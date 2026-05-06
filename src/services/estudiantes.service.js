import jwt from 'jsonwebtoken';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../middlewares/errorHandler.js';
import {
  applyGroupAccessScope,
  assertGroupBelongsToUser,
  assertStudentBelongsToUser,
  getActiveStudentIdsByGroup,
  withActiveGroupHistory,
} from './access.service.js';
import { randomCode } from '../utils/codes.js';

/** Campos base que se devuelven en la mayoría de respuestas de estudiante */
const STUDENT_FIELDS = [
  'estudiantes.id_estudiante as id', 'estudiantes.nombre', 'estudiantes.edad',
  'estudiantes.color_avatar', 'estudiantes.sesion_activa',
  'estudiantes.creado_en', 'estados_estudiante.nombre as estado',
  'egh.grupo_id',
];

/**
 * Query base reutilizable: estudiante + estado + grupo activo via historial.
 * Centraliza el join repetido en todo el servicio.
 */
const baseQuery = () =>
  withActiveGroupHistory(
    db('estudiantes')
      .join('estados_estudiante', 'estados_estudiante.id_estado_estudiante', 'estudiantes.estado_id')
  );

/**
 * Genera un QR token único con reintentos.
 * Formato: QR-XXXXXX-XXXXXX
 * @returns {Promise<string>} Token único garantizado
 */
const generateUniqueQR = async () => {
  for (let i = 0; i < 10; i++) {
    const token = `QR-${randomCode(6)}-${randomCode(6)}`;
    const exists = await db('estudiantes').where({ qr_token: token }).first();
    if (!exists) return token;
  }
  throw new AppError('No se pudo generar QR único', 500);
};

/**
 * Autentica a un estudiante mediante su QR token.
 * Emite un JWT firmado con JWT_STUDENT_SECRET (diferente al de tutores).
 *
 * @param {string} qr_token - Token QR escaneado desde la app móvil
 * @returns {{ token: string, estudiante: object }}
 * @throws {AppError} 404 si el QR no corresponde a ningún estudiante
 * @throws {AppError} 403 si el estudiante está inactivo
 */
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

  // No devolver el qr_token en la respuesta por seguridad
  const { qr_token: _, ...estudiante } = est;
  return { token, estudiante };
};

/**
 * Lista estudiantes activos del tutor, opcionalmente filtrados por grupo.
 * El admin ve todos los estudiantes de su institución.
 *
 * @param {object} user - Usuario autenticado (tutor o admin)
 * @param {number|null} grupo_id - Filtro opcional por grupo
 */
export const listar = async (user, grupo_id) => {
  let query = baseQuery()
    .join('grupos', 'grupos.id_grupo', 'egh.grupo_id')
    .where('estados_estudiante.nombre', 'activo')
    .select(STUDENT_FIELDS)
    .orderBy('estudiantes.nombre');

  query = applyGroupAccessScope(query, user);

  if (grupo_id) query = query.where('egh.grupo_id', grupo_id);
  return query;
};

/**
 * Lista todos los estudiantes incluyendo inactivos.
 * Útil para el panel de administración del tutor.
 *
 * @param {object} user - Usuario autenticado
 * @param {number|null} grupo_id - Filtro opcional
 */
export const listarTodos = async (user, grupo_id) => {
  let query = withActiveGroupHistory(
    db('estudiantes')
      .join('estados_estudiante', 'estados_estudiante.id_estado_estudiante', 'estudiantes.estado_id')
  )
    .join('grupos', 'grupos.id_grupo', 'egh.grupo_id')
    .select([...STUDENT_FIELDS, 'estados_estudiante.nombre as estado'])
    .orderBy('estudiantes.nombre');

  query = applyGroupAccessScope(query, user);

  if (grupo_id) query = query.where('egh.grupo_id', grupo_id);
  return query;
};

/**
 * Devuelve el detalle de un estudiante verificando permisos del tutor.
 *
 * @param {number} id_estudiante
 * @param {object} user
 * @throws {AppError} 403 si el estudiante no pertenece a los grupos del tutor
 */
export const obtener = async (id_estudiante, user) => {
  await assertStudentBelongsToUser(id_estudiante, user);
  return baseQuery()
    .where('estudiantes.id_estudiante', id_estudiante)
    .select(STUDENT_FIELDS)
    .first();
};

/**
 * Perfil del estudiante autenticado para el dashboard de la app móvil.
 * No requiere validación de ownership porque el JWT garantiza la identidad.
 *
 * @param {number} id_estudiante - Extraído del JWT del estudiante
 */
export const obtenerPerfilInfantil = (id_estudiante) =>
  baseQuery()
    .where('estudiantes.id_estudiante', id_estudiante)
    .select(STUDENT_FIELDS)
    .first();

/**
 * Crea un estudiante y lo registra en el historial del grupo.
 * Genera automáticamente un QR token único.
 *
 * @param {object} user - Tutor que crea al estudiante
 * @param {{ grupo_id, nombre, edad, color_avatar }} datos
 * @throws {AppError} 403 si el grupo no pertenece al tutor
 */
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
      institucion_id: user.institucion_id ?? null,
    })
    .returning('*');

  // Registra la asignación inicial en el historial de grupos
  await db('estudiante_grupo_historial').insert({
    estudiante_id: est.id_estudiante,
    grupo_id,
    fecha_inicio: db.fn.now(),
    activo: true,
  });

  return obtener(est.id_estudiante, user);
};

