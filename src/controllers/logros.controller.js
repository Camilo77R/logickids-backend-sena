import * as svc from '../services/logros.service.js';
import { AppError } from '../middlewares/errorHandler.js';
import { ok, created } from '../utils/response.js';

export const catalogo = async (req, res, next) => {
  try {
    const requestedStudentId = req.query.estudiante_id ? Number(req.query.estudiante_id) : null;

    if (!requestedStudentId) {
      const data = await svc.listarCatalogo();
      return ok(res, data, 'Catálogo de logros obtenido correctamente');
    }

    if (!Number.isInteger(requestedStudentId) || requestedStudentId <= 0) {
      throw new AppError('El parámetro estudiante_id no es válido', 400);
    }

    if (req.estudiante?.id === requestedStudentId) {
      const data = await svc.listarCatalogo(requestedStudentId);
      return ok(res, data, 'Catálogo de logros obtenido correctamente');
    }

    if (req.user) {
      const data = await svc.listarCatalogoTutor(requestedStudentId, req.user);
      return ok(res, data, 'Catálogo de logros obtenido correctamente');
    }

    throw new AppError(
      'Debes autenticarte para consultar el estado de logros de un estudiante específico',
      401
    );

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
