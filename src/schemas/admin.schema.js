import { z } from 'zod';

/** PATCH /api/admin/usuarios/:id/estado */
export const cambiarEstadoUsuarioSchema = z.object({
  estado: z
    .string({ required_error: 'El estado es obligatorio' })
    .trim()
    .min(1, 'El estado no puede estar vacío'),
});

/** POST /api/admin/instituciones — crear institución */
export const crearInstitucionSchema = z.object({
  nombre: z
    .string({ required_error: 'El nombre de la institución es obligatorio' })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(150, 'El nombre no puede superar 150 caracteres'),

  ciudad: z
    .string()
    .trim()
    .max(100, 'La ciudad no puede superar 100 caracteres')
    .optional(),

  direccion: z
    .string()
    .trim()
    .max(200, 'La dirección no puede superar 200 caracteres')
    .optional(),

  telefono: z
    .string()
    .trim()
    .max(30, 'El teléfono no puede superar 30 caracteres')
    .optional(),
});

/** PATCH /api/admin/minijuegos/:id/toggle */
export const toggleMinijuegoSchema = z.object({
  activo: z.boolean({
    required_error: 'El campo activo es obligatorio',
    invalid_type_error: 'El campo activo debe ser true o false',
  }),
});
