import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// --- USUARIOS WEB ---

export const listarUsuarios = (institucion_id) =>
  db('usuarios')
    .join('roles', 'usuarios.rol_id', 'roles.id_rol')
    .join('estados_usuario', 'usuarios.estado_id', 'estados_usuario.id_estado_usuario')
    .leftJoin('instituciones', 'usuarios.institucion_id', 'instituciones.id_institucion')
    .where('usuarios.institucion_id', institucion_id)
    .where('roles.nombre', 'tutor')
    .select(
      'usuarios.id_usuario as id',
      'usuarios.nombre',
      'usuarios.email',
      'usuarios.creado_en',
      'roles.nombre as rol',
      'estados_usuario.nombre as estado',
      'instituciones.nombre as institucion'
    )
    .orderBy('usuarios.creado_en', 'desc');

export const obtenerUsuario = async (id_usuario) => {
  const user = await db('usuarios')
    .join('roles', 'usuarios.rol_id', 'roles.id_rol')
    .join('estados_usuario', 'usuarios.estado_id', 'estados_usuario.id_estado_usuario')
    .leftJoin('instituciones', 'usuarios.institucion_id', 'instituciones.id_institucion')
    .where('usuarios.id_usuario', id_usuario)
    .select(
      'usuarios.id_usuario as id',
      'usuarios.nombre',
      'usuarios.email',
      'usuarios.creado_en',
      'usuarios.actualizado_en',
      'roles.nombre as rol',
      'estados_usuario.nombre as estado',
      'instituciones.nombre as institucion',
      'instituciones.ciudad as institucion_ciudad'
    )
    .first();

  if (!user) throw new AppError('Usuario no encontrado', 404);
  return user;
};

/**
 * Cambia el estado de un tutor. El admin solo puede modificar tutores
 * de su misma institución para evitar escalada de privilegios cross-tenant.
 */
export const cambiarEstadoUsuario = async (id_usuario, estado_nombre, admin) => {
  const objetivo = await db('usuarios')
    .join('roles', 'usuarios.rol_id', 'roles.id_rol')
    .where('usuarios.id_usuario', id_usuario)
    .select('usuarios.institucion_id', 'roles.nombre as rol')
    .first();

  if (!objetivo) throw new AppError('Usuario no encontrado', 404);

  if (admin.rol === 'admin') {
    if (objetivo.institucion_id !== admin.institucion_id) {
      throw new AppError('No tienes permisos para modificar usuarios de otra institución', 403);
    }
    if (objetivo.rol !== 'tutor') {
      throw new AppError('El admin solo puede gestionar tutores', 403);
    }
  }

  const estado = await db('estados_usuario')
    .where({ nombre: estado_nombre })
    .select('id_estado_usuario')
    .first();
  if (!estado) throw new AppError('Estado no válido. Use: activo | inactivo | suspendido', 400);

  await db('usuarios')
    .where({ id_usuario })
    .update({ estado_id: estado.id_estado_usuario, actualizado_en: db.fn.now() });

  return { id: id_usuario, estado: estado_nombre };
};

// --- INSTITUCIONES ---

export const listarInstituciones = () =>
  db('instituciones')
    .leftJoin('usuarios as u', function () {
      this.on('u.institucion_id', 'instituciones.id_institucion')
        .andOnVal('u.estado_id', '=', db.raw(
          '(SELECT id_estado_usuario FROM estados_usuario WHERE nombre = ?)', ['activo']
        ));
    })
    .leftJoin('roles as r', 'r.id_rol', 'u.rol_id')
    .where(function () {
      this.where('r.nombre', 'tutor').orWhereNull('r.nombre');
    })
    .groupBy('instituciones.id_institucion')
    .select(
      'instituciones.id_institucion as id',
      'instituciones.nombre',
      'instituciones.ciudad',
      'instituciones.direccion',
      'instituciones.telefono',
      'instituciones.creado_en',
      db.raw('COUNT(u.id_usuario) as tutores_activos')
    )
    .orderBy('instituciones.nombre', 'asc');

export const crearInstitucion = async ({ nombre, ciudad, direccion, telefono }) => {
  const exists = await db('instituciones').where({ nombre }).first();
  if (exists) throw new AppError('Ya existe una institución con ese nombre', 409);

  return db.transaction(async (trx) => {
    const [inst] = await trx('instituciones')
      .insert({ nombre, ciudad, direccion, telefono })
      .returning('*');

    const rol = await trx('roles').where({ nombre: 'admin' }).select('id_rol').first();

    // Contraseña temporal aleatoria y segura — nunca hardcodeada
    const contrasena_temp = crypto.randomBytes(8).toString('hex');
    const contrasena_hash = await bcrypt.hash(contrasena_temp, 10);
    const emailAdmin = `admin.${nombre.toLowerCase().replace(/\s+/g, '')}@logickids.dev`;

    const [usuario] = await trx('usuarios')
      .insert({
        nombre: `Admin ${nombre}`,
        email: emailAdmin,
        contrasena_hash,
        rol_id: rol.id_rol,
        institucion_id: inst.id_institucion,
        estado_id: 1,
      })
      .returning('*');

    return {
      institucion: {
        id: inst.id_institucion,
        nombre: inst.nombre,
        ciudad: inst.ciudad,
      },
      admin: {
        email: usuario.email,
        contrasena_temporal: contrasena_temp,
      },
    };
  });
};

export const eliminarInstitucion = async (id_institucion) => {
  const rolTutor = await db('roles').where({ nombre: 'tutor' }).select('id_rol').first();

  const conTutores = await db('usuarios')
    .where({ institucion_id: id_institucion, rol_id: rolTutor.id_rol })
    .first();
  if (conTutores) throw new AppError('No se puede eliminar: tiene tutores asociados', 409);

  return db.transaction(async (trx) => {
    await trx('usuarios').where({ institucion_id: id_institucion }).delete();
    const deleted = await trx('instituciones').where({ id_institucion }).delete();
    if (!deleted) throw new AppError('Institución no encontrada', 404);
  });
};

// --- MINIJUEGOS ---

export const listarMinijuegosAdmin = () =>
  db('minijuegos')
    .join('habilidades', 'habilidades.id_habilidad', 'minijuegos.habilidad_id')
    .select(
      'minijuegos.id_minijuego as id',
      'minijuegos.slug',
      'minijuegos.titulo',
      'minijuegos.descripcion',
      'minijuegos.dificultad_maxima',
      'minijuegos.activo',
      'minijuegos.creado_en',
      'habilidades.nombre as habilidad'
    )
    .orderBy('minijuegos.titulo', 'asc');

export const toggleMinijuego = async (id_minijuego, activo) => {
  const updated = await db('minijuegos')
    .where({ id_minijuego })
    .update({ activo })
    .returning(['id_minijuego as id', 'activo']);

  const row = updated?.[0];
  if (!row) throw new AppError('Minijuego no encontrado', 404);
  return row;
};
