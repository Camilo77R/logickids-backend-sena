import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../middlewares/errorHandler.js';
import {
  assertGroupBelongsToUser,
  assertStudentBelongsToUser,
} from './access.service.js';

const DEFAULT_MODEL_NAME = 'gemini-1.5-flash';

const buildStudentPrompt = (nombre, stats) => {
  const lineas = stats
    .map(
      (stat) =>
        `- ${stat.habilidad}: ${stat.precision_pct}% de precisión, ${stat.promedio_reaccion_ms ?? 'N/A'} ms de reacción promedio y ${stat.total_intentos} intentos`
    )
    .join('\n');

  return `Eres un pedagogo experto en educación infantil de 7 a 12 años.
El estudiante "${nombre}" tiene estas estadísticas por habilidad cognitiva:
${lineas}
Genera una recomendación pedagógica personalizada en español para el tutor.
Indica qué habilidad necesita más refuerzo, qué actividades puede aplicar y cómo interpretar la velocidad de respuesta.
Máximo 3 párrafos claros y accionables.`;
};

const buildGroupPrompt = (grupo, stats) => {
  const lineas = stats
    .map(
      (stat) =>
        `- ${stat.habilidad}: ${stat.precision_promedio}% de precisión promedio, ${stat.reaccion_promedio ?? 'N/A'} ms de reacción promedio y ${stat.estudiantes_evaluados} estudiantes evaluados`
    )
    .join('\n');

  return `Eres un pedagogo experto en educación infantil de 7 a 12 años.
El grupo "${grupo}" tiene estas estadísticas colectivas:
${lineas}
Genera una recomendación pedagógica grupal en español para el tutor.
Resume fortalezas, debilidades y una estrategia concreta de refuerzo para el aula.
Máximo 3 párrafos claros y accionables.`;
};

const resolveSeverityId = async (precision) => {
  let severityName = 'baja';

  if (precision < 40) {
    severityName = 'alta';
  } else if (precision < 65) {
    severityName = 'media';
  }

  const severity = await db('niveles_severidad')
    .where({ nombre: severityName })
    .select('id_nivel_severidad')
    .first();

  if (!severity) {
    throw new AppError('No se pudo resolver la severidad de la recomendación', 500);
  }

  return severity.id_nivel_severidad;
};

const resolveDefaultModelId = async () => {
  const model = await db('modelos_ia')
    .where({ nombre: DEFAULT_MODEL_NAME, activo: true })
    .select('id_modelo_ia')
    .first();

  return model?.id_modelo_ia ?? null;
};

const pickWeakestSkill = (stats, precisionField) =>
  [...stats].sort((left, right) => Number(left[precisionField]) - Number(right[precisionField]))[0];

const listRecommendationFields = [
  'recomendaciones.id_recomendacion as id',
  'recomendaciones.estudiante_id',
  'recomendaciones.grupo_id',
  'recomendaciones.mensaje',
  'recomendaciones.precision_momento',
  'recomendaciones.generado_en',
  'recomendaciones.activo',
  'niveles_severidad.nombre as severidad',
  'habilidades.nombre as habilidad',
  'modelos_ia.nombre as modelo_ia',
];

const callGemini = async (prompt) => {
  if (!env.GEMINI_API_KEY) {
    return '[Recomendación simulada]\n\nSe recomienda reforzar la habilidad con menor precisión mediante actividades graduales, dar más tiempo en los ejercicios donde la reacción es lenta y revisar el progreso después de varias sesiones para ajustar la dificultad.';
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL_NAME}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!response.ok) {
    throw new AppError('Error al generar la recomendación con IA', 502);
  }

  const json = await response.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Sin respuesta de la IA';
};

const fetchStudentStats = (estudiante_id) =>
  db('estadisticas_habilidad')
    .join('habilidades', 'habilidades.id_habilidad', 'estadisticas_habilidad.habilidad_id')
    .where('estadisticas_habilidad.estudiante_id', estudiante_id)
    .select(
      'estadisticas_habilidad.habilidad_id',
      'estadisticas_habilidad.precision_pct',
      'estadisticas_habilidad.promedio_reaccion_ms',
      'estadisticas_habilidad.total_intentos',
      'habilidades.nombre as habilidad'
    );

const fetchGroupStats = (grupo_id) =>
  db('estadisticas_habilidad')
    .join('habilidades', 'habilidades.id_habilidad', 'estadisticas_habilidad.habilidad_id')
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
    .select(
      'habilidades.id_habilidad',
      'habilidades.nombre as habilidad',
      db.raw('ROUND(AVG(estadisticas_habilidad.precision_pct), 2) as precision_promedio'),
      db.raw('ROUND(AVG(estadisticas_habilidad.promedio_reaccion_ms)) as reaccion_promedio'),
      db.raw('COUNT(DISTINCT estadisticas_habilidad.estudiante_id) as estudiantes_evaluados')
    )
    .groupBy('habilidades.id_habilidad', 'habilidades.nombre');

