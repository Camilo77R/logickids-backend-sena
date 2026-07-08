import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(message, statusCode = 500, extra = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.extra = extra;  // <--- NUEVO: permite datos adicionales
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err, _req, res, _next) => {
  if (typeof err?.message === 'string' && err.message.startsWith('CORS bloqueado')) {
    return res.status(403).json({ success: false, message: err.message });
  }

  // Errores de validación de Zod (si alguno llega aquí sin pasar por validate())
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: err.errors.map(({ path, message }) => ({
        field: path.join('.') || 'body',
        message,
      })),
    });
  }

  // Errores operacionales controlados (AppError)
  if (err.isOperational) {
    // Enviar respuesta con datos extra si existen
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.extra && { ...err.extra })  // <--- NUEVO: incluye datos extra (ej: estado, email)
    });
  }

  // Errores inesperados — no exponer detalles al cliente
  console.error(' Error inesperado:', err);
  res.status(500).json({ success: false, message: 'Error interno del servidor' });
};