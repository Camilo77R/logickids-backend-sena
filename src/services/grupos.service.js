import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';

/** Verifica que el grupo existe y pertenece al tutor autenticado */
const ownedByUser = async (id_grupo, usuario_id) => {
  const g = await db('grupos').where({ id_grupo, usuario_id }).first();
  if (!g) throw new AppError('Grupo no encontrado', 404);
  return g;
};

const toGroupDto = (grupo) => ({
  id: grupo.id_grupo,
  usuario_id: grupo.usuario_id,
  nombre: grupo.nombre,
  descripcion: grupo.descripcion,
  predeterminado: grupo.predeterminado,
  creado_en: grupo.creado_en,
  actualizado_en: grupo.actualizado_en,
});

export const listar = (usuario_id) =>
  db('grupos')
    .where({ usuario_id })
    .select(
      'id_grupo as id',
      'usuario_id',
      'nombre',
      'descripcion',
      'predeterminado',
      'creado_en',
      'actualizado_en'
    )
    .select(db.raw(`
      EXISTS (
        SELECT 1 FROM estudiante_grupo_historial egh
        JOIN estudiantes e ON e.id_estudiante = egh.estudiante_id
        WHERE egh.grupo_id = grupos.id_grupo
          AND egh.activo = true
          AND egh.fecha_fin IS NULL
          AND e.sesion_activa = true
      ) as sesion_activa
    `))
    .orderBy('predeterminado', 'desc')
    .orderBy('creado_en', 'asc');

export const obtener = async (id_grupo, usuario_id) => {
  const grupo = await ownedByUser(id_grupo, usuario_id);

  // Obtiene estudiantes activos del grupo via historial
  const estudiantes = await db('estudiantes')
    .join('estudiante_grupo_historial as egh', function () {
      this.on('egh.estudiante_id', 'estudiantes.id_estudiante')
        .andOn('egh.activo', db.raw('TRUE'))
        .andOn('egh.grupo_id', db.raw('?', [id_grupo]));
    })
    .join('estados_estudiante', 'estados_estudiante.id_estado_estudiante', 'estudiantes.estado_id')
    .where('estados_estudiante.nombre', 'activo')
    .select(
      'estudiantes.id_estudiante as id',
      'estudiantes.nombre',
      'estudiantes.edad',
      'estudiantes.color_avatar',
      'estudiantes.sesion_activa'
    );

  return { ...toGroupDto(grupo), estudiantes };
};

export const crear = (usuario_id, { nombre, descripcion, predeterminado }) =>
  db('grupos')
    .insert({ usuario_id, nombre, descripcion, predeterminado: predeterminado ?? false })
    .returning('*')
    .then(([g]) => toGroupDto(g));

export const actualizar = async (id_grupo, usuario_id, datos) => {
  await ownedByUser(id_grupo, usuario_id);
  const allowed = ['nombre', 'descripcion', 'predeterminado'];
  const updates = Object.fromEntries(Object.entries(datos).filter(([k]) => allowed.includes(k)));
  updates.actualizado_en = db.fn.now();
  await db('grupos').where({ id_grupo }).update(updates);
  return db('grupos').where({ id_grupo }).first().then((grupo) => toGroupDto(grupo));
};

export const eliminar = async (id_grupo, usuario_id) => {
  await ownedByUser(id_grupo, usuario_id);
  await db('grupos').where({ id_grupo }).delete();
};

/** Abre o cierra la sesión para todos los estudiantes activos del grupo */
export const toggleSesion = async (id_grupo, usuario_id, sesion_activa) => {
  await ownedByUser(id_grupo, usuario_id);

  // Obtiene IDs de estudiantes activos en el grupo
  const rows = await db('estudiante_grupo_historial')
    .where({ grupo_id: id_grupo, activo: true })
    .whereNull('fecha_fin')
    .select('estudiante_id');

  const ids = rows.map((r) => r.estudiante_id);
  if (!ids.length) return { actualizados: 0, sesion_activa };

  await db('estudiantes')
    .whereIn('id_estudiante', ids)
    .update({ sesion_activa, actualizado_en: db.fn.now() });

  return { actualizados: ids.length, sesion_activa };
};
