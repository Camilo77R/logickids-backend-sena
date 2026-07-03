import { db } from '../src/config/db.js';
import {
  buildGroupRecommendationV1,
  buildStudentRecommendationV1,
} from '../src/domain/recomendaciones/recommendationEngineV1.js';
import { buildTemplateRecommendation } from '../src/domain/recomendaciones/recommendationTemplates.js';

const fetchGames = () =>
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
    );

const fetchStudentCase = async () => {
  const candidate = await db('estadisticas_habilidad')
    .where('total_intentos', '>=', 10)
    .select('estudiante_id')
    .orderBy('estudiante_id')
    .first();
  if (!candidate) return null;

  const [student, stats] = await Promise.all([
    db('estudiantes')
      .where({ id_estudiante: candidate.estudiante_id })
      .select('id_estudiante', 'edad')
      .first(),
    db('estadisticas_habilidad as eh')
      .join('habilidades as h', 'h.id_habilidad', 'eh.habilidad_id')
      .where('eh.estudiante_id', candidate.estudiante_id)
      .select(
        'eh.habilidad_id',
        'eh.precision_pct',
        'eh.promedio_reaccion_ms',
        'eh.total_intentos',
        'eh.aciertos',
        'eh.errores',
        'h.nombre as habilidad'
      ),
  ]);

  return { student, stats };
};

const fetchGroupCase = async () => {
  const candidate = await db('estudiante_grupo_historial')
    .where({ activo: true })
    .whereNull('fecha_fin')
    .select('grupo_id')
    .countDistinct({ students: 'estudiante_id' })
    .groupBy('grupo_id')
    .havingRaw('COUNT(DISTINCT estudiante_id) >= 3')
    .orderBy('grupo_id')
    .first();
  if (!candidate) return null;

  const stats = await db('estadisticas_habilidad as eh')
    .join('habilidades as h', 'h.id_habilidad', 'eh.habilidad_id')
    .join('estudiante_grupo_historial as egh', 'egh.estudiante_id', 'eh.estudiante_id')
    .where({ 'egh.grupo_id': candidate.grupo_id, 'egh.activo': true })
    .whereNull('egh.fecha_fin')
    .select(
      'h.id_habilidad',
      'h.nombre as habilidad',
      db.raw('ROUND(SUM(eh.aciertos) * 100.0 / NULLIF(SUM(eh.total_intentos), 0), 2) as precision_promedio'),
      db.raw('ROUND(AVG(eh.promedio_reaccion_ms)) as reaccion_promedio'),
      db.raw('COUNT(DISTINCT eh.estudiante_id) as estudiantes_evaluados'),
      db.raw('SUM(eh.total_intentos) as intentos_totales'),
      db.raw('SUM(eh.aciertos) as aciertos_totales'),
      db.raw('SUM(eh.errores) as errores_totales'),
      db.raw('ROUND(MIN(eh.precision_pct), 2) as precision_minima'),
      db.raw('ROUND(MAX(eh.precision_pct), 2) as precision_maxima')
    )
    .groupBy('h.id_habilidad', 'h.nombre');

  return { groupId: candidate.grupo_id, stats };
};

try {
  const [games, studentCase, groupCase] = await Promise.all([
    fetchGames(),
    fetchStudentCase(),
    fetchGroupCase(),
  ]);

  const studentDecision = studentCase
    ? buildStudentRecommendationV1({
        studentId: studentCase.student.id_estudiante,
        studentAge: studentCase.student.edad,
        stats: studentCase.stats,
        games,
      })
    : null;
  const groupDecision = groupCase
    ? buildGroupRecommendationV1({ groupId: groupCase.groupId, stats: groupCase.stats, games })
    : null;

  const studentTemplate = buildTemplateRecommendation({
    subjectType: 'student',
    subjectName: 'Estudiante de prueba',
    decision: studentDecision,
  });
  const groupTemplate = buildTemplateRecommendation({
    subjectType: 'group',
    subjectName: 'Grupo de prueba',
    decision: groupDecision,
  });

  console.log(JSON.stringify({
    ok: Boolean(studentTemplate) && Boolean(groupTemplate),
    student: {
      status: studentDecision?.status ?? 'missing_case',
      skill: studentDecision?.skillTarget?.name ?? null,
      source: studentTemplate ? 'plantilla' : 'gemini_or_fallback',
    },
    group: {
      status: groupDecision?.status ?? 'missing_case',
      skill: groupDecision?.skillTarget?.name ?? null,
      source: groupTemplate ? 'plantilla' : 'gemini_or_fallback',
    },
  }, null, 2));

  if (!studentTemplate || !groupTemplate) process.exitCode = 1;
} finally {
  await db.destroy();
}
