import * as svc from '../services/logros.service.js';
import { AppError } from '../middlewares/errorHandler.js';
import { ok, created } from '../utils/response.js';

export const catalogo = async (req, res, next) => {
  try {
    // Permite marcar logros como desbloqueados si se pasa ?estudiante_id=
    // o si el que consulta es un estudiante autenticado (HU-25)
    const estudiante_id = req.estudiante?.id ?? (req.query.estudiante_id ? Number(req.query.estudiante_id) : null);
    const data = await svc.listarCatalogo(estudiante_id);
    ok(res, data, 'Catálogo de logros obtenido correctamente');
  } catch (e) { next(e); }
};

export const misLogros = async (req, res, next) => {
  try {
    const data = await svc.listarPorEstudiante(req.estudiante.id);
    ok(res, data, 'Logros del estudiante obtenidos correctamente');
  } catch (e) { next(e); }
};

export const listar = async (req, res, next) => {
  try {
    const data = await svc.listar(Number(req.params.id), req.user);
    ok(res, data, 'Logros del estudiante obtenidos correctamente');
  } catch (e) { next(e); }
};

export const desbloquear = async (req, res, next) => {
  try {
    const requestedStudentId = req.params.id ? Number(req.params.id) : req.estudiante.id;
    if (requestedStudentId !== req.estudiante.id) {
      throw new AppError('No puedes desbloquear logros para otro estudiante', 403);
    }

    const data = await svc.desbloquear(req.estudiante.id, req.body.clave_logro);
    created(res, data, 'Logro desbloqueado correctamente');
  } catch (e) { next(e); }
};