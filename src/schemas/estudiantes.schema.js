import { z } from 'zod';

/** POST /api/estudiantes/login — login por QR */
export const loginEstudianteSchema = z.object({
  qr_token: z
    .string({ required_error: 'El QR token es obligatorio' })
    .trim()
    .min(6, 'El QR token debe tener al menos 6 caracteres')
    .max(120, 'El QR token no puede superar 120 caracteres'),
});

/** POST /api/estudiantes — crear estudiante */
export const crearEstudianteSchema = z.object({
  nombre: z
    .string({ required_error: 'El nombre es obligatorio' })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres'),

  edad: z
    .number({ required_error: 'La edad es obligatoria', invalid_type_error: 'La edad debe ser un número' })
    .int('La edad debe ser un número entero')
    .positive('La edad debe ser un número positivo'),

  grupo_id: z
    .number({ required_error: 'El grupo es obligatorio', invalid_type_error: 'El ID de grupo debe ser un número' })
    .int()
    .positive('El ID de grupo debe ser un número positivo'),
});

/** PUT /api/estudiantes/:id — actualizar estudiante */
export const actualizarEstudianteSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(100, 'El nombre no puede superar 100 caracteres')
      .optional(),

    edad: z
      .number({ invalid_type_error: 'La edad debe ser un número' })
      .int('La edad debe ser un número entero')
      .positive('La edad debe ser un número positivo')
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debes proporcionar al menos un campo para actualizar',
  });

/** PATCH /api/estudiantes/:id/grupo */
export const cambiarGrupoEstudianteSchema = z.object({
  grupo_id: z
    .number({ required_error: 'El grupo es obligatorio', invalid_type_error: 'El ID de grupo debe ser un número' })
    .int()
    .positive('El ID de grupo debe ser un número positivo'),
});

/** PATCH /api/estudiantes/:id/sesion */
export const toggleSesionSchema = z.object({
  sesion_activa: z.boolean({
    required_error: 'El campo sesion_activa es obligatorio',
    invalid_type_error: 'El campo sesion_activa debe ser true o false',
  }),
});

/** PATCH /api/estudiantes/sesion/grupo */
export const toggleSesionGrupoSchema = z.object({
  grupo_id: z
    .number({ required_error: 'El ID de grupo es obligatorio', invalid_type_error: 'El ID de grupo debe ser un número' })
    .int()
    .positive('El ID de grupo debe ser un número positivo'),

  sesion_activa: z.boolean({
    required_error: 'El campo sesion_activa es obligatorio',
    invalid_type_error: 'El campo sesion_activa debe ser true o false',
  }),
});
