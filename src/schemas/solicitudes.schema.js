import { z } from 'zod';

export const crearSolicitudReactivacionSchema = z.object({
  email: z
    .string({ required_error: 'El email de la cuenta es obligatorio' })
    .trim()
    .toLowerCase()
    .email('El email de la cuenta no tiene un formato válido'),

  correo_respuesta: z
    .union([
      z.string().trim().toLowerCase().email('El correo de respuesta no tiene un formato válido'),
      z.literal(''),
    ])
    .optional()
    .transform((value) => (value ? value : undefined)),

  motivo: z
    .string({ required_error: 'El motivo es obligatorio' })
    .trim()
    .min(5, 'El motivo debe tener al menos 5 caracteres')
    .max(160, 'El motivo no puede superar 160 caracteres'),

  descripcion: z
    .string()
    .trim()
    .max(1000, 'La descripción no puede superar 1000 caracteres')
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export const rechazarSolicitudSchema = z.object({
  motivo_rechazo: z
    .string({ required_error: 'El motivo de rechazo es obligatorio' })
    .trim()
    .min(5, 'El motivo de rechazo debe tener al menos 5 caracteres')
    .max(1000, 'El motivo de rechazo no puede superar 1000 caracteres'),
});
