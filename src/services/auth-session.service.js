import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../middlewares/errorHandler.js';
import { REALTIME_ACTOR_TYPES } from '../realtime/realtime.contract.js';
import {
  obtenerEstudianteAutenticado,
  obtenerUsuarioAutenticado,
  validarSesionEstudiante,
  validarSesionWeb,
} from './session-access.service.js';

const JWT_LIBRARY_ERRORS = new Set(['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError']);

const toSessionResolutionError = (error, { expiredMessage, invalidMessage }) => {
  if (error instanceof AppError) {
    return error;
  }

  if (error?.name === 'TokenExpiredError') {
    return new AppError(expiredMessage, 401);
  }

  if (JWT_LIBRARY_ERRORS.has(error?.name)) {
    return new AppError(invalidMessage, 401);
  }

  return error;
};

/**
 * Resuelve un token web hasta su sesion viva en base de datos.
 *
 * POR QUE:
 * - el JWT solo dice quien inicio sesion
 * - la base de datos nos dice si todavia puede operar
 */
export const resolveWebSessionFromToken = async (token) => {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    const liveUser = await obtenerUsuarioAutenticado(payload.id);
    return validarSesionWeb(liveUser);
  } catch (error) {
    throw toSessionResolutionError(error, {
      expiredMessage: 'Sesion expirada',
      invalidMessage: 'Token invalido',
    });
  }
};

/**
 * Resuelve un token infantil hasta la sesion viva del estudiante.
 *
 * ANALOGIA:
 * el QR/JWT es la escarapela del nino; la base confirma si el colegio sigue
 * abierto y si ese nino sigue habilitado para entrar.
 */
export const resolveStudentSessionFromToken = async (token) => {
  try {
    const payload = jwt.verify(token, env.JWT_STUDENT_SECRET);
    const liveStudent = await obtenerEstudianteAutenticado(payload.id);
    return validarSesionEstudiante(liveStudent);
  } catch (error) {
    throw toSessionResolutionError(error, {
      expiredMessage: 'Sesion de estudiante expirada',
      invalidMessage: 'Token de estudiante invalido',
    });
  }
};

const isUnauthorizedError = (error) => error instanceof AppError && error.statusCode === 401;

/**
 * Resuelve un actor realtime sin acoplar sockets a un solo tipo de JWT.
 *
 * QUÉ:
 * - primero intentamos sesión web
 * - solo si el token realmente no corresponde, caemos a sesión infantil
 *
 * POR QUÉ:
 * - un 403 de un tutor deshabilitado no debe reintentarse como estudiante
 * - un token infantil válido sí debe poder reutilizar la misma infraestructura
 */
export const resolveRealtimeActorFromToken = async (token) => {
  try {
    const webSession = await resolveWebSessionFromToken(token);
    return {
      actorType: REALTIME_ACTOR_TYPES.web,
      id: webSession.id,
      institucion_id: webSession.institucion_id ?? null,
      session: webSession,
    };
  } catch (webError) {
    if (!isUnauthorizedError(webError)) {
      throw webError;
    }
  }

  const studentSession = await resolveStudentSessionFromToken(token);
  return {
    actorType: REALTIME_ACTOR_TYPES.student,
    id: studentSession.id,
    grupo_id: studentSession.grupo_id ?? null,
    institucion_id: studentSession.institucion_id ?? null,
    session: studentSession,
  };
};
