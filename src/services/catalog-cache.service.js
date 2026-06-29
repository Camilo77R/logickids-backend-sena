/**
 * Catalog Cache Service
 *
 * WHY THIS EXISTS:
 * Several hot-path endpoints (registrarEvento in particular) resolve catalog
 * IDs by name on every single request — estados_sesion, tipos_evento, and
 * habilidades are all tiny, static lookup tables that almost never change.
 * Hitting the database for each of them adds 3 sequential round-trips to
 * every event registration call, which directly blocks mobile gameplay
 * progression.
 *
 * This module loads those tables once at server startup and keeps them in
 * process memory. Node.js is single-threaded, so a plain object is safe.
 * The cache can be invalidated and reloaded on demand if catalog data ever
 * needs to change at runtime (e.g. after a seed or admin operation).
 */

import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Internal store.
 * Shape: { [tableName]: Map<nombre, pkValue> }
 */
const _cache = {
  estados_sesion: null,   // Map<string, number>
  tipos_evento:   null,   // Map<string, number>
  habilidades:    null,   // Map<string, number>
};

/** Whether the cache has been successfully populated. */
let _ready = false;

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

const loadTable = async (table, pkColumn) => {
  const rows = await db(table).select(pkColumn, 'nombre');
  const map = new Map();
  for (const row of rows) {
    map.set(row.nombre, row[pkColumn]);
  }
  return map;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Populate (or refresh) the in-memory catalog cache.
 * Called once during server startup; can be called again to invalidate.
 */
export const warmUpCatalogCache = async () => {
  const [estadosSesion, tiposEvento, habilidades] = await Promise.all([
    loadTable('estados_sesion', 'id_estado_sesion'),
    loadTable('tipos_evento',   'id_tipo_evento'),
    loadTable('habilidades',    'id_habilidad'),
  ]);

  _cache.estados_sesion = estadosSesion;
  _cache.tipos_evento   = tiposEvento;
  _cache.habilidades    = habilidades;
  _ready = true;

  console.log(
    ` Catalog cache warm — estados_sesion:${estadosSesion.size}` +
    ` tipos_evento:${tiposEvento.size}` +
    ` habilidades:${habilidades.size}`
  );
};

/**
 * Returns true when the cache has been populated at least once.
 */
export const isCatalogCacheReady = () => _ready;

/**
 * Resolve a catalog ID from the in-memory cache.
 *
 * Falls back to a live database query when the cache is not yet ready
 * (e.g. during the very first request before startup completes) so the
 * service degrades gracefully rather than throwing.
 *
 * @param {'estados_sesion'|'tipos_evento'|'habilidades'} table
 * @param {string} nombre
 * @returns {Promise<number>}
 */
export const getCatalogId = async (table, nombre) => {
  if (_ready && _cache[table] != null) {
    const id = _cache[table].get(nombre);
    if (id != null) return id;
    throw new AppError(`Valor '${nombre}' no encontrado en ${table}`, 400);
  }

  // Graceful fallback: cache not ready yet — query the DB directly.
  const pkColumns = {
    estados_sesion: 'id_estado_sesion',
    tipos_evento:   'id_tipo_evento',
    habilidades:    'id_habilidad',
  };
  const pkColumn = pkColumns[table];
  if (!pkColumn) {
    throw new AppError(`Tabla de catálogo desconocida: ${table}`, 500);
  }

  const row = await db(table).where({ nombre }).select(pkColumn).first();
  if (!row) throw new AppError(`Valor '${nombre}' no encontrado en ${table}`, 400);
  return row[pkColumn];
};

/**
 * Convenience wrappers for the three cached catalogs.
 */
export const getEstadoSesionId = (nombre) => getCatalogId('estados_sesion', nombre);
export const getTipoEventoId   = (nombre) => getCatalogId('tipos_evento',   nombre);
export const getHabilidadId    = (nombre) => getCatalogId('habilidades',    nombre);

/**
 * Returns a snapshot of the current cache contents for health-check purposes.
 */
export const getCatalogCacheStats = () => ({
  ready: _ready,
  estados_sesion: _cache.estados_sesion ? [..._cache.estados_sesion.keys()] : null,
  tipos_evento:   _cache.tipos_evento   ? [..._cache.tipos_evento.keys()]   : null,
  habilidades:    _cache.habilidades    ? [..._cache.habilidades.keys()]    : null,
});
