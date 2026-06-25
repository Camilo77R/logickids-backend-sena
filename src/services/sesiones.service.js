import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import { assertSessionBelongsToUser, assertStudentBelongsToUser } from './access.service.js';
import { actualizarStats } from './estadisticas.service.js';
import { evaluarLogrosSesion } from './logros.service.js';
import {
  avanzarParticipacionSesionClase,
  cerrarSesionClaseSiTermino,
  ESTADOS_PARTICIPANTE_SESION,
  esEstadoParticipanteTerminal,
  marcarParticipanteEnProgreso,
} from './sesionesClase.service.js';
import {
  buildCodigoEstelarGameConfig,
  buildRoomKey,
  CODIGO_ESTELAR_SLUG,
  CODIGO_ESTELAR_SOCKET_EVENTS,
} from '../games/codigoEstelar/codigoEstelar.config.js';
import {
  buildCaminoArGameConfig,
  CAMINO_AR_SLUG,
} from '../games/caminoAr/caminoAr.config.js';
import {
  buildMercadoInteligenteGameConfig,
  MERCADO_INTELIGENTE_SLUG,
} from '../games/mercadoInteligente/mercadoInteligente.config.js';
import {
  publishClassSessionChanged,
  publishRankingUpdated,
  publishStudentAccessChanged,
} from '../realtime/realtime.events.js';
import { executeIdempotent } from './student-idempotency.service.js';

/** Resuelve el ID de una tabla catálogo por su nombre usando la PK correcta */
const resolveCatalogId = async (table, pkColumn, nombre, executor = db) => {
  const r = await executor(table).where({ nombre }).select(pkColumn).first();
  if (!r) throw new AppError(`Valor '${nombre}' no encontrado en ${table}`, 400);
  return r[pkColumn];
};

const ESTRELLAS_MINIMAS = 0;
const ESTRELLAS_MAXIMAS = 3;

const clampStars = (stars) =>
  Math.max(ESTRELLAS_MINIMAS, Math.min(ESTRELLAS_MAXIMAS, Number(stars) || 0));

/**
 * Calcula estrellas oficiales para cualquier minijuego.
 *
 * PARETO:
 * - la DB guarda intentos y resultado oficial
 * - el backend traduce eso a una recompensa simple 0..3
 * - la UI solo muestra esa recompensa, no la inventa
 */
const calcularEstrellasSesion = ({ aciertos = 0, errores = 0, estado = 'completado' }) => {
  if (estado !== 'completado') {
    return ESTRELLAS_MINIMAS;
  }

  const totalIntentos = aciertos + errores;
  if (totalIntentos <= 0 || aciertos <= 0) {
    return ESTRELLAS_MINIMAS;
  }

  const precision = aciertos / totalIntentos;

  if (precision >= 0.9) {
    return ESTRELLAS_MAXIMAS;
  }

  if (precision >= 0.7) {
    return 2;
  }

  return 1;
};

const SOCKET_EVENTS_BY_SLUG = Object.freeze({
  [CODIGO_ESTELAR_SLUG]: CODIGO_ESTELAR_SOCKET_EVENTS,
});

/**
 * Relee el estado vivo del estudiante y de su contexto de juego.
 *
 * POR QUÉ:
 * - `requireEstudiante` ya valida identidad, estado e institución
 * - aun así, este servicio vuelve a consultar la base para aplicar defensa en
 *   profundidad y para resolver el grupo activo con el que se armará la sala
 */
const resolvePlayableStudentContext = async (estudiante_id, executor = db) =>
  executor('estudiantes')
    .join('estados_estudiante', 'estados_estudiante.id_estado_estudiante', 'estudiantes.estado_id')
    .leftJoin('instituciones', 'instituciones.id_institucion', 'estudiantes.institucion_id')
    .leftJoin('estudiante_grupo_historial as egh', function joinCurrentGroup() {
      this.on('egh.estudiante_id', 'estudiantes.id_estudiante')
        .andOn('egh.activo', executor.raw('TRUE'))
        .andOnNull('egh.fecha_fin');
    })
    .leftJoin('grupos', 'grupos.id_grupo', 'egh.grupo_id')
    .leftJoin('sesiones_clase as sc', function joinActiveClassSession() {
      this.on('sc.grupo_id', 'egh.grupo_id').andOn('sc.estado', executor.raw('?', ['activa']));
    })
    .leftJoin('sesion_clase_participantes as participante', function joinParticipantSnapshot() {
      this.on('participante.sesion_clase_id', 'sc.id_sesion_clase')
        .andOn('participante.estudiante_id', 'estudiantes.id_estudiante');
    })
    .leftJoin('sesion_clase_pasos as paso', function joinCurrentStep() {
      this.on('paso.sesion_clase_id', 'sc.id_sesion_clase')
        .andOn('paso.orden', 'participante.paso_actual');
    })
    .where('estudiantes.id_estudiante', estudiante_id)
    .select(
      'estudiantes.id_estudiante',
      'estudiantes.institucion_id',
      'estados_estudiante.nombre as estado',
      'instituciones.activo as institucion_activa',
      'egh.grupo_id',
      'grupos.activo as grupo_activo',
      'sc.id_sesion_clase as sesion_clase_id',
      'sc.modo as sesion_modo',
      'sc.ruta_pedagogica_id as sesion_ruta_id',
      'participante.estado as sesion_participante_estado',
      'participante.paso_actual as sesion_paso_actual',
      'paso.bloque_orden as sesion_bloque_actual',
      'paso.nivel_en_bloque as sesion_nivel_en_bloque',
      'paso.minijuego_id as sesion_minijuego_id',
      'paso.configuracion_base as sesion_configuracion_base'
    )
    .first();

