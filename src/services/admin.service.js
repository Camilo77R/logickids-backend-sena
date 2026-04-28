import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';

class AdminService {
  // --- USUARIOS WEB ---
  async listarUsuarios() {
    return db('usuarios')
      .join('roles', 'usuarios.rol_id', 'roles.id_rol')
      .join('estados_usuario', 'usuarios.estado_id', 'estados_usuario.id_estado_usuario')
      .leftJoin('instituciones', 'usuarios.institucion_id', 'instituciones.id_institucion')
      .select(
        'usuarios.id_usuario as id', 'usuarios.nombre', 'usuarios.email', 'usuarios.creado_en',
        'roles.nombre as rol',
        'estados_usuario.nombre as estado',
        'instituciones.nombre as institucion'
      )
      .orderBy('usuarios.creado_en', 'desc');
  }

  async obtenerUsuario(id_usuario) {
    const user = await db('usuarios')
      .join('roles', 'usuarios.rol_id', 'roles.id_rol')
      .join('estados_usuario', 'usuarios.estado_id', 'estados_usuario.id_estado_usuario')
      .leftJoin('instituciones', 'usuarios.institucion_id', 'instituciones.id_institucion')
      .where('usuarios.id_usuario', id_usuario)
      .select(
        'usuarios.id_usuario as id',
        'usuarios.nombre',
        'usuarios.email',
        'usuarios.creado_en',
        'usuarios.actualizado_en',
        'roles.nombre as rol',
        'estados_usuario.nombre as estado',
        'instituciones.nombre as institucion',
        'instituciones.ciudad as institucion_ciudad'
      )
      .first();

    if (!user) {
      throw new AppError('Usuario no encontrado', 404);
    }

    return user;
  }

  async cambiarEstadoUsuario(id_usuario, estado_nombre) {
    const estado = await db('estados_usuario').where({ nombre: estado_nombre }).select('id_estado_usuario').first();
    if (!estado) throw new AppError('Estado no válido. Use: activo | inactivo | suspendido', 400);

    await db('usuarios')
      .where({ id_usuario })
      .update({ estado_id: estado.id_estado_usuario, actualizado_en: db.fn.now() });

    return { id: id_usuario, estado: estado_nombre };
  }

  // --- INSTITUCIONES ---
  async listarInstituciones() {
    return db('instituciones')
      .select(
        'id_institucion as id',
        'nombre',
        'ciudad',
        'direccion',
        'telefono',
        'creado_en'
      )
      .orderBy('nombre', 'asc');
  }

  async crearInstitucion({ nombre, ciudad, direccion, telefono }) {
    const exists = await db('instituciones').where({ nombre }).first();
    if (exists) throw new AppError('Ya existe una institución con ese nombre', 409);

    const [inst] = await db('instituciones')
      .insert({ nombre, ciudad, direccion, telefono })
      .returning('*');
    return {
      id: inst.id_institucion,
      nombre: inst.nombre,
      ciudad: inst.ciudad,
      direccion: inst.direccion,
      telefono: inst.telefono,
      creado_en: inst.creado_en,
    };
  }

  async eliminarInstitucion(id_institucion) {
    const conUsuarios = await db('usuarios').where({ institucion_id: id_institucion }).first();
    if (conUsuarios) throw new AppError('No se puede eliminar: tiene tutores asociados', 409);

    const deleted = await db('instituciones').where({ id_institucion }).delete();
    if (!deleted) throw new AppError('Institución no encontrada', 404);
  }

  // --- MINIJUEGOS ---
  async listarMinijuegosAdmin() {
    return db('minijuegos')
      .join('habilidades', 'habilidades.id_habilidad', 'minijuegos.habilidad_id')
      .select(
        'minijuegos.id_minijuego as id',
        'minijuegos.slug',
        'minijuegos.titulo',
        'minijuegos.descripcion',
        'minijuegos.dificultad_maxima',
        'minijuegos.activo',
        'minijuegos.creado_en',
        'habilidades.nombre as habilidad'
      )
      .orderBy('minijuegos.titulo', 'asc');
  }

  async toggleMinijuego(id_minijuego, activo) {
    const updated = await db('minijuegos')
      .where({ id_minijuego })
      .update({ activo })
      .returning(['id_minijuego as id', 'activo']);

    const row = updated?.[0];
    if (!row) throw new AppError('Minijuego no encontrado', 404);
    return row;
  }
}

export default new AdminService();
