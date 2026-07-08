import jwt from 'jsonwebtoken';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../middlewares/errorHandler.js';
import {
  applyStudentOwnershipScope,
  assertCurrentStudentBelongsToUser,
  assertGroupBelongsToUser,
  assertStudentBelongsToUser,
  withActiveGroupHistory,
} from './access.service.js';
import {
  cerrarSesionClaseSiTermino,
  ESTADOS_PARTICIPANTE_SESION,
  obtenerResumenSesionActivaParaEstudiante,
} from './sesionesClase.service.js';
import { finalizar } from './sesiones.service.js';
import { randomCode } from '../utils/codes.js';
import { publishStudentAccessChanged } from '../realtime/realtime.events.js';
import {
  buildStudentLoginRateLimitKeys,
  clearStudentLoginRateLimit,
  createOrReuseStudentDeviceSession,
  recordStudentLoginAttempt,
  resolveActiveStudentDeviceSession,
  resolveActiveStudentDeviceSessionByInstallation,
  revokeAllStudentDeviceSessions,
  revokeStudentDeviceSession,
  STUDENT_DEVICE_CONFLICT_STRATEGIES,
  STUDENT_SESSION_TTL_SECONDS,
} from './student-device-session.service.js';

const SESION_ACTIVA_STUDENT_RAW = db.raw(`
  EXISTS (
    SELECT 1
    FROM sesion_clase_participantes participante
    JOIN sesiones_clase sc ON sc.id_sesion_clase = participante.sesion_clase_id
    WHERE participante.estudiante_id = estudiantes.id_estudiante
      AND sc.estado = 'activa'
      AND participante.estado IN ('pendiente', 'en_progreso')
  ) as sesion_activa
`);

/** Campos base que se devuelven en la mayoría de respuestas de estudiante */
const STUDENT_FIELDS = [
  'estudiantes.id_estudiante as id',
  'estudiantes.nombre',
  'estudiantes.edad',
  'estudiantes.color_avatar',
  SESION_ACTIVA_STUDENT_RAW,
  'estudiantes.creado_en',
  'estados_estudiante.nombre as estado',
  'egh.grupo_id',
];

/**
 * Query base reutilizable: estudiante + estado + grupo activo via historial.
 * Centraliza el join repetido en todo el servicio.
 */
const baseQuery = () =>
  withActiveGroupHistory(
    db('estudiantes').join(
      'estados_estudiante',
      'estados_estudiante.id_estado_estudiante',
      'estudiantes.estado_id'
    )
  );

const buildBaseStudentRow = (executor = db) =>
  withActiveGroupHistory(
    executor('estudiantes').join(
      'estados_estudiante',
      'estados_estudiante.id_estado_estudiante',
      'estudiantes.estado_id'
    )
  )
    .leftJoin('grupos', 'grupos.id_grupo', 'egh.grupo_id')
    .select([
      ...STUDENT_FIELDS,
      'grupos.nombre as grupo_nombre',
      'grupos.activo as grupo_activo',
    ]);

const enrichStudentWithActiveSession = async (student, executor = db) => {
  if (!student) {
    return null;
  }

  if (!student.grupo_id || student.grupo_activo === false) {
    return {
      ...student,
      sesion_activa: false,
      sesion_clase_id: null,
      sesion_modo: null,
      sesion_ruta_id: null,
      sesion_ruta_slug: null,
      sesion_ruta_nombre: null,
      sesion_total_pasos: 0,
      sesion_paso_actual: null,
      sesion_bloque_actual: null,
      sesion_nivel_en_bloque: null,
      sesion_participante_estado: null,
      sesion_minijuego_id: null,
      sesion_minijuego_slug: null,
      sesion_minijuego_titulo: null,
      sesion_configuracion_base: null,
    };
  }

  const resumenSesion = await obtenerResumenSesionActivaParaEstudiante(
    {
      grupoId: student.grupo_id,
      estudianteId: student.id,
    },
    executor
  );

  return {
    ...student,
    sesion_activa: ['pendiente', 'en_progreso'].includes(
      resumenSesion?.sesion_participante_estado ?? ''
    ),
    sesion_clase_id: resumenSesion?.sesion_clase_id ?? null,
    sesion_modo: resumenSesion?.sesion_modo ?? null,
    sesion_ruta_id: resumenSesion?.sesion_ruta_id ?? null,
    sesion_ruta_slug: resumenSesion?.sesion_ruta_slug ?? null,
    sesion_ruta_nombre: resumenSesion?.sesion_ruta_nombre ?? null,
    sesion_total_pasos: Number(resumenSesion?.sesion_total_pasos ?? 0),
    sesion_paso_actual: resumenSesion?.sesion_paso_actual ?? null,
    sesion_bloque_actual: resumenSesion?.sesion_bloque_actual ?? null,
    sesion_nivel_en_bloque: resumenSesion?.sesion_nivel_en_bloque ?? null,
    sesion_participante_estado: resumenSesion?.sesion_participante_estado ?? null,
    sesion_minijuego_id: resumenSesion?.sesion_minijuego_id ?? null,
    sesion_minijuego_slug: resumenSesion?.sesion_minijuego_slug ?? null,
    sesion_minijuego_titulo: resumenSesion?.sesion_minijuego_titulo ?? null,
    sesion_configuracion_base: resumenSesion?.sesion_configuracion_base ?? null,
  };
};