const assertPlayableStudentContext = (context) => {
  if (!context) {
    throw new AppError('Estudiante no encontrado', 404);
  }

  if (context.estado !== 'activo') {
    throw new AppError('La cuenta del estudiante no está habilitada', 403);
  }

  if (context.institucion_id != null && context.institucion_activa === false) {
    throw new AppError('La institución del estudiante está desactivada', 403);
  }

  if (!context.grupo_id || context.grupo_activo === false) {
    throw new AppError('El estudiante no tiene un grupo activo habilitado para jugar', 403);
  }

  if (!context.sesion_clase_id) {
    throw new AppError('Sesión no activa. El tutor debe abrir la clase primero.', 403);
  }

  if (!context.sesion_participante_estado) {
    throw new AppError('El estudiante no hace parte de la sesión activa de su grupo', 403);
  }

  if (esEstadoParticipanteTerminal(context.sesion_participante_estado)) {
    throw new AppError('La actividad actual ya fue completada o cerrada para este estudiante', 409);
  }
};

const lockParticipantTurn = ({ sesionClaseId, estudianteId }, executor = db) =>
  executor('sesion_clase_participantes')
    .where({
      sesion_clase_id: sesionClaseId,
      estudiante_id: estudianteId,
    })
    .forUpdate()
    .first();

const resolveMinijuegoCatalog = async (minijuego_id, executor = db) => {
  const minijuego = await executor('minijuegos')
    .join('habilidades', 'habilidades.id_habilidad', 'minijuegos.habilidad_id')
    .where({
      'minijuegos.id_minijuego': minijuego_id,
      'minijuegos.activo': true,
    })
    .select(
      'minijuegos.id_minijuego as id',
      'minijuegos.slug',
      'minijuegos.titulo',
      'minijuegos.habilidad_id',
      'minijuegos.dificultad_maxima',
      'habilidades.nombre as habilidad'
    )
    .first();

  if (!minijuego) {
    throw new AppError('Minijuego no encontrado', 404);
  }

  return minijuego;
};

