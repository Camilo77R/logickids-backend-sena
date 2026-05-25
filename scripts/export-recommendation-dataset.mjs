import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { db } from '../src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT_DIR = path.join(ROOT_DIR, 'datasets', 'recomendaciones_ia', 'exports');

const args = process.argv.slice(2);

const getArgValue = (flag) => {
  const item = args.find((arg) => arg.startsWith(`${flag}=`));
  return item ? item.slice(flag.length + 1) : null;
};

const outputDir = path.resolve(getArgValue('--out') || DEFAULT_OUTPUT_DIR);

const normalizeValue = (value) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const escapeCsvValue = (value) => {
  const normalized = normalizeValue(value);
  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
};

const toCsv = (rows, headers) => {
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ];

  return `${lines.join('\n')}\n`;
};

const deriveSeverity = (precision) => {
  const numericPrecision = Number(precision);
  if (Number.isNaN(numericPrecision)) return '';
  if (numericPrecision < 50) return 'alta';
  if (numericPrecision < 70) return 'media';
  return 'baja';
};

const fetchStudentSkillRows = async () =>
  db('estadisticas_habilidad as eh')
    .join('estudiantes as e', 'e.id_estudiante', 'eh.estudiante_id')
    .join('habilidades as h', 'h.id_habilidad', 'eh.habilidad_id')
    .leftJoin('estudiante_grupo_historial as egh', function () {
      this.on('egh.estudiante_id', '=', 'e.id_estudiante')
        .andOn('egh.activo', '=', db.raw('TRUE'))
        .andOnNull('egh.fecha_fin');
    })
    .leftJoin('grupos as g', 'g.id_grupo', 'egh.grupo_id')
    .leftJoin('instituciones as i', 'i.id_institucion', 'e.institucion_id')
    .select(
      'e.id_estudiante as estudiante_id',
      'e.nombre as nombre_estudiante',
      'e.edad',
      'e.institucion_id',
      'i.nombre as nombre_institucion',
      'g.id_grupo as grupo_id',
      'g.nombre as nombre_grupo',
      'eh.habilidad_id',
      'h.nombre as habilidad',
      'eh.total_intentos',
      'eh.aciertos',
      'eh.errores',
      'eh.precision_pct as precision_porcentaje',
      'eh.promedio_reaccion_ms as tiempo_reaccion_ms',
      'eh.actualizado_en as fecha_corte_estadistica'
    )
    .orderBy(['e.id_estudiante', 'eh.habilidad_id']);

const fetchRecommendationRows = async () =>
  db('recomendaciones as r')
    .leftJoin('estudiantes as e', 'e.id_estudiante', 'r.estudiante_id')
    .leftJoin('estudiante_grupo_historial as egh', function () {
      this.on('egh.estudiante_id', '=', 'e.id_estudiante')
        .andOn('egh.activo', '=', db.raw('TRUE'))
        .andOnNull('egh.fecha_fin');
    })
    .leftJoin('grupos as eg', 'eg.id_grupo', 'egh.grupo_id')
    .leftJoin('grupos as rg', 'rg.id_grupo', 'r.grupo_id')
    .leftJoin('habilidades as h', 'h.id_habilidad', 'r.habilidad_id')
    .leftJoin('niveles_severidad as ns', 'ns.id_nivel_severidad', 'r.severidad_id')
    .leftJoin('modelos_ia as mi', 'mi.id_modelo_ia', 'r.modelo_ia_id')
    .select(
      'r.id_recomendacion as recomendacion_id',
      'r.estudiante_id',
      'e.nombre as nombre_estudiante',
      'r.grupo_id as grupo_id_recomendacion',
      'rg.nombre as nombre_grupo_recomendacion',
      'eg.id_grupo as grupo_id_actual_estudiante',
      'eg.nombre as nombre_grupo_actual_estudiante',
      'r.habilidad_id',
      'h.nombre as habilidad',
      'r.precision_momento',
      'ns.nombre as severidad',
      'mi.nombre as modelo_ia',
      'r.mensaje as mensaje_objetivo',
      'r.generado_en',
      'r.activo'
    )
    .orderBy('r.generado_en', 'desc');

const buildStudentSkillDataset = (rows) =>
  rows.map((row) => ({
    ...row,
    severidad_sugerida: deriveSeverity(row.precision_porcentaje),
  }));