const closeClassStateForStudent = async (id_estudiante, executor = db) => {
  const activoId = await executor('estados_sesion')
    .where({ nombre: 'activo' })
    .select('id_estado_sesion')
    .first();

  const sesionesActivas = await executor('sesiones_juego')
    .where({ estudiante_id: id_estudiante, estado_id: activoId.id_estado_sesion })
    .select('id_sesion_juego as id', 'sesion_clase_id');

  const sesionesClaseTocadas = new Set();

  for (const sesion of sesionesActivas) {
    const resultado = await finalizar(
      sesion.id,
      id_estudiante,
      { estado: 'abandonado', cerrarSesionClase: false },
      executor
    );
    if (resultado.sesion_clase_id != null) {
      sesionesClaseTocadas.add(resultado.sesion_clase_id);
    }
  }

  const participacionesPendientes = await executor('sesion_clase_participantes as participante')
    .join('sesiones_clase as sc', 'sc.id_sesion_clase', 'participante.sesion_clase_id')
    .where('participante.estudiante_id', id_estudiante)
    .where('sc.estado', 'activa')
    .whereIn('participante.estado', [
      ESTADOS_PARTICIPANTE_SESION.pendiente,
      ESTADOS_PARTICIPANTE_SESION.enProgreso,
    ])
    .select('participante.sesion_clase_id');

  if (participacionesPendientes.length) {
    await executor('sesion_clase_participantes')
      .whereIn(
        'sesion_clase_id',
        participacionesPendientes.map((participacion) => participacion.sesion_clase_id)
      )
      .andWhere({ estudiante_id: id_estudiante })
      .update({
        estado: ESTADOS_PARTICIPANTE_SESION.cerrado,
        finalizada_en: executor.fn.now(),
      });

    participacionesPendientes.forEach((participacion) =>
      sesionesClaseTocadas.add(participacion.sesion_clase_id)
    );
  }

  for (const sesionClaseId of sesionesClaseTocadas) {
    await cerrarSesionClaseSiTermino(sesionClaseId, executor);
  }
};

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
 */
