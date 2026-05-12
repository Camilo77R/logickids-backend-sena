import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err, _req, res, _next) => {
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
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }

  // Errores inesperados — no exponer detalles al cliente
  console.error(' Error inesperado:', err);
  res.status(500).json({ success: false, message: 'Error interno del servidor' });
};
