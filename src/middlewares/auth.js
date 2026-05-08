import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.js';
import {
  obtenerEstudianteAutenticado,
  obtenerUsuarioAutenticado,
  validarSesionEstudiante,
  validarSesionWeb,
} from '../services/session-access.service.js';

const extractToken = (req) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.split(' ')[1];
};

const isJwtLibraryError = (err) =>
  ['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(err?.name);

const resolveWebSession = async (token) => {
  const payload = jwt.verify(token, env.JWT_SECRET);
  const liveUser = await obtenerUsuarioAutenticado(payload.id);
  return validarSesionWeb(liveUser);
};

const resolveStudentSession = async (token) => {
  const payload = jwt.verify(token, env.JWT_STUDENT_SECRET);
  const liveStudent = await obtenerEstudianteAutenticado(payload.id);
  return validarSesionEstudiante(liveStudent);
};

export const requireAuth = async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next(new AppError('Token de acceso requerido', 401));

  try {
    req.user = await resolveWebSession(token);
    next();
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }
    next(new AppError(err.name === 'TokenExpiredError' ? 'Sesión expirada' : 'Token inválido', 401));
  }
};

export const requireEstudiante = async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next(new AppError('Token de estudiante requerido', 401));

  try {
    req.estudiante = await resolveStudentSession(token);
    next();
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }
    next(new AppError(err.name === 'TokenExpiredError' ? 'Sesión de estudiante expirada' : 'Token de estudiante inválido', 401));
  }
};

/**
 * Adjunta la sesión si el request trae un token válido, sin volver obligatoria
 * la autenticación para la ruta.
 *
 * CASO DE USO:
 * - rutas públicas que a veces necesitan personalizar la respuesta
 * - ejemplo: catálogo de logros público, pero con estado desbloqueado si
 *   el consumidor pide el detalle de un estudiante concreto
 */
export const attachOptionalSession = async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    req.user = await resolveWebSession(token);
    return next();
  } catch (webErr) {
    if (webErr instanceof AppError && webErr.status !== 401) {
      return next(webErr);
    }

    if (!(webErr instanceof AppError) && !isJwtLibraryError(webErr)) {
      return next(webErr);
    }
  }

  try {
    req.estudiante = await resolveStudentSession(token);
    return next();
  } catch (studentErr) {
    if (studentErr instanceof AppError) {
      return next(studentErr);
    }
    next(new AppError(studentErr.name === 'TokenExpiredError' ? 'Sesión expirada' : 'Token inválido', 401));
  }
};

export const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user?.rol)) {
    return next(new AppError('No tienes permisos para esta acción', 403));
  }
  next();
};
