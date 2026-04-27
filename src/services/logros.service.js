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

const resolveCatalogLogroId = async (clave) => {
  const logro = await db('catalogo_logros')
    .where({ clave, activo: true })
    .select('id_catalogo_logro')
    .first();

  if (!logro) {
    throw new AppError('El logro solicitado no existe', 404);
  }

  return logro.id_catalogo_logro;
};

export const listarCatalogo = () =>
  db('catalogo_logros')
    .where({ activo: true })
    .select('id_catalogo_logro', 'clave', 'nombre', 'descripcion', 'icono')
    .orderBy('nombre', 'asc');

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

export const desbloquear = async (estudiante_id, clave_logro) => {
  const catalogo_logro_id = await resolveCatalogLogroId(clave_logro);

  await db('logros')
    .insert({ estudiante_id, catalogo_logro_id })
    .onConflict(['estudiante_id', 'catalogo_logro_id'])
    .ignore();

  return db('logros')
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
  { aciertos = 0, errores = 0, combo_maximo = 0, estado = 'completado' }
) => {
  if (estado !== 'completado') {
    return [];
  }

  const claves = [];
  const total_intentos = aciertos + errores;
  const precision = total_intentos > 0 ? (aciertos / total_intentos) * 100 : 0;

  const { id_estado_sesion } = await db('estados_sesion')
    .where({ nombre: 'completado' })
    .select('id_estado_sesion')
    .first();

  const [{ total_sesiones }] = await db('sesiones_juego')
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
    const logro = await desbloquear(estudiante_id, clave);
    if (logro) {
      unlocked.push(logro);
    }
  }

  return unlocked;
};