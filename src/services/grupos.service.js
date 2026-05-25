import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import {
  applyGroupAccessScope,
  assertGroupAssignedToTutor,
  assertGroupBelongsToUser,
} from './access.service.js';

const GROUP_FIELDS = [
  'grupos.id_grupo as id',
  'grupos.usuario_id as creado_por_usuario_id',
  'grupos.tutor_asignado_id',
  'grupos.institucion_id',
  'grupos.sesion_minijuego_id',
  'grupos.nombre',
  'grupos.descripcion',
  'grupos.predeterminado',
  'grupos.activo',
  'grupos.archivado_en',
  'grupos.creado_en',
  'grupos.actualizado_en',
  'tutor.nombre as tutor_nombre',
  'tutor.email as tutor_email',
  'minijuegos.slug as sesion_minijuego_slug',
  'minijuegos.titulo as sesion_minijuego_titulo',
];

const buildGroupQuery = () =>
  db('grupos')
    .leftJoin('usuarios as tutor', 'tutor.id_usuario', 'grupos.tutor_asignado_id')
    .leftJoin('minijuegos', 'minijuegos.id_minijuego', 'grupos.sesion_minijuego_id');

const addSessionActiveProjection = (query) =>
  query.select(
    db.raw(`
      EXISTS (
        SELECT 1
        FROM estudiante_grupo_historial egh
        JOIN estudiantes e ON e.id_estudiante = egh.estudiante_id
        WHERE egh.grupo_id = grupos.id_grupo
          AND egh.activo = true
          AND egh.fecha_fin IS NULL
          AND e.sesion_activa = true
      ) as sesion_activa
    `)
  );

const closeStudentSessionsForGroup = async (trx, grupo_id) => {
  const rows = await trx('estudiante_grupo_historial')
    .where({ grupo_id, activo: true })
    .whereNull('fecha_fin')
    .select('estudiante_id');

  const studentIds = rows.map(({ estudiante_id }) => estudiante_id);

  if (studentIds.length) {
    await trx('estudiantes')
      .whereIn('id_estudiante', studentIds)
      .update({
        sesion_activa: false,
        actualizado_en: trx.fn.now(),
      });
  }

  return studentIds.length;
};

const resolveTutorAsignable = async (tutorId, actor, trx = db) => {
  const tutor = await trx('usuarios as u')
    .join('roles as r', 'r.id_rol', 'u.rol_id')
    .join('estados_usuario as eu', 'eu.id_estado_usuario', 'u.estado_id')
    .where('u.id_usuario', tutorId)
    .select(
      'u.id_usuario as id',
      'u.institucion_id',
      'r.nombre as rol',
      'eu.nombre as estado'
    )
    .first();

  if (!tutor) {
    throw new AppError('Tutor no encontrado', 404);
  }

  if (tutor.rol !== 'tutor') {
    throw new AppError('El usuario seleccionado no tiene rol tutor', 409);
  }

  if (tutor.institucion_id !== actor.institucion_id) {
    throw new AppError('El tutor debe pertenecer a la misma institución del grupo', 403);
  }

  if (tutor.estado !== 'activo') {
    throw new AppError('Solo se pueden asignar tutores activos', 409);
  }

  return tutor;
};

const resolveOpenMinigame = async (minijuegoId, trx = db) => {
  const minijuego = await trx('minijuegos')
    .where({ id_minijuego: minijuegoId, activo: true })
    .select('id_minijuego as id', 'slug', 'titulo')
    .first();

  if (!minijuego) {
    throw new AppError('El minijuego seleccionado no está disponible', 404);
  }

  return minijuego;
};

const fetchGroupById = async (id_grupo, user) => {
  const query = buildGroupQuery().where('grupos.id_grupo', id_grupo).select(GROUP_FIELDS);
  applyGroupAccessScope(query, user);
  addSessionActiveProjection(query);
  return query.first();
};

export const listar = async (user) => {
  const query = buildGroupQuery().select(GROUP_FIELDS);
  applyGroupAccessScope(query, user);
  addSessionActiveProjection(query);

  return query
    .orderBy('grupos.predeterminado', 'desc')
    .orderBy('grupos.creado_en', 'asc');
};

export const obtener = async (id_grupo, user) => {
  const group = await fetchGroupById(id_grupo, user);
  if (!group) {
    throw new AppError('Grupo no encontrado o sin permisos', 403);
  }

  const estudiantes = await db('estudiantes')
    .join('estudiante_grupo_historial as egh', function joinCurrentMembership() {
      this.on('egh.estudiante_id', 'estudiantes.id_estudiante')
        .andOn('egh.activo', db.raw('TRUE'))
        .andOn('egh.grupo_id', db.raw('?', [id_grupo]));
    })
    .join('estados_estudiante', 'estados_estudiante.id_estado_estudiante', 'estudiantes.estado_id')
    .where('estados_estudiante.nombre', 'activo')
    .select(
      'estudiantes.id_estudiante as id',
      'estudiantes.nombre',
      'estudiantes.edad',
      'estudiantes.color_avatar',
      'estudiantes.sesion_activa'
    )
    .orderBy('estudiantes.nombre', 'asc');

  return { ...group, estudiantes };
};

export const crear = async (actor, { nombre, descripcion, predeterminado }) => {
  const [created] = await db('grupos')
    .insert({
      usuario_id: actor.id,
      tutor_asignado_id: null,
      institucion_id: actor.institucion_id,
      nombre,
      descripcion,
      predeterminado: predeterminado ?? false,
    })
    .returning('id_grupo');

  return obtener(created.id_grupo, actor);
};

