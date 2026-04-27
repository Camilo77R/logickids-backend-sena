import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.js';

const extractToken = (req) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.split(' ')[1];
};

export const requireAuth = (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next(new AppError('Token de acceso requerido', 401));

  try {
    req.user = jwt.verify(token, env.JWT_SECRET);
    next();
  } catch (err) {
    next(new AppError(err.name === 'TokenExpiredError' ? 'Sesión expirada' : 'Token inválido', 401));
  }
};

export const requireEstudiante = (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next(new AppError('Token de estudiante requerido', 401));

  try {
    req.estudiante = jwt.verify(token, env.JWT_STUDENT_SECRET);
    next();
  } catch {
    next(new AppError('Token de estudiante inválido', 401));
  }
};

export const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user?.rol)) {
    return next(new AppError('No tienes permisos para esta acción', 403));
  }
  next();
};
