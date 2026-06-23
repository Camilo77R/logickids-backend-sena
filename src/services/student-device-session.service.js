import { createHash, randomUUID } from 'node:crypto';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../middlewares/errorHandler.js';

const MINUTE_IN_MS = 60 * 1000;

export const STUDENT_SESSION_TTL_SECONDS =
  env.STUDENT_DEVICE_SESSION_TTL_MINUTES * 60;

const STUDENT_INACTIVITY_MS =
  env.STUDENT_DEVICE_INACTIVITY_MINUTES * MINUTE_IN_MS;
const LOGIN_WINDOW_MS = env.STUDENT_LOGIN_WINDOW_MINUTES * MINUTE_IN_MS;
const LOGIN_BLOCK_MS = env.STUDENT_LOGIN_BLOCK_MINUTES * MINUTE_IN_MS;

const hashInstallationId = (installationId) =>
  createHash('sha256')
    .update(String(installationId).trim())
    .digest('hex');

const hasActiveGameSession = async (estudianteId, executor) => {
  const activeGame = await executor('sesiones_juego as sj')
    .join('estados_sesion as es', 'es.id_estado_sesion', 'sj.estado_id')
    .where({
      'sj.estudiante_id': estudianteId,
      'es.nombre': 'activo',
    })
    .select('sj.id_sesion_juego')
    .first();

  return Boolean(activeGame);
};

const isInactiveOutsideGame = async (session, now, executor) => {
  const inactiveSince = now.getTime() - new Date(session.ultima_actividad_en).getTime();
  if (inactiveSince <= STUDENT_INACTIVITY_MS) {
    return false;
  }

  return !(await hasActiveGameSession(session.estudiante_id, executor));
};

const revokeSession = (sessionId, reason, executor) =>
  executor('student_device_sessions')
    .where({ id_student_device_session: sessionId })
    .whereNull('revocada_en')
    .update({
      revocada_en: executor.fn.now(),
      motivo_revocacion: reason,
    });

const findLiveSessionForUpdate = (estudianteId, executor) =>
  executor('student_device_sessions')
    .where({ estudiante_id: estudianteId })
    .whereNull('revocada_en')
    .orderBy('creada_en', 'desc')
    .forUpdate()
    .first();

const expireStaleSession = async (session, now, executor) => {
  if (!session) {
    return null;
  }

  if (new Date(session.expira_en) <= now) {
    await revokeSession(session.id_student_device_session, 'expired', executor);
    return null;
  }

  if (await isInactiveOutsideGame(session, now, executor)) {
    await revokeSession(session.id_student_device_session, 'inactive', executor);
    return null;
  }

  return session;
};

export const createOrReuseStudentDeviceSession = async (
  { estudianteId, installationId, appVersion },
  executor
) => {
  const now = new Date();
  const installationHash = hashInstallationId(installationId);
  const current = await expireStaleSession(
    await findLiveSessionForUpdate(estudianteId, executor),
    now,
    executor
  );

  if (current && current.installation_hash !== installationHash) {
    throw new AppError('El estudiante ya tiene una sesión activa en otro dispositivo', 409, {
      code: 'STUDENT_SESSION_ACTIVE',
    });
  }

  if (current) {
    const [reused] = await executor('student_device_sessions')
      .where({ id_student_device_session: current.id_student_device_session })
      .update({
        ultima_actividad_en: now,
        app_version: appVersion ?? current.app_version,
      })
      .returning('*');
    return { session: reused, reused: true };
  }

  let created;
  try {
    [created] = await executor('student_device_sessions')
      .insert({
        id_student_device_session: randomUUID(),
        estudiante_id: estudianteId,
        installation_hash: installationHash,
        app_version: appVersion ?? null,
        creada_en: now,
        ultima_actividad_en: now,
        expira_en: new Date(now.getTime() + STUDENT_SESSION_TTL_SECONDS * 1000),
      })
      .returning('*');
  } catch (error) {
    if (error?.code === '23505') {
      throw new AppError('El dispositivo ya tiene una sesion infantil activa', 409, {
        code: 'STUDENT_SESSION_ACTIVE',
      });
    }
    throw error;
  }

  return { session: created, reused: false };
};

export const resolveActiveStudentDeviceSession = async (estudianteId, executor) => {
  const now = new Date();
  return expireStaleSession(
    await findLiveSessionForUpdate(estudianteId, executor),
    now,
    executor
  );
};

