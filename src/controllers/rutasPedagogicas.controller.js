import * as svc from '../services/rutasPedagogicas.service.js';
import { ok } from '../utils/response.js';

export const listar = async (_req, res, next) => {
  try {
    const data = await svc.listar();
    ok(res, data, 'Rutas pedagógicas obtenidas correctamente');
  } catch (error) {
    next(error);
  }
};
