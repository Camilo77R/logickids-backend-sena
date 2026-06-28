import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import { assertStudentBelongsToUser } from './access.service.js';

const VALID_MODULES = ['memoria', 'patrones', 'logica', 'razonar', 'atencion'];

const MODULE_ACHIEVEMENTS = {
  memoria: 'logro_memoria',
  patrones: 'logro_patrones',
  logica: 'logro_logica',
  razonar: 'logro_razonar',
  atencion: 'logro_atencion',
};

const normalizeModule = (value = '') => {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (['memoria', 'memory'].includes(normalized)) return 'memoria';
  if (['patrones', 'pattern', 'patterns', 'tren', 'figuras'].includes(normalized)) return 'patrones';
  if (['logica', 'logic', 'logical'].includes(normalized)) return 'logica';
  if (['razonar', 'razonamiento', 'reason', 'reasoning'].includes(normalized)) return 'razonar';
  if (['atencion', 'attention', 'buscar', 'observacion', 'observacion visual'].includes(normalized)) return 'atencion';
  return null;
};

const normalizeCatalogRow = (row, unlockedByCatalog = new Map()) => {
  const unlocked = unlockedByCatalog.get(row.id_catalogo_logro);
  const isUnlocked = Boolean(unlocked);
  const iconKey = row.icon_key ?? row.icono ?? 'general_star';
  const module = normalizeModule(row.modulo);

  return {
    id: row.id_catalogo_logro,
    id_catalogo_logro: row.id_catalogo_logro,
    code: row.clave,
    clave: row.clave,
    title: row.nombre,
    nombre: row.nombre,
    description: row.descripcion,
    descripcion: row.descripcion,
    type: row.tipo ?? 'global',
    module,
    modulo: module,
    iconKey,
    icon_key: iconKey,
    icono: iconKey,
    points: Number(row.puntos ?? 1),
    puntos: Number(row.puntos ?? 1),
    isUnlocked,
    unlocked: isUnlocked,
    desbloqueado: isUnlocked,
    unlockedAt: unlocked?.desbloqueado_en ?? null,
    desbloqueado_en: unlocked?.desbloqueado_en ?? null,
    progress: isUnlocked ? 1 : 0,
    progressTarget: 1,
  };
};

