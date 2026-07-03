import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import {
  buildGroupRecommendationV1,
  buildStudentRecommendationV1,
  RECOMMENDATION_RULES_VERSION,
} from '../domain/recomendaciones/recommendationEngineV1.js';
import { buildTemplateRecommendation } from '../domain/recomendaciones/recommendationTemplates.js';
import {
  assertGroupBelongsToUser,
  assertStudentBelongsToUser,
} from './access.service.js';
import {
  generateRecommendationText,
  getGeminiModelName,
} from './recommendationText.service.js';

const formatNumber = (value, fallback = 'N/A') => {
  if (value === null || value === undefined || value === '') return fallback;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toLocaleString('es-CO') : String(value);
};

const formatPercent = (value) => `${formatNumber(Number(value).toFixed(2))}%`;

const formatReaction = (value) =>
  value === null || value === undefined ? 'sin dato de tiempo' : `${formatNumber(value)} ms`;

const getPrecisionLabel = (precision) => {
  const value = Number(precision);
  if (value < 50) return 'critico';
  if (value < 70) return 'en refuerzo';
  if (value < 85) return 'en consolidacion';
  return 'fortaleza';
};

const formatHistoryForPrompt = (history) => {
  if (!history.length) {
    return 'No hay recomendaciones previas activas para este alcance.';
  }

  return history
    .map((item) => {
      const generatedAt = item.generado_en?.toISOString?.() ?? item.generado_en;
      return `- ${item.habilidad ?? 'General'} (${generatedAt}): ${item.mensaje}`;
    })
    .join('\n');
};

const buildRecentSessionsSummary = (sessions) => {
  if (!sessions.length) {
    return 'No hay sesiones recientes disponibles para complementar la lectura.';
  }

  return sessions
    .map(
      (session) =>
        `- ${session.minijuego} (${session.habilidad}): dificultad ${session.dificultad}, ${session.puntaje} puntos, ${session.aciertos} aciertos, ${session.errores} errores, combo maximo ${session.combo_maximo}, estado ${session.estado}`
    )
    .join('\n');
};

const buildStudentPrompt = (nombre, stats, history = [], recentSessions = []) => {
  const lineas = stats
    .map(
      (stat) =>
        `- ${stat.habilidad}: ${stat.precision_pct}% de precision, ${stat.total_intentos} intentos, ${stat.aciertos} aciertos, ${stat.errores} errores, ${stat.promedio_reaccion_ms ?? 'N/A'} ms de reaccion promedio, actualizado en ${stat.actualizado_en}`
    )
    .join('\n');

  return `Eres un pedagogo experto en educacion infantil de 7 a 12 anos.
El estudiante "${nombre}" tiene estas estadisticas por habilidad cognitiva:
${lineas}

Recomendaciones previas activas:
${formatHistoryForPrompt(history)}

Ultimas sesiones de juego:
${buildRecentSessionsSummary(recentSessions)}

Genera una recomendacion pedagogica personalizada en espanol para el tutor.
Usa exactamente esta estructura, sin markdown:
Hallazgo principal: menciona habilidad, porcentaje, intentos, aciertos, errores y si hay sesiones recientes relevantes.
Interpretacion: explica que significan esos numeros para un nino de 7 a 12 anos.
Acciones sugeridas: propone 2 o 3 acciones concretas conectadas con la habilidad y el minijuego.
Seguimiento: indica una meta medible para las proximas partidas.
No inventes datos. Maximo 190 palabras.`;
};

const buildGroupPrompt = (grupo, stats, history = []) => {
  const lineas = stats
    .map(
      (stat) =>
        `- ${stat.habilidad}: ${stat.precision_promedio}% de precision promedio, rango ${stat.precision_minima}% a ${stat.precision_maxima}%, ${stat.intentos_totales} intentos, ${stat.aciertos_totales} aciertos, ${stat.errores_totales} errores, ${stat.reaccion_promedio ?? 'N/A'} ms de reaccion promedio y ${stat.estudiantes_evaluados} estudiantes evaluados`
    )
    .join('\n');

  return `Eres un pedagogo experto en educacion infantil de 7 a 12 anos.
El grupo "${grupo}" tiene estas estadisticas colectivas:
${lineas}

Recomendaciones previas activas:
${formatHistoryForPrompt(history)}

Genera una recomendacion pedagogica grupal en espanol para el tutor.
Usa exactamente esta estructura, sin markdown:
Hallazgo principal: menciona habilidad, precision promedio, rango del grupo, intentos, aciertos y errores.
Interpretacion: explica que significa el desempeno del grupo con palabras sencillas.
Acciones sugeridas: propone 2 o 3 dinamicas concretas para el aula conectadas con la habilidad.
Seguimiento: indica una meta medible para comparar en las proximas partidas.
No inventes datos. Maximo 190 palabras.`;
};