export const loginEstudiante = async (
  { qr_token, installation_id, app_version, device_conflict_strategy },
  { ip = 'unknown' } = {}
) => {
  const rateLimitKeys = buildStudentLoginRateLimitKeys({
    ip,
    installationId: installation_id,
  });

  const loginResult = await db.transaction(async (trx) => {
    const identity = await trx('estudiantes')
      .where({ qr_token })
      .select('id_estudiante')
      .forUpdate()
      .first();

    if (!identity) {
      await recordStudentLoginAttempt({
        ip,
        installationId: installation_id,
      });
      throw new AppError('QR inválido', 404, { code: 'STUDENT_QR_INVALID' });
    }

    await clearStudentLoginRateLimit(rateLimitKeys);

    const est = await buildBaseStudentRow(trx)
      .leftJoin('instituciones', 'instituciones.id_institucion', 'estudiantes.institucion_id')
      .where('estudiantes.id_estudiante', identity.id_estudiante)
      .select('estudiantes.qr_token', 'instituciones.activo as institucion_activa')
      .first();

    if (est.estado !== 'activo') {
      throw new AppError('Estudiante inactivo', 403, { code: 'STUDENT_INACTIVE' });
    }
    if (est.institucion_activa === false) {
      throw new AppError('La institución del estudiante está desactivada', 403, {
        code: 'STUDENT_INSTITUTION_INACTIVE',
      });
    }

    const perfil = await enrichStudentWithActiveSession(est, trx);
    const events = [];
    const activeSessionOnInstallation =
      await resolveActiveStudentDeviceSessionByInstallation(installation_id, trx);

    if (
      activeSessionOnInstallation &&
      activeSessionOnInstallation.estudiante_id !== perfil.id
    ) {
      if (
        device_conflict_strategy !==
        STUDENT_DEVICE_CONFLICT_STRATEGIES.replaceExistingDeviceSession
      ) {
        throw new AppError('El dispositivo ya tiene una sesion infantil activa', 409, {
          code: 'STUDENT_SESSION_ACTIVE',
        });
      }

      const replacedStudent = await buildBaseStudentRow(trx)
        .leftJoin('instituciones', 'instituciones.id_institucion', 'estudiantes.institucion_id')
        .where('estudiantes.id_estudiante', activeSessionOnInstallation.estudiante_id)
        .select('estudiantes.institucion_id')
        .first();

      await closeClassStateForStudent(activeSessionOnInstallation.estudiante_id, trx);
      await revokeAllStudentDeviceSessions(
        activeSessionOnInstallation.estudiante_id,
        'device_replaced_local',
        trx
      );

      await trx('student_device_session_audit').insert({
        estudiante_id: activeSessionOnInstallation.estudiante_id,
        institucion_id: perfil.institucion_id ?? null,
        actor_usuario_id: null,
        accion: 'tutor_recovery',
        metadata: {
          replaced_by_student_id: perfil.id,
          strategy: device_conflict_strategy,
          recovery_mode: 'same_device_handoff',
        },
      });

      events.push({
        institucionId: replacedStudent?.institucion_id ?? perfil.institucion_id ?? null,
        studentId: activeSessionOnInstallation.estudiante_id,
        grupoId: replacedStudent?.grupo_id ?? null,
        reason: 'student_device_recovered',
      });
    }

    const { session, reused } = await createOrReuseStudentDeviceSession(
      {
        estudianteId: perfil.id,
        installationId: installation_id,
        appVersion: app_version,
      },
      trx
    );

    const token = jwt.sign(
      {
        sid: session.id_student_device_session,
      },
      env.JWT_STUDENT_SECRET,
      {
        algorithm: 'HS256',
        audience: env.JWT_STUDENT_AUDIENCE,
        expiresIn: STUDENT_SESSION_TTL_SECONDS,
        issuer: env.JWT_STUDENT_ISSUER,
        subject: String(perfil.id),
      }
    );

    const { qr_token: _, ...estudiante } = perfil;
    events.push({
      institucionId: perfil.institucion_id ?? null,
      studentId: perfil.id,
      grupoId: perfil.grupo_id ?? null,
      reason: reused ? 'student_device_session_reused' : 'student_device_session_started',
    });

    return {
      response: {
        token,
        estudiante,
        expires_at: session.expira_en,
        device_session: {
          id: session.id_student_device_session,
          reused,
        },
      },
      events,
    };
  });

  loginResult.events.forEach((event) => publishStudentAccessChanged(event));
  return loginResult.response;
};

