import { db } from '../config/db.js';
import {
  assertGroupBelongsToUser,
  assertStudentBelongsToUser,
} from './access.service.js';

/**
 * Query base: estadísticas_habilidad + nombre de habilidad.
 * Centraliza el join repetido en el servicio.
 */
const withHabilidad = (executor = db) =>
  executor('estadisticas_habilidad').join(
    'habilidades',
    'habilidades.id_habilidad',
    'estadisticas_habilidad.habilidad_id'
  );

/** Campos estándar de estadísticas devueltos en todas las respuestas */
const STAT_FIELDS = [
  'estadisticas_habilidad.id_estadistica as id',
  'estadisticas_habilidad.total_intentos',
  'estadisticas_habilidad.aciertos',
  'estadisticas_habilidad.errores',
  'estadisticas_habilidad.precision_pct',
  'estadisticas_habilidad.promedio_reaccion_ms',
  'estadisticas_habilidad.actualizado_en',
  'habilidades.nombre as habilidad',
  'habilidades.descripcion as habilidad_descripcion',
];

/**
 * Estadísticas acumuladas de un estudiante, validando que pertenezca al tutor.
 * Ordena de menor a mayor precisión para que la habilidad más débil aparezca primero.
 *
 * @param {number} estudiante_id
 * @param {object} user - Tutor o admin autenticado
 * @returns {Promise<Array>} Lista de estadísticas por habilidad
 * @throws {AppError} 403 si el estudiante no pertenece al tutor
 */
export const obtenerEstudiante = async (estudiante_id, user) => {
  await assertStudentBelongsToUser(estudiante_id, user);
  return listarStatsEstudiante(estudiante_id);
};

/**
 * Estadísticas del estudiante sin validación de ownership.
 * Usado internamente por el propio estudiante autenticado (HU-32, HU-45).
 *
 * @param {number} estudiante_id
 * @returns {Promise<Array>}
 */
export const listarStatsEstudiante = (estudiante_id) =>
  withHabilidad()
    .where('estadisticas_habilidad.estudiante_id', estudiante_id)
    .select(STAT_FIELDS)
    .orderBy('estadisticas_habilidad.precision_pct', 'asc');

/**
 * Estadísticas consolidadas del grupo: promedios por habilidad entre todos
 * los estudiantes activos. Útil para el dashboard del tutor (HU-29).
 *
 * @param {number} grupo_id
 * @param {object} user
 * @returns {Promise<Array>} Promedio de precisión y reacción por habilidad
 * @throws {AppError} 403 si el grupo no pertenece al tutor
 */
export const obtenerGrupo = async (grupo_id, user) => {
  await assertGroupBelongsToUser(grupo_id, user);

  return withHabilidad()
    .join(
      'estudiante_grupo_historial as egh',
      'egh.estudiante_id',
      'estadisticas_habilidad.estudiante_id'
    )
    .where({ 'egh.grupo_id': grupo_id, 'egh.activo': true })
    .whereNull('egh.fecha_fin')
    .select([
      'habilidades.id_habilidad',
      'habilidades.nombre as habilidad',
      db.raw('ROUND(AVG(estadisticas_habilidad.precision_pct), 2) as precision_promedio'),
      db.raw('ROUND(AVG(estadisticas_habilidad.promedio_reaccion_ms)) as reaccion_promedio'),
      db.raw('COUNT(DISTINCT estadisticas_habilidad.estudiante_id) as estudiantes_evaluados'),
    ])
    .groupBy('habilidades.id_habilidad', 'habilidades.nombre')
    .orderBy('precision_promedio', 'asc');
};

/**
 * Agrega los eventos de una sesión por habilidad.
 * Separa aciertos, errores y tiempos de reacción para calcular estadísticas.
 *
 * @param {Array} eventos - Eventos raw de la DB con tipo y habilidad_id
 * @returns {{ [habilidad_id]: { aciertos, errores, tiempos[] } }}
 */
const buildSkillAggregates = (eventos) => {
  const aggregates = {};

  for (const evento of eventos) {
    if (!aggregates[evento.habilidad_id]) {
      aggregates[evento.habilidad_id] = { aciertos: 0, errores: 0, tiempos: [] };
    }

    if (evento.tipo === 'acierto') {
      aggregates[evento.habilidad_id].aciertos += 1;
    } else {
      aggregates[evento.habilidad_id].errores += 1;
    }

    if (evento.tiempo_reaccion_ms != null) {
      aggregates[evento.habilidad_id].tiempos.push(evento.tiempo_reaccion_ms);
    }
  }

  return aggregates;
};

