import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import { assertStudentBelongsToUser } from './access.service.js';

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
    throw new AppError('El logro solicitado no existe', 404);
  }

  return logro.id_catalogo_logro;
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

export const desbloquear = async (estudiante_id, clave_logro, executor = db) => {
  const catalogo_logro_id = await resolveCatalogLogroId(clave_logro, executor);

  await executor('logros')
    .insert({ estudiante_id, catalogo_logro_id })
    .onConflict(['estudiante_id', 'catalogo_logro_id'])
    .ignore();

  return executor('logros')
    .join('catalogo_logros', 'catalogo_logros.id_catalogo_logro', 'logros.catalogo_logro_id')
    .where({
      'logros.estudiante_id': estudiante_id,
      'logros.catalogo_logro_id': catalogo_logro_id,
    })
    .select(logroFields)
    .first();
};

export const evaluarLogrosSesion = async (
  estudiante_id,
  { aciertos = 0, errores = 0, combo_maximo = 0, estado = 'completado' },
  executor = db
) => {
  if (estado !== 'completado') {
    return [];
  }

  const claves = [];
  const total_intentos = aciertos + errores;
  const precision = total_intentos > 0 ? (aciertos / total_intentos) * 100 : 0;

  const { id_estado_sesion } = await executor('estados_sesion')
    .where({ nombre: 'completado' })
    .select('id_estado_sesion')
    .first();

  const [{ total_sesiones }] = await executor('sesiones_juego')
    .where({
      estudiante_id,
      estado_id: id_estado_sesion,
    })
    .count('id_sesion_juego as total_sesiones');

  if (Number(total_sesiones) === 1) {
    claves.push('primer_intento');
  }

  if (combo_maximo >= 5) {
    claves.push('combo_5');
  }

  if (precision >= 90) {
    claves.push('precision_90');
  }

  if (Number(total_sesiones) >= 10) {
    claves.push('maratonista');
  }

  const unlocked = [];
  for (const clave of [...new Set(claves)]) {
    const logro = await desbloquear(estudiante_id, clave, executor);
    if (logro) {
      unlocked.push(logro);
    }
  }

  return unlocked;
};
