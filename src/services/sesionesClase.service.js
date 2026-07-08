import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import { obtenerRutaPedagogicaActivaPorId } from './rutasPedagogicas.service.js';

export const MODOS_SESION_CLASE = Object.freeze({
  single: 'single',
  path: 'path',
});

export const ESTADOS_SESION_CLASE = Object.freeze({
  activa: 'activa',
  cerrada: 'cerrada',
  cancelada: 'cancelada',
});

export const ESTADOS_PARTICIPANTE_SESION = Object.freeze({
  pendiente: 'pendiente',
  enProgreso: 'en_progreso',
  completado: 'completado',
  abandonado: 'abandonado',
  cerrado: 'cerrado',
});

const ESTADOS_PARTICIPANTE_TERMINALES = new Set([
  ESTADOS_PARTICIPANTE_SESION.completado,
  ESTADOS_PARTICIPANTE_SESION.abandonado,
  ESTADOS_PARTICIPANTE_SESION.cerrado,
]);

export const esEstadoParticipanteTerminal = (estado) =>
  ESTADOS_PARTICIPANTE_TERMINALES.has(estado);

const CAMPOS_BASE_SESION_CLASE = [
  'id_sesion_clase as id',
  'grupo_id',
  'tutor_responsable_id',
  'abierta_por_usuario_id',
  'ruta_pedagogica_id',
  'modo',
  'estado',
  'abierta_en',
  'cerrada_en',
  'cierre_motivo',
  'actualizada_en',
];

const MAX_PASOS_POR_SESION = 25;
const DEFAULT_NIVELES_SINGLE = 3;
const MAX_NIVELES_POR_BLOQUE = 10;

const normalizarConfiguracionBase = (configuracionBase) => {
  if (!configuracionBase || typeof configuracionBase !== 'object' || Array.isArray(configuracionBase)) {
    return {};
  }

  return configuracionBase;
};

const resolveMinijuegosActivos = async (minijuegoIds, executor = db) => {
  const idsUnicos = [...new Set(minijuegoIds)];
  const minijuegos = await executor('minijuegos')
    .whereIn('id_minijuego', idsUnicos)
    .where({ activo: true })
    .select('id_minijuego as id', 'slug', 'titulo');

  if (minijuegos.length !== idsUnicos.length) {
    throw new AppError('Uno o más minijuegos no están disponibles para abrir la sesión', 404);
  }

  const byId = new Map(minijuegos.map((minijuego) => [minijuego.id, minijuego]));
  return minijuegoIds.map((id) => byId.get(id));
};

const normalizeNiveles = (niveles, fieldName = 'niveles') => {
  const normalized = niveles ?? DEFAULT_NIVELES_SINGLE;

  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new AppError(`El campo ${fieldName} debe ser un entero positivo`, 400);
  }

  if (normalized > MAX_NIVELES_POR_BLOQUE) {
    throw new AppError(
      `El campo ${fieldName} no puede superar ${MAX_NIVELES_POR_BLOQUE} niveles`,
      400
    );
  }

  return normalized;
};

const expandBloqueEnPasos = ({ bloqueOrden, minijuego, niveles, configuracionBase }) =>
  Array.from({ length: niveles }, (_unused, index) => ({
    bloque_orden: bloqueOrden,
    nivel_en_bloque: index + 1,
    minijuego_id: minijuego.id,
    minijuego_slug: minijuego.slug,
    minijuego_titulo: minijuego.titulo,
    configuracion_base: normalizarConfiguracionBase(configuracionBase),
  }));

const buildPasosConOrdenGlobal = (pasosSinOrden) =>
  pasosSinOrden.map((paso, index) => ({
    ...paso,
    orden: index + 1,
  }));

