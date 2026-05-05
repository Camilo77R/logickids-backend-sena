import * as svc from '../services/minijuegos.service.js';
import { ok, created } from '../utils/response.js';

export const listar = async (req, res, next) => {
  try {
    const data = await svc.listar();
    ok(res, data, 'Minijuegos obtenidos correctamente');
  } catch (e) { next(e); }
};

export const obtener = async (req, res, next) => {
  try {
    const data = await svc.obtener(req.params.id);
    ok(res, data, 'Minijuego obtenido correctamente');
  } catch (e) { next(e); }
};

export const crear = async (req, res, next) => {
  try {
    const data = await svc.crear(req.body);
    created(res, data, 'Minijuego creado correctamente');
  } catch (e) { next(e); }
};

export const toggleActivo = async (req, res, next) => {
  try {
    const data = await svc.actualizar(Number(req.params.id), { activo: req.body.activo });
    ok(res, data, `Minijuego ${data.activo ? 'activado' : 'desactivado'} correctamente`);
  } catch (e) { next(e); }
};
