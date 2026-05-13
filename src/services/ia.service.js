
import FormData from 'form-data';
import axios from 'axios';
import { db } from '../config/db.js';

const IA_SERVICE_URL = process.env.IA_SERVICE_URL || 'http://localhost:8001';

export const generarRecomendacionesDesdeCSV = async (csvBuffer, nombreArchivo) => {
  const formData = new FormData();
  formData.append('file', csvBuffer, { filename: nombreArchivo });
  
  const response = await axios.post(`${IA_SERVICE_URL}/api/ia/recomendaciones`, formData, {
    headers: formData.getHeaders()
  });
  
  return response.data;
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
