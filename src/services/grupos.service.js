import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import {
  applyGroupAccessScope,
  assertGroupAssignedToTutor,
  assertGroupBelongsToUser,
  getActiveStudentIdsByGroup,
} from './access.service.js';
import {
  crearSesionClase,
  cerrarSesionClasePorGrupo,
  ESTADOS_SESION_CLASE,
  obtenerSesionClaseActivaPorGrupo,
  obtenerResumenSesionActivaParaGrupo,
  resolvePlanSesionClase,
} from './sesionesClase.service.js';
import { abandonarSesionesActivasDeClase } from './sesiones.service.js';

const GROUP_FIELDS = [
  'grupos.id_grupo as id',
  'grupos.creado_por_usuario_id',
  'grupos.tutor_asignado_id',
  'grupos.institucion_id',
  'grupos.nombre',
  'grupos.descripcion',
  'grupos.predeterminado',
  'grupos.activo',
  'grupos.archivado_en',
  'grupos.creado_en',
  'grupos.actualizado_en',
  'tutor.nombre as tutor_nombre',
  'tutor.email as tutor_email',
  db.raw(`
    EXISTS (
      SELECT 1
      FROM sesiones_clase sc
      WHERE sc.grupo_id = grupos.id_grupo
        AND sc.estado = 'activa'
    ) as sesion_activa
  `),
  db.raw(`
    (
      SELECT sc.id_sesion_clase
      FROM sesiones_clase sc
      WHERE sc.grupo_id = grupos.id_grupo
        AND sc.estado = 'activa'
      LIMIT 1
    ) as sesion_clase_id
  `),
  db.raw(`
    (
      SELECT sc.modo
      FROM sesiones_clase sc
      WHERE sc.grupo_id = grupos.id_grupo
        AND sc.estado = 'activa'
      LIMIT 1
    ) as sesion_modo
  `),
  db.raw(`
    (
      SELECT COUNT(*)
      FROM sesiones_clase sc
      JOIN sesion_clase_pasos pasos ON pasos.sesion_clase_id = sc.id_sesion_clase
      WHERE sc.grupo_id = grupos.id_grupo
        AND sc.estado = 'activa'
    ) as sesion_total_pasos
  `),
  db.raw(`
    (
      SELECT paso.minijuego_id
      FROM sesiones_clase sc
      JOIN sesion_clase_pasos paso ON paso.sesion_clase_id = sc.id_sesion_clase
      WHERE sc.grupo_id = grupos.id_grupo
        AND sc.estado = 'activa'
        AND paso.orden = 1
      LIMIT 1
    ) as sesion_minijuego_id
  `),
  db.raw(`
    (
      SELECT m.slug
      FROM sesiones_clase sc
      JOIN sesion_clase_pasos paso ON paso.sesion_clase_id = sc.id_sesion_clase
      JOIN minijuegos m ON m.id_minijuego = paso.minijuego_id
      WHERE sc.grupo_id = grupos.id_grupo
        AND sc.estado = 'activa'
        AND paso.orden = 1
      LIMIT 1
    ) as sesion_minijuego_slug
  `),
  db.raw(`
    (
      SELECT m.titulo
      FROM sesiones_clase sc
      JOIN sesion_clase_pasos paso ON paso.sesion_clase_id = sc.id_sesion_clase
      JOIN minijuegos m ON m.id_minijuego = paso.minijuego_id
      WHERE sc.grupo_id = grupos.id_grupo
        AND sc.estado = 'activa'
        AND paso.orden = 1
      LIMIT 1
    ) as sesion_minijuego_titulo
  `),
];

const buildGroupQuery = () =>
  db('grupos').leftJoin('usuarios as tutor', 'tutor.id_usuario', 'grupos.tutor_asignado_id');

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

const fetchGroupById = async (id_grupo, user) => {
  const query = buildGroupQuery().where('grupos.id_grupo', id_grupo).select(GROUP_FIELDS);
  applyGroupAccessScope(query, user);
  return query.first();
};

const closeActiveClassForGroup = async (grupoId, { cierreMotivo, estado }, trx) => {
  const sesionActiva = await obtenerSesionClaseActivaPorGrupo(grupoId, trx);
  if (!sesionActiva) {
    return null;
  }

  await abandonarSesionesActivasDeClase(sesionActiva.id, { estadoSesionJuego: 'abandonado' }, trx);
  return cerrarSesionClasePorGrupo(
    {
      grupoId,
      estado,
      cierreMotivo,
    },
    trx
  );
};

