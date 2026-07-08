import * as svc from '../services/estudiantes.service.js';
import * as rankingSvc from '../services/ranking.service.js';
import { ok, created, noContent } from '../utils/response.js';

export const loginEstudiante = async (req, res, next) => {
  try {
    const data = await svc.loginEstudiante(req.body, { ip: req.ip });
    ok(res, data, 'Sesión de estudiante iniciada correctamente');
  } catch (e) { next(e); }
};

export const logoutEstudiante = async (req, res, next) => {
  try {
    const data = await svc.logoutEstudiante(req.estudiante.device_session_id);
    ok(res, data, 'Sesión de dispositivo cerrada correctamente');
  } catch (e) { next(e); }
};

export const obtenerSesionDispositivoActiva = async (req, res, next) => {
  try {
    const data = await svc.obtenerSesionDispositivoActiva(Number(req.params.id), req.user);
    const message = data.tiene_dispositivo_activo
      ? 'Sesion de dispositivo obtenida correctamente'
      : 'El estudiante no tiene una sesion de dispositivo activa';
    ok(res, data, message);
  } catch (e) { next(e); }
};

export const recuperarSesionDispositivo = async (req, res, next) => {
  try {
    const data = await svc.recuperarSesionDispositivo(
      Number(req.params.id),
      req.user,
      req.body.action
    );
    ok(res, data, 'Acceso recuperado y actividad actual reiniciada correctamente');
  } catch (e) { next(e); }
};

export const miPerfil = async (req, res, next) => {
  try {
    const data = await svc.obtenerPerfilInfantil(req.estudiante.id);
    ok(res, data, 'Perfil infantil obtenido correctamente');
  } catch (e) { next(e); }
};

export const miRanking = async (req, res, next) => {
  try {
    const data = await rankingSvc.obtenerMiRanking(req.estudiante.id);
    ok(res, data, 'Ranking del estudiante obtenido correctamente');
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

export const cambiarGrupo = async (req, res, next) => {
  try {
    const data = await svc.cambiarGrupo(Number(req.params.id), req.user, req.body.grupo_id);
    ok(res, data, 'Grupo del estudiante actualizado correctamente');
  } catch (e) { next(e); }
};
