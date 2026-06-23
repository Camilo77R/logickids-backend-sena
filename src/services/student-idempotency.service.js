import { createHash } from 'node:crypto';
import { AppError } from '../middlewares/errorHandler.js';

const canonicalize = (value) => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }

  return value;
};

const hashRequest = (payload) =>
  createHash('sha256').update(JSON.stringify(canonicalize(payload))).digest('hex');

/**
 * Ejecuta una escritura exactamente una vez por clave logica.
 *
 * La fila se crea dentro de la misma transaccion que el efecto. Si el efecto
 * falla, tambien desaparece la reserva y un retry limpio puede volver a entrar.
 */
export const executeIdempotent = async (
  { estudianteId, operacion, key, payload, executor },
  handler
) => {
  if (!key) {
    return { replayed: false, value: await handler() };
  }

  const requestHash = hashRequest(payload);
  const conflictTarget = ['estudiante_id', 'operacion', 'idempotency_key'];
  const [inserted] = await executor('student_idempotency_keys')
    .insert({
      estudiante_id: estudianteId,
      operacion,
      idempotency_key: key,
      request_hash: requestHash,
    })
    .onConflict(conflictTarget)
    .ignore()
    .returning('*');

  const reservation =
    inserted ??
    (await executor('student_idempotency_keys')
      .where({
        estudiante_id: estudianteId,
        operacion,
        idempotency_key: key,
      })
      .forUpdate()
      .first());

  if (reservation.request_hash !== requestHash) {
    throw new AppError('La clave idempotente ya fue usada con otros datos', 409, {
      code: 'IDEMPOTENCY_CONFLICT',
    });
  }

  if (reservation.response_json != null) {
    return { replayed: true, value: reservation.response_json };
  }

  const value = await handler();
  await executor('student_idempotency_keys')
    .where({ id_student_idempotency_key: reservation.id_student_idempotency_key })
    .update({
      response_json: value,
      completada_en: executor.fn.now(),
    });

  return { replayed: false, value };
};