export const resolvePlanSesionClase = async (
  { modo, minijuego_id, niveles, ruta_id },
  executor = db
) => {
  if (!Object.values(MODOS_SESION_CLASE).includes(modo)) {
    throw new AppError('El modo de sesión solicitado no es válido', 400);
  }

  if (modo === MODOS_SESION_CLASE.single) {
    const minijuegoId = Number(minijuego_id);
    if (!Number.isInteger(minijuegoId) || minijuegoId <= 0) {
      throw new AppError('Debes indicar un minijuego válido para abrir una sesión single', 400);
    }

    const totalNiveles = normalizeNiveles(niveles, 'niveles');
    const [minijuego] = await resolveMinijuegosActivos([minijuegoId], executor);
    const pasos = buildPasosConOrdenGlobal(
      expandBloqueEnPasos({
        bloqueOrden: 1,
        minijuego,
        niveles: totalNiveles,
        configuracionBase: {},
      })
    );

    return {
      modo,
      ruta_pedagogica_id: null,
      pasos,
    };
  }

  const route = await obtenerRutaPedagogicaActivaPorId(ruta_id, executor);
  const pasos = buildPasosConOrdenGlobal(
    route.bloques.flatMap((bloque) =>
      expandBloqueEnPasos({
        bloqueOrden: bloque.orden,
        minijuego: {
          id: bloque.minijuego_id,
          slug: bloque.minijuego_slug,
          titulo: bloque.minijuego_titulo,
        },
        niveles: normalizeNiveles(bloque.niveles, `niveles del bloque ${bloque.orden}`),
        configuracionBase: bloque.configuracion_base,
      })
    )
  );

  if (pasos.length < 2) {
    throw new AppError('Una sesión path requiere al menos dos niveles en total', 400);
  }

  if (pasos.length > MAX_PASOS_POR_SESION) {
    throw new AppError(
      `La sesión no puede tener más de ${MAX_PASOS_POR_SESION} pasos configurados`,
      400
    );
  }

  return {
    modo,
    ruta_pedagogica_id: route.id,
    ruta_pedagogica_slug: route.slug,
    ruta_pedagogica_nombre: route.nombre,
    pasos,
  };
};

export const obtenerSesionClaseActivaPorGrupo = (grupoId, executor = db) =>
  executor('sesiones_clase')
    .where({
      grupo_id: grupoId,
      estado: ESTADOS_SESION_CLASE.activa,
    })
    .select(CAMPOS_BASE_SESION_CLASE)
    .first();

export const listarPasosSesionClase = (sesionClaseId, executor = db) =>
  executor('sesion_clase_pasos')
    .join('minijuegos', 'minijuegos.id_minijuego', 'sesion_clase_pasos.minijuego_id')
    .where('sesion_clase_pasos.sesion_clase_id', sesionClaseId)
    .select(
      'sesion_clase_pasos.id_sesion_clase_paso as id',
      'sesion_clase_pasos.orden',
      'sesion_clase_pasos.bloque_orden',
      'sesion_clase_pasos.nivel_en_bloque',
      'sesion_clase_pasos.minijuego_id',
      'sesion_clase_pasos.configuracion_base',
      'minijuegos.slug',
      'minijuegos.titulo'
    )
    .orderBy('sesion_clase_pasos.orden', 'asc');

export const obtenerPasoSesionClase = async (sesionClaseId, orden, executor = db) =>
  executor('sesion_clase_pasos')
    .join('minijuegos', 'minijuegos.id_minijuego', 'sesion_clase_pasos.minijuego_id')
    .where({
      'sesion_clase_pasos.sesion_clase_id': sesionClaseId,
      'sesion_clase_pasos.orden': orden,
    })
    .select(
      'sesion_clase_pasos.id_sesion_clase_paso as id',
      'sesion_clase_pasos.orden',
      'sesion_clase_pasos.bloque_orden',
      'sesion_clase_pasos.nivel_en_bloque',
      'sesion_clase_pasos.minijuego_id',
      'sesion_clase_pasos.configuracion_base',
      'minijuegos.slug',
      'minijuegos.titulo'
    )
    .first();

export const crearSesionClase = async (
  {
    grupoId,
    tutorResponsableId,
    abiertaPorUsuarioId,
    estudianteIds,
    planSesion,
  },
  executor = db
) => {
  const [sesionClase] = await executor('sesiones_clase')
    .insert({
      grupo_id: grupoId,
      tutor_responsable_id: tutorResponsableId,
      abierta_por_usuario_id: abiertaPorUsuarioId,
      ruta_pedagogica_id: planSesion.ruta_pedagogica_id ?? null,
      modo: planSesion.modo,
      estado: ESTADOS_SESION_CLASE.activa,
    })
    .returning(CAMPOS_BASE_SESION_CLASE);

  await executor('sesion_clase_pasos').insert(
    planSesion.pasos.map((paso) => ({
      sesion_clase_id: sesionClase.id,
      orden: paso.orden,
      bloque_orden: paso.bloque_orden,
      nivel_en_bloque: paso.nivel_en_bloque,
      minijuego_id: paso.minijuego_id,
      configuracion_base: paso.configuracion_base ?? {},
    }))
  );

  await executor('sesion_clase_participantes').insert(
    estudianteIds.map((estudianteId) => ({
      sesion_clase_id: sesionClase.id,
      estudiante_id: estudianteId,
      estado: ESTADOS_PARTICIPANTE_SESION.pendiente,
      paso_actual: 1,
    }))
  );

  return {
    ...sesionClase,
    pasos: planSesion.pasos,
    participantes_totales: estudianteIds.length,
  };
};