const resolveSeverityId = async (precision) => {
  let severityName = 'baja';

  if (precision < 50) {
    severityName = 'alta';
  } else if (precision < 70) {
    severityName = 'media';
  }

  const severity = await db('niveles_severidad')
    .where({ nombre: severityName })
    .select('id_nivel_severidad')
    .first();

  if (!severity) {
    throw new AppError('No se pudo resolver la severidad de la recomendacion', 500);
  }

  return severity.id_nivel_severidad;
};

const resolveDefaultModelId = async () => {
  const modelName = getGeminiModelName();
  const model = await db('modelos_ia')
    .where({ nombre: getGeminiModelName(), activo: true })
    .select('id_modelo_ia')
    .first();

  if (model) {
    return model.id_modelo_ia;
  }

  const [createdModel] = await db('modelos_ia')
    .insert({
      nombre: modelName,
      proveedor: 'Google',
      activo: true,
    })
    .returning('id_modelo_ia');

  return createdModel.id_modelo_ia;
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
  'recomendaciones.origen_generacion',
  'recomendaciones.version_reglas',
  'niveles_severidad.nombre as severidad',
  'habilidades.nombre as habilidad',
  'modelos_ia.nombre as modelo_ia',
];

const buildStudentFallbackRecommendation = ({ nombre, stats, recentSessions }) => {
  const weakestSkill = pickWeakestSkill(stats, 'precision_pct');
  const latestSession = recentSessions[0];
  const precision = Number(weakestSkill.precision_pct);
  const nextGoal = Math.min(100, Math.ceil(precision + 10));

  return `Hallazgo principal: ${nombre} necesita refuerzo en ${weakestSkill.habilidad}: registra ${formatPercent(precision)} de precision con ${formatNumber(weakestSkill.total_intentos)} intentos, ${formatNumber(weakestSkill.aciertos)} aciertos y ${formatNumber(weakestSkill.errores)} errores.
Interpretacion: Este nivel se considera ${getPrecisionLabel(precision)}. Su reaccion promedio es ${formatReaction(weakestSkill.promedio_reaccion_ms)}, por lo que conviene priorizar precision antes de aumentar dificultad.${latestSession ? ` En su sesion reciente de ${latestSession.minijuego} obtuvo ${formatNumber(latestSession.puntaje)} puntos, ${formatNumber(latestSession.aciertos)} aciertos y ${formatNumber(latestSession.errores)} errores.` : ''}
Acciones sugeridas: Trabaja bloques cortos de 5 a 8 ejercicios de ${weakestSkill.habilidad}, usa ejemplos visuales antes del reto y repite la misma mecanica hasta que explique por que eligio cada respuesta.
Seguimiento: En las proximas partidas busca subir la precision a por lo menos ${nextGoal}% y reducir errores manteniendo un tiempo de reaccion estable.`;
};

const buildGroupFallbackRecommendation = ({ grupo, stats }) => {
  const weakestSkill = pickWeakestSkill(stats, 'precision_promedio');
  const precision = Number(weakestSkill.precision_promedio);
  const nextGoal = Math.min(100, Math.ceil(precision + 10));

  return `Hallazgo principal: El grupo ${grupo} requiere apoyo en ${weakestSkill.habilidad}: tiene ${formatPercent(precision)} de precision promedio, con un rango entre ${formatPercent(weakestSkill.precision_minima)} y ${formatPercent(weakestSkill.precision_maxima)}, ${formatNumber(weakestSkill.intentos_totales)} intentos, ${formatNumber(weakestSkill.aciertos_totales)} aciertos y ${formatNumber(weakestSkill.errores_totales)} errores.
Interpretacion: El desempeno colectivo esta ${getPrecisionLabel(precision)}. La reaccion promedio es ${formatReaction(weakestSkill.reaccion_promedio)} para ${formatNumber(weakestSkill.estudiantes_evaluados)} estudiantes evaluados.
Acciones sugeridas: Divide el grupo en parejas, inicia con retos guiados de ${weakestSkill.habilidad} y cierra con una mini ronda competitiva donde expliquen la estrategia usada.
Seguimiento: En la proxima sesion compara si la precision promedio sube a por lo menos ${nextGoal}% y si disminuye la diferencia entre el estudiante con menor y mayor precision.`;
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
      'estadisticas_habilidad.aciertos',
      'estadisticas_habilidad.errores',
      'estadisticas_habilidad.actualizado_en',
      'habilidades.nombre as habilidad'
    )
    .orderBy('estadisticas_habilidad.habilidad_id');

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
      db.raw('ROUND(SUM(estadisticas_habilidad.aciertos) * 100.0 / NULLIF(SUM(estadisticas_habilidad.total_intentos), 0), 2) as precision_promedio'),
      db.raw('ROUND(AVG(estadisticas_habilidad.promedio_reaccion_ms)) as reaccion_promedio'),
      db.raw('COUNT(DISTINCT estadisticas_habilidad.estudiante_id) as estudiantes_evaluados'),
      db.raw('SUM(estadisticas_habilidad.total_intentos) as intentos_totales'),
      db.raw('SUM(estadisticas_habilidad.aciertos) as aciertos_totales'),
      db.raw('SUM(estadisticas_habilidad.errores) as errores_totales'),
      db.raw('ROUND(MIN(estadisticas_habilidad.precision_pct), 2) as precision_minima'),
      db.raw('ROUND(MAX(estadisticas_habilidad.precision_pct), 2) as precision_maxima')
    )
    .groupBy('habilidades.id_habilidad', 'habilidades.nombre')
    .orderBy('habilidades.id_habilidad');

