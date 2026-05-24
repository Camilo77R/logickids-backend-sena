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
    modo: z.enum(['single', 'path']).optional(),
    minijuego_id: z
      .number({ invalid_type_error: 'El ID del minijuego debe ser un número' })
      .int()
      .positive('El ID del minijuego debe ser positivo')
      .optional(),
    pasos: z
      .array(
        z.object({
          minijuego_id: z
            .number({ invalid_type_error: 'El ID del minijuego debe ser un número' })
            .int()
            .positive('El ID del minijuego debe ser positivo'),
          configuracion_base: z.record(z.any()).optional(),
        })
      )
      .max(25, 'La sesión no puede tener más de 25 pasos configurados')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sesion_activa !== true) {
      return;
    }

    const tienePasos = Array.isArray(data.pasos) && data.pasos.length > 0;
    const tieneMinijuegoSingle = Boolean(data.minijuego_id);

    if (!tienePasos && !tieneMinijuegoSingle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minijuego_id'],
        message: 'Debes indicar un minijuego o una ruta de pasos para abrir la sesión del grupo',
      });
    }

    if (data.modo === 'single' && tienePasos && data.pasos.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pasos'],
        message: 'Una sesión single solo puede abrirse con un paso',
      });
    }

    if (data.modo === 'path' && (!tienePasos || data.pasos.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pasos'],
        message: 'Una sesión path requiere al menos dos minijuegos',
      });
    }
  });
