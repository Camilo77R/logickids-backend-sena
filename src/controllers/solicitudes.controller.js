import * as svc from '../services/solicitudes.service.js';
import { created, ok } from '../utils/response.js';

export const crearSolicitudReactivacion = async (req, res, next) => {
  try {
    const data = await svc.crearSolicitudReactivacion(req.body);
    created(res, data, 'Solicitud enviada correctamente');
  } catch (error) { next(error); }
};

export const listarSolicitudes = async (req, res, next) => {
  try {
    const data = await svc.listarSolicitudes(req.user);
    ok(res, data, 'Solicitudes obtenidas correctamente');
  } catch (error) { next(error); }
};

export const obtenerSolicitud = async (req, res, next) => {
  try {
    const data = await svc.obtenerSolicitud(Number(req.params.id), req.user);
    ok(res, data, 'Solicitud obtenida correctamente');
  } catch (error) { next(error); }
};

export const aprobarSolicitud = async (req, res, next) => {
  try {
    const data = await svc.aprobarSolicitud(Number(req.params.id), req.user);
    ok(res, data, 'Solicitud aprobada correctamente');
  } catch (error) { next(error); }
};

export const rechazarSolicitud = async (req, res, next) => {
  try {
    const data = await svc.rechazarSolicitud(
      Number(req.params.id),
      req.user,
      req.body.motivo_rechazo
    );
    ok(res, data, 'Solicitud rechazada correctamente');
  } catch (error) { next(error); }
};
