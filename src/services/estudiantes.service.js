import jwt from 'jsonwebtoken';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../middlewares/errorHandler.js';
import {
  assertGroupBelongsToUser,
  assertStudentBelongsToUser,
  getActiveStudentIdsByGroup,
  withActiveGroupHistory,
} from './access.service.js';
import { randomCode } from '../utils/codes.js';

const STUDENT_FIELDS = [
  'estudiantes.id_estudiante as id', 'estudiantes.nombre', 'estudiantes.edad',
  'estudiantes.color_avatar', 'estudiantes.sesion_activa',
  'estudiantes.creado_en', 'estados_estudiante.nombre as estado',
  'egh.grupo_id',
];

/** Query base: estudiante + estado + grupo activo via historial */
const baseQuery = () =>
  withActiveGroupHistory(
    db('estudiantes')
      .join('estados_estudiante', 'estados_estudiante.id_estado_estudiante', 'estudiantes.estado_id')
  );

/** Genera qr_token único */
const generateUniqueQR = async () => {
  for (let i = 0; i < 10; i++) {
    const token = `QR-${randomCode(6)}-${randomCode(6)}`;
    const exists = await db('estudiantes').where({ qr_token: token }).first();
    if (!exists) return token;
  }
  throw new AppError('No se pudo generar QR único', 500);
};

export const loginEstudiante = async (qr_token) => {
  const est = await baseQuery()
    .where('estudiantes.qr_token', qr_token)
    .select([...STUDENT_FIELDS, 'estudiantes.qr_token'])
    .first();

  if (!est) throw new AppError('QR inválido', 404);
  if (est.estado !== 'activo') throw new AppError('Estudiante inactivo', 403);

  const token = jwt.sign(
    { id: est.id, nombre: est.nombre, grupo_id: est.grupo_id },
    env.JWT_STUDENT_SECRET,
    { expiresIn: env.JWT_STUDENT_EXPIRES_IN }
  );

  const { qr_token: _, ...estudiante } = est;
  return { token, estudiante };
};

export const listar = async (user, grupo_id) => {
  let query = baseQuery()
    .join('grupos', 'grupos.id_grupo', 'egh.grupo_id')
    .where('estados_estudiante.nombre', 'activo')
    .select(STUDENT_FIELDS)
    .orderBy('estudiantes.nombre');

  if (user.rol !== 'admin') {
    query = query.where('grupos.usuario_id', user.id);
  }

  if (grupo_id) query = query.where('egh.grupo_id', grupo_id);
  return query;
};

export const obtener = async (id_estudiante, user) => {
  await assertStudentBelongsToUser(id_estudiante, user);
  return baseQuery()
    .where('estudiantes.id_estudiante', id_estudiante)
    .select(STUDENT_FIELDS)
    .first();
};

export const obtenerPerfilInfantil = (id_estudiante) =>
  baseQuery()
    .where('estudiantes.id_estudiante', id_estudiante)
    .select(STUDENT_FIELDS)
    .first();

export const crear = async (user, { grupo_id, nombre, edad, color_avatar }) => {
  await assertGroupBelongsToUser(grupo_id, user);
  const qr_token = await generateUniqueQR();

  const [est] = await db('estudiantes')
    .insert({
      nombre, edad,
      color_avatar: color_avatar ?? '#3B82F6',
      qr_token,
      sesion_activa: false,
      estado_id: 1,
    })
    .returning('*');

  // Registra en el historial como grupo activo
  await db('estudiante_grupo_historial').insert({
    estudiante_id: est.id_estudiante,
    grupo_id,
    fecha_inicio: db.raw('CURRENT_DATE'),
    activo: true,
  });

  return obtener(est.id_estudiante, user);
};

export const actualizar = async (id_estudiante, user, datos) => {
  await assertStudentBelongsToUser(id_estudiante, user);
  const allowed = ['nombre', 'edad', 'color_avatar'];
  const updates = Object.fromEntries(Object.entries(datos).filter(([k]) => allowed.includes(k)));
  updates.actualizado_en = db.fn.now();
  await db('estudiantes').where({ id_estudiante }).update(updates);
  return baseQuery().where('estudiantes.id_estudiante', id_estudiante).select(STUDENT_FIELDS).first();
};

export const desactivar = async (id_estudiante, user) => {
  await assertStudentBelongsToUser(id_estudiante, user);
  const { id_estado_estudiante } = await db('estados_estudiante')
    .where({ nombre: 'inactivo' })
    .select('id_estado_estudiante')
    .first();

  await db('estudiantes')
    .where({ id_estudiante })
    .update({ estado_id: id_estado_estudiante, sesion_activa: false, actualizado_en: db.fn.now() });
};

export const obtenerQR = async (id_estudiante, user) => {
  await assertStudentBelongsToUser(id_estudiante, user);
  const est = await db('estudiantes').where({ id_estudiante }).select('qr_token').first();
  if (!est) throw new AppError('Estudiante no encontrado', 404);
  return { qr_token: est.qr_token };
};

export const toggleSesion = async (id_estudiante, user, sesion_activa) => {
  await assertStudentBelongsToUser(id_estudiante, user);
  await db('estudiantes').where({ id_estudiante }).update({ sesion_activa, actualizado_en: db.fn.now() });
};

export const toggleSesionGrupo = async (grupo_id, user, sesion_activa) => {
  const ids = await getActiveStudentIdsByGroup(grupo_id, user);

  if (!ids.length) {
    return { actualizados: 0, sesion_activa };
  }

  await db('estudiantes')
    .whereIn('id_estudiante', ids)
    .update({ sesion_activa, actualizado_en: db.fn.now() });

  return { actualizados: ids.length, sesion_activa };
};

/** Traslada al estudiante a otro grupo (actualiza historial) */
export const cambiarGrupo = async (id_estudiante, user, nuevo_grupo_id) => {
  const student = await assertStudentBelongsToUser(id_estudiante, user);
  await assertGroupBelongsToUser(nuevo_grupo_id, user);

  if (student.grupo_id === nuevo_grupo_id) {
    throw new AppError('El estudiante ya pertenece a ese grupo', 409);
  }

  await db.transaction(async (trx) => {
    // Cierra la asignación activa anterior
    await trx('estudiante_grupo_historial')
      .where({ estudiante_id: id_estudiante, activo: true })
      .whereNull('fecha_fin')
      .update({ activo: false, fecha_fin: trx.raw('CURRENT_DATE') });

    // Crea nueva asignación
    await trx('estudiante_grupo_historial').insert({
      estudiante_id: id_estudiante,
      grupo_id: nuevo_grupo_id,
      fecha_inicio: trx.raw('CURRENT_DATE'),
      activo: true,
    });
  });

  return obtener(id_estudiante, user);
};
