import * as svc from '../services/recomendaciones.service.js';
import { ok, created, noContent } from '../utils/response.js';

export const porEstudiante = async (req, res, next) => {
  try {
    const data = await svc.listarEstudiante(Number(req.params.id), req.user);
    ok(res, data, 'Recomendaciones del estudiante obtenidas correctamente');
  } catch (e) { next(e); }
};

export const porGrupo = async (req, res, next) => {
  try {
    const data = await svc.listarGrupo(Number(req.params.id), req.user);
    ok(res, data, 'Recomendaciones del grupo obtenidas correctamente');
  } catch (e) { next(e); }
};

export const generarEstudiante = async (req, res, next) => {
  try {
    const data = await svc.generarParaEstudiante(Number(req.params.id), req.user);
    created(res, data, 'Recomendación generada para el estudiante correctamente');
  } catch (e) { next(e); }
};

export const generarGrupo = async (req, res, next) => {
  try {
    const data = await svc.generarParaGrupo(Number(req.params.id), req.user);
    created(res, data, 'Recomendación generada para el grupo correctamente');
  } catch (e) { next(e); }
};

export const archivar = async (req, res, next) => {
  try {
    await svc.archivar(Number(req.params.id), req.user);
    noContent(res);
  } catch (e) { next(e); }
};