const loadRecommendationById = (id_recomendacion) =>
  db('recomendaciones')
    .join(
      'niveles_severidad',
      'niveles_severidad.id_nivel_severidad',
      'recomendaciones.severidad_id'
    )
    .leftJoin('habilidades', 'habilidades.id_habilidad', 'recomendaciones.habilidad_id')
    .leftJoin('modelos_ia', 'modelos_ia.id_modelo_ia', 'recomendaciones.modelo_ia_id')
    .where('recomendaciones.id_recomendacion', id_recomendacion)
    .select(listRecommendationFields)
    .first();

export const generarParaEstudiante = async (estudiante_id, user) => {
  const student = await assertStudentBelongsToUser(estudiante_id, user);
  const stats = await fetchStudentStats(estudiante_id);

  if (!stats.length) {
    throw new AppError('El estudiante no tiene estadísticas aún', 400);
  }

  const weakestSkill = pickWeakestSkill(stats, 'precision_pct');
  const [severidad_id, modelo_ia_id, mensaje] = await Promise.all([
    resolveSeverityId(Number(weakestSkill.precision_pct)),
    resolveDefaultModelId(),
    callGemini(buildStudentPrompt(student.nombre, stats)),
  ]);

  const [recommendation] = await db('recomendaciones')
    .insert({
      estudiante_id,
      grupo_id: null,
      habilidad_id: weakestSkill.habilidad_id,
      severidad_id,
      modelo_ia_id,
      mensaje,
      precision_momento: weakestSkill.precision_pct,
      activo: true,
    })
    .returning('id_recomendacion');

  return loadRecommendationById(recommendation.id_recomendacion);
};

export const generarParaGrupo = async (grupo_id, user) => {
  const group = await assertGroupBelongsToUser(grupo_id, user);
  const stats = await fetchGroupStats(grupo_id);

  if (!stats.length) {
    throw new AppError('El grupo no tiene estadísticas aún', 400);
  }

  const weakestSkill = pickWeakestSkill(stats, 'precision_promedio');
  const [severidad_id, modelo_ia_id, mensaje] = await Promise.all([
    resolveSeverityId(Number(weakestSkill.precision_promedio)),
    resolveDefaultModelId(),
    callGemini(buildGroupPrompt(group.nombre, stats)),
  ]);

  const [recommendation] = await db('recomendaciones')
    .insert({
      estudiante_id: null,
      grupo_id,
      habilidad_id: weakestSkill.id_habilidad,
      severidad_id,
      modelo_ia_id,
      mensaje,
      precision_momento: weakestSkill.precision_promedio,
      activo: true,
    })
    .returning('id_recomendacion');

  return loadRecommendationById(recommendation.id_recomendacion);
};

export const listarEstudiante = async (estudiante_id, user) => {
  await assertStudentBelongsToUser(estudiante_id, user);

  return db('recomendaciones')
    .join(
      'niveles_severidad',
      'niveles_severidad.id_nivel_severidad',
      'recomendaciones.severidad_id'
    )
    .leftJoin('habilidades', 'habilidades.id_habilidad', 'recomendaciones.habilidad_id')
    .leftJoin('modelos_ia', 'modelos_ia.id_modelo_ia', 'recomendaciones.modelo_ia_id')
    .where('recomendaciones.estudiante_id', estudiante_id)
    .where('recomendaciones.activo', true)
    .select(listRecommendationFields)
    .orderBy('recomendaciones.generado_en', 'desc');
};

export const listarGrupo = async (grupo_id, user) => {
  await assertGroupBelongsToUser(grupo_id, user);

  return db('recomendaciones')
    .join(
      'niveles_severidad',
      'niveles_severidad.id_nivel_severidad',
      'recomendaciones.severidad_id'
    )
    .leftJoin('habilidades', 'habilidades.id_habilidad', 'recomendaciones.habilidad_id')
    .leftJoin('modelos_ia', 'modelos_ia.id_modelo_ia', 'recomendaciones.modelo_ia_id')
    .where('recomendaciones.grupo_id', grupo_id)
    .where('recomendaciones.activo', true)
    .select(listRecommendationFields)
    .orderBy('recomendaciones.generado_en', 'desc');
};

export const archivar = async (id_recomendacion, user) => {
  const recommendation = await db('recomendaciones')
    .where({ id_recomendacion })
    .first();

  if (!recommendation) {
    throw new AppError('Recomendación no encontrada', 404);
  }

  if (recommendation.estudiante_id) {
    await assertStudentBelongsToUser(recommendation.estudiante_id, user);
  } else if (recommendation.grupo_id) {
    await assertGroupBelongsToUser(recommendation.grupo_id, user);
  }

  await db('recomendaciones')
    .where({ id_recomendacion })
    .update({ activo: false });
};
