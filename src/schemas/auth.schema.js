import { z } from 'zod';

/** POST /api/auth/registro */
export const registroSchema = z.object({
  nombre: z
    .string({ required_error: 'El nombre es obligatorio' })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres'),

  email: z
    .string({ required_error: 'El email es obligatorio' })
    .trim()
    .toLowerCase()
    .email('El email no tiene un formato válido'),

  contrasena: z
    .string({ required_error: 'La contraseña es obligatoria' })
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .max(128, 'La contraseña no puede superar 128 caracteres'),

  rol: z.literal('tutor').optional().default('tutor'),

  institucion_id: z
    .number()
    .int('El ID de la institución debe ser un número entero')
    .positive('El ID de la institución debe ser positivo')
    .optional(),
});

/** POST /api/auth/login */
export const loginSchema = z.object({
  email: z
    .string({ required_error: 'El email es obligatorio' })
    .trim()
    .toLowerCase()
    .email('El email no tiene un formato válido'),

  contrasena: z
    .string({ required_error: 'La contraseña es obligatoria' })
    .min(1, 'La contraseña es obligatoria'),
});

/** PUT /api/auth/perfil */
export const actualizarPerfilSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(100, 'El nombre no puede superar 100 caracteres')
      .optional(),

    institucion_id: z
      .number()
      .int('El ID de la institución debe ser un número entero')
      .positive('El ID de la institución debe ser positivo')
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debes proporcionar al menos un campo para actualizar',
  });

/** PUT /api/auth/cambiar-contrasena */
export const cambiarContrasenaSchema = z.object({
  contrasena_actual: z
    .string({ required_error: 'La contraseña actual es obligatoria' })
    .min(1, 'La contraseña actual es obligatoria'),

  contrasena_nueva: z
    .string({ required_error: 'La nueva contraseña es obligatoria' })
    .min(6, 'La nueva contraseña debe tener al menos 6 caracteres')
    .max(128, 'La nueva contraseña no puede superar 128 caracteres'),
});