const buildRecommendationExamplesDataset = (rows) =>
  rows.map((row) => ({
    recomendacion_id: row.recomendacion_id,
    tipo_recomendacion: row.estudiante_id ? 'estudiante' : 'grupo',
    estudiante_id: row.estudiante_id,
    nombre_estudiante: row.nombre_estudiante,
    grupo_id: row.grupo_id_recomendacion || row.grupo_id_actual_estudiante,
    nombre_grupo: row.nombre_grupo_recomendacion || row.nombre_grupo_actual_estudiante,
    habilidad_id: row.habilidad_id,
    habilidad: row.habilidad,
    precision_momento: row.precision_momento,
    severidad: row.severidad,
    modelo_ia: row.modelo_ia,
    mensaje_objetivo: row.mensaje_objetivo,
    generado_en: row.generado_en,
    activo: row.activo,
  }));

const buildRecommendationHistoryDataset = (rows) =>
  rows.map((row) => ({
    recomendacion_id: row.recomendacion_id,
    estudiante_id: row.estudiante_id,
    nombre_estudiante: row.nombre_estudiante,
    grupo_id: row.grupo_id_recomendacion || row.grupo_id_actual_estudiante,
    nombre_grupo: row.nombre_grupo_recomendacion || row.nombre_grupo_actual_estudiante,
    habilidad_id: row.habilidad_id,
    habilidad: row.habilidad,
    precision_momento: row.precision_momento,
    severidad: row.severidad,
    modelo_ia: row.modelo_ia,
    mensaje_objetivo: row.mensaje_objetivo,
    generado_en: row.generado_en,
    activo: row.activo,
  }));

const studentSkillHeaders = [
  'estudiante_id',
  'nombre_estudiante',
  'edad',
  'institucion_id',
  'nombre_institucion',
  'grupo_id',
  'nombre_grupo',
  'habilidad_id',
  'habilidad',
  'total_intentos',
  'aciertos',
  'errores',
  'precision_porcentaje',
  'tiempo_reaccion_ms',
  'fecha_corte_estadistica',
  'severidad_sugerida',
];

const recommendationHeaders = [
  'recomendacion_id',
  'tipo_recomendacion',
  'estudiante_id',
  'nombre_estudiante',
  'grupo_id',
  'nombre_grupo',
  'habilidad_id',
  'habilidad',
  'precision_momento',
  'severidad',
  'modelo_ia',
  'mensaje_objetivo',
  'generado_en',
  'activo',
];

const recommendationHistoryHeaders = [
  'recomendacion_id',
  'estudiante_id',
  'nombre_estudiante',
  'grupo_id',
  'nombre_grupo',
  'habilidad_id',
  'habilidad',
  'precision_momento',
  'severidad',
  'modelo_ia',
  'mensaje_objetivo',
  'generado_en',
  'activo',
];

const main = async () => {
  try {
    await mkdir(outputDir, { recursive: true });

    const [studentSkillRows, recommendationRows] = await Promise.all([
      fetchStudentSkillRows(),
      fetchRecommendationRows(),
    ]);

    const datasetFeatures = buildStudentSkillDataset(studentSkillRows);
    const datasetLabels = buildRecommendationExamplesDataset(recommendationRows);
    const datasetHistory = buildRecommendationHistoryDataset(
      recommendationRows.filter((row) => row.estudiante_id)
    );

    const featuresPath = path.join(outputDir, 'student_skill_observations.csv');
    const labelsPath = path.join(outputDir, 'recommendation_examples.csv');
    const historyPath = path.join(outputDir, 'recommendation_history.csv');

    await Promise.all([
      writeFile(featuresPath, toCsv(datasetFeatures, studentSkillHeaders), 'utf8'),
      writeFile(labelsPath, toCsv(datasetLabels, recommendationHeaders), 'utf8'),
      writeFile(historyPath, toCsv(datasetHistory, recommendationHistoryHeaders), 'utf8'),
    ]);

    console.log(`Dataset exportado en: ${outputDir}`);
    console.log(`- Observaciones por habilidad: ${datasetFeatures.length} filas`);
    console.log(`- Ejemplos de recomendaciones: ${datasetLabels.length} filas`);
    console.log(`- Historial de recomendaciones: ${datasetHistory.length} filas`);
  } finally {
    await db.destroy();
  }
};

await main();
