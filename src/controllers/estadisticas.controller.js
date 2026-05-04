import * as svc from '../services/estadisticas.service.js';
import { ok } from '../utils/response.js';

export const porEstudiante = async (req, res, next) => {
  try {
    const data = await svc.obtenerEstudiante(Number(req.params.id), req.user);
    ok(res, data, 'Estadísticas del estudiante obtenidas correctamente');
  } catch (e) { next(e); }
};

export const misEstadisticas = async (req, res, next) => {
  try {
    const data = await svc.listarStatsEstudiante(req.estudiante.id);
    ok(res, data, 'Estadísticas del estudiante obtenidas correctamente');
  } catch (e) { next(e); }
};

export const porGrupo = async (req, res, next) => {
  try {
    const data = await svc.obtenerGrupo(Number(req.params.id), req.user);
    ok(res, data, 'Estadísticas del grupo obtenidas correctamente');
  } catch (e) { next(e); }
};