const resolveSuggestedDifficulty = async (estudiante_id, minijuego, executor = db) => {
  const stats = await executor('estadisticas_habilidad')
    .where({ estudiante_id, habilidad_id: minijuego.habilidad_id })
    .first();

  const recentSessions = await executor('sesiones_juego')
    .join('estados_sesion', 'estados_sesion.id_estado_sesion', 'sesiones_juego.estado_id')
    .where({
      'sesiones_juego.estudiante_id': estudiante_id,
      'sesiones_juego.minijuego_id': minijuego.id,
    })
    .whereIn('estados_sesion.nombre', ['completado', 'abandonado'])
    .select(
      'sesiones_juego.dificultad',
      'sesiones_juego.aciertos',
      'sesiones_juego.errores',
      'sesiones_juego.puntaje',
      'sesiones_juego.combo_maximo',
      'sesiones_juego.estrellas_obtenidas',
      'sesiones_juego.finalizada_en',
      'estados_sesion.nombre as estado'
    )
    .orderBy('sesiones_juego.finalizada_en', 'desc')
    .limit(3);

  if (!stats || stats.total_intentos <= 0) {
    return {
      dificultad: 1,
      fuente: 'reglas',
      motivo: 'Primera experiencia o sin estadisticas suficientes para esta habilidad.',
      metricas: {
        habilidad: minijuego.habilidad,
        total_intentos: 0,
        sesiones_recientes: 0,
      },
    };
  }

  const precision = Number(stats.precision_pct);
  const totalAttempts = Number(stats.total_intentos ?? 0);
  const averageReaction = Number(stats.promedio_reaccion_ms ?? 0);
  const lastSession = recentSessions[0] ?? null;
  const lastDifficulty = Number(lastSession?.dificultad ?? 1);
  const recentCompleted = recentSessions.filter((session) => session.estado === 'completado');
  const recentAcciertos = recentSessions.reduce((sum, session) => sum + Number(session.aciertos ?? 0), 0);
  const recentErrores = recentSessions.reduce((sum, session) => sum + Number(session.errores ?? 0), 0);
  const recentTotal = recentAcciertos + recentErrores;
  const recentPrecision = recentTotal > 0 ? (recentAcciertos / recentTotal) * 100 : precision;
  const strongStreak =
    recentCompleted.length >= 2 &&
    recentCompleted.slice(0, 2).every((session) => {
      const attempts = Number(session.aciertos ?? 0) + Number(session.errores ?? 0);
      if (attempts === 0) return false;
      return (Number(session.aciertos ?? 0) / attempts) * 100 >= 80;
    });

  let nextDifficulty = lastDifficulty;
  let motivo = 'Se mantiene la dificultad para consolidar la habilidad.';

  if (totalAttempts < 8) {
    nextDifficulty = Math.min(Math.max(lastDifficulty, 1), minijuego.dificultad_maxima);
    motivo = 'Aun hay pocos intentos acumulados; se evita subir dificultad hasta tener mas evidencia.';
  } else if (precision >= 85 && recentPrecision >= 80 && strongStreak) {
    nextDifficulty = lastDifficulty + 1;
    motivo = 'Sube un nivel por alta precision historica y buen rendimiento en sesiones recientes.';
  } else if (precision < 50 || recentPrecision < 45) {
    nextDifficulty = lastDifficulty - 1;
    motivo = 'Baja un nivel porque la precision indica que necesita refuerzo previo.';
  } else if (precision >= 70 && recentPrecision >= 65 && averageReaction > 0 && averageReaction <= 2500) {
    nextDifficulty = lastDifficulty;
    motivo = 'Mantiene dificultad: hay progreso, pero conviene afianzar antes de subir.';
  } else if (precision >= 65) {
    nextDifficulty = Math.max(lastDifficulty, 2);
    motivo = 'Ajuste moderado por precision aceptable en la habilidad.';
  } else {
    nextDifficulty = Math.min(lastDifficulty, 2);
    motivo = 'Se prioriza practica guiada porque la precision aun esta en refuerzo.';
  }

  const dificultad = Math.max(1, Math.min(minijuego.dificultad_maxima, nextDifficulty));

  return {
    dificultad,
    fuente: 'reglas',
    motivo,
    metricas: {
      habilidad: minijuego.habilidad,
      precision_historica: precision,
      precision_reciente: Number(recentPrecision.toFixed(2)),
      total_intentos: totalAttempts,
      aciertos: Number(stats.aciertos ?? 0),
      errores: Number(stats.errores ?? 0),
      promedio_reaccion_ms: stats.promedio_reaccion_ms,
      sesiones_recientes: recentSessions.length,
      ultima_dificultad: lastDifficulty,
      dificultad_maxima: minijuego.dificultad_maxima,
      racha_fuerte: strongStreak,
    },
  };
};

const resolveInitialDifficulty = async (
  estudiante_id,
  minijuego,
  requestedDifficulty,
  executor = db
) => {
  if (requestedDifficulty == null) {
    return resolveSuggestedDifficulty(estudiante_id, minijuego, executor);
  }

  if (requestedDifficulty > minijuego.dificultad_maxima) {
    throw new AppError(
      `La dificultad solicitada supera el máximo permitido para ${minijuego.titulo}`,
      400
    );
  }

  return {
    dificultad: requestedDifficulty,
    fuente: 'base',
    motivo: 'Dificultad solicitada explicitamente por el cliente o tutor.',
    metricas: {
      habilidad: minijuego.habilidad,
      dificultad_solicitada: requestedDifficulty,
      dificultad_maxima: minijuego.dificultad_maxima,
    },
  };
};

const buildRealtimeConfig = (grupoId, minijuegoSlug) => {
  const socketEvents = SOCKET_EVENTS_BY_SLUG[minijuegoSlug];

  if (!socketEvents) {
    return {
      room_key: null,
      socket_events: {},
    };
  }

  return {
    room_key: buildRoomKey(grupoId, minijuegoSlug),
    socket_events: socketEvents,
  };
};

const buildGameConfig = (grupoId, minijuego, dificultad, configuracionBase = {}) => {
  const configuracionNormalizada =
    configuracionBase && typeof configuracionBase === 'object' && !Array.isArray(configuracionBase)
      ? configuracionBase
      : {};

  switch (minijuego.slug) {
    case CODIGO_ESTELAR_SLUG:
      return {
        ...buildCodigoEstelarGameConfig(grupoId, dificultad),
        ...configuracionNormalizada,
        dificultad,
      };
    case CAMINO_AR_SLUG:
      return buildCaminoArGameConfig(dificultad, configuracionNormalizada);
    case MERCADO_INTELIGENTE_SLUG:
      return buildMercadoInteligenteGameConfig(dificultad, configuracionNormalizada);
    default:
      return { ...configuracionNormalizada, dificultad };
  }
};

