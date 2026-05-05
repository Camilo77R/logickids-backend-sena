import * as svc from '../services/grupos.service.js';
import { ok, created, noContent } from '../utils/response.js';

export const listar = async (req, res, next) => {
  try {
    const data = await svc.listar(req.user.id);
    ok(res, data, 'Grupos obtenidos correctamente');
  } catch (e) { next(e); }
};



export const obtener = async (req, res, next) => {
  try {
    const data = await svc.obtener(req.params.id, req.user.id);
    ok(res, data, 'Grupo obtenido correctamente');
  } catch (e) { next(e); }
};

export const crear = async (req, res, next) => {
  try {
    const data = await svc.crear(req.user.id, req.user.institucion_id, req.body);
    created(res, data, 'Grupo creado correctamente');
  } catch (e) { next(e); }
};

export const actualizar = async (req, res, next) => {
  try {
    const data = await svc.actualizar(req.params.id, req.user.id, req.body);
    ok(res, data, 'Grupo actualizado correctamente');
  } catch (e) { next(e); }
};

export const eliminar = async (req, res, next) => {
  try {
    await svc.eliminar(req.params.id, req.user.id);
    noContent(res);
  } catch (e) { next(e); }
};

export const toggleSesion = async (req, res, next) => {
  try {
    const data = await svc.toggleSesion(Number(req.params.id), req.user.id, req.body.sesion_activa);
    ok(
      res,
      data,
      `Sesión del grupo ${req.body.sesion_activa ? 'activada' : 'desactivada'} correctamente`
    );
  } catch (e) { next(e); }
};