export const logoutEstudiante = async (deviceSessionId) => {
  if (!deviceSessionId) {
    return {
      revoked: false,
      legacy: true,
    };
  }

  const result = await db.transaction(async (trx) => {
    const activeSession = await trx('student_device_sessions as sds')
      .join('estudiantes', 'estudiantes.id_estudiante', 'sds.estudiante_id')
      .leftJoin('estudiante_grupo_historial as egh', function joinActiveMembership() {
        this.on('egh.estudiante_id', 'estudiantes.id_estudiante')
          .andOn('egh.activo', db.raw('TRUE'))
          .andOnNull('egh.fecha_fin');
      })
      .where('sds.id_student_device_session', deviceSessionId)
      .select(
        'sds.estudiante_id',
        'estudiantes.institucion_id',
        'egh.grupo_id'
      )
      .first();

    const revoked = await revokeStudentDeviceSession(deviceSessionId, 'logout', trx);

    return {
      revoked,
      event: activeSession
        ? {
            institucionId: activeSession.institucion_id ?? null,
            studentId: activeSession.estudiante_id,
            grupoId: activeSession.grupo_id ?? null,
            reason: 'student_device_session_ended',
          }
        : null,
    };
  });

  if (result.revoked && result.event) {
    publishStudentAccessChanged(result.event);
  }

  return {
    revoked: result.revoked,
    legacy: false,
  };
};

export const obtenerSesionDispositivoActiva = async (id_estudiante, user) =>
  db.transaction(async (trx) => {
    const student = await trx('estudiantes')
      .where({ id_estudiante })
      .select('id_estudiante')
      .forUpdate()
      .first();

    if (!student) {
      throw new AppError('Estudiante no encontrado', 404);
    }

    await assertCurrentStudentBelongsToUser(id_estudiante, user, trx);
    const deviceSession = await resolveActiveStudentDeviceSession(id_estudiante, trx);

    if (!deviceSession) {
      return {
        tiene_dispositivo_activo: false,
        puede_recuperar: false,
        dispositivo_activo: null,
      };
    }

    const currentActivity = await trx('sesiones_juego as sj')
      .join('estados_sesion as es', 'es.id_estado_sesion', 'sj.estado_id')
      .join('minijuegos as m', 'm.id_minijuego', 'sj.minijuego_id')
      .where({
        'sj.estudiante_id': id_estudiante,
        'es.nombre': 'activo',
      })
      .select(
        'm.slug as minijuego_slug',
        'm.titulo as minijuego_titulo',
        'sj.iniciada_en'
      )
      .orderBy('sj.iniciada_en', 'desc')
      .first();

    return {
      tiene_dispositivo_activo: true,
      puede_recuperar: true,
      dispositivo_activo: {
        estado: 'activo',
        conectado_desde: deviceSession.creada_en,
        ultima_actividad_en: deviceSession.ultima_actividad_en,
        actividad_actual: currentActivity
          ? {
              minijuego_slug: currentActivity.minijuego_slug,
              minijuego_titulo: currentActivity.minijuego_titulo,
              iniciada_en: currentActivity.iniciada_en,
            }
          : null,
      },
    };
  });