const buildSessionStartResponse = ({
  sesion,
  grupoId,
  minijuego,
  dificultad,
  sesionClaseId,
  sesionModo,
  rutaPedagogicaId,
  ordenEnRuta,
  bloqueActual,
  nivelEnBloque,
  gameConfig,
}) => ({
  sesion: {
    id: sesion.id_sesion_juego,
    sesion_clase_id: sesionClaseId,
    estado: 'activo',
    dificultad,
    minijuego_id: minijuego.id,
    minijuego_slug: minijuego.slug,
    modo: sesionModo,
    ruta_pedagogica_id: rutaPedagogicaId,
    orden_en_ruta: ordenEnRuta,
    bloque_orden: bloqueActual,
    nivel_en_bloque: nivelEnBloque,
  },
  realtime: buildRealtimeConfig(grupoId, minijuego.slug),
  game_config: gameConfig,
});

const resolveRealtimeClassContext = async (sesionClaseId, executor = db) =>
  executor('sesiones_clase as sc')
    .join('grupos as grupo', 'grupo.id_grupo', 'sc.grupo_id')
    .where('sc.id_sesion_clase', sesionClaseId)
    .select(
      'sc.id_sesion_clase as sesion_clase_id',
      'sc.grupo_id',
      'grupo.institucion_id',
      'grupo.tutor_asignado_id'
    )
    .first();

const emitPostFinalizationRealtimeUpdates = async ({ result, studentId, executor = db }) => {
  if (result.finalizacion_idempotente || result.sesion_clase_id == null) {
    return;
  }

  const realtimeContext = await resolveRealtimeClassContext(result.sesion_clase_id, executor);
  if (!realtimeContext) {
    return;
  }

  const commonPayload = {
    institucionId: realtimeContext.institucion_id ?? null,
    grupoId: realtimeContext.grupo_id,
    sesionClaseId: realtimeContext.sesion_clase_id,
    tutorId: realtimeContext.tutor_asignado_id ?? null,
    studentId,
  };

  publishRankingUpdated({
    ...commonPayload,
    reason: 'session_finalized',
  });

  publishStudentAccessChanged({
    ...commonPayload,
    reason: 'session_finalized',
  });

  if (result.sesion_clase_cerrada) {
    publishClassSessionChanged({
      ...commonPayload,
      sessionState: 'cerrada',
      reason: 'finalizada',
    });
  }
};

const openStudentGameSession = async ({
  estudiante_id,
  minijuego_id,
  dificultad,
  sesion_clase_id,
  orden_en_ruta,
  configuracion_aplicada,
  fuente_adaptacion,
  executor = db,
}) => {
  const activo_id = await resolveCatalogId('estados_sesion', 'id_estado_sesion', 'activo', executor);
  const abandonado_id = await resolveCatalogId(
    'estados_sesion',
    'id_estado_sesion',
    'abandonado',
    executor
  );

  const sesionActivaMismaActividad = await executor('sesiones_juego')
    .where({
      estudiante_id,
      estado_id: activo_id,
      sesion_clase_id,
      orden_en_ruta,
      minijuego_id,
    })
    .orderBy('id_sesion_juego', 'desc')
    .first();

  if (sesionActivaMismaActividad) {
    await executor('sesiones_juego')
      .where({ estudiante_id, estado_id: activo_id })
      .whereNot({ id_sesion_juego: sesionActivaMismaActividad.id_sesion_juego })
      .update({ estado_id: abandonado_id, finalizada_en: executor.fn.now() });

    return sesionActivaMismaActividad;
  }

  await executor('sesiones_juego')
    .where({ estudiante_id, estado_id: activo_id })
    .update({ estado_id: abandonado_id, finalizada_en: executor.fn.now() });

  const [sesion] = await executor('sesiones_juego')
    .insert({
      estudiante_id,
      minijuego_id,
      dificultad,
      estado_id: activo_id,
      sesion_clase_id,
      orden_en_ruta,
      configuracion_aplicada,
      fuente_adaptacion,
    })
    .returning('*');

  return sesion;
};

