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
    niveles: z
      .number({ invalid_type_error: 'La cantidad de niveles debe ser un número' })
      .int()
      .min(1, 'La sesión debe tener al menos un nivel')
      .max(10, 'La sesión no puede superar 10 niveles por bloque')
      .optional(),
    ruta_id: z
      .number({ invalid_type_error: 'El ID de la ruta debe ser un número' })
      .int()
      .positive('El ID de la ruta debe ser positivo')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sesion_activa !== true) {
      return;
    }

    if (!data.modo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['modo'],
        message: 'Debes indicar si la actividad es single o path',
      });

      return;
    }

    if (data.modo === 'single') {
      if (!data.minijuego_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['minijuego_id'],
          message: 'Debes indicar el minijuego de la actividad single',
        });
      }

      if (data.ruta_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ruta_id'],
          message: 'Una actividad single no recibe ruta pedagógica',
        });
      }
    }

    if (data.modo === 'path') {
      if (!data.ruta_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ruta_id'],
          message: 'Debes indicar la ruta pedagógica para abrir una actividad path',
        });
      }

      if (data.minijuego_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['minijuego_id'],
          message: 'Una actividad path no se abre con un minijuego individual',
        });
      }

      if (data.niveles != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['niveles'],
          message: 'La cantidad de niveles de una actividad path la define la ruta pedagógica',
        });
      }
    }
  });
