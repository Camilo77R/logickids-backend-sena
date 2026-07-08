import * as svc from '../services/grupos.service.js';
import * as rankingSvc from '../services/ranking.service.js';
import { ok, created } from '../utils/response.js';

export const listar = async (req, res, next) => {
  try {
    const data = await svc.listar(req.user);
    ok(res, data, 'Grupos obtenidos correctamente');
  } catch (e) { next(e); }
};



export const obtener = async (req, res, next) => {
  try {
    const data = await svc.obtener(req.params.id, req.user);
    ok(res, data, 'Grupo obtenido correctamente');
  } catch (e) { next(e); }
};

export const obtenerRanking = async (req, res, next) => {
  try {
    const data = await rankingSvc.obtenerRankingGrupo(Number(req.params.id), req.user);
    ok(res, data, 'Ranking del grupo obtenido correctamente');
  } catch (e) { next(e); }
};

export const crear = async (req, res, next) => {
  try {
    const data = await svc.crear(req.user, req.body);
    created(res, data, 'Grupo creado correctamente');
  } catch (e) { next(e); }
};

export const actualizar = async (req, res, next) => {
  try {
    const data = await svc.actualizar(req.params.id, req.user, req.body);
    ok(res, data, 'Grupo actualizado correctamente');
  } catch (e) { next(e); }
};

export const eliminar = async (req, res, next) => {
  try {
    const data = await svc.eliminar(Number(req.params.id), req.user);
    ok(res, data, 'Grupo archivado correctamente');
  } catch (e) { next(e); }
};

export const archivar = async (req, res, next) => {
  try {
    const data = await svc.archivar(Number(req.params.id), req.user);
    ok(res, data, 'Grupo archivado correctamente');
  } catch (e) { next(e); }
};

export const restaurar = async (req, res, next) => {
  try {
    const data = await svc.restaurar(Number(req.params.id), req.user);
    ok(res, data, 'Grupo restaurado correctamente');
  } catch (e) { next(e); }
};

export const toggleSesion = async (req, res, next) => {
  try {
    const data = await svc.toggleSesion(Number(req.params.id), req.user, req.body);
    ok(
      res,
      data,
      `Sesión del grupo ${req.body.sesion_activa ? 'activada' : 'desactivada'} correctamente`
    );
  } catch (e) { next(e); }
};

export const asignarTutor = async (req, res, next) => {
  try {
    const data = await svc.asignarTutor(Number(req.params.id), req.user, req.body.tutor_id);
    ok(res, data, 'Tutor del grupo actualizado correctamente');
  } catch (e) { next(e); }
};