const finalizarSesionInterna = async (
  sesion_id,
  estudiante_id,
  { estado = 'completado', cerrarSesionClase = true } = {},
  executor = db
) => {
  const sesionExistente = await resolveSessionForFinalization(sesion_id, estudiante_id, executor);
  if (!sesionExistente) {
    throw new AppError('Sesión no encontrada', 404);
  }

  if (sesionExistente.estado !== 'activo') {
    const sesionPersistida = await executor('sesiones_juego')
      .where({ id_sesion_juego: sesion_id })
      .first();
    return {
      ...sesionPersistida,
      resumen_oficial: buildPersistedOfficialSummary(sesionPersistida),
      logros_desbloqueados: [],
      finalizacion_idempotente: true,
    };
  }

  const estado_id = await resolveCatalogId('estados_sesion', 'id_estado_sesion', estado, executor);
  const officialSummary = await buildOfficialSessionSummary(sesion_id, executor);
  const estrellas_obtenidas = calcularEstrellasSesion({
    ...officialSummary,
    estado,
  });

  const updateData = {
    estado_id,
    finalizada_en: executor.fn.now(),
    puntaje: officialSummary.puntaje,
    aciertos: officialSummary.aciertos,
    errores: officialSummary.errores,
    combo_maximo: officialSummary.combo_maximo,
    estrellas_obtenidas,
  };

  await executor('sesiones_juego').where({ id_sesion_juego: sesion_id }).update(updateData);
  await actualizarStats(estudiante_id, sesion_id, executor);

  const logros_desbloqueados = await evaluarLogrosSesion(
    estudiante_id,
    {
      aciertos: officialSummary.aciertos,
      errores: officialSummary.errores,
      combo_maximo: officialSummary.combo_maximo,
      estado,
    },
    executor
  );

  let progreso_ruta = null;
  let sesion_clase_cerrada = false;
  if (sesionExistente.sesion_clase_id != null) {
    progreso_ruta = await avanzarParticipacionSesionClase(
      {
        sesionClaseId: sesionExistente.sesion_clase_id,
        estudianteId: estudiante_id,
        ordenActual: sesionExistente.orden_en_ruta,
        estadoFinal: estado,
      },
      executor
    );

    if (cerrarSesionClase) {
      sesion_clase_cerrada = await cerrarSesionClaseSiTermino(
        sesionExistente.sesion_clase_id,
        executor
      );
    }
  }

  const sesion = await executor('sesiones_juego').where({ id_sesion_juego: sesion_id }).first();
  return {
    ...sesion,
    resumen_oficial: {
      ...officialSummary,
      estrellas_obtenidas,
    },
    logros_desbloqueados,
    progreso_ruta,
    sesion_clase_cerrada,
    finalizacion_idempotente: false,
  };
};

const resolveSessionForFinalization = async (sesion_id, estudiante_id, executor = db) =>
  executor('sesiones_juego')
    .join('estados_sesion', 'estados_sesion.id_estado_sesion', 'sesiones_juego.estado_id')
    .where({
      'sesiones_juego.id_sesion_juego': sesion_id,
      'sesiones_juego.estudiante_id': estudiante_id,
    })
    .select(
      'sesiones_juego.id_sesion_juego',
      'sesiones_juego.estudiante_id',
      'sesiones_juego.dificultad',
      'sesiones_juego.sesion_clase_id',
      'sesiones_juego.orden_en_ruta',
      'sesiones_juego.estado_id',
      'estados_sesion.nombre as estado'
    )
    .forUpdate('sesiones_juego')
    .first();

/**
 * Construye el resumen oficial de una sesion a partir de eventos ya persistidos.
 *
 * ANALOGIA:
 * en vez de preguntarle al jugador cuanto cree que hizo, miramos la hoja del
 * arbitro donde quedaron anotadas todas las jugadas.
 */
const buildOfficialSessionSummary = async (sesion_id, executor = db) => {
  const eventos = await executor('eventos_sesion')
    .join('tipos_evento', 'tipos_evento.id_tipo_evento', 'eventos_sesion.tipo_evento_id')
    .where('eventos_sesion.sesion_id', sesion_id)
    .select(
      'tipos_evento.nombre as tipo_evento',
      'eventos_sesion.puntos',
      'eventos_sesion.combo_en_evento'
    );

  return eventos.reduce(
    (summary, evento) => {
      summary.puntaje += Number(evento.puntos ?? 0);
      summary.combo_maximo = Math.max(summary.combo_maximo, Number(evento.combo_en_evento ?? 0));

      if (evento.tipo_evento === 'acierto') {
        summary.aciertos += 1;
      }

      if (evento.tipo_evento === 'error') {
        summary.errores += 1;
      }

      return summary;
    },
    {
      puntaje: 0,
      aciertos: 0,
      errores: 0,
      combo_maximo: 0,
    }
  );
};

const buildPersistedOfficialSummary = (sesion) => ({
  puntaje: Number(sesion.puntaje ?? 0),
  aciertos: Number(sesion.aciertos ?? 0),
  errores: Number(sesion.errores ?? 0),
  combo_maximo: Number(sesion.combo_maximo ?? 0),
  estrellas_obtenidas: clampStars(sesion.estrellas_obtenidas),
});

/**
 * Inicia una sesión de juego para un estudiante.
 * Verifica que la sesión del aula esté activa antes de permitir el inicio.
 */