export const validateStudentDeviceSession = async ({ sessionId, estudianteId }) => {
  const resolution = await db.transaction(async (trx) => {
    const session = await trx('student_device_sessions')
      .where({
        id_student_device_session: sessionId,
        estudiante_id: estudianteId,
      })
      .forUpdate()
      .first();

    if (!session || session.revocada_en) {
      return { errorCode: 'SESSION_REVOKED' };
    }

    const now = new Date();
    if (new Date(session.expira_en) <= now) {
      await revokeSession(sessionId, 'expired', trx);
      return { errorCode: 'TOKEN_EXPIRED' };
    }

    if (await isInactiveOutsideGame(session, now, trx)) {
      await revokeSession(sessionId, 'inactive', trx);
      return { errorCode: 'SESSION_REVOKED' };
    }

    await trx('student_device_sessions')
      .where({ id_student_device_session: sessionId })
      .update({ ultima_actividad_en: now });

    return { session };
  });

  if (resolution.errorCode) {
    throw new AppError('La sesión del dispositivo ya no está activa', 401, {
      code: resolution.errorCode,
    });
  }

  return resolution.session;
};

export const revokeStudentDeviceSession = async (sessionId, reason = 'logout', executor = db) =>
  Boolean(await revokeSession(sessionId, reason, executor));

export const revokeAllStudentDeviceSessions = async (
  estudianteId,
  reason = 'tutor_recovery',
  executor = db
) =>
  executor('student_device_sessions')
    .where({ estudiante_id: estudianteId })
    .whereNull('revocada_en')
    .update({
      revocada_en: executor.fn.now(),
      motivo_revocacion: reason,
    });

const hashRateLimitKey = (value) =>
  createHash('sha256')
    .update(value)
    .digest('hex');

const recordRateLimitKey = async ({ keyHash, maxAttempts }) => {
  const result = await db.transaction(async (trx) => {
    await trx('student_login_rate_limits')
      .insert({ key_hash: keyHash })
      .onConflict('key_hash')
      .ignore();

    const row = await trx('student_login_rate_limits')
      .where({ key_hash: keyHash })
      .forUpdate()
      .first();
    const now = new Date();

    if (row.bloqueada_hasta && new Date(row.bloqueada_hasta) > now) {
      return { blockedUntil: row.bloqueada_hasta };
    }

    const windowExpired = now.getTime() - new Date(row.ventana_iniciada_en).getTime() > LOGIN_WINDOW_MS;
    const attempts = windowExpired ? 1 : Number(row.intentos) + 1;
    const blockedUntil = attempts > maxAttempts
      ? new Date(now.getTime() + LOGIN_BLOCK_MS)
      : null;

    await trx('student_login_rate_limits')
      .where({ key_hash: keyHash })
      .update({
        intentos: attempts,
        ventana_iniciada_en: windowExpired ? now : row.ventana_iniciada_en,
        bloqueada_hasta: blockedUntil,
        ultimo_intento_en: now,
      });

    return { blockedUntil };
  });

  if (result.blockedUntil) {
    throw new AppError('Demasiados intentos de acceso. Intenta más tarde', 429, {
      code: 'STUDENT_LOGIN_RATE_LIMITED',
      retry_after_seconds: Math.max(
        1,
        Math.ceil((new Date(result.blockedUntil).getTime() - Date.now()) / 1000)
      ),
    });
  }

  return keyHash;
};

export const recordStudentLoginAttempt = async ({ ip, installationId }) => {
  const normalizedIp = String(ip ?? 'unknown');
  const keys = [
    {
      keyHash: hashRateLimitKey(`device|${normalizedIp}|${installationId}`),
      maxAttempts: env.STUDENT_LOGIN_MAX_ATTEMPTS,
    },
    {
      keyHash: hashRateLimitKey(`ip|${normalizedIp}`),
      maxAttempts: env.STUDENT_LOGIN_MAX_ATTEMPTS_PER_IP,
    },
  ];

  const recordedKeys = [];
  for (const key of keys) {
    recordedKeys.push(await recordRateLimitKey(key));
  }
  return {
    deviceKeyHash: recordedKeys[0],
    ipKeyHash: recordedKeys[1],
  };
};

export const clearStudentLoginRateLimit = ({ deviceKeyHash }) =>
  db('student_login_rate_limits').where({ key_hash: deviceKeyHash }).del();