export const obtenerResumenSesionActivaParaGrupo = async (grupoId, executor = db) =>
  executor('sesiones_clase as sc')
    .leftJoin('rutas_pedagogicas as ruta', 'ruta.id_ruta_pedagogica', 'sc.ruta_pedagogica_id')
    .join('sesion_clase_pasos as paso', function joinPrimerPaso() {
      this.on('paso.sesion_clase_id', 'sc.id_sesion_clase').andOn('paso.orden', db.raw('1'));
    })
    .join('minijuegos as m', 'm.id_minijuego', 'paso.minijuego_id')
    .where({
      'sc.grupo_id': grupoId,
      'sc.estado': ESTADOS_SESION_CLASE.activa,
    })
    .select(
      'sc.id_sesion_clase as sesion_clase_id',
      'sc.modo as sesion_modo',
      'sc.ruta_pedagogica_id as sesion_ruta_id',
      'ruta.slug as sesion_ruta_slug',
      'ruta.nombre as sesion_ruta_nombre',
      'paso.minijuego_id as sesion_minijuego_id',
      'm.slug as sesion_minijuego_slug',
      'm.titulo as sesion_minijuego_titulo',
      db.raw(
        '(SELECT COUNT(*) FROM sesion_clase_pasos pasos WHERE pasos.sesion_clase_id = sc.id_sesion_clase) as sesion_total_pasos'
      )
    )
    .first();

export const obtenerResumenSesionActivaParaEstudiante = async (
  { grupoId, estudianteId },
  executor = db
) =>
  executor('sesiones_clase as sc')
    .leftJoin('rutas_pedagogicas as ruta', 'ruta.id_ruta_pedagogica', 'sc.ruta_pedagogica_id')
    .join('sesion_clase_participantes as participante', function joinParticipante() {
      this.on('participante.sesion_clase_id', 'sc.id_sesion_clase')
        .andOn('participante.estudiante_id', db.raw('?', [estudianteId]));
    })
    .join('sesion_clase_pasos as paso', function joinPasoActual() {
      this.on('paso.sesion_clase_id', 'sc.id_sesion_clase')
        .andOn('paso.orden', 'participante.paso_actual');
    })
    .join('minijuegos as m', 'm.id_minijuego', 'paso.minijuego_id')
    .where({
      'sc.grupo_id': grupoId,
      'sc.estado': ESTADOS_SESION_CLASE.activa,
    })
    .select(
      'sc.id_sesion_clase as sesion_clase_id',
      'sc.modo as sesion_modo',
      'sc.ruta_pedagogica_id as sesion_ruta_id',
      'ruta.slug as sesion_ruta_slug',
      'ruta.nombre as sesion_ruta_nombre',
      'participante.estado as sesion_participante_estado',
      'participante.paso_actual as sesion_paso_actual',
      'paso.bloque_orden as sesion_bloque_actual',
      'paso.nivel_en_bloque as sesion_nivel_en_bloque',
      'paso.minijuego_id as sesion_minijuego_id',
      'm.slug as sesion_minijuego_slug',
      'm.titulo as sesion_minijuego_titulo',
      'paso.configuracion_base as sesion_configuracion_base',
      db.raw(
        '(SELECT COUNT(*) FROM sesion_clase_pasos pasos WHERE pasos.sesion_clase_id = sc.id_sesion_clase) as sesion_total_pasos'
      )
    )
    .first();