export const recuperarSesionDispositivo = async (
  id_estudiante,
  user,
  action = 'restart_current_activity'
) => {
  const transactionResult = await db.transaction(async (trx) => {
    const lockedStudent = await trx('estudiantes')
      .where({ id_estudiante })
      .select('id_estudiante')
      .forUpdate()
      .first();

    if (!lockedStudent) {
      throw new AppError('Estudiante no encontrado', 404);
    }

    const student = await assertCurrentStudentBelongsToUser(id_estudiante, user, trx);
    const activeDeviceSession = await resolveActiveStudentDeviceSession(id_estudiante, trx);

    if (!activeDeviceSession) {
      throw new AppError('El estudiante no tiene una sesion de dispositivo activa', 409, {
        code: 'STUDENT_DEVICE_SESSION_NOT_ACTIVE',
      });
    }

    const activoId = await trx('estados_sesion')
      .where({ nombre: 'activo' })
      .select('id_estado_sesion')
      .first();
    const abandonadoId = await trx('estados_sesion')
      .where({ nombre: 'abandonado' })
      .select('id_estado_sesion')
      .first();

    const activeSessions = await trx('sesiones_juego')
      .where({
        estudiante_id: id_estudiante,
        estado_id: activoId.id_estado_sesion,
      })
      .select('id_sesion_juego', 'sesion_clase_id')
      .forUpdate();

    if (activeSessions.length) {
      await trx('sesiones_juego')
        .whereIn(
          'id_sesion_juego',
          activeSessions.map(({ id_sesion_juego }) => id_sesion_juego)
        )
        .update({
          estado_id: abandonadoId.id_estado_sesion,
          finalizada_en: trx.fn.now(),
          recuperada_en: trx.fn.now(),
          recuperada_por_usuario_id: user.id,
        });
    }

    const participant = await trx('sesion_clase_participantes as participante')
      .join('sesiones_clase as sc', 'sc.id_sesion_clase', 'participante.sesion_clase_id')
      .where({
        'participante.estudiante_id': id_estudiante,
        'sc.estado': 'activa',
      })
      .whereIn('participante.estado', ['pendiente', 'en_progreso'])
      .select(
        'participante.id_sesion_clase_participante',
        'participante.sesion_clase_id',
        'participante.paso_actual'
      )
      .first();

    if (participant) {
      await trx('sesion_clase_participantes')
        .where({ id_sesion_clase_participante: participant.id_sesion_clase_participante })
        .update({
          estado: 'pendiente',
          iniciada_en: null,
          finalizada_en: null,
        });
    }

    const revokedDeviceSessions = await revokeAllStudentDeviceSessions(
      id_estudiante,
      'tutor_recovery',
      trx
    );

    await trx('student_device_session_audit').insert({
      estudiante_id: id_estudiante,
      institucion_id: student.institucion_id ?? user.institucion_id ?? null,
      actor_usuario_id: user.id,
      accion: 'tutor_recovery',
      metadata: {
        action,
        revoked_device_sessions: revokedDeviceSessions,
        reset_game_sessions: activeSessions.length,
        sesion_clase_id: participant?.sesion_clase_id ?? null,
        paso_actual: participant?.paso_actual ?? null,
      },
    });

    return {
      student,
      data: {
        action,
        revoked_device_sessions: revokedDeviceSessions,
        reset_game_sessions: activeSessions.length,
        sesion_clase_id: participant?.sesion_clase_id ?? null,
        paso_actual: participant?.paso_actual ?? null,
      },
    };
  });

  publishStudentAccessChanged({
    institucionId: user.institucion_id ?? transactionResult.student.institucion_id ?? null,
    studentId: id_estudiante,
    grupoId: transactionResult.student.grupo_id ?? null,
    reason: 'student_device_recovered',
  });

  return transactionResult.data;
};

export const listar = async (user, grupo_id) => {
  let query = baseQuery()
    .leftJoin('grupos', 'grupos.id_grupo', 'egh.grupo_id')
    .where('estados_estudiante.nombre', 'activo')
    .select([...STUDENT_FIELDS, 'grupos.nombre as grupo_nombre', 'grupos.activo as grupo_activo'])
    .orderBy('estudiantes.nombre');

  query = applyStudentOwnershipScope(query, user);

  if (grupo_id) query = query.where('egh.grupo_id', grupo_id);
  return query;
};

