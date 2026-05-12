import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import { enviarResultadoReactivacion } from './email.service.js';

const SOLICITUD_FIELDS = [
  'sr.id_solicitud as id',
  'sr.usuario_id',
  'sr.correo_contacto',
  'sr.motivo',
  'sr.descripcion',
  'sr.estado_solicitud',
  'sr.respuesta_admin',
  'sr.leida_admin',
  'sr.fecha_solicitud',
  'sr.fecha_respuesta',
  'u.nombre as tutor_nombre',
  'u.email as tutor_email',
  'u.institucion_id',
];

const resolveEstadoUsuarioId = async (nombre, executor = db) => {
  const estado = await executor('estados_usuario')
    .where({ nombre })
    .select('id_estado_usuario')
    .first();

  if (!estado) {
    throw new AppError(`El estado '${nombre}' no existe`, 500);
  }

  return estado.id_estado_usuario;
};

const buildSolicitudesQuery = (executor = db) =>
  executor('solicitudes_reactivacion as sr')
    .join('usuarios as u', 'sr.usuario_id', 'u.id_usuario')
    .select(SOLICITUD_FIELDS);

const assertSolicitudManagementScope = (solicitud, user) => {
  if (!solicitud) {
    throw new AppError('Solicitud no encontrada', 404);
  }

  if (user.rol === 'superadmin') {
    return solicitud;
  }

  if (!user.institucion_id) {
    throw new AppError('No tienes una institución asociada', 403);
  }

  if (solicitud.institucion_id !== user.institucion_id) {
    throw new AppError('No tienes permisos para gestionar solicitudes de otra institución', 403);
  }

  return solicitud;
};

const resolveSolicitudById = async (id_solicitud, executor = db) => {
  if (!Number.isInteger(id_solicitud) || id_solicitud <= 0) {
    throw new AppError('El ID de la solicitud no es válido', 400);
  }

  return buildSolicitudesQuery(executor)
    .where('sr.id_solicitud', id_solicitud)
    .first();
};

const assertPendingSolicitud = (solicitud) => {
  if (solicitud.estado_solicitud !== 'pendiente') {
    throw new AppError(
      `La solicitud ya fue ${solicitud.estado_solicitud} y no puede procesarse de nuevo`,
      409
    );
  }
};

/**
 * Crea una solicitud de reactivación para un tutor suspendido.
 */
export const crearSolicitudReactivacion = async ({
  email,
  correo_respuesta,
  motivo,
  descripcion,
}) => {
  const usuario = await db('usuarios as u')
    .join('roles as r', 'r.id_rol', 'u.rol_id')
    .select('u.id_usuario', 'u.nombre', 'u.email', 'u.estado_id', 'r.nombre as rol')
    .where('u.email', email)
    .first();

  if (!usuario) {
    throw new AppError('No existe una cuenta con ese correo electrónico', 404);
  }

  if (usuario.rol !== 'tutor') {
    throw new AppError('Solo los tutores pueden solicitar reactivación', 409);
  }

  const suspendidoId = await resolveEstadoUsuarioId('suspendido');
  if (usuario.estado_id !== suspendidoId) {
    throw new AppError('Solo los usuarios suspendidos pueden solicitar reactivación', 409);
  }

  const solicitudExistente = await db('solicitudes_reactivacion')
    .where({ usuario_id: usuario.id_usuario, estado_solicitud: 'pendiente' })
    .first();

  if (solicitudExistente) {
    throw new AppError('Ya existe una solicitud de reactivación pendiente para este tutor', 409);
  }

  const [nuevaSolicitud] = await db('solicitudes_reactivacion')
    .insert({
      usuario_id: usuario.id_usuario,
      correo_contacto: correo_respuesta || usuario.email,
      motivo,
      descripcion: descripcion ?? null,
      estado_solicitud: 'pendiente',
      leida_admin: false,
      fecha_solicitud: db.fn.now(),
    })
    .returning(['id_solicitud', 'estado_solicitud', 'fecha_solicitud']);

  return {
    solicitud: {
      id: nuevaSolicitud.id_solicitud,
      estado: nuevaSolicitud.estado_solicitud,
      fecha: nuevaSolicitud.fecha_solicitud,
    },
  };
};

/**
 * Lista solicitudes visibles para el administrador actual.
 */
export const listarSolicitudes = async (user) => {
  const query = buildSolicitudesQuery().orderBy('sr.fecha_solicitud', 'desc');

  if (user.rol === 'admin') {
    if (!user.institucion_id) {
      throw new AppError('No tienes una institución asociada', 403);
    }

    query.where('u.institucion_id', user.institucion_id);
  }

  return query;
};

/**
 * Obtiene una solicitud puntual y la marca como leída si aún no lo estaba.
 */
export const obtenerSolicitud = async (id_solicitud, user) => {
  const solicitud = await resolveSolicitudById(id_solicitud);
  assertSolicitudManagementScope(solicitud, user);

  if (!solicitud.leida_admin) {
    await db('solicitudes_reactivacion')
      .where({ id_solicitud })
      .update({ leida_admin: true });

    return { ...solicitud, leida_admin: true };
  }

  return solicitud;
};

/**
 * Aprueba una solicitud pendiente y reactiva al tutor.
 */
export const aprobarSolicitud = async (id_solicitud, user) => {
  const solicitud = await resolveSolicitudById(id_solicitud);
  assertSolicitudManagementScope(solicitud, user);
  assertPendingSolicitud(solicitud);

  const activoId = await resolveEstadoUsuarioId('activo');

  await db.transaction(async (trx) => {
    await trx('solicitudes_reactivacion')
      .where({ id_solicitud })
      .update({
        estado_solicitud: 'aprobado',
        fecha_respuesta: trx.fn.now(),
      });

    await trx('usuarios')
      .where({ id_usuario: solicitud.usuario_id })
      .update({
        estado_id: activoId,
        actualizado_en: trx.fn.now(),
      });
  });

  const notification = await enviarResultadoReactivacion({
    tutorNombre: solicitud.tutor_nombre,
    tutorEmail: solicitud.correo_contacto,
    resultado: 'aprobado',
  });

  return {
    solicitud_id: id_solicitud,
    usuario_id: solicitud.usuario_id,
    estado: 'aprobado',
    notificacion: {
      enviada: notification.success,
      omitida: Boolean(notification.skipped),
    },
  };
};

/**
 * Rechaza una solicitud pendiente y registra el motivo.
 */
export const rechazarSolicitud = async (id_solicitud, user, motivo_rechazo) => {
  const solicitud = await resolveSolicitudById(id_solicitud);
  assertSolicitudManagementScope(solicitud, user);
  assertPendingSolicitud(solicitud);

  await db('solicitudes_reactivacion')
    .where({ id_solicitud })
    .update({
      estado_solicitud: 'rechazado',
      respuesta_admin: motivo_rechazo,
      fecha_respuesta: db.fn.now(),
    });

  const notification = await enviarResultadoReactivacion({
    tutorNombre: solicitud.tutor_nombre,
    tutorEmail: solicitud.correo_contacto,
    resultado: 'rechazado',
    motivo: motivo_rechazo,
  });

  return {
    solicitud_id: id_solicitud,
    usuario_id: solicitud.usuario_id,
    estado: 'rechazado',
    notificacion: {
      enviada: notification.success,
      omitida: Boolean(notification.skipped),
    },
  };
};
