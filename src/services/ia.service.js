
import FormData from 'form-data';
import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../config/db.js';

const IA_SERVICE_URL = process.env.IA_SERVICE_URL || 'http://localhost:8001';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const DEFAULT_CSV_PATH = path.join(ROOT_DIR, 'datos_estudiantes.csv');
const HISTORY_CSV_PATH = path.join(
  ROOT_DIR,
  'datasets',
  'recomendaciones_ia',
  'exports',
  'recommendation_history.csv'
);
const HISTORY_HEADERS = [
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

const parseCsvRows = (csvContent) => {
  if (!csvContent?.trim()) return [];

  const rows = [];
  let currentRow = [];
  let currentValue = '';
  let inQuotes = false;

  for (let index = 0; index < csvContent.length; index += 1) {
    const char = csvContent[index];
    const nextChar = csvContent[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      currentRow.push(currentValue);
      currentValue = '';

      if (currentRow.some((value) => value !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      continue;
    }

    currentValue += char;
  }

  if (currentValue !== '' || currentRow.length > 0) {
    currentRow.push(currentValue);
    if (currentRow.some((value) => value !== '')) {
      rows.push(currentRow);
    }
  }

  if (!rows.length) return [];

  const [headers, ...dataRows] = rows;

  return dataRows.map((values) =>
    headers.reduce((row, header, headerIndex) => {
      row[String(header).trim()] = values[headerIndex] ?? '';
      return row;
    }, {})
  );
};

const normalizeCsvCell = (value) => {
  if (value === null || value === undefined) return '';
  return String(value);
};

const escapeCsvValue = (value) => {
  const normalized = normalizeCsvCell(value);

  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
};

const readCsvRows = async (filePath, { allowMissing = false } = {}) => {
  try {
    const csvContent = await fs.readFile(filePath, 'utf8');
    return parseCsvRows(csvContent);
  } catch (error) {
    if (allowMissing && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const readLocalCsvRows = async () => {
  const csvContent = await fs.readFile(DEFAULT_CSV_PATH, 'utf8');
  return parseCsvRows(csvContent);
};

const filterCsvRows = (rows, { grupoId, estudianteId } = {}) =>
  rows.filter((row) => {
    if (grupoId && String(row.grupo_id) !== String(grupoId)) {
      return false;
    }

    if (estudianteId && String(row.estudiante_id) !== String(estudianteId)) {
      return false;
    }

    return true;
  });

const buildCsvBuffer = (rows) => {
  if (!rows.length) {
    return null;
  }

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => row[header] ?? '').join(',')),
  ].join('\n');

  return Buffer.from(csvContent, 'utf-8');
};

const writeCsvRows = async (filePath, rows, headers) => {
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ].join('\n');

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${csvContent}\n`, 'utf8');
};

const appendRecommendationsToHistory = async (recomendaciones, sourceRows) => {
  const historyRows = await readHistoryRows();
  const sourceByStudent = new Map();

  for (const row of sourceRows) {
    const studentKey = String(row.estudiante_id ?? '');
    if (studentKey && !sourceByStudent.has(studentKey)) {
      sourceByStudent.set(studentKey, row);
    }
  }

  const timestampBase = Date.now();
  const newRows = recomendaciones.map((recommendation, index) => {
    const source = sourceByStudent.get(String(recommendation.estudiante_id)) ?? {};

    return {
      recomendacion_id: `csv_${timestampBase}_${index + 1}`,
      estudiante_id: recommendation.estudiante_id ?? '',
      nombre_estudiante: recommendation.nombre ?? source.nombre_estudiante ?? '',
      grupo_id: source.grupo_id ?? '',
      nombre_grupo: source.nombre_grupo ?? '',
      habilidad_id: source.habilidad_id ?? '',
      habilidad: recommendation.habilidad_critica ?? source.habilidad ?? '',
      precision_momento: recommendation.precision_actual ?? source.precision_porcentaje ?? '',
      severidad: recommendation.severidad ?? '',
      modelo_ia: recommendation.modelo_usado ?? '',
      mensaje_objetivo: normalizeCsvCell(recommendation.recomendacion).replace(/\r?\n+/g, ' ').trim(),
      generado_en: recommendation.fecha_generacion ?? new Date().toISOString(),
      activo: 'true',
    };
  });

  await writeCsvRows(HISTORY_CSV_PATH, [...historyRows, ...newRows], HISTORY_HEADERS);
  return newRows.length;
};

const isValidHistoryRow = (row) =>
  Boolean(row?.recomendacion_id) &&
  Boolean(row?.estudiante_id) &&
  Boolean(row?.generado_en) &&
  Boolean(row?.mensaje_objetivo);

const readHistoryRows = async () =>
  (await readCsvRows(HISTORY_CSV_PATH, { allowMissing: true })).filter(isValidHistoryRow);

const filterHistoryRows = (rows, { grupoId, estudianteId, recommendationId } = {}) =>
  rows.filter((row) => {
    if (recommendationId && String(row.recomendacion_id) !== String(recommendationId)) {
      return false;
    }

    if (grupoId && String(row.grupo_id) !== String(grupoId)) {
      return false;
    }

    if (estudianteId && String(row.estudiante_id) !== String(estudianteId)) {
      return false;
    }

    return true;
  });

export const obtenerCatalogoCsvLocal = async (_req, res) => {
  try {
    const rows = await readLocalCsvRows();
    const groupsMap = new Map();

    for (const row of rows) {
      const groupId = String(row.grupo_id ?? '');
      const studentId = String(row.estudiante_id ?? '');

      if (!groupId || !studentId) continue;

      if (!groupsMap.has(groupId)) {
        groupsMap.set(groupId, {
          id: groupId,
          nombre: row.nombre_grupo || `Grupo ${groupId}`,
          estudiantes: [],
        });
      }

      const group = groupsMap.get(groupId);

      if (!group.estudiantes.some((student) => String(student.id) === studentId)) {
        group.estudiantes.push({
          id: studentId,
          nombre: row.nombre_estudiante || `Estudiante ${studentId}`,
        });
      }
    }

    const grupos = Array.from(groupsMap.values()).sort((left, right) =>
      left.nombre.localeCompare(right.nombre, 'es')
    );

    const estudiantes = grupos.flatMap((group) =>
      group.estudiantes.map((student) => ({
        ...student,
        grupo_id: group.id,
        nombre_grupo: group.nombre,
      }))
    );

    res.json({
      success: true,
      data: {
        grupos,
        estudiantes,
      },
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({
        success: false,
        message: 'No se encontro el archivo datos_estudiantes.csv en la raiz del proyecto',
      });
    }

    res.status(500).json({ success: false, message: error.message });
  }
};

export const generarRecomendacionesDesdeCSV = async (csvBuffer, nombreArchivo) => {
  const formData = new FormData();
  formData.append('file', csvBuffer, { filename: nombreArchivo });
  
  const response = await axios.post(`${IA_SERVICE_URL}/api/ia/recomendaciones`, formData, {
    headers: formData.getHeaders()
  });
  
  return response.data;
};

export const recomendarDesdeArchivoLocal = async (_req, res) => {
  try {
    const rows = await readLocalCsvRows();
    const filteredRows = filterCsvRows(rows, {
      grupoId: _req.body?.grupoId,
      estudianteId: _req.body?.estudianteId,
    });

    if (!filteredRows.length) {
      return res.status(404).json({
        success: false,
        message: 'No hay datos en el CSV para los filtros seleccionados',
      });
    }

    const csvBuffer = buildCsvBuffer(filteredRows);
    const resultado = await generarRecomendacionesDesdeCSV(csvBuffer, 'datos_estudiantes.csv');
    const historialAgregado = await appendRecommendationsToHistory(
      resultado?.recomendaciones ?? [],
      filteredRows
    );

    res.json({
      ...resultado,
      historial_actualizado: historialAgregado,
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'No se encontro el archivo datos_estudiantes.csv en la raiz del proyecto' });
    }

    res.status(500).json({ error: error.message });
  }
};

export const obtenerHistorialCsv = async (req, res) => {
  try {
    const rows = await readHistoryRows();
    const filteredRows = filterHistoryRows(rows, {
      grupoId: req.query?.grupoId,
      estudianteId: req.query?.estudianteId,
    }).sort((left, right) => {
      const leftTime = new Date(left.generado_en ?? 0).getTime();
      const rightTime = new Date(right.generado_en ?? 0).getTime();
      return rightTime - leftTime;
    });

    res.json({
      success: true,
      data: filteredRows,
      total: filteredRows.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const borrarHistorialCsv = async (req, res) => {
  try {
    const { grupoId, estudianteId, recommendationId } = req.body ?? {};
    if (!grupoId && !estudianteId && !recommendationId) {
      return res.status(400).json({
        success: false,
        message: 'Debes enviar recommendationId, grupoId o estudianteId para borrar historial',
      });
    }

    const rows = await readHistoryRows();
    const rowsToDelete = filterHistoryRows(rows, { grupoId, estudianteId, recommendationId });

    if (!rowsToDelete.length) {
      return res.json({
        success: true,
        deleted: 0,
        message: 'No habia registros de historial para borrar con ese filtro',
      });
    }

    const remainingRows = rows.filter(
      (row) => !rowsToDelete.some((candidate) => candidate.recomendacion_id === row.recomendacion_id)
    );

    await writeCsvRows(HISTORY_CSV_PATH, remainingRows, HISTORY_HEADERS);

    res.json({
      success: true,
      deleted: rowsToDelete.length,
      message: 'Historial borrado correctamente',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const exportarYRecomendar = async (req, res) => {
  try {
    const estudiantes = await db('estadisticas_habilidad')
      .join('estudiantes', 'estudiantes.id_estudiante', 'estadisticas_habilidad.estudiante_id')
      .join('habilidades', 'habilidades.id_habilidad', 'estadisticas_habilidad.habilidad_id')
      .select(
        'estudiantes.id_estudiante as estudiante_id',
        'estudiantes.nombre as nombre_estudiante',
        'habilidades.nombre as habilidad',
        'estadisticas_habilidad.precision_pct as precision_porcentaje'
      );
    
    if (estudiantes.length === 0) {
      return res.status(404).json({ error: 'No hay datos para analizar' });
    }
    
    const headers = ['estudiante_id', 'nombre_estudiante', 'habilidad', 'precision_porcentaje', 'recomendacion_manual'];
    const rows = estudiantes.map(e => [e.estudiante_id, e.nombre_estudiante, e.habilidad, e.precision_porcentaje, 'Revisar rendimiento']);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const csvBuffer = Buffer.from(csvContent, 'utf-8');
    
    const resultado = await generarRecomendacionesDesdeCSV(csvBuffer, `export_${Date.now()}.csv`);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