export const iniciar = async (
  estudiante_id,
  { minijuego_id, dificultad: requestedDifficulty, attempt_id }
) => {
  return db.transaction(async (trx) => {
    const idempotency = await executeIdempotent(
      {
        estudianteId: estudiante_id,
        operacion: 'attempt',
        key: attempt_id,
        payload: { minijuego_id, dificultad: requestedDifficulty },
        executor: trx,
      },
      async () => {
    let playableContext = await resolvePlayableStudentContext(estudiante_id, trx);
    assertPlayableStudentContext(playableContext);

    await lockParticipantTurn(
      {
        sesionClaseId: playableContext.sesion_clase_id,
        estudianteId: estudiante_id,
      },
      trx
    );

    playableContext = await resolvePlayableStudentContext(estudiante_id, trx);
    assertPlayableStudentContext(playableContext);

    const configuredMinigameId = playableContext.sesion_minijuego_id ?? null;
    const selectedMinigameId = configuredMinigameId ?? minijuego_id ?? null;

    if (!selectedMinigameId) {
      throw new AppError('La sesión del grupo no tiene un minijuego configurado todavía', 409);
    }

    if (configuredMinigameId && minijuego_id && configuredMinigameId !== minijuego_id) {
      throw new AppError('El grupo fue abierto para un minijuego diferente al solicitado', 409);
    }

    const minijuego = await resolveMinijuegoCatalog(selectedMinigameId, trx);
    const adaptationDecision = await resolveInitialDifficulty(
      estudiante_id,
      minijuego,
      requestedDifficulty,
      trx
    );
    const dificultad = adaptationDecision.dificultad;
    const fuenteAdaptacion = adaptationDecision.fuente;
    const gameConfig = buildGameConfig(
      playableContext.grupo_id,
      minijuego,
      dificultad,
      playableContext.sesion_configuracion_base
    );
    const appliedConfig = {
      ...gameConfig,
      adaptacion: {
        fuente: adaptationDecision.fuente,
        motivo: adaptationDecision.motivo,
        metricas: adaptationDecision.metricas,
      },
    };

    await marcarParticipanteEnProgreso(
      {
        sesionClaseId: playableContext.sesion_clase_id,
        estudianteId: estudiante_id,
      },
      trx
    );

    const sesion = await openStudentGameSession({
      estudiante_id,
      minijuego_id: minijuego.id,
      dificultad,
      sesion_clase_id: playableContext.sesion_clase_id,
      orden_en_ruta: playableContext.sesion_paso_actual ?? 1,
      configuracion_aplicada: appliedConfig,
      fuente_adaptacion: fuenteAdaptacion,
      executor: trx,
    });

    const effectiveDifficulty = Number(sesion.dificultad ?? dificultad);
    const effectiveGameConfig =
      sesion.configuracion_aplicada &&
      typeof sesion.configuracion_aplicada === 'object' &&
      !Array.isArray(sesion.configuracion_aplicada)
        ? sesion.configuracion_aplicada
        : appliedConfig;

    return buildSessionStartResponse({
      sesion,
      grupoId: playableContext.grupo_id,
      minijuego,
      dificultad: effectiveDifficulty,
      sesionClaseId: playableContext.sesion_clase_id,
      sesionModo: playableContext.sesion_modo,
      rutaPedagogicaId: playableContext.sesion_ruta_id,
      ordenEnRuta: playableContext.sesion_paso_actual ?? 1,
      bloqueActual: playableContext.sesion_bloque_actual ?? 1,
      nivelEnBloque: playableContext.sesion_nivel_en_bloque ?? 1,
      gameConfig: effectiveGameConfig,
    });
      }
    );

    return idempotency.value;
  });
};

/**
 * Registra un evento dentro de una sesión activa (acierto, error, combo, etc.)
 */
export const registrarEvento = async (
  sesion_id,
  estudiante_id,
  {
    event_id,
    sequence,
    tipo_evento,
    habilidad,
    tiempo_reaccion_ms,
    puntos,
    combo_en_evento,
    metadata,
  }
) => {
  return db.transaction(async (trx) => {
    const idempotency = await executeIdempotent(
      {
        estudianteId: estudiante_id,
        operacion: 'event',
        key: event_id,
        payload: {
          sesion_id,
          sequence,
          tipo_evento,
          habilidad,
          tiempo_reaccion_ms,
          puntos,
          combo_en_evento,
          metadata,
        },
        executor: trx,
      },
      async () => {
  const sesion = await trx('sesiones_juego')
    .where({ id_sesion_juego: sesion_id, estudiante_id })
    .forUpdate()
    .first();
  if (!sesion) throw new AppError('Sesión no encontrada', 404);

  const activo_id = await resolveCatalogId('estados_sesion', 'id_estado_sesion', 'activo', trx);
  if (sesion.estado_id !== activo_id) throw new AppError('La sesión ya no está activa', 409);

  if (sequence != null) {
    const existingSequence = await trx('eventos_sesion')
      .where({ sesion_id, client_sequence: sequence })
      .select('id_evento_sesion')
      .first();

    if (existingSequence) {
      throw new AppError('La secuencia del evento ya fue utilizada', 409, {
        code: 'IDEMPOTENCY_CONFLICT',
      });
    }
  }

  const tipo_evento_id = await resolveCatalogId(
    'tipos_evento',
    'id_tipo_evento',
    tipo_evento,
    trx
  );

  let habilidad_id = null;
  if (habilidad) {
    const habilidadRecord = await trx('habilidades')
      .where({ nombre: habilidad })
      .select('id_habilidad')
      .first();

    if (!habilidadRecord) {
      throw new AppError(`La habilidad '${habilidad}' no existe`, 400);
    }

    habilidad_id = habilidadRecord.id_habilidad;
  }

  if (sesion.sesion_clase_id != null) {
    const sesionClase = await trx('sesiones_clase')
      .where({ id_sesion_clase: sesion.sesion_clase_id })
      .select('estado')
      .first();

    if (!sesionClase || sesionClase.estado !== 'activa') {
      throw new AppError('La clase ya no está activa para seguir registrando eventos', 409);
    }
  }

  const [evento] = await trx('eventos_sesion')
    .insert({
      sesion_id,
      client_sequence: sequence ?? null,
      tipo_evento_id,
      habilidad_id,
      tiempo_reaccion_ms: tiempo_reaccion_ms ?? null,
      puntos: puntos ?? 0,
      combo_en_evento: combo_en_evento ?? 0,
      metadata: metadata ?? {},
    })
    .returning('id_evento_sesion');

  return evento;
      }
    );

    return idempotency.value;
  });
};

