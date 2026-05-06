import * as adminService from '../services/admin.service.js';
import { ok, created } from '../utils/response.js';

export const listarUsuarios = async (req, res, next) => {
  try {
    const data = await adminService.listarUsuarios(req.user.institucion_id);
    ok(res, data, 'Usuarios obtenidos correctamente');
  } catch (error) { next(error); }
};

export const obtenerUsuario = async (req, res, next) => {
  try {
    const data = await adminService.obtenerUsuario(Number(req.params.id), req.user);
    ok(res, data, 'Usuario obtenido correctamente');
  } catch (error) { next(error); }
};

export const cambiarEstadoUsuario = async (req, res, next) => {
  try {
    // Se pasa req.user para validar el scope de institución
    const data = await adminService.cambiarEstadoUsuario(req.params.id, req.body.estado, req.user);
    ok(res, data, 'Estado del usuario actualizado correctamente');
  } catch (error) { next(error); }
};

export const listarInstituciones = async (req, res, next) => {
  try {
    const data = await adminService.listarInstituciones();
    ok(res, data, 'Instituciones obtenidas correctamente');
  } catch (error) { next(error); }
};

export const crearInstitucion = async (req, res, next) => {
  try {
    const data = await adminService.crearInstitucion(req.body);
    created(res, data, 'Institución creada correctamente');
  } catch (error) { next(error); }
};

export const eliminarInstitucion = async (req, res, next) => {
  try {
    await adminService.eliminarInstitucion(Number(req.params.id));
    ok(res, { eliminada: true }, 'Institución eliminada correctamente');
  } catch (error) { next(error); }
};

export const actualizarInstitucion = async (req, res, next) => {
  try {
    const data = await adminService.actualizarInstitucion(Number(req.params.id), req.body);
    ok(res, data, 'Institución actualizada correctamente');
  } catch (error) { next(error); }
};

export const listarMinijuegos = async (req, res, next) => {
  try {
    const data = await adminService.listarMinijuegosAdmin();
    ok(res, data, 'Minijuegos obtenidos correctamente');
  } catch (error) { next(error); }
};

export const toggleMinijuego = async (req, res, next) => {
  try {
    const data = await adminService.toggleMinijuego(req.params.id, req.body.activo);
    ok(res, data, `Minijuego ${req.body.activo ? 'activado' : 'desactivado'} correctamente`);
  } catch (error) { next(error); }
};
