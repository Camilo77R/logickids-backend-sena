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

/** Resuelve el ID de una tabla catálogo por su nombre usando la PK correcta */
const resolveCatalogId = async (table, pkColumn, nombre, executor = db) => {
  const r = await executor(table).where({ nombre }).select(pkColumn).first();
  if (!r) throw new AppError(`Valor '${nombre}' no encontrado en ${table}`, 400);
  return r[pkColumn];
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
const resolvePlayableStudentContext = async (estudiante_id) =>
  db('estudiantes')
    .join('estados_estudiante', 'estados_estudiante.id_estado_estudiante', 'estudiantes.estado_id')
    .leftJoin('instituciones', 'instituciones.id_institucion', 'estudiantes.institucion_id')
    .leftJoin('estudiante_grupo_historial as egh', function joinCurrentGroup() {
      this.on('egh.estudiante_id', 'estudiantes.id_estudiante')
        .andOn('egh.activo', db.raw('TRUE'))
        .andOnNull('egh.fecha_fin');
    })
    .leftJoin('grupos', 'grupos.id_grupo', 'egh.grupo_id')
    .leftJoin('sesiones_clase as sc', function joinActiveClassSession() {
      this.on('sc.grupo_id', 'egh.grupo_id').andOn('sc.estado', db.raw('?', ['activa']));
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

const resolveMinijuegoCatalog = async (minijuego_id) => {
  const minijuego = await db('minijuegos')
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

const resolveSuggestedDifficulty = async (estudiante_id, minijuego) => {
  const stats = await db('estadisticas_habilidad')
    .where({ estudiante_id, habilidad_id: minijuego.habilidad_id })
    .first();

  if (!stats || stats.total_intentos <= 0) {
    return 1;
  }

  const precision = Number(stats.precision_pct);
  if (precision >= 85) return Math.min(minijuego.dificultad_maxima, 4);
  if (precision >= 65) return Math.min(minijuego.dificultad_maxima, 3);
  if (precision >= 40) return Math.min(minijuego.dificultad_maxima, 2);
  return 1;
};

const resolveInitialDifficulty = async (estudiante_id, minijuego, requestedDifficulty) => {
  if (requestedDifficulty == null) {
    return resolveSuggestedDifficulty(estudiante_id, minijuego);
  }

  if (requestedDifficulty > minijuego.dificultad_maxima) {
    throw new AppError(
      `La dificultad solicitada supera el máximo permitido para ${minijuego.titulo}`,
      400
    );
  }

  return requestedDifficulty;
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

  const updateData = {
    estado_id,
    finalizada_en: executor.fn.now(),
    puntaje: officialSummary.puntaje,
    aciertos: officialSummary.aciertos,
    errores: officialSummary.errores,
    combo_maximo: officialSummary.combo_maximo,
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
      await cerrarSesionClaseSiTermino(sesionExistente.sesion_clase_id, executor);
    }
  }

  const sesion = await executor('sesiones_juego').where({ id_sesion_juego: sesion_id }).first();
  return {
    ...sesion,
    resumen_oficial: officialSummary,
    logros_desbloqueados,
    progreso_ruta,
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
});

/**
 * Inicia una sesión de juego para un estudiante.
 * Verifica que la sesión del aula esté activa antes de permitir el inicio.
 */
export const iniciar = async (estudiante_id, { minijuego_id, dificultad: requestedDifficulty }) => {
  const playableContext = await resolvePlayableStudentContext(estudiante_id);
  assertPlayableStudentContext(playableContext);

  const configuredMinigameId = playableContext.sesion_minijuego_id ?? null;
  const selectedMinigameId = configuredMinigameId ?? minijuego_id ?? null;

  if (!selectedMinigameId) {
    throw new AppError('La sesión del grupo no tiene un minijuego configurado todavía', 409);
  }

  if (configuredMinigameId && minijuego_id && configuredMinigameId !== minijuego_id) {
    throw new AppError('El grupo fue abierto para un minijuego diferente al solicitado', 409);
  }

  const minijuego = await resolveMinijuegoCatalog(selectedMinigameId);
  const dificultad = await resolveInitialDifficulty(estudiante_id, minijuego, requestedDifficulty);
  const fuenteAdaptacion = requestedDifficulty == null ? 'reglas' : 'base';
  const gameConfig = buildGameConfig(
    playableContext.grupo_id,
    minijuego,
    dificultad,
    playableContext.sesion_configuracion_base
  );

  await marcarParticipanteEnProgreso(
    {
      sesionClaseId: playableContext.sesion_clase_id,
      estudianteId: estudiante_id,
    }
  );

  const sesion = await openStudentGameSession({
    estudiante_id,
    minijuego_id: minijuego.id,
    dificultad,
    sesion_clase_id: playableContext.sesion_clase_id,
    orden_en_ruta: playableContext.sesion_paso_actual ?? 1,
    configuracion_aplicada: gameConfig,
    fuente_adaptacion: fuenteAdaptacion,
    executor: db,
  });

  return buildSessionStartResponse({
    sesion,
    grupoId: playableContext.grupo_id,
    minijuego,
    dificultad,
    sesionClaseId: playableContext.sesion_clase_id,
    sesionModo: playableContext.sesion_modo,
    rutaPedagogicaId: playableContext.sesion_ruta_id,
    ordenEnRuta: playableContext.sesion_paso_actual ?? 1,
    bloqueActual: playableContext.sesion_bloque_actual ?? 1,
    nivelEnBloque: playableContext.sesion_nivel_en_bloque ?? 1,
    gameConfig,
  });
};

/**
 * Registra un evento dentro de una sesión activa (acierto, error, combo, etc.)
 */
export const registrarEvento = async (
  sesion_id,
  estudiante_id,
  { tipo_evento, habilidad, tiempo_reaccion_ms, puntos, combo_en_evento, metadata }
) => {
  const sesion = await db('sesiones_juego')
    .where({ id_sesion_juego: sesion_id, estudiante_id })
    .first();
  if (!sesion) throw new AppError('Sesión no encontrada', 404);

  const activo_id = await resolveCatalogId('estados_sesion', 'id_estado_sesion', 'activo');
  if (sesion.estado_id !== activo_id) throw new AppError('La sesión ya no está activa', 409);

  const tipo_evento_id = await resolveCatalogId('tipos_evento', 'id_tipo_evento', tipo_evento);

  let habilidad_id = null;
  if (habilidad) {
    const habilidadRecord = await db('habilidades')
      .where({ nombre: habilidad })
      .select('id_habilidad')
      .first();

    if (!habilidadRecord) {
      throw new AppError(`La habilidad '${habilidad}' no existe`, 400);
    }

    habilidad_id = habilidadRecord.id_habilidad;
  }

  if (sesion.sesion_clase_id != null) {
    const sesionClase = await db('sesiones_clase')
      .where({ id_sesion_clase: sesion.sesion_clase_id })
      .select('estado')
      .first();

    if (!sesionClase || sesionClase.estado !== 'activa') {
      throw new AppError('La clase ya no está activa para seguir registrando eventos', 409);
    }
  }

  const [evento] = await db('eventos_sesion')
    .insert({
      sesion_id,
      tipo_evento_id,
      habilidad_id,
      tiempo_reaccion_ms: tiempo_reaccion_ms ?? null,
      puntos: puntos ?? 0,
      combo_en_evento: combo_en_evento ?? 0,
      metadata: metadata ?? {},
    })
    .returning('id_evento_sesion');

  return evento;
};

/**
 * Finaliza una sesión usando el resumen oficial calculado desde eventos persistidos.
 */
export const finalizar = async (
  sesion_id,
  estudiante_id,
  { estado = 'completado', cerrarSesionClase = true } = {},
  executor = db
) => {
  if (executor === db) {
    return db.transaction((trx) =>
      finalizarSesionInterna(sesion_id, estudiante_id, { estado, cerrarSesionClase }, trx)
    );
  }

  return finalizarSesionInterna(
    sesion_id,
    estudiante_id,
    { estado, cerrarSesionClase },
    executor
  );
};

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
      'eventos_sesion.metadata',
      'eventos_sesion.ocurrido_en'
    )
    .orderBy('eventos_sesion.ocurrido_en', 'asc');
};
