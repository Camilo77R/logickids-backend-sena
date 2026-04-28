import { db } from '../config/db.js';
import {
  assertGroupBelongsToUser,
  assertStudentBelongsToUser,
} from './access.service.js';

const withHabilidad = () =>
  db('estadisticas_habilidad').join(
    'habilidades',
    'habilidades.id_habilidad',
    'estadisticas_habilidad.habilidad_id'
  );

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
 * Estadísticas acumuladas de un estudiante.
 */
export const obtenerEstudiante = async (estudiante_id, user) => {
  await assertStudentBelongsToUser(estudiante_id, user);
  return listarStatsEstudiante(estudiante_id);
};

export const listarStatsEstudiante = (estudiante_id) =>
  withHabilidad()
    .where('estadisticas_habilidad.estudiante_id', estudiante_id)
    .select(STAT_FIELDS)
    .orderBy('estadisticas_habilidad.precision_pct', 'asc');

/**
 * Promedio de desempeño del grupo actual.
 */
export const obtenerGrupo = async (grupo_id, user) => {
  await assertGroupBelongsToUser(grupo_id, user);

  return withHabilidad()
    .join(
      'estudiante_grupo_historial as egh',
      'egh.estudiante_id',
      'estadisticas_habilidad.estudiante_id'
    )
    .where({
      'egh.grupo_id': grupo_id,
      'egh.activo': true,
    })
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

const buildSkillAggregates = (eventos) => {
  const aggregates = {};

  for (const evento of eventos) {
    if (!aggregates[evento.habilidad_id]) {
      aggregates[evento.habilidad_id] = {
        aciertos: 0,
        errores: 0,
        tiempos: [],
      };
    }

    if (evento.tipo === 'acierto') {
      aggregates[evento.habilidad_id].aciertos += 1;
    } else {
      aggregates[evento.habilidad_id].errores += 1;
    }

    if (evento.tiempo_reaccion_ms !== null && evento.tiempo_reaccion_ms !== undefined) {
      aggregates[evento.habilidad_id].tiempos.push(evento.tiempo_reaccion_ms);
    }
  }

  return aggregates;
};

const calculateAverageReaction = (tiempos) => {
  if (!tiempos.length) {
    return null;
  }

  const total = tiempos.reduce((sum, value) => sum + value, 0);
  return Math.round(total / tiempos.length);
};

/**
 * Acumula resultados de la sesión dentro del histórico del estudiante.
 */
export const actualizarStats = async (estudiante_id, sesion_id) => {
  const eventos = await db('eventos_sesion')
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

    const existing = await db('estadisticas_habilidad')
      .where({ estudiante_id, habilidad_id })
      .first();

    if (!existing) {
      const precision_pct = total_intentos > 0
        ? ((skillStats.aciertos / total_intentos) * 100).toFixed(2)
        : '0.00';

      await db('estadisticas_habilidad').insert({
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

    const nuevo_total_intentos = existing.total_intentos + total_intentos;
    const nuevos_aciertos = existing.aciertos + skillStats.aciertos;
    const nuevos_errores = existing.errores + skillStats.errores;
    const precision_pct = nuevo_total_intentos > 0
      ? ((nuevos_aciertos / nuevo_total_intentos) * 100).toFixed(2)
      : '0.00';

    const promedio_acumulado = existing.promedio_reaccion_ms !== null && existing.promedio_reaccion_ms !== undefined && promedio_reaccion_ms !== null
      ? Math.round((existing.promedio_reaccion_ms + promedio_reaccion_ms) / 2)
      : promedio_reaccion_ms ?? existing.promedio_reaccion_ms;

    await db('estadisticas_habilidad')
      .where({ id_estadistica: existing.id_estadistica })
      .update({
        total_intentos: nuevo_total_intentos,
        aciertos: nuevos_aciertos,
        errores: nuevos_errores,
        precision_pct,
        promedio_reaccion_ms: promedio_acumulado,
        actualizado_en: db.fn.now(),
      });
  }
};