const fetchRecommendationGames = () =>
  db('minijuegos')
    .join('habilidades', 'habilidades.id_habilidad', 'minijuegos.habilidad_id')
    .where({
      'minijuegos.activo': true,
      'minijuegos.visible_en_catalogo': true,
    })
    .select(
      'minijuegos.id_minijuego',
      'minijuegos.slug',
      'minijuegos.titulo',
      'minijuegos.habilidad_id',
      'minijuegos.dificultad_maxima',
      'minijuegos.orden_catalogo',
      'minijuegos.activo',
      'minijuegos.visible_en_catalogo',
      'habilidades.nombre as habilidad'
    )
    .orderBy('minijuegos.orden_catalogo');

const fetchStudentRecentSessions = (estudiante_id) =>
  db('sesiones_juego')
    .join('minijuegos', 'minijuegos.id_minijuego', 'sesiones_juego.minijuego_id')
    .join('habilidades', 'habilidades.id_habilidad', 'minijuegos.habilidad_id')
    .join('estados_sesion', 'estados_sesion.id_estado_sesion', 'sesiones_juego.estado_id')
    .where('sesiones_juego.estudiante_id', estudiante_id)
    .select(
      'minijuegos.id_minijuego',
      'minijuegos.slug',
      'sesiones_juego.dificultad',
      'sesiones_juego.puntaje',
      'sesiones_juego.aciertos',
      'sesiones_juego.errores',
      'sesiones_juego.combo_maximo',
      'sesiones_juego.estrellas_obtenidas',
      'sesiones_juego.finalizada_en',
      'minijuegos.titulo as minijuego',
      'habilidades.nombre as habilidad',
      'estados_sesion.nombre as estado'
    )
    .orderBy('sesiones_juego.iniciada_en', 'desc')
    .limit(5);

const fetchStudentRecommendationHistory = (estudiante_id) =>
  db('recomendaciones')
    .leftJoin('habilidades', 'habilidades.id_habilidad', 'recomendaciones.habilidad_id')
    .where('recomendaciones.estudiante_id', estudiante_id)
    .where('recomendaciones.activo', true)
    .select(
      'recomendaciones.mensaje',
      'recomendaciones.generado_en',
      'habilidades.nombre as habilidad'
    )
    .orderBy('recomendaciones.generado_en', 'desc')
    .limit(3);

const fetchGroupRecommendationHistory = (grupo_id) =>
  db('recomendaciones')
    .leftJoin('habilidades', 'habilidades.id_habilidad', 'recomendaciones.habilidad_id')
    .where('recomendaciones.grupo_id', grupo_id)
    .where('recomendaciones.activo', true)
    .select(
      'recomendaciones.mensaje',
      'recomendaciones.generado_en',
      'habilidades.nombre as habilidad'
    )
    .orderBy('recomendaciones.generado_en', 'desc')
    .limit(3);

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

const resolveGeneration = ({ template, prompt, fallback }) =>
  template
    ? Promise.resolve({ message: template, source: 'template' })
    : generateRecommendationText({ prompt, fallback });

const mapGenerationOrigin = (source) => {
  if (source === 'template') return 'plantilla';
  if (source === 'gemini') return 'gemini';
  return 'fallback';
};

