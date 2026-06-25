import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import { assertStudentBelongsToUser } from './access.service.js';
import { resolveAchievementKeysForSession } from './logros.rules.js';

const logroFields = [
  'logros.id_logro as id',
  'logros.desbloqueado_en',
  'catalogo_logros.clave as clave_logro',
  'catalogo_logros.nombre as nombre_logro',
  'catalogo_logros.descripcion',
  'catalogo_logros.icono',
];

const resolveCatalogLogroId = async (clave, executor = db) => {
  const logro = await executor('catalogo_logros')
    .where({ clave, activo: true })
    .select('id_catalogo_logro')
    .first();

  if (!logro) {
    return null;
  }

  return logro.id_catalogo_logro;
};

const resolveCompletedSessionStateId = async (executor = db) => {
  const estado = await executor('estados_sesion')
    .where({ nombre: 'completado' })
    .select('id_estado_sesion')
    .first();

  if (!estado) {
    throw new AppError('No existe el estado de sesion completado', 500);
  }

  return estado.id_estado_sesion;
};

const findUnlockedAchievement = (estudiante_id, catalogo_logro_id, executor = db) =>
  executor('logros')
    .join('catalogo_logros', 'catalogo_logros.id_catalogo_logro', 'logros.catalogo_logro_id')
    .where({
      'logros.estudiante_id': estudiante_id,
      'logros.catalogo_logro_id': catalogo_logro_id,
    })
    .select(logroFields)
    .first();

const insertAchievementUnlockIfMissing = async (
  estudiante_id,
  catalogo_logro_id,
  executor = db
) => {
  const result = await executor.raw(
    `
      INSERT INTO logros (estudiante_id, catalogo_logro_id)
      VALUES (?, ?)
      ON CONFLICT (estudiante_id, catalogo_logro_id) DO NOTHING
      RETURNING id_logro
    `,
    [estudiante_id, catalogo_logro_id]
  );

  return result.rows?.[0]?.id_logro ?? null;
};

const desbloquearSiEsNuevo = async (estudiante_id, clave_logro, executor = db) => {
  const catalogo_logro_id = await resolveCatalogLogroId(clave_logro, executor);

  if (!catalogo_logro_id) {
    return null;
  }

  const insertedId = await insertAchievementUnlockIfMissing(
    estudiante_id,
    catalogo_logro_id,
    executor
  );

  if (!insertedId) {
    return null;
  }

  return findUnlockedAchievement(estudiante_id, catalogo_logro_id, executor);
};

const buildAchievementEvaluationContext = async (
  estudiante_id,
  {
    aciertos = 0,
    errores = 0,
    combo_maximo = 0,
    minijuego_id = null,
    minijuego_slug = null,
  },
  executor = db
) => {
  const total_intentos = aciertos + errores;
  const precision = total_intentos > 0 ? (aciertos / total_intentos) * 100 : 0;
  const estadoCompletadoId = await resolveCompletedSessionStateId(executor);

  const totalSesiones = await executor('sesiones_juego')
    .where({
      estudiante_id,
      estado_id: estadoCompletadoId,
    })
    .count('id_sesion_juego as total_sesiones')
    .first();

  const totalSesionesPorJuego = Number.isInteger(minijuego_id)
    ? await executor('sesiones_juego')
        .where({
          estudiante_id,
          estado_id: estadoCompletadoId,
          minijuego_id,
        })
        .count('id_sesion_juego as total_sesiones')
        .first()
    : { total_sesiones: null };

  return {
    aciertos,
    errores,
    combo_maximo,
    minijuego_id,
    minijuego_slug,
    precision,
    total_intentos,
    total_completed_sessions: Number(totalSesiones?.total_sesiones ?? 0),
    total_completed_sessions_in_minijuego:
      totalSesionesPorJuego?.total_sesiones == null
        ? null
        : Number(totalSesionesPorJuego.total_sesiones),
  };
};

/**
 * Catálogo de logros activos.
 * Si se pasa estudiante_id, cada logro incluye campo `desbloqueado: boolean`
 * para que la UI pueda distinguir visualmente los obtenidos de los pendientes (HU-25).
 */
export const listarCatalogo = async (estudiante_id = null) => {
  const catalogo = await db('catalogo_logros')
    .where({ activo: true })
    .select('id_catalogo_logro', 'clave', 'nombre', 'descripcion', 'icono')
    .orderBy('nombre', 'asc');

  if (!estudiante_id) return catalogo;

  const desbloqueados = await db('logros')
    .where({ estudiante_id })
    .select('catalogo_logro_id');

  const desbloqueadosSet = new Set(desbloqueados.map((l) => l.catalogo_logro_id));

  return catalogo.map((logro) => ({
    ...logro,
    desbloqueado: desbloqueadosSet.has(logro.id_catalogo_logro),
  }));
};

export const listarCatalogoTutor = async (estudiante_id, user) => {
  await assertStudentBelongsToUser(estudiante_id, user);
  return listarCatalogo(estudiante_id);
};

export const listar = async (estudiante_id, user) => {
  await assertStudentBelongsToUser(estudiante_id, user);
  return listarPorEstudiante(estudiante_id);
};

export const listarPorEstudiante = (estudiante_id) =>
  db('logros')
    .join('catalogo_logros', 'catalogo_logros.id_catalogo_logro', 'logros.catalogo_logro_id')
    .where('logros.estudiante_id', estudiante_id)
    .select(logroFields)
    .orderBy('logros.desbloqueado_en', 'desc');

export const evaluarLogrosSesion = async (
  estudiante_id,
  {
    aciertos = 0,
    errores = 0,
    combo_maximo = 0,
    estado = 'completado',
    minijuego_id = null,
    minijuego_slug = null,
  },
  executor = db
) => {
  if (estado !== 'completado') {
    return [];
  }

  const context = await buildAchievementEvaluationContext(
    estudiante_id,
    {
      aciertos,
      errores,
      combo_maximo,
      minijuego_id,
      minijuego_slug,
    },
    executor
  );

  const unlocked = [];
  for (const clave of resolveAchievementKeysForSession(context)) {
    const logro = await desbloquearSiEsNuevo(estudiante_id, clave, executor);
    if (logro) {
      unlocked.push(logro);
    }
  }

  return unlocked;
};