export const marcarParticipanteEnProgreso = async (
  { sesionClaseId, estudianteId },
  executor = db
) => {
  const [participante] = await executor('sesion_clase_participantes')
    .where({
      sesion_clase_id: sesionClaseId,
      estudiante_id: estudianteId,
    })
    .whereNotIn('estado', [
      ESTADOS_PARTICIPANTE_SESION.completado,
      ESTADOS_PARTICIPANTE_SESION.abandonado,
      ESTADOS_PARTICIPANTE_SESION.cerrado,
    ])
    .update({
      estado: ESTADOS_PARTICIPANTE_SESION.enProgreso,
      iniciada_en: executor.raw('COALESCE(iniciada_en, now())'),
    })
    .returning([
      'sesion_clase_id',
      'estudiante_id',
      'estado',
      'paso_actual',
      'iniciada_en',
      'finalizada_en',
    ]);

  return participante ?? null;
};

export const avanzarParticipacionSesionClase = async (
  { sesionClaseId, estudianteId, ordenActual, estadoFinal },
  executor = db
) => {
  const pasoSiguiente = await obtenerPasoSesionClase(sesionClaseId, ordenActual + 1, executor);

  if (estadoFinal !== 'completado') {
    await executor('sesion_clase_participantes')
      .where({
        sesion_clase_id: sesionClaseId,
        estudiante_id: estudianteId,
      })
      .update({
        estado: ESTADOS_PARTICIPANTE_SESION.abandonado,
        finalizada_en: executor.fn.now(),
      });

    return { haySiguientePaso: false, participanteEstado: ESTADOS_PARTICIPANTE_SESION.abandonado };
  }

  if (pasoSiguiente) {
    await executor('sesion_clase_participantes')
      .where({
        sesion_clase_id: sesionClaseId,
        estudiante_id: estudianteId,
      })
      .update({
        estado: ESTADOS_PARTICIPANTE_SESION.pendiente,
        paso_actual: pasoSiguiente.orden,
      });

    return {
      haySiguientePaso: true,
      siguientePaso: pasoSiguiente,
      participanteEstado: ESTADOS_PARTICIPANTE_SESION.pendiente,
    };
  }

  await executor('sesion_clase_participantes')
    .where({
      sesion_clase_id: sesionClaseId,
      estudiante_id: estudianteId,
    })
    .update({
      estado: ESTADOS_PARTICIPANTE_SESION.completado,
      finalizada_en: executor.fn.now(),
    });

  return { haySiguientePaso: false, participanteEstado: ESTADOS_PARTICIPANTE_SESION.completado };
};

export const cerrarSesionClaseSiTermino = async (sesionClaseId, executor = db) => {
  const pendiente = await executor('sesion_clase_participantes')
    .where({ sesion_clase_id: sesionClaseId })
    .whereIn('estado', [
      ESTADOS_PARTICIPANTE_SESION.pendiente,
      ESTADOS_PARTICIPANTE_SESION.enProgreso,
    ])
    .first();

  if (pendiente) {
    return false;
  }

  const [sesionActualizada] = await executor('sesiones_clase')
    .where({
      id_sesion_clase: sesionClaseId,
      estado: ESTADOS_SESION_CLASE.activa,
    })
    .update({
      estado: ESTADOS_SESION_CLASE.cerrada,
      cerrada_en: executor.fn.now(),
      cierre_motivo: 'finalizada',
      actualizada_en: executor.fn.now(),
    })
    .returning(CAMPOS_BASE_SESION_CLASE);

  return Boolean(sesionActualizada);
};

export const cerrarSesionClasePorGrupo = async (
  { grupoId, estado = ESTADOS_SESION_CLASE.cerrada, cierreMotivo = 'manual' },
  executor = db
) => {
  const sesionActiva = await obtenerSesionClaseActivaPorGrupo(grupoId, executor);
  if (!sesionActiva) {
    return null;
  }

  await executor('sesion_clase_participantes')
    .where({ sesion_clase_id: sesionActiva.id })
    .whereIn('estado', [
      ESTADOS_PARTICIPANTE_SESION.pendiente,
      ESTADOS_PARTICIPANTE_SESION.enProgreso,
    ])
    .update({
      estado: ESTADOS_PARTICIPANTE_SESION.cerrado,
      finalizada_en: executor.fn.now(),
    });

  const [sesionCerrada] = await executor('sesiones_clase')
    .where({ id_sesion_clase: sesionActiva.id })
    .update({
      estado,
      cerrada_en: executor.fn.now(),
      cierre_motivo: cierreMotivo,
      actualizada_en: executor.fn.now(),
    })
    .returning(CAMPOS_BASE_SESION_CLASE);

  return sesionCerrada ?? null;
};
