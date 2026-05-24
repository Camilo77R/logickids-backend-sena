
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

const parseCsvRows = (csvContent) => {
  const [headerLine, ...lines] = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!headerLine) {
    return [];
  }

  const headers = headerLine.split(',').map((value) => value.trim());

  return lines.map((line) => {
    const values = line.split(',').map((value) => value.trim());

    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    }, {});
  });
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
    res.json(resultado);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'No se encontro el archivo datos_estudiantes.csv en la raiz del proyecto' });
    }

    res.status(500).json({ error: error.message });
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
