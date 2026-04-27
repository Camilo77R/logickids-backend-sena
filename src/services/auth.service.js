import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../middlewares/errorHandler.js';

const USER_FIELDS = [
  'usuarios.id_usuario',
  'usuarios.nombre',
  'usuarios.email',
  'usuarios.creado_en',
  'roles.nombre as rol',
  'estados_usuario.nombre as estado',
  'instituciones.nombre as institucion',
  'instituciones.ciudad as institucion_ciudad',
];

const baseQuery = () =>
  db('usuarios')
    .join('roles', 'roles.id_rol', 'usuarios.rol_id')
    .join('estados_usuario', 'estados_usuario.id_estado_usuario', 'usuarios.estado_id')
    .leftJoin('instituciones', 'instituciones.id_institucion', 'usuarios.institucion_id');

const signToken = (payload) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

const resolveRolId = (nombre) =>
  db('roles').where({ nombre }).select('id_rol').first().then((r) => {
    if (!r) throw new AppError(`Rol '${nombre}' no existe`, 400);
    return r.id_rol;
  });

const resolveInstitucionId = async (nombre) => {
  if (!nombre) return null;
  let inst = await db('instituciones').where({ nombre }).select('id_institucion').first();
  if (!inst) {
    [inst] = await db('instituciones').insert({ nombre }).returning('id_institucion');
  }
  return inst.id_institucion;
};

export const registrar = async ({ nombre, email, contrasena, institucion }) => {
  const exists = await db('usuarios').where({ email }).first();
  if (exists) throw new AppError('El email ya está registrado', 409);

  const [rol_id, institucion_id, contrasena_hash] = await Promise.all([
    resolveRolId('tutor'),
    resolveInstitucionId(institucion),
    bcrypt.hash(contrasena, 10),
  ]);

  const [{ id_usuario }] = await db('usuarios')
    .insert({ nombre, email, contrasena_hash, rol_id, institucion_id, estado_id: 1 })
    .returning('id_usuario');

  return { id_usuario, nombre, email, rol: 'tutor' };
};

export const login = async ({ email, contrasena }) => {
  const user = await baseQuery()
    .where('usuarios.email', email)
    .select([...USER_FIELDS, 'usuarios.contrasena_hash'])
    .first();

  if (!user) throw new AppError('Credenciales incorrectas', 401);
  if (user.estado !== 'activo') throw new AppError('Cuenta suspendida o inactiva', 403);

  const valid = await bcrypt.compare(contrasena, user.contrasena_hash);
  if (!valid) throw new AppError('Credenciales incorrectas', 401);

  const { contrasena_hash: _, ...userData } = user;
  const token = signToken({
    id: user.id_usuario,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
  });

  return { token, usuario: userData };
};

export const obtenerPerfil = (id) =>
  baseQuery().where('usuarios.id_usuario', id).select(USER_FIELDS).first();

export const actualizarPerfil = async (id, datos) => {
  const updates = {};
  if (datos.nombre) updates.nombre = datos.nombre;
  if (datos.institucion !== undefined) {
    updates.institucion_id = await resolveInstitucionId(datos.institucion);
  }
  updates.actualizado_en = db.fn.now();

  await db('usuarios').where({ id_usuario: id }).update(updates);
  return obtenerPerfil(id);
};

export const cambiarContrasena = async (id, contrasena_actual, contrasena_nueva) => {
  const user = await db('usuarios').where({ id_usuario: id }).select('contrasena_hash').first();
  if (!user) throw new AppError('Usuario no encontrado', 404);

  const valid = await bcrypt.compare(contrasena_actual, user.contrasena_hash);
  if (!valid) throw new AppError('Contraseña actual incorrecta', 401);

  const contrasena_hash = await bcrypt.hash(contrasena_nueva, 10);
  await db('usuarios').where({ id_usuario: id }).update({ contrasena_hash, actualizado_en: db.fn.now() });
};