const logroFields = [
  'logros.id_logro as id',
  'logros.desbloqueado_en',
  'logros.sesion_id',
  'logros.puntos_otorgados',
  'catalogo_logros.clave as clave_logro',
  'catalogo_logros.clave as code',
  'catalogo_logros.nombre as nombre_logro',
  'catalogo_logros.nombre as title',
  'catalogo_logros.descripcion',
  'catalogo_logros.icono',
  'catalogo_logros.icon_key as iconKey',
  'catalogo_logros.tipo as type',
  'catalogo_logros.modulo as module',
  'catalogo_logros.puntos as points',
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

const isMissingAchievementError = (error) =>
  error?.statusCode === 404 && error?.message === 'El logro solicitado no existe';

const logSkippedAchievement = (clave) => {
  console.warn(`[Logros] Se omitio el logro "${clave}" porque no existe en el catalogo activo.`);
};

/**
 * Catálogo de logros activos.
 * Si se pasa estudiante_id, cada logro incluye campo `desbloqueado: boolean`
 * para que la UI pueda distinguir visualmente los obtenidos de los pendientes (HU-25).
 */
export const listarCatalogo = async (estudiante_id = null) => {
  const catalogo = await db('catalogo_logros')
    .where({ activo: true })
    .select(
      'id_catalogo_logro',
      'clave',
      'nombre',
      'descripcion',
      'icono',
      'tipo',
      'modulo',
      'icon_key',
      'puntos',
      'orden'
    )
    .orderBy('orden', 'asc')
    .orderBy('nombre', 'asc');

  if (!estudiante_id) return catalogo;

  const desbloqueados = await db('logros')
    .where({ estudiante_id })
    .select('catalogo_logro_id', 'desbloqueado_en');

  const unlockedByCatalog = new Map(
    desbloqueados.map((logro) => [logro.catalogo_logro_id, logro])
  );

  return catalogo.map((logro) => normalizeCatalogRow(logro, unlockedByCatalog));
};

export const listarCatalogoTutor = async (estudiante_id, user) => {
  await assertStudentBelongsToUser(estudiante_id, user);
  return listarCatalogo(estudiante_id);
};

export const listar = async (estudiante_id, user) => {
  await assertStudentBelongsToUser(estudiante_id, user);
  return listarCatalogo(estudiante_id);
};

export const listarPorEstudiante = (estudiante_id) =>
  listarCatalogo(estudiante_id);

export const resumenEstudiante = async (estudiante_id) => {
  const catalogo = await listarCatalogo(estudiante_id);
  const totalCount = catalogo.length;
  const unlocked = catalogo.filter((logro) => logro.isUnlocked);
  const unlockedCount = unlocked.length;
  const totalPoints = unlocked.reduce((sum, logro) => sum + Number(logro.points ?? 0), 0);

  return {
    unlockedCount,
    totalCount,
    progressPercent: totalCount ? Math.round((unlockedCount / totalCount) * 100) : 0,
    totalPoints,
  };
};

export const desbloquear = async (
  estudiante_id,
  clave_logro,
  executor = db,
  { sesion_id = null, returnExisting = true } = {}
) => {
  const catalogo_logro_id = await resolveCatalogLogroId(clave_logro, executor);
  const catalogo = await executor('catalogo_logros')
    .where({ id_catalogo_logro: catalogo_logro_id })
    .select('puntos')
    .first();

  const inserted = await executor('logros')
    .insert({
      estudiante_id,
      catalogo_logro_id,
      sesion_id,
      puntos_otorgados: Number(catalogo?.puntos ?? 1),
    })
    .onConflict(['estudiante_id', 'catalogo_logro_id'])
    .ignore()
    .returning('id_logro');

  if (!returnExisting && !inserted.length) {
    return null;
  }

  return executor('logros')
    .join('catalogo_logros', 'catalogo_logros.id_catalogo_logro', 'logros.catalogo_logro_id')
    .where({
      'logros.estudiante_id': estudiante_id,
      'logros.catalogo_logro_id': catalogo_logro_id,
    })
    .select(logroFields)
    .first();
};

export const desbloquearSiDisponible = async (
  estudiante_id,
  clave_logro,
  executor = db,
  options = {}
) => {
  try {
    return await desbloquear(estudiante_id, clave_logro, executor, options);
  } catch (error) {
    if (isMissingAchievementError(error)) {
      logSkippedAchievement(clave_logro);
      return null;
    }
    throw error;
  }
};

const getSessionModule = async (sesion_id, executor = db) => {
  if (!sesion_id) return null;

  const session = await executor('sesiones_juego')
    .join('minijuegos', 'minijuegos.id_minijuego', 'sesiones_juego.minijuego_id')
    .join('habilidades', 'habilidades.id_habilidad', 'minijuegos.habilidad_id')
    .where('sesiones_juego.id_sesion_juego', sesion_id)
    .select(
      'minijuegos.slug',
      'minijuegos.titulo',
      'habilidades.nombre as habilidad'
    )
    .first();

  return normalizeModule(session?.habilidad)
    ?? normalizeModule(session?.slug)
    ?? normalizeModule(session?.titulo);
};

const listPlayedModules = async (estudiante_id, currentModule, executor = db) => {
  const rows = await executor('sesiones_juego')
    .join('estados_sesion', 'estados_sesion.id_estado_sesion', 'sesiones_juego.estado_id')
    .join('minijuegos', 'minijuegos.id_minijuego', 'sesiones_juego.minijuego_id')
    .join('habilidades', 'habilidades.id_habilidad', 'minijuegos.habilidad_id')
    .where({
      'sesiones_juego.estudiante_id': estudiante_id,
      'estados_sesion.nombre': 'completado',
    })
    .select('habilidades.nombre as habilidad');

  const modules = new Set(rows.map((row) => normalizeModule(row.habilidad)).filter(Boolean));
  if (currentModule) modules.add(currentModule);
  return modules;
};

export const evaluarLogrosSesion = async (
  estudiante_id,
  { sesion_id = null, aciertos = 0, errores = 0, estado = 'completado', modulo = null, habilidad = null },
  executor = db
) => {
  if (estado !== 'completado') {
    return [];
  }

  const claves = [];
  const total_intentos = aciertos + errores;
  const precision = total_intentos > 0 ? (aciertos / total_intentos) * 100 : 0;
  const sessionModule = normalizeModule(modulo)
    ?? normalizeModule(habilidad)
    ?? (await getSessionModule(sesion_id, executor));

  if (sessionModule && precision >= 70) {
    claves.push(MODULE_ACHIEVEMENTS[sessionModule]);
  }

  if (precision >= 100) {
    claves.push('precision_perfecta');
  }

  const existingRows = await executor('logros')
    .join('catalogo_logros', 'catalogo_logros.id_catalogo_logro', 'logros.catalogo_logro_id')
    .where('logros.estudiante_id', estudiante_id)
    .select('catalogo_logros.clave');

  const existingKeys = new Set(existingRows.map((logro) => logro.clave));
  const playedModules = await listPlayedModules(estudiante_id, sessionModule, executor);
  if (VALID_MODULES.every((moduleName) => playedModules.has(moduleName))) {
    claves.push('explorador');
  }

  const unlocked = [];
  for (const clave of [...new Set(claves)].filter(Boolean)) {
    if (existingKeys.has(clave)) continue;

    const logro = await desbloquearSiDisponible(estudiante_id, clave, executor, {
      sesion_id,
      returnExisting: false,
    });

    if (logro) {
      unlocked.push(logro);
      existingKeys.add(clave);
    }
  }

  if (!existingRows.length && unlocked.length && !existingKeys.has('primer_logro')) {
    const logro = await desbloquearSiDisponible(estudiante_id, 'primer_logro', executor, {
      sesion_id,
      returnExisting: false,
    });
    if (logro) {
      unlocked.push(logro);
      existingKeys.add('primer_logro');
    }
  }

  const hasAllMainAchievements = Object.values(MODULE_ACHIEVEMENTS).every((clave) =>
    existingKeys.has(clave)
  );
  if (hasAllMainAchievements && !existingKeys.has('multitalento')) {
    const logro = await desbloquearSiDisponible(estudiante_id, 'multitalento', executor, {
      sesion_id,
      returnExisting: false,
    });
    if (logro) unlocked.push(logro);
  }

  return unlocked;
};