/**
 * Calcula el promedio aritmético de tiempos de reacción para una sesión.
 *
 * @param {number[]} tiempos - Array de tiempos en milisegundos
 * @returns {number|null} Promedio redondeado o null si no hay datos
 */
const calculateAverageReaction = (tiempos) => {
  if (!tiempos.length) return null;
  return Math.round(tiempos.reduce((sum, v) => sum + v, 0) / tiempos.length);
};

/**
 * Acumula los resultados de una sesión en el historial estadístico del estudiante.
 * Se llama automáticamente al finalizar cada partida.
 *
 * Usa media ponderada para `promedio_reaccion_ms`, evitando que una sesión
 * corta distorsione el historial acumulado:
 *   media_acum = (media_ant * n_ant + media_nueva * n_nueva) / (n_ant + n_nueva)
 *
 * Si es la primera sesión del estudiante en esa habilidad, inserta un nuevo registro.
 * Si ya existe, actualiza el acumulado con los nuevos datos.
 *
 * @param {number} estudiante_id
 * @param {number} sesion_id - ID de la sesión recién finalizada
 */
export const actualizarStats = async (estudiante_id, sesion_id, executor = db) => {
  const eventos = await executor('eventos_sesion')
    .join('tipos_evento', 'tipos_evento.id_tipo_evento', 'eventos_sesion.tipo_evento_id')
    .where('eventos_sesion.sesion_id', sesion_id)
    .whereNotNull('eventos_sesion.habilidad_id')
    .whereIn('tipos_evento.nombre', ['acierto', 'error'])
    .select(
      'eventos_sesion.habilidad_id',
      'tipos_evento.nombre as tipo',
      'eventos_sesion.tiempo_reaccion_ms'
    );

  const byHabilidad = buildSkillAggregates(eventos);

  for (const [habilidadId, skillStats] of Object.entries(byHabilidad)) {
    const habilidad_id = Number(habilidadId);
    const total_intentos = skillStats.aciertos + skillStats.errores;
    const promedio_reaccion_ms = calculateAverageReaction(skillStats.tiempos);

    const existing = await executor('estadisticas_habilidad')
      .where({ estudiante_id, habilidad_id })
      .first();

    // Primera sesión en esta habilidad → insertar registro nuevo
    if (!existing) {
      const precision_pct = total_intentos > 0
        ? ((skillStats.aciertos / total_intentos) * 100).toFixed(2)
        : '0.00';

      await executor('estadisticas_habilidad').insert({
        estudiante_id,
        habilidad_id,
        total_intentos,
        aciertos: skillStats.aciertos,
        errores: skillStats.errores,
        precision_pct,
        promedio_reaccion_ms,
      });

      continue;
    }

    // Sesión subsiguiente → acumular sobre el histórico
    const nuevo_total_intentos = existing.total_intentos + total_intentos;
    const nuevos_aciertos = existing.aciertos + skillStats.aciertos;
    const nuevos_errores = existing.errores + skillStats.errores;
    const precision_pct = nuevo_total_intentos > 0
      ? ((nuevos_aciertos / nuevo_total_intentos) * 100).toFixed(2)
      : '0.00';

    /**
     * Media ponderada: evita que sesiones pequeñas distorsionen el promedio acumulado.
     * Si alguno de los dos valores es null (sesión sin datos de tiempo), se conserva el que existe.
     */
    const promedio_acumulado =
      existing.promedio_reaccion_ms != null && promedio_reaccion_ms != null
        ? Math.round(
            (existing.promedio_reaccion_ms * existing.total_intentos +
              promedio_reaccion_ms * total_intentos) /
              nuevo_total_intentos
          )
        : promedio_reaccion_ms ?? existing.promedio_reaccion_ms;

    await executor('estadisticas_habilidad')
      .where({ id_estadistica: existing.id_estadistica })
      .update({
        total_intentos: nuevo_total_intentos,
        aciertos: nuevos_aciertos,
        errores: nuevos_errores,
        precision_pct,
        promedio_reaccion_ms: promedio_acumulado,
        actualizado_en: executor.fn.now(),
      });
  }
};
