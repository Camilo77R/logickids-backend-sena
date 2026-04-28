import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import { assertSessionBelongsToUser, assertStudentBelongsToUser } from './access.service.js';
import { actualizarStats } from './estadisticas.service.js';
import { evaluarLogrosSesion } from './logros.service.js';

/** Resuelve el ID de una tabla catálogo por su nombre usando la PK correcta */
const resolveCatalogId = async (table, pkColumn, nombre) => {
  const r = await db(table).where({ nombre }).select(pkColumn).first();
  if (!r) throw new AppError(`Valor '${nombre}' no encontrado en ${table}`, 400);
  return r[pkColumn];
};

/**
 * Inicia una sesión de juego para un estudiante.
 * Verifica que la sesión del aula esté activa antes de permitir el inicio.
 */
export const iniciar = async (estudiante_id, { minijuego_id }) => {
  const est = await db('estudiantes')
    .where({ id_estudiante: estudiante_id })
    .select('sesion_activa')
    .first();

  if (!est?.sesion_activa) {
    throw new AppError('Sesión no activa. El tutor debe abrir la clase primero.', 403);
  }

  const mini = await db('minijuegos')
    .where({ id_minijuego: minijuego_id, activo: true })
    .select('habilidad_id', 'dificultad_maxima')
    .first();

  if (!mini) throw new AppError('Minijuego no encontrado', 404);

  // --- CÁLCULO AUTOMÁTICO DE DIFICULTAD ---
  let dificultad = 1; // Por defecto inicia en nivel 1
  const stats = await db('estadisticas_habilidad')
    .where({ estudiante_id, habilidad_id: mini.habilidad_id })
    .first();

  if (stats && stats.total_intentos > 0) {
    const precision = Number(stats.precision_pct);
    if (precision >= 85) dificultad = Math.min(mini.dificultad_maxima, 4);
    else if (precision >= 65) dificultad = Math.min(mini.dificultad_maxima, 3);
    else if (precision >= 40) dificultad = Math.min(mini.dificultad_maxima, 2);
    else dificultad = 1;
  }

  // Si hay sesión activa previa, la abandona
  const activo_id = await resolveCatalogId('estados_sesion', 'id_estado_sesion', 'activo');
  const abandonado_id = await resolveCatalogId('estados_sesion', 'id_estado_sesion', 'abandonado');

  await db('sesiones_juego')
    .where({ estudiante_id, estado_id: activo_id })
    .update({ estado_id: abandonado_id, finalizada_en: db.fn.now() });

  const [sesion] = await db('sesiones_juego')
    .insert({ estudiante_id, minijuego_id, dificultad, estado_id: activo_id })
    .returning('*');

  return sesion;
};

/**
 * Registra un evento dentro de una sesión activa (acierto, error, combo, etc.)
 */
export const registrarEvento = async (sesion_id, estudiante_id, { tipo_evento, habilidad, tiempo_reaccion_ms, puntos, combo_en_evento }) => {
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

  const [evento] = await db('eventos_sesion')
    .insert({
      sesion_id,
      tipo_evento_id,
      habilidad_id,
      tiempo_reaccion_ms: tiempo_reaccion_ms ?? null,
      puntos: puntos ?? 0,
      combo_en_evento: combo_en_evento ?? 0,
    })
    .returning('id_evento_sesion');

  return evento;
};

/**
 * Finaliza una sesión guardando el resumen y actualizando estadísticas del estudiante.
 */
export const finalizar = async (sesion_id, estudiante_id, { puntaje, aciertos, errores, combo_maximo, dificultad, estado = 'completado' }) => {
  const sesion = await db('sesiones_juego')
    .where({ id_sesion_juego: sesion_id, estudiante_id })
    .first();
  if (!sesion) throw new AppError('Sesión no encontrada', 404);

  const estado_id = await resolveCatalogId('estados_sesion', 'id_estado_sesion', estado);

  const updateData = {
    estado_id,
    finalizada_en: db.fn.now(),
    puntaje: puntaje ?? 0,
    aciertos: aciertos ?? 0,
    errores: errores ?? 0,
    combo_maximo: combo_maximo ?? 0,
  };
  if (dificultad !== undefined) updateData.dificultad = dificultad;

  await db('sesiones_juego').where({ id_sesion_juego: sesion_id }).update(updateData);
  await actualizarStats(estudiante_id, sesion_id);
  await evaluarLogrosSesion(estudiante_id, {
    aciertos: updateData.aciertos,
    errores: updateData.errores,
    combo_maximo: updateData.combo_maximo,
    estado,
  });

  return db('sesiones_juego').where({ id_sesion_juego: sesion_id }).first();
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
    .where('sesiones_juego.estudiante_id', estudiante_id)
    .select(
      'sesiones_juego.id_sesion_juego as id',
      'sesiones_juego.dificultad',
      'sesiones_juego.puntaje',
      'sesiones_juego.aciertos',
      'sesiones_juego.errores',
      'sesiones_juego.combo_maximo',
      'sesiones_juego.iniciada_en',
      'sesiones_juego.finalizada_en',
      'estados_sesion.nombre as estado',
      'minijuegos.titulo as minijuego',
      'minijuegos.slug',
      'habilidades.nombre as habilidad'
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
      'eventos_sesion.ocurrido_en'
    )
    .orderBy('eventos_sesion.ocurrido_en', 'asc');
};