const assertSufficientEvidence = (decision, subjectLabel) => {
  if (decision.status === 'ready') return;

  throw new AppError(
    `${subjectLabel} aun no tiene evidencia suficiente para generar una recomendacion confiable`,
    400,
    { evidence: decision.evidence }
  );
};

export const generarParaEstudiante = async (estudiante_id, user) => {
  const student = await assertStudentBelongsToUser(estudiante_id, user);
  const [stats, history, recentSessions, games] = await Promise.all([
    fetchStudentStats(estudiante_id),
    fetchStudentRecommendationHistory(estudiante_id),
    fetchStudentRecentSessions(estudiante_id),
    fetchRecommendationGames(),
  ]);

  if (!stats.length) {
    throw new AppError('El estudiante no tiene estadisticas aun', 400);
  }

  const decision = buildStudentRecommendationV1({
    studentId: estudiante_id,
    studentAge: student.edad,
    stats,
    games,
    recentSessions,
  });
  assertSufficientEvidence(decision, 'El estudiante');

  const template = buildTemplateRecommendation({
    subjectType: 'student',
    subjectName: student.nombre,
    decision,
  });
  const [severidad_id, generation] = await Promise.all([
    resolveSeverityId(decision.skillTarget.precision),
    resolveGeneration({
      template,
      prompt: buildStudentPrompt(student.nombre, stats, history, recentSessions),
      fallback: buildStudentFallbackRecommendation({ nombre: student.nombre, stats, recentSessions }),
    }),
  ]);
  const modelo_ia_id = generation.source === 'gemini' ? await resolveDefaultModelId() : null;
  const snapshot = {
    subjectType: 'student',
    subjectId: estudiante_id,
    stats,
    decision,
  };

  const [recommendation] = await db('recomendaciones')
    .insert({
      estudiante_id,
      grupo_id: null,
      habilidad_id: decision.skillTarget.id,
      severidad_id,
      modelo_ia_id: generation.source === 'gemini' ? modelo_ia_id : null,
      mensaje: generation.message,
      precision_momento: decision.skillTarget.precision,
      origen_generacion: mapGenerationOrigin(generation.source),
      version_reglas: RECOMMENDATION_RULES_VERSION,
      input_snapshot_json: snapshot,
      activo: true,
    })
    .returning('id_recomendacion');

  return loadRecommendationById(recommendation.id_recomendacion);
};

export const generarParaGrupo = async (grupo_id, user) => {
  const group = await assertGroupBelongsToUser(grupo_id, user);
  const [stats, history, games] = await Promise.all([
    fetchGroupStats(grupo_id),
    fetchGroupRecommendationHistory(grupo_id),
    fetchRecommendationGames(),
  ]);

  if (!stats.length) {
    throw new AppError('El grupo no tiene estadisticas aun', 400);
  }

  const decision = buildGroupRecommendationV1({ groupId: grupo_id, stats, games });
  assertSufficientEvidence(decision, 'El grupo');

  const template = buildTemplateRecommendation({
    subjectType: 'group',
    subjectName: group.nombre,
    decision,
  });
  const [severidad_id, generation] = await Promise.all([
    resolveSeverityId(decision.skillTarget.precision),
    resolveGeneration({
      template,
      prompt: buildGroupPrompt(group.nombre, stats, history),
      fallback: buildGroupFallbackRecommendation({ grupo: group.nombre, stats }),
    }),
  ]);
  const modelo_ia_id = generation.source === 'gemini' ? await resolveDefaultModelId() : null;
  const snapshot = {
    subjectType: 'group',
    subjectId: grupo_id,
    stats,
    decision,
  };

  const [recommendation] = await db('recomendaciones')
    .insert({
      estudiante_id: null,
      grupo_id,
      habilidad_id: decision.skillTarget.id,
      severidad_id,
      modelo_ia_id: generation.source === 'gemini' ? modelo_ia_id : null,
      mensaje: generation.message,
      precision_momento: decision.skillTarget.precision,
      origen_generacion: mapGenerationOrigin(generation.source),
      version_reglas: RECOMMENDATION_RULES_VERSION,
      input_snapshot_json: snapshot,
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
    throw new AppError('Recomendacion no encontrada', 404);
  }

  if (recommendation.estudiante_id) {
    await assertStudentBelongsToUser(recommendation.estudiante_id, user);
  } else if (recommendation.grupo_id) {
    await assertGroupBelongsToUser(recommendation.grupo_id, user);
  } else {
    throw new AppError('Recomendacion con destino invalido', 500);
  }

  await db('recomendaciones')
    .where({ id_recomendacion })
    .update({ activo: false });
};