/**
 * Actualiza datos básicos del estudiante (nombre, edad, avatar).
 * El tutor no puede cambiar el QR ni el grupo desde aquí.
 *
 * @param {number} id_estudiante
 * @param {object} user
 * @param {object} datos - Campos permitidos: nombre, edad, color_avatar
 */
export const actualizar = async (id_estudiante, user, datos) => {
  await assertStudentBelongsToUser(id_estudiante, user);
  const allowed = ['nombre', 'edad', 'color_avatar'];
  const updates = Object.fromEntries(Object.entries(datos).filter(([k]) => allowed.includes(k)));
  updates.actualizado_en = db.fn.now();
  await db('estudiantes').where({ id_estudiante }).update(updates);
  return baseQuery().where('estudiantes.id_estudiante', id_estudiante).select(STUDENT_FIELDS).first();
};

/**
 * Desactiva un estudiante: no puede iniciar sesión ni aparecer en listados activos.
 * También cierra su sesión de juego si estaba abierta.
 *
 * @param {number} id_estudiante
 * @param {object} user
 */
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

/**
 * Reactiva un estudiante inactivo para que vuelva a poder acceder.
 *
 * @param {number} id_estudiante
 * @param {object} user
 */
export const reactivar = async (id_estudiante, user) => {
  await assertStudentBelongsToUser(id_estudiante, user);
  const { id_estado_estudiante } = await db('estados_estudiante')
    .where({ nombre: 'activo' })
    .select('id_estado_estudiante')
    .first();

  await db('estudiantes')
    .where({ id_estudiante })
    .update({ estado_id: id_estado_estudiante, actualizado_en: db.fn.now() });
};

/**
 * Devuelve el QR token del estudiante para que el tutor lo imprima o muestre.
 * El QR no cambia a menos que se regenere explícitamente.
 *
 * @param {number} id_estudiante
 * @param {object} user
 * @returns {{ qr_token: string }}
 */
export const obtenerQR = async (id_estudiante, user) => {
  await assertStudentBelongsToUser(id_estudiante, user);
  const est = await db('estudiantes').where({ id_estudiante }).select('qr_token').first();
  if (!est) throw new AppError('Estudiante no encontrado', 404);
  return { qr_token: est.qr_token };
};

/**
 * Activa o desactiva la sesión de juego de un estudiante individual.
 * El método masivo (por grupo) se maneja en grupos.service.js.
 *
 * @param {number} id_estudiante
 * @param {object} user
 * @param {boolean} sesion_activa
 */
export const toggleSesion = async (id_estudiante, user, sesion_activa) => {
  await assertStudentBelongsToUser(id_estudiante, user);
  await db('estudiantes').where({ id_estudiante }).update({ sesion_activa, actualizado_en: db.fn.now() });
};

/**
 * @deprecated Usar grupos.service.js → toggleSesion() que incluye la guard de estudiantes vacíos (HU-13).
 * Mantenida para compatibilidad interna pero ya no expuesta por ninguna ruta.
 */
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

/**
 * Traslada al estudiante a otro grupo del mismo tutor.
 * Cierra el historial anterior con fecha_fin y abre uno nuevo.
 * El estudiante solo puede pertenecer a un grupo activo a la vez.
 *
 * @param {number} id_estudiante
 * @param {object} user
 * @param {number} nuevo_grupo_id
 * @throws {AppError} 409 si el estudiante ya pertenece al grupo destino
 * @throws {AppError} 403 si el grupo destino no pertenece al tutor
 */
export const cambiarGrupo = async (id_estudiante, user, nuevo_grupo_id) => {
  const student = await assertStudentBelongsToUser(id_estudiante, user);
  await assertGroupBelongsToUser(nuevo_grupo_id, user);

  if (student.grupo_id === nuevo_grupo_id) {
    throw new AppError('El estudiante ya pertenece a ese grupo', 409);
  }

  await db.transaction(async (trx) => {
    // Cierra todos los registros activos anteriores con fecha de salida
    await trx('estudiante_grupo_historial')
      .where({ estudiante_id: id_estudiante, activo: true })
      .update({ activo: false, fecha_fin: trx.fn.now() });

    // Inserta el nuevo registro en el historial
    await trx('estudiante_grupo_historial')
      .insert({
        estudiante_id: id_estudiante,
        grupo_id: nuevo_grupo_id,
        fecha_inicio: trx.fn.now(),
        activo: true,
      })
      .onConflict(['estudiante_id', 'grupo_id', 'fecha_inicio'])
      .merge({ activo: true, fecha_fin: null });
  });

  return db('estudiantes')
    .join('estados_estudiante', 'estados_estudiante.id_estado_estudiante', 'estudiantes.estado_id')
    .leftJoin('estudiante_grupo_historial', function () {
      this.on('estudiante_grupo_historial.estudiante_id', 'estudiantes.id_estudiante')
        .andOn('estudiante_grupo_historial.activo', db.raw('TRUE'))
        .andOnNull('estudiante_grupo_historial.fecha_fin');
    })
    .leftJoin('grupos', 'grupos.id_grupo', 'estudiante_grupo_historial.grupo_id')
    .where('estudiantes.id_estudiante', id_estudiante)
    .select(
      'estudiantes.id_estudiante as id',
      'estudiantes.nombre',
      'estudiantes.edad',
      'estudiantes.color_avatar',
      'estudiantes.sesion_activa',
      'estudiantes.creado_en',
      'estados_estudiante.nombre as estado',
      'estudiante_grupo_historial.grupo_id'
    )
    .first();
};