/**
 * Finaliza una sesión usando el resumen oficial calculado desde eventos persistidos.
 */
export const finalizar = async (
  sesion_id,
  estudiante_id,
  options = {},
  executor = db
) => {
  const {
    estado = 'completado',
    cerrarSesionClase = true,
    finalization_id,
  } = options;

  if (executor === db) {
    const idempotency = await db.transaction((trx) =>
      executeIdempotent(
        {
          estudianteId: estudiante_id,
          operacion: 'finalization',
          key: finalization_id,
          payload: { sesion_id, ...options },
          executor: trx,
        },
        () => finalizarSesionInterna(
          sesion_id,
          estudiante_id,
          { estado, cerrarSesionClase },
          trx
        )
      )
    );

    if (!idempotency.replayed) {
      await emitPostFinalizationRealtimeUpdates({
        result: idempotency.value,
        studentId: estudiante_id,
      });
    }
    return idempotency.value;
  }

  return finalizarSesionInterna(
    sesion_id,
    estudiante_id,
    { estado, cerrarSesionClase },
    executor
  );
};

export const obtenerCheckpoint = async (sesion_id, estudiante_id) => {
  const session = await db('sesiones_juego')
    .where({ id_sesion_juego: sesion_id, estudiante_id })
    .select('id_sesion_juego')
    .first();
  if (!session) throw new AppError('Sesión no encontrada', 404);

  const checkpoint = await db('student_game_checkpoints')
    .where({ sesion_id, estudiante_id })
    .first();

  return checkpoint
    ? {
        session_id: sesion_id,
        version: checkpoint.version,
        state: checkpoint.estado,
        updated_at: checkpoint.actualizada_en,
      }
    : { session_id: sesion_id, version: 0, state: {}, updated_at: null };
};

export const guardarCheckpoint = async (
  sesion_id,
  estudiante_id,
  { expected_version, state }
) =>
  db.transaction(async (trx) => {
    const session = await trx('sesiones_juego as sj')
      .join('estados_sesion as es', 'es.id_estado_sesion', 'sj.estado_id')
      .where({
        'sj.id_sesion_juego': sesion_id,
        'sj.estudiante_id': estudiante_id,
      })
      .select('sj.id_sesion_juego', 'es.nombre as estado')
      .forUpdate('sj')
      .first();

    if (!session) throw new AppError('Sesión no encontrada', 404);
    if (session.estado !== 'activo') {
      throw new AppError('La sesión ya no está activa', 409, {
        code: 'GAME_SESSION_NOT_ACTIVE',
      });
    }

    const current = await trx('student_game_checkpoints')
      .where({ sesion_id, estudiante_id })
      .forUpdate()
      .first();
    const currentVersion = Number(current?.version ?? 0);

    if (currentVersion !== expected_version) {
      throw new AppError('El checkpoint fue actualizado por otra solicitud', 409, {
        code: 'CHECKPOINT_VERSION_CONFLICT',
        current_version: currentVersion,
        current_checkpoint: current?.estado ?? {},
      });
    }

    const nextVersion = currentVersion + 1;
    const [saved] = current
      ? await trx('student_game_checkpoints')
          .where({ sesion_id, estudiante_id, version: expected_version })
          .update({
            version: nextVersion,
            estado: state,
            actualizada_en: trx.fn.now(),
          })
          .returning('*')
      : await trx('student_game_checkpoints')
          .insert({
            sesion_id,
            estudiante_id,
            version: nextVersion,
            estado: state,
          })
          .returning('*');

    return {
      session_id: sesion_id,
      version: saved.version,
      state: saved.estado,
      updated_at: saved.actualizada_en,
    };
  });

