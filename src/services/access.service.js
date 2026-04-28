import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Une el historial activo de grupos al query del estudiante actual.
 *
 * POR QUÉ: varias consultas necesitan saber el grupo activo sin repetir
 * la misma condición de join por todo el backend.
 */
export const withActiveGroupHistory = (
  query,
  { studentTable = 'estudiantes', alias = 'egh' } = {}
) =>
  query.leftJoin(`estudiante_grupo_historial as ${alias}`, function joinActiveGroupHistory() {
    this.on(`${alias}.estudiante_id`, `${studentTable}.id_estudiante`)
      .andOn(`${alias}.activo`, db.raw('TRUE'))
      .andOnNull(`${alias}.fecha_fin`);
  });

const applyOwnershipFilter = (query, user, ownerColumn = 'grupos.usuario_id') => {
  if (user?.rol !== 'admin') {
    query.where(ownerColumn, user.id);
  }

  return query;
};

/**
 * Verifica que el grupo exista y pertenezca al usuario autenticado.
 */
export const assertGroupBelongsToUser = async (grupoId, user, trx = db) => {
  const query = trx('grupos')
    .where('grupos.id_grupo', grupoId)
    .select('grupos.id_grupo', 'grupos.usuario_id', 'grupos.nombre');

  applyOwnershipFilter(query, user);

  const group = await query.first();
  if (!group) {
    throw new AppError('Grupo no encontrado o sin permisos', 403);
  }

  return group;
};

/**
 * Verifica que el estudiante esté vinculado a un grupo del usuario autenticado.
 */
export const assertStudentBelongsToUser = async (studentId, user, trx = db) => {
  let query = trx('estudiantes').where('estudiantes.id_estudiante', studentId);
  query = withActiveGroupHistory(query);
  query = query.leftJoin('grupos', 'grupos.id_grupo', 'egh.grupo_id');
  query = query.select(
    'estudiantes.id_estudiante',
    'estudiantes.nombre',
    'egh.grupo_id',
    'grupos.usuario_id'
  );

  applyOwnershipFilter(query, user);

  const student = await query.first();
  if (!student) {
    throw new AppError('Estudiante no encontrado o sin permisos', 403);
  }

  return student;
};

/**
 * Verifica que una sesión pertenezca a un estudiante visible para el usuario.
 */
export const assertSessionBelongsToUser = async (sessionId, user, trx = db) => {
  let query = trx('sesiones_juego')
    .join('estudiantes', 'estudiantes.id_estudiante', 'sesiones_juego.estudiante_id')
    .where('sesiones_juego.id_sesion_juego', sessionId);

  query = withActiveGroupHistory(query);
  query = query.leftJoin('grupos', 'grupos.id_grupo', 'egh.grupo_id');
  query = query.select(
    'sesiones_juego.id_sesion_juego',
    'sesiones_juego.estudiante_id',
    'egh.grupo_id'
  );

  applyOwnershipFilter(query, user);

  const session = await query.first();
  if (!session) {
    throw new AppError('Sesión no encontrada o sin permisos', 403);
  }

  return session;
};

/**
 * Lista los IDs de estudiantes activos dentro de un grupo.
 */
export const getActiveStudentIdsByGroup = async (grupoId, user, trx = db) => {
  await assertGroupBelongsToUser(grupoId, user, trx);

  const rows = await trx('estudiante_grupo_historial')
    .where({ grupo_id: grupoId, activo: true })
    .whereNull('fecha_fin')
    .select('estudiante_id');

  return rows.map(({ estudiante_id }) => estudiante_id);
};
