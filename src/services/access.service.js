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

const assertTenantScopedUser = (user) => {
  if (!user?.rol) {
    throw new AppError('Usuario autenticado inválido para aplicar scope', 401);
  }

  if (user.rol !== 'superadmin' && !user.institucion_id) {
    throw new AppError('Usuario sin institución asignada', 403);
  }
};

/**
 * Aplica el scope histórico de estudiantes.
 *
 * Analogía: aunque un niño ya no esté sentado hoy en un salón activo,
 * seguimos pudiendo saber si alguna vez perteneció al salón del tutor asignado.
 * Eso permite reasignarlo después de archivar un grupo sin perder trazabilidad.
 */
export const applyStudentOwnershipScope = (
  query,
  user,
  {
    studentIdColumn = 'estudiantes.id_estudiante',
    studentInstitutionColumn = 'estudiantes.institucion_id',
    historyAlias = 'egh_scope',
    groupAlias = 'grupos_scope',
  } = {}
) => {
  assertTenantScopedUser(user);

  if (user.rol === 'superadmin') {
    return query;
  }

  if (user.rol === 'admin') {
    query.where(studentInstitutionColumn, user.institucion_id);
    return query;
  }

  query.whereExists(function scopeStudentHistory() {
    this.select(db.raw('1'))
      .from(`estudiante_grupo_historial as ${historyAlias}`)
      .join(`grupos as ${groupAlias}`, `${groupAlias}.id_grupo`, `${historyAlias}.grupo_id`)
      .whereRaw(`${historyAlias}.estudiante_id = ${studentIdColumn}`)
      .where(`${groupAlias}.institucion_id`, user.institucion_id);

    this.where(`${groupAlias}.tutor_asignado_id`, user.id);
  });

  return query;
};

/**
 * Aplica scope de acceso sobre entidades que dependen de grupos.
 * - superadmin: acceso global
 * - admin: acceso a cualquier grupo de su institución
 * - tutor: acceso a grupos de su institución y donde es el tutor asignado
 */
export const applyGroupAccessScope = (
  query,
  user,
  {
    ownerColumn = 'grupos.tutor_asignado_id',
    tenantColumn = 'grupos.institucion_id',
  } = {}
) => {
  assertTenantScopedUser(user);

  if (user.rol === 'superadmin') {
    return query;
  }

  query.where(tenantColumn, user.institucion_id);

  if (user.rol === 'tutor') {
    query.where(ownerColumn, user.id);
  }

  return query;
};

/**
 * Aplica scope directo por institución a tablas que tienen institucion_id propio.
 */
export const applyInstitutionScope = (query, user, tenantColumn = 'institucion_id') => {
  assertTenantScopedUser(user);

  if (user.rol === 'superadmin') {
    return query;
  }

  query.where(tenantColumn, user.institucion_id);
  return query;
};

/**
 * Verifica que el grupo exista y pertenezca al alcance del usuario autenticado.
 */
export const assertGroupBelongsToUser = async (grupoId, user, trx = db) => {
  const query = trx('grupos')
    .where('grupos.id_grupo', grupoId)
    .select(
      'grupos.id_grupo',
      'grupos.usuario_id as creado_por_usuario_id',
      'grupos.tutor_asignado_id',
      'grupos.nombre',
      'grupos.institucion_id',
      'grupos.activo',
      'grupos.archivado_en'
    );

  applyGroupAccessScope(query, user);

  const group = await query.first();
  if (!group) {
    throw new AppError('Grupo no encontrado o sin permisos', 403);
  }

  return group;
};

/**
 * Verifica que el estudiante esté vinculado a un grupo visible para el usuario autenticado.
 */
export const assertStudentBelongsToUser = async (studentId, user, trx = db) => {
  let query = trx('estudiantes').where('estudiantes.id_estudiante', studentId);
  query = withActiveGroupHistory(query);
  query = query.leftJoin('grupos', 'grupos.id_grupo', 'egh.grupo_id');
  query = query.select(
    'estudiantes.id_estudiante',
    'estudiantes.nombre',
    'egh.grupo_id',
    'grupos.tutor_asignado_id',
    'grupos.institucion_id'
  );

  applyStudentOwnershipScope(query, user);

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
    'egh.grupo_id',
    'grupos.institucion_id'
  );

  applyStudentOwnershipScope(query, user, { studentIdColumn: 'estudiantes.id_estudiante' });

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

  const rows = await trx('estudiante_grupo_historial as egh')
    .join('estudiantes', 'estudiantes.id_estudiante', 'egh.estudiante_id')
    .join(
      'estados_estudiante',
      'estados_estudiante.id_estado_estudiante',
      'estudiantes.estado_id'
    )
    .where({
      'egh.grupo_id': grupoId,
      'egh.activo': true,
      'estados_estudiante.nombre': 'activo',
    })
    .whereNull('egh.fecha_fin')
    .select('egh.estudiante_id');

  return rows.map(({ estudiante_id }) => estudiante_id);
};

/**
 * Verifica que el usuario autenticado sea el tutor actualmente asignado al grupo.
 *
 * POR QUÉ:
 * aunque el admin vea el grupo por institución, abrir/cerrar clase sigue siendo
 * una responsabilidad exclusivamente pedagógica del tutor.
 */
export const assertGroupAssignedToTutor = async (grupoId, user, trx = db) => {
  const group = await assertGroupBelongsToUser(grupoId, user, trx);

  if (user.rol !== 'tutor' || group.tutor_asignado_id !== user.id) {
    throw new AppError('Solo el tutor asignado puede operar la sesión de este grupo', 403);
  }

  return group;
};
