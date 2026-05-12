import { ZodError } from 'zod';
import { AppError } from '../middlewares/errorHandler.js';

const STATUS_ERROR_CODES = Object.freeze({
  400: 'INVALID_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
});

export class SocketAppError extends AppError {
  constructor(code, message, statusCode = 400) {
    super(message, statusCode);
    this.code = code;
  }
}

const mapStatusToCode = (statusCode) => STATUS_ERROR_CODES[statusCode] ?? 'SOCKET_ERROR';

export const buildSocketErrorPayload = (error) => {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof ZodError) {
    return {
      code: 'INVALID_PAYLOAD',
      message: 'Datos del evento invalidos',
      details: error.errors.map(({ path, message }) => ({
        field: path.join('.') || 'payload',
        message,
      })),
    };
  }

  if (error instanceof SocketAppError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof AppError) {
    return {
      code: mapStatusToCode(error.statusCode),
      message: error.message,
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    message: 'Error interno del servidor',
  };
};

export const emitSocketError = (socket, eventName, error) => {
  socket.emit(eventName, buildSocketErrorPayload(error));
};

export const toSocketConnectError = (error) => {
  const payload = buildSocketErrorPayload(error);
  const connectError = new Error(payload.message);
  connectError.data = payload;
  return connectError;
};
