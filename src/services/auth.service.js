import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../middlewares/errorHandler.js';

const USER_FIELDS = [
  'usuarios.id_usuario',
  'usuarios.nombre',
  'usuarios.email',
  'usuarios.institucion_id',
  'usuarios.es_admin_principal',
  'usuarios.creado_en',
  'roles.nombre as rol',
  'estados_usuario.nombre as estado',
  'instituciones.nombre as institucion',
  'instituciones.ciudad as institucion_ciudad',
  'instituciones.activo as institucion_activa',
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

const resolveEstadoUsuarioId = (nombre) =>
  db('estados_usuario').where({ nombre }).select('id_estado_usuario').first().then((r) => {
    if (!r) throw new AppError(`Estado '${nombre}' no existe`, 400);
    return r.id_estado_usuario;
  });

const assertInstitutionAvailableForRegistration = async (institucion_id) => {
  const institution = await db('instituciones')
    .where({ id_institucion: institucion_id })
    .select('id_institucion', 'activo')
    .first();

  if (!institution) {
    throw new AppError('La institución seleccionada no existe', 404);
  }

  if (institution.activo === false) {
    throw new AppError('La institución seleccionada está desactivada y no acepta registros nuevos', 409);
  }
};

const assertInstitutionActiveForLogin = (user) => {
  const requiresInstitution = user.rol !== 'superadmin' && user.institucion_id != null;
  if (requiresInstitution && user.institucion_activa === false) {
    throw new AppError('La institución del usuario está desactivada y no puede iniciar sesión', 403);
  }
};

export const listarInstitucionesPublicas = () =>
  db('instituciones')
    .where({ activo: true })
    .select(
      'id_institucion',
      'nombre',
      'ciudad',
      'direccion',
      'telefono',
      'creado_en'
    )
    .orderBy('nombre', 'asc');

export const registrar = async ({ nombre, email, contrasena, institucion_id }) => {
  const exists = await db('usuarios').where({ email }).first();
  if (exists) throw new AppError('El email ya está registrado', 409);

  await assertInstitutionAvailableForRegistration(institucion_id);

  const [rol_id, estado_id, contrasena_hash] = await Promise.all([
    resolveRolId('tutor'),
    resolveEstadoUsuarioId('inactivo'),
    bcrypt.hash(contrasena, 10),
  ]);

  const [{ id_usuario }] = await db('usuarios')
    .insert({ nombre, email, contrasena_hash, rol_id, institucion_id, estado_id })
    .returning('id_usuario');

  return { id_usuario, nombre, email, rol: 'tutor', estado: 'inactivo' };
};

export const login = async ({ email, contrasena }) => {
  const user = await baseQuery()
    .where('usuarios.email', email)
    .select([...USER_FIELDS, 'usuarios.contrasena_hash'])
    .first();

  if (!user) throw new AppError('Credenciales incorrectas', 401);

  const valid = await bcrypt.compare(contrasena, user.contrasena_hash);
  if (!valid) throw new AppError('Credenciales incorrectas', 401);

  // ==========================================================
  // MODIFICACIÓN: Diferenciar entre inactivo y suspendido
  // ==========================================================
  if (user.estado !== 'activo') {
    // Si el usuario está suspendido (estado = 'suspendido')
    if (user.estado === 'suspendido') {
      throw new AppError('Cuenta suspendida', 403, { estado: 'suspendido', email: user.email });
    }
    // Si está inactivo (tutor recién registrado)
    throw new AppError('Cuenta inactiva. Contacta al administrador para activarla.', 403);
  }

  assertInstitutionActiveForLogin(user);

  const { contrasena_hash: _, ...userData } = user;
  const token = signToken({
    id: user.id_usuario,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    institucion_id: user.institucion_id ?? null,
    es_admin_principal: user.es_admin_principal ?? false,
  });

  return { token, usuario: userData };
};

export const obtenerPerfil = (id) =>
  baseQuery().where('usuarios.id_usuario', id).select(USER_FIELDS).first();

export const actualizarPerfil = async (id, datos) => {
  const updates = {};
  if (datos.nombre) updates.nombre = datos.nombre
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
