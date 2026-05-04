import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';

const withHabilidad = () =>
  db('minijuegos').join('habilidades', 'habilidades.id_habilidad', 'minijuegos.habilidad_id');

const FIELDS = [
  'minijuegos.id_minijuego as id', 'minijuegos.slug', 'minijuegos.titulo',
  'minijuegos.descripcion', 'minijuegos.dificultad_maxima',
  'minijuegos.activo', 'minijuegos.creado_en',
  'habilidades.nombre as habilidad',
  'habilidades.descripcion as habilidad_descripcion',
];

export const listar = () =>
  withHabilidad().where('minijuegos.activo', true).select(FIELDS).orderBy('minijuegos.titulo');

export const obtener = async (id_minijuego) => {
  const m = await withHabilidad().where('minijuegos.id_minijuego', id_minijuego).select(FIELDS).first();
  if (!m) throw new AppError('Minijuego no encontrado', 404);
  return m;
};

export const crear = async ({ slug, titulo, descripcion, habilidad, dificultad_maxima }) => {
  const hab = await db('habilidades').where({ nombre: habilidad }).select('id_habilidad').first();
  if (!hab) throw new AppError(`Habilidad '${habilidad}' no existe`, 400);

  const [{ id_minijuego }] = await db('minijuegos')
    .insert({ slug, titulo, descripcion, habilidad_id: hab.id_habilidad, dificultad_maxima: dificultad_maxima ?? 4 })
    .returning('id_minijuego');

  return obtener(id_minijuego);
};

export const actualizar = async (id_minijuego, datos) => {
  const m = await db('minijuegos').where({ id_minijuego }).first();
  if (!m) throw new AppError('Minijuego no encontrado', 404);
  const allowed = ['activo', 'titulo', 'descripcion', 'dificultad_maxima'];
  const updates = Object.fromEntries(Object.entries(datos).filter(([k]) => allowed.includes(k)));
  await db('minijuegos').where({ id_minijuego }).update(updates);
  return obtener(id_minijuego);
};