export const listar = async (user) => {
  const query = buildGroupQuery().select(GROUP_FIELDS);
  applyGroupAccessScope(query, user);

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
        .andOnNull('egh.fecha_fin')
        .andOn('egh.grupo_id', db.raw('?', [id_grupo]));
    })
    .join('estados_estudiante', 'estados_estudiante.id_estado_estudiante', 'estudiantes.estado_id')
    .where('estados_estudiante.nombre', 'activo')
    .select(
      'estudiantes.id_estudiante as id',
      'estudiantes.nombre',
      'estudiantes.edad',
      'estudiantes.color_avatar',
      db.raw(`
        EXISTS (
          SELECT 1
          FROM sesiones_clase sc
          JOIN sesion_clase_participantes participante
            ON participante.sesion_clase_id = sc.id_sesion_clase
          WHERE sc.grupo_id = ?
            AND sc.estado = 'activa'
            AND participante.estudiante_id = estudiantes.id_estudiante
            AND participante.estado IN ('pendiente', 'en_progreso')
        ) as sesion_activa
      `, [id_grupo])
    )
    .orderBy('estudiantes.nombre', 'asc');

  return { ...group, estudiantes };
};

export const crear = async (actor, { nombre, descripcion, predeterminado }) => {
  const [created] = await db('grupos')
    .insert({
      creado_por_usuario_id: actor.id,
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

  await db.transaction(async (trx) => {
    await closeActiveClassForGroup(id_grupo, {
      cierreMotivo: 'reasignacion_tutor',
      estado: ESTADOS_SESION_CLASE.cancelada,
    }, trx);

    await trx('grupos')
      .where({ id_grupo })
      .update({
        tutor_asignado_id: tutor_id ?? null,
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
    const affectedStudents = await getActiveStudentIdsByGroup(id_grupo, user, trx);

    await closeActiveClassForGroup(id_grupo, {
      cierreMotivo: 'grupo_archivado',
      estado: ESTADOS_SESION_CLASE.cancelada,
    }, trx);

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
        actualizado_en: trx.fn.now(),
      });

    return {
      estudiantes_desvinculados: affectedStudents.length,
      sesiones_cerradas: affectedStudents.length,
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

export const toggleSesion = async (id_grupo, user, { sesion_activa, minijuego_id, pasos, modo }) => {
  const group = await assertGroupAssignedToTutor(id_grupo, user);

  if (group.activo === false) {
    throw new AppError('No se puede abrir ni cerrar la clase de un grupo archivado', 409);
  }

  if (!sesion_activa) {
    const sesionActiva = await obtenerSesionClaseActivaPorGrupo(id_grupo);
    if (!sesionActiva) {
      return { actualizados: 0, sesion_activa: false, minijuego_id: null };
    }

    const [{ total }] = await db('sesion_clase_participantes')
      .where({ sesion_clase_id: sesionActiva.id })
      .count('id_sesion_clase_participante as total');

    await db.transaction(async (trx) => {
      await closeActiveClassForGroup(id_grupo, {
        cierreMotivo: 'manual',
        estado: ESTADOS_SESION_CLASE.cerrada,
      }, trx);
    });

    return {
      actualizados: Number(total ?? 0),
      sesion_activa: false,
      minijuego_id: null,
      minijuego_slug: null,
      minijuego_titulo: null,
    };
  }

  const activeSession = await obtenerSesionClaseActivaPorGrupo(id_grupo);
  if (activeSession) {
    throw new AppError('El grupo ya tiene una sesión de clase activa', 409);
  }

  const studentIds = await getActiveStudentIdsByGroup(id_grupo, user);
  if (!studentIds.length) {
    throw new AppError(
      'No hay estudiantes activos en este grupo. Agrega estudiantes antes de abrir la clase.',
      422
    );
  }

  const planSesion = await resolvePlanSesionClase({ minijuego_id, pasos, modo });

  await db.transaction(async (trx) => {
    await crearSesionClase(
      {
        grupoId: id_grupo,
        tutorResponsableId: user.id,
        abiertaPorUsuarioId: user.id,
        estudianteIds: studentIds,
        planSesion,
      },
      trx
    );
  });

  const resumenSesion = await obtenerResumenSesionActivaParaGrupo(id_grupo);
  return {
    actualizados: studentIds.length,
    sesion_activa: true,
    minijuego_id: resumenSesion?.sesion_minijuego_id ?? null,
    minijuego_slug: resumenSesion?.sesion_minijuego_slug ?? null,
    minijuego_titulo: resumenSesion?.sesion_minijuego_titulo ?? null,
    sesion_clase_id: resumenSesion?.sesion_clase_id ?? null,
    sesion_modo: resumenSesion?.sesion_modo ?? null,
    sesion_total_pasos: Number(resumenSesion?.sesion_total_pasos ?? 0),
  };
};