export const actualizar = async (id_grupo, user, datos) => {
  const group = await assertGroupBelongsToUser(id_grupo, user);
  if (group.activo === false) {
    throw new AppError('No se puede editar un grupo archivado. Restáuralo primero.', 409);
  }

  const allowed = ['nombre', 'descripcion', 'predeterminado'];
  const updates = Object.fromEntries(Object.entries(datos).filter(([key]) => allowed.includes(key)));
  updates.actualizado_en = db.fn.now();

  await db('grupos').where({ id_grupo }).update(updates);
  return obtener(id_grupo, user);
};

export const asignarTutor = async (id_grupo, actor, tutor_id) => {
  const group = await assertGroupBelongsToUser(id_grupo, actor);
  if (group.activo === false) {
    throw new AppError('No se puede reasignar tutor en un grupo archivado', 409);
  }

  if ((group.tutor_asignado_id ?? null) === (tutor_id ?? null)) {
    return obtener(id_grupo, actor);
  }

  if (tutor_id != null) {
    await resolveTutorAsignable(tutor_id, actor);
  }

  return db.transaction(async (trx) => {
    await closeStudentSessionsForGroup(trx, id_grupo);

    await trx('grupos')
      .where({ id_grupo })
      .update({
        tutor_asignado_id: tutor_id ?? null,
        sesion_minijuego_id: null,
        actualizado_en: trx.fn.now(),
      });

    await trx('grupo_tutor_historial')
      .where({ grupo_id: id_grupo, activo: true })
      .whereNull('fecha_fin')
      .update({
        activo: false,
        fecha_fin: trx.fn.now(),
      });

    if (tutor_id != null) {
      await trx('grupo_tutor_historial').insert({
        grupo_id: id_grupo,
        tutor_id,
        asignado_por: actor.id,
        fecha_inicio: trx.fn.now(),
        activo: true,
      });
    }
  });

  return obtener(id_grupo, actor);
};

export const eliminar = async (id_grupo, user) => archivar(id_grupo, user);

export const archivar = async (id_grupo, user) => {
  const group = await assertGroupBelongsToUser(id_grupo, user);

  if (group.activo === false) {
    throw new AppError('El grupo ya está archivado', 409);
  }

  return db.transaction(async (trx) => {
    const affectedStudents = await closeStudentSessionsForGroup(trx, id_grupo);

    await trx('estudiante_grupo_historial')
      .where({ grupo_id: id_grupo, activo: true })
      .whereNull('fecha_fin')
      .update({
        activo: false,
        fecha_fin: trx.fn.now(),
      });

    await trx('grupos')
      .where({ id_grupo })
      .update({
        activo: false,
        archivado_en: trx.fn.now(),
        sesion_minijuego_id: null,
        actualizado_en: trx.fn.now(),
      });

    return {
      estudiantes_desvinculados: affectedStudents,
      sesiones_cerradas: affectedStudents,
    };
  }).then(async (summary) => ({
    ...(await obtener(id_grupo, user)),
    ...summary,
  }));
};

export const restaurar = async (id_grupo, user) => {
  const group = await assertGroupBelongsToUser(id_grupo, user);

  if (group.activo === true) {
    throw new AppError('El grupo ya está activo', 409);
  }

  await db('grupos')
    .where({ id_grupo })
    .update({
      activo: true,
      archivado_en: null,
      actualizado_en: db.fn.now(),
    });

  return obtener(id_grupo, user);
};

export const toggleSesion = async (id_grupo, user, { sesion_activa, minijuego_id }) => {
  const group = await assertGroupAssignedToTutor(id_grupo, user);

  if (group.activo === false) {
    throw new AppError('No se puede abrir ni cerrar la clase de un grupo archivado', 409);
  }

  const selectedMinigame = sesion_activa
    ? await resolveOpenMinigame(minijuego_id ?? group.sesion_minijuego_id)
    : null;

  const rows = await db('estudiante_grupo_historial')
    .where({ grupo_id: id_grupo, activo: true })
    .whereNull('fecha_fin')
    .select('estudiante_id');

  const studentIds = rows.map(({ estudiante_id }) => estudiante_id);

  if (!studentIds.length && sesion_activa) {
    throw new AppError('No hay estudiantes activos en este grupo. Agrega estudiantes antes de abrir la clase.', 422);
  }

  if (!studentIds.length) {
    await db('grupos')
      .where({ id_grupo })
      .update({
        sesion_minijuego_id: null,
        actualizado_en: db.fn.now(),
      });

    return { actualizados: 0, sesion_activa, minijuego_id: null };
  }

  await db.transaction(async (trx) => {
    await trx('estudiantes')
      .whereIn('id_estudiante', studentIds)
      .update({
        sesion_activa,
        actualizado_en: trx.fn.now(),
      });

    await trx('grupos')
      .where({ id_grupo })
      .update({
        sesion_minijuego_id: sesion_activa ? selectedMinigame.id : null,
        actualizado_en: trx.fn.now(),
      });
  });

  return {
    actualizados: studentIds.length,
    sesion_activa,
    minijuego_id: selectedMinigame?.id ?? null,
    minijuego_slug: selectedMinigame?.slug ?? null,
    minijuego_titulo: selectedMinigame?.titulo ?? null,
  };
};
