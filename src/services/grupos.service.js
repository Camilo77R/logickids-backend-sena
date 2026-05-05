import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import { assertGroupBelongsToUser } from './access.service.js';

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
  // Reutiliza assertGroupBelongsToUser — no duplicamos la lógica de ownership
  const grupo = await assertGroupBelongsToUser(id_grupo, { id: usuario_id, rol: 'tutor' });

  const estudiantesRaw = await db('estudiantes')
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

  // Obtener info completa del grupo para el DTO
  const grupoCompleto = await db('grupos').where({ id_grupo }).first();
  return { ...toGroupDto(grupoCompleto), estudiantes: estudiantesRaw };
};

export const crear = (usuario_id, institucion_id, { nombre, descripcion, predeterminado }) =>
  db('grupos')
    .insert({ usuario_id, institucion_id, nombre, descripcion, predeterminado: predeterminado ?? false })
    .returning('*')
    .then(([g]) => toGroupDto(g));

export const actualizar = async (id_grupo, usuario_id, datos) => {
  await assertGroupBelongsToUser(id_grupo, { id: usuario_id, rol: 'tutor' });
  const allowed = ['nombre', 'descripcion', 'predeterminado'];
  const updates = Object.fromEntries(Object.entries(datos).filter(([k]) => allowed.includes(k)));
  updates.actualizado_en = db.fn.now();
  await db('grupos').where({ id_grupo }).update(updates);
  return db('grupos').where({ id_grupo }).first().then((grupo) => toGroupDto(grupo));
};

export const eliminar = async (id_grupo, usuario_id) => {
  await assertGroupBelongsToUser(id_grupo, { id: usuario_id, rol: 'tutor' });

  // HU-12: no se puede eliminar si tiene estudiantes activos
  const conEstudiantes = await db('estudiante_grupo_historial')
    .where({ grupo_id: id_grupo, activo: true })
    .whereNull('fecha_fin')
    .first();

  if (conEstudiantes) {
    throw new AppError('No se puede eliminar: el grupo tiene estudiantes activos. Desásignalos primero.', 409);
  }

  await db('grupos').where({ id_grupo }).delete();
};

/** Abre o cierra la sesión para todos los estudiantes activos del grupo */
export const toggleSesion = async (id_grupo, usuario_id, sesion_activa) => {
  await assertGroupBelongsToUser(id_grupo, { id: usuario_id, rol: 'tutor' });

  const rows = await db('estudiante_grupo_historial')
    .where({ grupo_id: id_grupo, activo: true })
    .whereNull('fecha_fin')
    .select('estudiante_id');

  const ids = rows.map((r) => r.estudiante_id);

  // HU-13: si no hay estudiantes activos y se intenta ABRIR la clase, informar al tutor
  if (!ids.length && sesion_activa) {
    throw new AppError('No hay estudiantes activos en este grupo. Agrega estudiantes antes de abrir la clase.', 422);
  }

  // Si se intenta CERRAR y no hay nadie activo, simplemente no hay nada que hacer
  if (!ids.length) return { actualizados: 0, sesion_activa };

  await db('estudiantes')
    .whereIn('id_estudiante', ids)
    .update({ sesion_activa, actualizado_en: db.fn.now() });

  return { actualizados: ids.length, sesion_activa };
};

