import { z } from 'zod';

/** POST /api/logros/desbloquear */
export const desbloquearLogroSchema = z.object({
  clave_logro: z
    .string({ required_error: 'La clave del logro es obligatoria' })
    .trim()
    .min(1, 'La clave del logro no puede estar vacía')
    .max(50, 'La clave del logro no puede superar 50 caracteres'),
});