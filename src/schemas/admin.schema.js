import { z } from 'zod';

const crearUsuarioInstitucionalBaseSchema = z.object({
  nombre: z
    .string({ required_error: 'El nombre es obligatorio' })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres'),

  email: z
    .string({ required_error: 'El email es obligatorio' })
    .trim()
    .email('El email no tiene un formato válido')
    .max(150, 'El email no puede superar 150 caracteres'),

  institucion_id: z
    .number({ invalid_type_error: 'El ID de institución debe ser numérico' })
    .int()
    .positive('El ID de institución debe ser positivo')
    .optional(),
});

/** PATCH /api/admin/usuarios/:id/estado */
export const cambiarEstadoUsuarioSchema = z.object({
  estado: z
    .string({ required_error: 'El estado es obligatorio' })
    .trim()
    .min(1, 'El estado no puede estar vacío'),
});

/** POST /api/admin/usuarios/admins */
export const crearAdminInstitucionalSchema = crearUsuarioInstitucionalBaseSchema;

/** POST /api/admin/usuarios/tutores */
export const crearTutorInstitucionalSchema = crearUsuarioInstitucionalBaseSchema;

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

/** PUT /api/admin/instituciones/:id — actualizar datos de una institución (superadmin) */
export const actualizarInstitucionSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(150, 'El nombre no puede superar 150 caracteres')
    .optional(),

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
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'Debes enviar al menos un campo para actualizar' }
);
