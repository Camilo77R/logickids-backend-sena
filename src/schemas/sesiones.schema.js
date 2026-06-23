import { z } from 'zod';

const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8, 'La clave idempotente es demasiado corta')
  .max(128, 'La clave idempotente es demasiado larga')
  .optional();

/** POST /api/sesiones/iniciar */
export const iniciarSesionSchema = z.object({
  attempt_id: idempotencyKeySchema,

  minijuego_id: z
    .number({ invalid_type_error: 'El ID del minijuego debe ser un número' })
    .int()
    .positive('El ID del minijuego debe ser un número positivo')
    .optional(),

  dificultad: z
    .number({ invalid_type_error: 'El nivel debe ser un número' })
    .int()
    .min(1, 'El nivel mínimo es 1')
    .max(10, 'El nivel máximo es 10')
    .optional(),
});

/** POST /api/sesiones/:id/eventos */
export const registrarEventoSchema = z.object({
  event_id: idempotencyKeySchema,
  sequence: z
    .number({ invalid_type_error: 'La secuencia debe ser un numero' })
    .int()
    .positive('La secuencia debe ser positiva')
    .optional(),

  tipo_evento: z
    .string({ required_error: 'El tipo de evento es obligatorio' })
    .trim()
    .min(1, 'El tipo de evento no puede estar vacío')
    .max(50, 'El tipo de evento no puede superar 50 caracteres'),

  habilidad: z
    .string()
    .trim()
    .max(50, 'La habilidad no puede superar 50 caracteres')
    .optional(),

  tiempo_reaccion_ms: z
    .number({ invalid_type_error: 'El tiempo de reacción debe ser un número' })
    .int()
    .min(0, 'El tiempo de reacción no puede ser negativo')
    .optional(),

  puntos: z
    .number({ invalid_type_error: 'Los puntos deben ser un número' })
    .int()
    .min(0, 'Los puntos no pueden ser negativos')
    .optional(),

  combo_en_evento: z
    .number({ invalid_type_error: 'El combo debe ser un número' })
    .int()
    .min(0, 'El combo no puede ser negativo')
    .optional(),

  metadata: z.record(z.any()).optional(),
});

/** POST /api/sesiones/:id/finalizar */
export const finalizarSesionSchema = z.object({
  finalization_id: idempotencyKeySchema,

  puntaje: z
    .number({ invalid_type_error: 'El puntaje debe ser un número' })
    .min(0, 'El puntaje no puede ser negativo')
    .max(10000, 'El puntaje supera el límite permitido')
    .optional(),

  aciertos: z
    .number({ invalid_type_error: 'Los aciertos deben ser un número' })
    .int()
    .min(0, 'Los aciertos no pueden ser negativos')
    .optional(),

  errores: z
    .number({ invalid_type_error: 'Los errores deben ser un número' })
    .int()
    .min(0, 'Los errores no pueden ser negativos')
    .optional(),

  combo_maximo: z
    .number({ invalid_type_error: 'El combo máximo debe ser un número' })
    .int()
    .min(0, 'El combo máximo no puede ser negativo')
    .optional(),

  dificultad: z
    .number({ invalid_type_error: 'La dificultad debe ser un número' })
    .int()
    .min(1, 'La dificultad mínima es 1')
    .max(10, 'La dificultad máxima es 10')
    .optional(),

  estado: z
    .enum(['completado', 'abandonado'], {
      invalid_type_error: 'El estado no es válido',
    })
    .optional(),
});

export const guardarCheckpointSchema = z.object({
  expected_version: z
    .number({
      required_error: 'La versión esperada es obligatoria',
      invalid_type_error: 'La versión esperada debe ser un número',
    })
    .int()
    .min(0, 'La versión esperada no puede ser negativa'),
  state: z
    .record(z.any(), { required_error: 'El estado del checkpoint es obligatorio' })
    .refine(
      (value) => Buffer.byteLength(JSON.stringify(value), 'utf8') <= 64 * 1024,
      'El checkpoint no puede superar 64 KB'
    ),
});