export const listarTodos = async (user, grupo_id) => {
  let query = withActiveGroupHistory(
    db('estudiantes').join(
      'estados_estudiante',
      'estados_estudiante.id_estado_estudiante',
      'estudiantes.estado_id'
    )
  )
    .leftJoin('grupos', 'grupos.id_grupo', 'egh.grupo_id')
    .leftJoin('instituciones', 'instituciones.id_institucion', 'estudiantes.institucion_id')
    .select([
      ...STUDENT_FIELDS,
      'grupos.nombre as grupo_nombre',
      'grupos.activo as grupo_activo',
      'instituciones.nombre as institucion',
      'instituciones.ciudad as institucion_ciudad',
    ])
    .orderBy('estudiantes.nombre');

  query = applyStudentOwnershipScope(query, user);

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

export const obtenerPerfilInfantil = async (id_estudiante) => {
  const student = await buildBaseStudentRow()
    .where('estudiantes.id_estudiante', id_estudiante)
    .first();

  return enrichStudentWithActiveSession(student);
};

export const crear = async (user, { grupo_id, nombre, edad, color_avatar }) => {
  if (grupo_id) {
    const group = await assertGroupBelongsToUser(grupo_id, user);
    if (group.activo === false) {
      throw new AppError('No se puede asignar un estudiante a un grupo archivado', 409);
    }
  }

  const qr_token = await generateUniqueQR();

  const [est] = await db('estudiantes')
    .insert({
      nombre,
      edad,
      color_avatar: color_avatar ?? '#3B82F6',
      qr_token,
      estado_id: 1,
      institucion_id: user.institucion_id ?? null,
    })
    .returning('*');

  if (grupo_id) {
    await db('estudiante_grupo_historial').insert({
      estudiante_id: est.id_estudiante,
      grupo_id,
      fecha_inicio: db.fn.now(),
      activo: true,
    });
  }

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
  const student = await assertStudentBelongsToUser(id_estudiante, user);

  const { id_estado_estudiante: idInactivo } = await db('estados_estudiante')
    .where({ nombre: 'inactivo' })
    .select('id_estado_estudiante')
    .first();

  const estudiante = await db('estudiantes').where({ id_estudiante }).select('estado_id').first();

  if (!estudiante) {
    throw new AppError('Estudiante no encontrado', 404);
  }

  if (estudiante.estado_id === idInactivo) {
    throw new AppError('El estudiante ya está inactivo', 409);
  }

  await db.transaction(async (trx) => {
    await closeClassStateForStudent(id_estudiante, trx);

    await trx('estudiantes')
      .where({ id_estudiante })
      .update({ estado_id: idInactivo, actualizado_en: trx.fn.now() });
  });

  publishStudentAccessChanged({
    institucionId: user.institucion_id ?? student.institucion_id ?? null,
    studentId: id_estudiante,
    grupoAnteriorId: student.grupo_id ?? null,
    reason: 'student_deactivated',
  });
};

export const reactivar = async (id_estudiante, user) => {
  const student = await assertStudentBelongsToUser(id_estudiante, user);

  const { id_estado_estudiante: idActivo } = await db('estados_estudiante')
    .where({ nombre: 'activo' })
    .select('id_estado_estudiante')
    .first();

  const estudiante = await db('estudiantes').where({ id_estudiante }).select('estado_id').first();

  if (!estudiante) {
    throw new AppError('Estudiante no encontrado', 404);
  }

  if (estudiante.estado_id === idActivo) {
    throw new AppError('El estudiante ya está activo', 409);
  }

  await db('estudiantes')
    .where({ id_estudiante })
    .update({ estado_id: idActivo, actualizado_en: db.fn.now() });

  publishStudentAccessChanged({
    institucionId: user.institucion_id ?? student.institucion_id ?? null,
    studentId: id_estudiante,
    grupoId: student.grupo_id ?? null,
    reason: 'student_reactivated',
  });
};

export const obtenerQR = async (id_estudiante, user) => {
  await assertStudentBelongsToUser(id_estudiante, user);
  const est = await db('estudiantes').where({ id_estudiante }).select('qr_token').first();
  if (!est) throw new AppError('Estudiante no encontrado', 404);
  return { qr_token: est.qr_token };
};

export const cambiarGrupo = async (id_estudiante, user, nuevo_grupo_id) => {
  const student = await assertStudentBelongsToUser(id_estudiante, user);
  const newGroup = await assertGroupBelongsToUser(nuevo_grupo_id, user);

  if (newGroup.activo === false) {
    throw new AppError('No se puede mover el estudiante a un grupo archivado', 409);
  }

  if (student.grupo_id === nuevo_grupo_id) {
    throw new AppError('El estudiante ya pertenece a ese grupo', 409);
  }

  await db.transaction(async (trx) => {
    await closeClassStateForStudent(id_estudiante, trx);

    await trx('estudiante_grupo_historial')
      .where({ estudiante_id: id_estudiante, activo: true })
      .update({ activo: false, fecha_fin: trx.fn.now() });

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

  publishStudentAccessChanged({
    institucionId: user.institucion_id ?? newGroup.institucion_id ?? null,
    studentId: id_estudiante,
    grupoAnteriorId: student.grupo_id ?? null,
    grupoId: nuevo_grupo_id,
    reason: 'group_changed',
  });

  return db('estudiantes')
    .join('estados_estudiante', 'estados_estudiante.id_estado_estudiante', 'estudiantes.estado_id')
    .leftJoin('estudiante_grupo_historial', function joinActiveMembership() {
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
      SESION_ACTIVA_STUDENT_RAW,
      'estudiantes.creado_en',
      'estados_estudiante.nombre as estado',
      'estudiante_grupo_historial.grupo_id'
    )
    .first();
};
