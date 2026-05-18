import { z } from 'zod';

/** POST /api/grupos — crear grupo */
export const crearGrupoSchema = z.object({
  nombre: z
    .string({ required_error: 'El nombre del grupo es obligatorio' })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres'),

  descripcion: z
    .string()
    .trim()
    .max(500, 'La descripción no puede superar 500 caracteres')
    .optional(),
});

/** PUT /api/grupos/:id — actualizar grupo */
export const actualizarGrupoSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(100, 'El nombre no puede superar 100 caracteres')
      .optional(),

    descripcion: z
      .string()
      .trim()
      .max(500, 'La descripción no puede superar 500 caracteres')
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debes proporcionar al menos un campo para actualizar',
  });

/** PATCH /api/grupos/:id/tutor */
export const asignarTutorGrupoSchema = z.object({
  tutor_id: z
    .number({ invalid_type_error: 'El ID del tutor debe ser un número' })
    .int()
    .positive('El ID del tutor debe ser positivo')
    .nullable(),
});

/** PATCH /api/grupos/:id/sesion */
export const toggleSesionGrupoSchema = z
  .object({
    sesion_activa: z.boolean({
      required_error: 'El campo sesion_activa es obligatorio',
      invalid_type_error: 'El campo sesion_activa debe ser true o false',
    }),
    minijuego_id: z
      .number({ invalid_type_error: 'El ID del minijuego debe ser un número' })
      .int()
      .positive('El ID del minijuego debe ser positivo')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sesion_activa === true && !data.minijuego_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minijuego_id'],
        message: 'Debes indicar el minijuego al abrir la sesión del grupo',
      });
    }
  });
