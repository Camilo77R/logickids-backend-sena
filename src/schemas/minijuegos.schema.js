import { z } from 'zod';

/** POST /api/minijuegos — crear minijuego (admin) */
export const crearMinijuegoSchema = z.object({
  slug: z
    .string({ required_error: 'El slug es obligatorio' })
    .trim()
    .min(2, 'El slug debe tener al menos 2 caracteres')
    .max(50, 'El slug no puede superar 50 caracteres')
    .regex(/^[a-z0-9-]+$/, 'El slug solo puede tener letras minúsculas, números y guiones'),

  titulo: z
    .string({ required_error: 'El título es obligatorio' })
    .trim()
    .min(2, 'El título debe tener al menos 2 caracteres')
    .max(100, 'El título no puede superar 100 caracteres'),

  descripcion: z
    .string()
    .trim()
    .max(1000, 'La descripción no puede superar 1000 caracteres')
    .optional(),

  habilidad: z
    .string({ required_error: 'La habilidad es obligatoria' })
    .trim()
    .min(2, 'La habilidad es obligatoria')
    .max(50, 'La habilidad no puede superar 50 caracteres'),

  dificultad_maxima: z
    .number({ invalid_type_error: 'La dificultad máxima debe ser un número' })
    .int()
    .min(1, 'La dificultad máxima mínima es 1')
    .max(10, 'La dificultad máxima no puede superar 10')
    .optional(),

  visible_en_catalogo: z.boolean().optional(),

  orden_catalogo: z
    .number({ invalid_type_error: 'El orden del catálogo debe ser un número' })
    .int()
    .min(1, 'El orden del catálogo debe ser positivo')
    .optional(),
});

/** PATCH /api/minijuegos/:id/estado — toggle activo */
export const toggleActivoSchema = z.object({
  activo: z.boolean({
    required_error: 'El campo activo es obligatorio',
    invalid_type_error: 'El campo activo debe ser true o false',
  }),
});
