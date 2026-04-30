import * as svc from '../services/estudiantes.service.js';
import { ok, created, noContent } from '../utils/response.js';

export const loginEstudiante = async (req, res, next) => {
  try {
    const data = await svc.loginEstudiante(req.body.qr_token);
    ok(res, data, 'Sesión de estudiante iniciada correctamente');
  } catch (e) { next(e); }
};

export const miPerfil = async (req, res, next) => {
  try {
    const data = await svc.obtenerPerfilInfantil(req.estudiante.id);
    ok(res, data, 'Perfil infantil obtenido correctamente');
  } catch (e) { next(e); }
};

export const listar = async (req, res, next) => {
  try {
    const data = await svc.listar(req.user, req.query.grupo_id ? Number(req.query.grupo_id) : undefined);
    ok(res, data, 'Estudiantes obtenidos correctamente');
  } catch (e) { next(e); }
};

export const listarTodos = async (req, res, next) => {
  try {
    const data = await svc.listarTodos(req.user, req.query.grupo_id ? Number(req.query.grupo_id) : undefined);
    ok(res, data, 'Todos los estudiantes obtenidos correctamente');
  } catch (e) { next(e); }
};

export const obtener = async (req, res, next) => {
  try {
    const data = await svc.obtener(Number(req.params.id), req.user);
    ok(res, data, 'Estudiante obtenido correctamente');
  } catch (e) { next(e); }
};

export const crear = async (req, res, next) => {
  try {
    const data = await svc.crear(req.user, req.body);
    created(res, data, 'Estudiante creado correctamente');
  } catch (e) { next(e); }
};

export const actualizar = async (req, res, next) => {
  try {
    const data = await svc.actualizar(Number(req.params.id), req.user, req.body);
    ok(res, data, 'Estudiante actualizado correctamente');
  } catch (e) { next(e); }
};

export const desactivar = async (req, res, next) => {
  try {
    await svc.desactivar(Number(req.params.id), req.user);
    noContent(res);
  } catch (e) { next(e); }
};

export const reactivar = async (req, res, next) => {
  try {
    const data = await svc.reactivar(Number(req.params.id), req.user);
    ok(res, data, 'Estudiante reactivado correctamente');
  } catch (e) { next(e); }
};

export const obtenerQr = async (req, res, next) => {
  try {
    const data = await svc.obtenerQR(Number(req.params.id), req.user);
    ok(res, data, 'QR del estudiante obtenido correctamente');
  } catch (e) { next(e); }
};

export const toggleSesion = async (req, res, next) => {
  try {
    await svc.toggleSesion(Number(req.params.id), req.user, req.body.sesion_activa);
    ok(res, { actualizado: true }, `Sesión ${req.body.sesion_activa ? 'activada' : 'desactivada'} correctamente`);
  } catch (e) { next(e); }
};

export const toggleSesionGrupo = async (req, res, next) => {
  try {
    const data = await svc.toggleSesionGrupo(req.body.grupo_id, req.user, req.body.sesion_activa);
    ok(res, data, `Sesión del grupo ${req.body.sesion_activa ? 'activada' : 'desactivada'} correctamente`);
  } catch (e) { next(e); }
};

export const cambiarGrupo = async (req, res, next) => {
  try {
    const data = await svc.cambiarGrupo(Number(req.params.id), req.user, req.body.grupo_id);
    ok(res, data, 'Grupo del estudiante actualizado correctamente');
  } catch (e) { next(e); }
};
