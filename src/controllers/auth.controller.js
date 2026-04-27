import * as svc from '../services/auth.service.js';
import { ok, created } from '../utils/response.js';

export const registro = async (req, res, next) => {
  try {
    const data = await svc.registrar(req.body);
    created(res, data, 'Cuenta creada correctamente');
  } catch (e) { next(e); }
};

export const login = async (req, res, next) => {
  try {
    const data = await svc.login(req.body);
    ok(res, data, 'Sesión iniciada correctamente');
  } catch (e) { next(e); }
};

export const perfil = async (req, res, next) => {
  try {
    const data = await svc.obtenerPerfil(req.user.id);
    ok(res, data, 'Perfil obtenido correctamente');
  } catch (e) { next(e); }
};

export const actualizarPerfil = async (req, res, next) => {
  try {
    const data = await svc.actualizarPerfil(req.user.id, req.body);
    ok(res, data, 'Perfil actualizado correctamente');
  } catch (e) { next(e); }
};

export const cambiarContrasena = async (req, res, next) => {
  try {
    await svc.cambiarContrasena(
      req.user.id,
      req.body.contrasena_actual,
      req.body.contrasena_nueva
    );
    ok(res, { actualizada: true }, 'Contraseña actualizada correctamente');
  } catch (e) { next(e); }
};
