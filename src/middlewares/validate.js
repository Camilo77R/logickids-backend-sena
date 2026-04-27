import { ZodError } from 'zod';

/**
 * Formatea los errores de Zod en un array limpio de mensajes por campo.
 * @param {ZodError} error
 * @returns {{ field: string; message: string }[]}
 */
const formatZodErrors = (error) =>
  error.errors.map(({ path, message }) => ({
    field: path.join('.') || 'body',
    message,
  }));

/**
 * Middleware factory que valida req.body contra un schema de Zod.
 * Si la validación pasa, reemplaza req.body con los datos parseados
 * (ya transformados: trim, toLowerCase, defaults, etc.).
 *
 * @param {import('zod').ZodTypeAny} schema
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.post('/registro', validate(registroSchema), ctrl.registro);
 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: formatZodErrors(result.error),
    });
  }

  // Sustituimos req.body con los datos limpios y transformados por Zod
  req.body = result.data;
  next();
};