/**
 * Finaliza en lote varias sesiones autoritativas de una misma sala.
 *
 * POR QUE:
 * cuando el servidor declara `game_over`, no conviene depender de que cada
 * celular recuerde cerrar su sesion individual despues.
 */
export const finalizarSesionesAutoritativas = async (
  sessions,
  { estado = 'completado' } = {}
) => {
  const results = [];

  for (const session of sessions) {
    const result = await finalizar(session.sesionId, session.estudianteId, { estado });
    results.push(result);
  }

  return results;
};

export const abandonarSesionesActivasDeClase = async (
  sesionClaseId,
  { estadoSesionJuego = 'abandonado' } = {},
  executor = db
) => {
  const activoId = await resolveCatalogId('estados_sesion', 'id_estado_sesion', 'activo', executor);
  const sessions = await executor('sesiones_juego')
    .where({
      sesion_clase_id: sesionClaseId,
      estado_id: activoId,
    })
    .select('id_sesion_juego as sesionId', 'estudiante_id as estudianteId');

  const resultados = [];
  for (const session of sessions) {
    const resultado = await finalizar(
      session.sesionId,
      session.estudianteId,
      { estado: estadoSesionJuego, cerrarSesionClase: false },
      executor
    );
    resultados.push(resultado);
  }

  return resultados;
};


/**
 * Historial de sesiones de un estudiante para el dashboard del tutor.
 */
export const historial = async (estudiante_id, user) => {
  await assertStudentBelongsToUser(estudiante_id, user);
  return listarHistorialEstudiante(estudiante_id);
};

export const listarHistorialEstudiante = (estudiante_id) =>
  db('sesiones_juego')
    .join('minijuegos', 'minijuegos.id_minijuego', 'sesiones_juego.minijuego_id')
    .join('habilidades', 'habilidades.id_habilidad', 'minijuegos.habilidad_id')
    .join('estados_sesion', 'estados_sesion.id_estado_sesion', 'sesiones_juego.estado_id')
    .leftJoin('sesiones_clase as sc', 'sc.id_sesion_clase', 'sesiones_juego.sesion_clase_id')
    .leftJoin('rutas_pedagogicas as ruta', 'ruta.id_ruta_pedagogica', 'sc.ruta_pedagogica_id')
    .leftJoin('sesion_clase_pasos as paso', function joinPasoHistorial() {
      this.on('paso.sesion_clase_id', 'sesiones_juego.sesion_clase_id').andOn(
        'paso.orden',
        'sesiones_juego.orden_en_ruta'
      );
    })
    .where('sesiones_juego.estudiante_id', estudiante_id)
    .select(
      'sesiones_juego.id_sesion_juego as id',
      'sesiones_juego.dificultad',
      'sesiones_juego.puntaje',
      'sesiones_juego.aciertos',
      'sesiones_juego.errores',
      'sesiones_juego.combo_maximo',
      'sesiones_juego.estrellas_obtenidas',
      'sesiones_juego.sesion_clase_id',
      'sesiones_juego.orden_en_ruta',
      'sc.modo as sesion_modo',
      'sc.ruta_pedagogica_id as sesion_ruta_id',
      'ruta.nombre as sesion_ruta_nombre',
      'paso.bloque_orden',
      'paso.nivel_en_bloque',
      'sesiones_juego.fuente_adaptacion',
      'sesiones_juego.iniciada_en',
      'sesiones_juego.finalizada_en',
      'estados_sesion.nombre as estado',
      'minijuegos.titulo as minijuego',
      'minijuegos.slug',
      'habilidades.nombre as habilidad',
      db.raw(
        '(SELECT COUNT(*) FROM sesion_clase_pasos pasos WHERE pasos.sesion_clase_id = sesiones_juego.sesion_clase_id) as sesion_total_pasos'
      )
    )
    .orderBy('sesiones_juego.iniciada_en', 'desc')
    .limit(50);

/**
 * Detalle evento a evento de una sesión.
 */
export const detalleEventos = async (sesion_id, user) => {
  await assertSessionBelongsToUser(sesion_id, user);

  return db('eventos_sesion')
    .join('tipos_evento', 'tipos_evento.id_tipo_evento', 'eventos_sesion.tipo_evento_id')
    .leftJoin('habilidades', 'habilidades.id_habilidad', 'eventos_sesion.habilidad_id')
    .where('eventos_sesion.sesion_id', sesion_id)
    .select(
      'eventos_sesion.id_evento_sesion as id',
      'tipos_evento.nombre as tipo_evento',
      'habilidades.nombre as habilidad',
      'eventos_sesion.tiempo_reaccion_ms',
      'eventos_sesion.puntos',
      'eventos_sesion.combo_en_evento',
      'eventos_sesion.client_sequence as sequence',
      'eventos_sesion.metadata',
      'eventos_sesion.ocurrido_en'
    )
    .orderByRaw('eventos_sesion.client_sequence ASC NULLS LAST')
    .orderBy('eventos_sesion.ocurrido_en', 'asc');
};
