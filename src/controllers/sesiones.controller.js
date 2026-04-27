import * as svc from '../services/sesiones.service.js';
import { ok, created } from '../utils/response.js';

/** POST /api/sesiones/iniciar — requiere JWT de estudiante */
export const iniciar = async (req, res, next) => {
  try {
    const data = await svc.iniciar(req.estudiante.id, req.body);
    created(res, data, 'Sesión de juego iniciada correctamente');
  } catch (e) { next(e); }
};

/** POST /api/sesiones/:id/eventos — requiere JWT de estudiante */
export const registrarEvento = async (req, res, next) => {
  try {
    const data = await svc.registrarEvento(Number(req.params.id), req.estudiante.id, req.body);
    created(res, data, 'Evento registrado correctamente');
  } catch (e) { next(e); }
};

/** POST /api/sesiones/:id/finalizar — requiere JWT de estudiante */
export const finalizar = async (req, res, next) => {
  try {
    const data = await svc.finalizar(Number(req.params.id), req.estudiante.id, req.body);
    ok(res, data, 'Sesión de juego finalizada correctamente');
  } catch (e) { next(e); }
};

/** GET /api/sesiones/estudiante/:id — requiere JWT de adulto */
export const historial = async (req, res, next) => {
  try {
    const data = await svc.historial(Number(req.params.id), req.user);
    ok(res, data, 'Historial de sesiones obtenido correctamente');
  } catch (e) { next(e); }
};

/** GET /api/sesiones/mis-sesiones — requiere JWT de estudiante */
export const miHistorial = async (req, res, next) => {
  try {
    const data = await svc.listarHistorialEstudiante(req.estudiante.id);
    ok(res, data, 'Historial del estudiante obtenido correctamente');
  } catch (e) { next(e); }
};

/** GET /api/sesiones/:id/eventos — requiere JWT de adulto */
export const detalleEventos = async (req, res, next) => {
  try {
    const data = await svc.detalleEventos(Number(req.params.id), req.user);
    ok(res, data, 'Detalle de eventos obtenido correctamente');
  } catch (e) { next(e); }
};