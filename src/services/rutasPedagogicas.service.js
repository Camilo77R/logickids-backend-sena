import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';

const RUTA_FIELDS = [
  'rutas_pedagogicas.id_ruta_pedagogica as id',
  'rutas_pedagogicas.slug',
  'rutas_pedagogicas.nombre',
  'rutas_pedagogicas.descripcion',
  'rutas_pedagogicas.orden_catalogo',
];

const hydrateRoutesWithBlocks = async (routes, executor = db) => {
  if (!routes.length) {
    return [];
  }

  const routeIds = routes.map((route) => route.id);
  const blocks = await executor('ruta_pedagogica_bloques as bloque')
    .join('minijuegos as juego', 'juego.id_minijuego', 'bloque.minijuego_id')
    .join('habilidades as habilidad', 'habilidad.id_habilidad', 'juego.habilidad_id')
    .whereIn('bloque.ruta_pedagogica_id', routeIds)
    .select(
      'bloque.ruta_pedagogica_id',
      'bloque.id_ruta_pedagogica_bloque as id',
      'bloque.orden',
      'bloque.niveles',
      'bloque.configuracion_base',
      'juego.id_minijuego as minijuego_id',
      'juego.slug as minijuego_slug',
      'juego.titulo as minijuego_titulo',
      'juego.activo as minijuego_activo',
      'habilidad.nombre as habilidad'
    )
    .orderBy('bloque.ruta_pedagogica_id', 'asc')
    .orderBy('bloque.orden', 'asc');

  const blocksByRouteId = new Map();
  for (const block of blocks) {
    const currentBlocks = blocksByRouteId.get(block.ruta_pedagogica_id) ?? [];
    currentBlocks.push({
      id: block.id,
      orden: block.orden,
      niveles: Number(block.niveles),
      configuracion_base: block.configuracion_base ?? {},
      minijuego_id: block.minijuego_id,
      minijuego_slug: block.minijuego_slug,
      minijuego_titulo: block.minijuego_titulo,
      minijuego_activo: block.minijuego_activo,
      habilidad: block.habilidad,
    });
    blocksByRouteId.set(block.ruta_pedagogica_id, currentBlocks);
  }

  return routes.map((route) => {
    const routeBlocks = blocksByRouteId.get(route.id) ?? [];
    return {
      ...route,
      total_bloques: routeBlocks.length,
      total_pasos: routeBlocks.reduce((sum, block) => sum + Number(block.niveles), 0),
      bloques: routeBlocks,
    };
  });
};

const sanitizeRoute = (route) => ({
  ...route,
  bloques: route.bloques.map(({ minijuego_activo, ...block }) => block),
});

export const listar = async (executor = db) => {
  const routes = await executor('rutas_pedagogicas')
    .where({
      activo: true,
      visible_en_catalogo: true,
    })
    .select(RUTA_FIELDS)
    .orderBy('orden_catalogo', 'asc')
    .orderBy('nombre', 'asc');

  const hydratedRoutes = await hydrateRoutesWithBlocks(routes, executor);
  return hydratedRoutes.filter(
    (route) => route.bloques.length > 0 && route.bloques.every((block) => block.minijuego_activo)
  ).map(sanitizeRoute);
};

export const obtenerRutaPedagogicaActivaPorId = async (rutaId, executor = db) => {
  const routeId = Number(rutaId);
  if (!Number.isInteger(routeId) || routeId <= 0) {
    throw new AppError('La ruta pedagógica solicitada no es válida', 400);
  }

  const route = await executor('rutas_pedagogicas')
    .where({
      id_ruta_pedagogica: routeId,
      activo: true,
    })
    .select(RUTA_FIELDS)
    .first();

  if (!route) {
    throw new AppError('La ruta pedagógica solicitada no existe', 404);
  }

  const [hydratedRoute] = await hydrateRoutesWithBlocks([route], executor);
  if (!hydratedRoute.bloques.length) {
    throw new AppError('La ruta pedagógica no tiene bloques configurados', 409);
  }

  if (hydratedRoute.bloques.some((block) => block.minijuego_activo !== true)) {
    throw new AppError('La ruta pedagógica referencia minijuegos inactivos', 409);
  }

  return sanitizeRoute(hydratedRoute);
};
