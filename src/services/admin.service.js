import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import {
  cerrarSesionClasePorGrupo,
  ESTADOS_SESION_CLASE,
  obtenerSesionClaseActivaPorGrupo,
} from './sesionesClase.service.js';
import { abandonarSesionesActivasDeClase } from './sesiones.service.js';

const WEB_USER_FIELDS = [
  'usuarios.id_usuario as id',
  'usuarios.nombre',
  'usuarios.email',
  'usuarios.institucion_id',
  'usuarios.es_admin_principal',
  'usuarios.creado_en',
  'usuarios.actualizado_en',
  'roles.nombre as rol',
  'estados_usuario.nombre as estado',
  'instituciones.nombre as institucion',
  'instituciones.ciudad as institucion_ciudad',
];

const MANAGEABLE_ROLES = new Set(['admin', 'tutor']);
const LISTABLE_ROLE_FILTERS = new Set(['admin', 'tutor', 'todos']);

const buildUserQuery = () =>
  db('usuarios')
    .join('roles', 'usuarios.rol_id', 'roles.id_rol')
    .join('estados_usuario', 'usuarios.estado_id', 'estados_usuario.id_estado_usuario')
    .leftJoin('instituciones', 'usuarios.institucion_id', 'instituciones.id_institucion');

const resolveRoleId = async (nombre, trx = db) => {
  const role = await trx('roles').where({ nombre }).select('id_rol').first();
  if (!role) {
    throw new AppError(`Rol '${nombre}' no encontrado`, 400);
  }

  return role.id_rol;
};

const resolveUserStateId = async (nombre, trx = db) => {
  const state = await trx('estados_usuario').where({ nombre }).select('id_estado_usuario').first();
  if (!state) {
    throw new AppError(`Estado '${nombre}' no encontrado`, 400);
  }

  return state.id_estado_usuario;
};

const assertInstitutionExists = async (institucion_id, trx = db) => {
  const institution = await trx('instituciones')
    .where({ id_institucion: institucion_id })
    .select('id_institucion', 'nombre', 'activo')
    .first();

  if (!institution) {
    throw new AppError('Institución no encontrada', 404);
  }

  return institution;
};

const assertPrincipalAdmin = (user) => {
  if (user.rol !== 'admin' || user.es_admin_principal !== true) {
    throw new AppError('Solo el admin principal puede ejecutar esta acción', 403);
  }
};

const assertRoleFilter = (rol) => {
  if (!LISTABLE_ROLE_FILTERS.has(rol)) {
    throw new AppError('Filtro de rol no válido. Use: admin | tutor | todos', 400);
  }
};

const buildTemporaryPassword = () => crypto.randomBytes(8).toString('hex');

const normalizeInstitutionScope = async (actor, requestedInstitutionId) => {
  if (actor.rol === 'superadmin') {
    if (!requestedInstitutionId) {
      return null;
    }

    await assertInstitutionExists(requestedInstitutionId);
    return requestedInstitutionId;
  }

  return actor.institucion_id;
};

const assertSameInstitution = (target, actor) => {
  if (actor.rol === 'superadmin') {
    return;
  }

  if (target.institucion_id !== actor.institucion_id) {
    throw new AppError('No tienes permisos para operar datos de otra institución', 403);
  }
};

const assertUserCanBeManagedByActor = (target, actor) => {
  if (!MANAGEABLE_ROLES.has(target.rol)) {
    throw new AppError('El rol objetivo no puede gestionarse desde este módulo', 403);
  }

  if (actor.rol === 'superadmin') {
    if (target.rol === 'superadmin') {
      throw new AppError('No se puede gestionar otro superadmin desde este flujo', 403);
    }

    return;
  }

  assertSameInstitution(target, actor);

  if (target.rol === 'tutor') {
    return;
  }

  assertPrincipalAdmin(actor);

  if (target.es_admin_principal) {
    throw new AppError('El admin principal solo puede ser gestionado por superadmin', 403);
  }

  if (target.id === actor.id) {
    throw new AppError('No puedes cambiar tu propio estado administrativo', 409);
  }
};

const buildInstitutionCountsQuery = (institutionId) =>
  db('instituciones as i')
    .where('i.id_institucion', institutionId)
    .leftJoin('usuarios as u', 'u.institucion_id', 'i.id_institucion')
    .leftJoin('roles as r', 'r.id_rol', 'u.rol_id')
    .leftJoin('estados_usuario as eu', 'eu.id_estado_usuario', 'u.estado_id')
    .leftJoin('estudiantes as e', 'e.institucion_id', 'i.id_institucion')
    .leftJoin('estados_estudiante as ee', 'ee.id_estado_estudiante', 'e.estado_id')
    .leftJoin('grupos as g', 'g.institucion_id', 'i.id_institucion')
    .select(
      'i.id_institucion as institucion_id',
      'i.nombre as institucion',
      db.raw(
        "COUNT(DISTINCT CASE WHEN r.nombre = 'admin' THEN u.id_usuario END) as admins_totales"
      ),
      db.raw(
        "COUNT(DISTINCT CASE WHEN r.nombre = 'tutor' AND eu.nombre = 'activo' THEN u.id_usuario END) as tutores_activos"
      ),
      db.raw(
        "COUNT(DISTINCT CASE WHEN ee.nombre = 'activo' THEN e.id_estudiante END) as estudiantes_activos"
      ),
      db.raw('COUNT(DISTINCT g.id_grupo) as grupos_totales'),
      db.raw('COUNT(DISTINCT CASE WHEN g.activo = true THEN g.id_grupo END) as grupos_activos'),
      db.raw(
        'COUNT(DISTINCT CASE WHEN g.activo = true AND g.tutor_asignado_id IS NULL THEN g.id_grupo END) as grupos_sin_tutor'
      )
    )
    .groupBy('i.id_institucion', 'i.nombre');

const buildAdminDashboardSummary = async (actor) => {
  const [institutionSummary, pendingRequests, recentSessions] = await Promise.all([
    buildInstitutionCountsQuery(actor.institucion_id).first(),
    db('solicitudes_reactivacion as sr')
      .join('usuarios as u', 'u.id_usuario', 'sr.usuario_id')
      .where('u.institucion_id', actor.institucion_id)
      .where('sr.estado_solicitud', 'pendiente')
      .count('* as total')
      .first(),
    db('sesiones_juego as sj')
      .join('estudiantes as e', 'e.id_estudiante', 'sj.estudiante_id')
      .where('e.institucion_id', actor.institucion_id)
      .where('sj.iniciada_en', '>=', db.raw("NOW() - INTERVAL '7 days'"))
      .count('* as total')
      .first(),
  ]);

  return {
    scope: 'institucion',
    institucion_id: actor.institucion_id,
    es_admin_principal: actor.es_admin_principal,
    resumen: {
      ...institutionSummary,
      solicitudes_pendientes: Number(pendingRequests?.total ?? 0),
      sesiones_ultimos_7_dias: Number(recentSessions?.total ?? 0),
    },
  };
};

const buildSuperadminDashboardSummary = async () => {
  const [
    institutions,
    activeTutors,
    totalStudents,
    totalAdmins,
    recentSessions,
  ] = await Promise.all([
    db('instituciones')
      .select(
        db.raw('COUNT(*) as instituciones_totales'),
        db.raw('COUNT(*) FILTER (WHERE activo = true) as instituciones_activas'),
        db.raw('COUNT(*) FILTER (WHERE activo = false) as instituciones_inactivas')
      )
      .first(),
    db('usuarios as u')
      .join('roles as r', 'r.id_rol', 'u.rol_id')
      .join('estados_usuario as eu', 'eu.id_estado_usuario', 'u.estado_id')
      .where('r.nombre', 'tutor')
      .where('eu.nombre', 'activo')
      .count('* as total')
      .first(),
    db('estudiantes').count('* as total').first(),
    db('usuarios as u')
      .join('roles as r', 'r.id_rol', 'u.rol_id')
      .where('r.nombre', 'admin')
      .count('* as total')
      .first(),
    db('sesiones_juego')
      .where('iniciada_en', '>=', db.raw("NOW() - INTERVAL '7 days'"))
      .count('* as total')
      .first(),
  ]);

  const instituciones = await db('instituciones as i')
    .leftJoin('usuarios as u', 'u.institucion_id', 'i.id_institucion')
    .leftJoin('roles as r', 'r.id_rol', 'u.rol_id')
    .leftJoin('estados_usuario as eu', 'eu.id_estado_usuario', 'u.estado_id')
    .leftJoin('grupos as g', 'g.institucion_id', 'i.id_institucion')
    .select(
      'i.id_institucion as id',
      'i.nombre',
      'i.ciudad',
      'i.activo',
      db.raw(
        "COUNT(DISTINCT CASE WHEN r.nombre = 'admin' THEN u.id_usuario END) as admins_totales"
      ),
      db.raw(
        "COUNT(DISTINCT CASE WHEN r.nombre = 'tutor' AND eu.nombre = 'activo' THEN u.id_usuario END) as tutores_activos"
      ),
      db.raw('COUNT(DISTINCT CASE WHEN g.activo = true THEN g.id_grupo END) as grupos_activos')
    )
    .groupBy('i.id_institucion', 'i.nombre', 'i.ciudad', 'i.activo')
    .orderBy('i.nombre', 'asc');

  return {
    scope: 'global',
    resumen: {
      instituciones_totales: Number(institutions?.instituciones_totales ?? 0),
      instituciones_activas: Number(institutions?.instituciones_activas ?? 0),
      instituciones_inactivas: Number(institutions?.instituciones_inactivas ?? 0),
      admins_totales: Number(totalAdmins?.total ?? 0),
      tutores_activos: Number(activeTutors?.total ?? 0),
      estudiantes_totales: Number(totalStudents?.total ?? 0),
      sesiones_ultimos_7_dias: Number(recentSessions?.total ?? 0),
    },
    instituciones,
  };
};

export const listarUsuarios = async (
  actor,
  { rol = 'tutor', institucion_id: requestedInstitutionId } = {}
) => {
  assertRoleFilter(rol);

  const institutionId = await normalizeInstitutionScope(actor, requestedInstitutionId);
  const query = buildUserQuery()
    .whereNot('roles.nombre', 'superadmin')
    .select(WEB_USER_FIELDS);

  if (institutionId) {
    query.where('usuarios.institucion_id', institutionId);
  }

  if (rol !== 'todos') {
    query.where('roles.nombre', rol);
  } else if (actor.rol === 'admin') {
    query.whereIn('roles.nombre', ['admin', 'tutor']);
  }

  return query
    .orderBy('usuarios.es_admin_principal', 'desc')
    .orderBy('roles.nombre', 'asc')
    .orderBy('usuarios.creado_en', 'desc');
};

export const obtenerUsuario = async (id_usuario, actor) => {
  const user = await buildUserQuery()
    .where('usuarios.id_usuario', id_usuario)
    .select(WEB_USER_FIELDS)
    .first();

  if (!user) {
    throw new AppError('Usuario no encontrado', 404);
  }

  assertUserCanBeManagedByActor(user, actor);
  return user;
};

export const cambiarEstadoUsuario = async (id_usuario, estado_nombre, actor) => {
  const objetivo = await buildUserQuery()
    .where('usuarios.id_usuario', id_usuario)
    .select(WEB_USER_FIELDS)
    .first();

  if (!objetivo) {
    throw new AppError('Usuario no encontrado', 404);
  }

  assertUserCanBeManagedByActor(objetivo, actor);

  const estado_id = await resolveUserStateId(estado_nombre);

  await db('usuarios')
    .where({ id_usuario })
    .update({
      estado_id,
      actualizado_en: db.fn.now(),
    });

  return { id: Number(id_usuario), estado: estado_nombre };
};

export const crearAdminInstitucional = async (
  actor,
  { nombre, email, institucion_id: requestedInstitutionId }
) => {
  if (actor.rol === 'admin') {
    assertPrincipalAdmin(actor);
  }

  const institucion_id = await normalizeInstitutionScope(actor, requestedInstitutionId);
  if (!institucion_id) {
    throw new AppError('Debe indicar la institución destino del nuevo admin', 400);
  }

  await assertInstitutionExists(institucion_id);

  const existing = await db('usuarios').where({ email }).first();
  if (existing) {
    throw new AppError('El email ya está registrado', 409);
  }

  const contrasena_temporal = buildTemporaryPassword();

  return db.transaction(async (trx) => {
    const [rol_id, estado_id, contrasena_hash] = await Promise.all([
      resolveRoleId('admin', trx),
      resolveUserStateId('activo', trx),
      bcrypt.hash(contrasena_temporal, 10),
    ]);

    const [usuario] = await trx('usuarios')
      .insert({
        nombre,
        email,
        contrasena_hash,
        rol_id,
        institucion_id,
        estado_id,
        es_admin_principal: false,
      })
      .returning([
        'id_usuario as id',
        'nombre',
        'email',
        'institucion_id',
        'es_admin_principal',
        'creado_en',
      ]);

    return {
      ...usuario,
      contrasena_temporal,
    };
  });
};

const buildInstitucionesQuery = () =>
  db('instituciones')
    .leftJoin('usuarios as u', 'u.institucion_id', 'instituciones.id_institucion')
    .leftJoin('roles as r', 'r.id_rol', 'u.rol_id')
    .leftJoin('estados_usuario as eu', 'eu.id_estado_usuario', 'u.estado_id')
    .groupBy('instituciones.id_institucion')
    .select(
      'instituciones.id_institucion as id',
      'instituciones.nombre',
      'instituciones.ciudad',
      'instituciones.direccion',
      'instituciones.telefono',
      'instituciones.activo',
      'instituciones.desactivado_en',
      'instituciones.creado_en',
      db.raw(
        "COUNT(DISTINCT CASE WHEN r.nombre = 'admin' THEN u.id_usuario END) as admins_totales"
      ),
      db.raw(
        "COUNT(DISTINCT CASE WHEN r.nombre = 'tutor' AND eu.nombre = 'activo' THEN u.id_usuario END) as tutores_activos"
      )
    );

export const listarInstituciones = ({ estado = 'todas' } = {}) => {
  const query = buildInstitucionesQuery();

  if (estado === 'activas') {
    query.where('instituciones.activo', true);
  } else if (estado === 'desactivadas') {
    query.where('instituciones.activo', false);
  } else if (estado !== 'todas') {
    throw new AppError('Filtro de estado no válido. Use: activas | desactivadas | todas', 400);
  }

  return query.orderBy([
    { column: 'instituciones.activo', order: 'desc' },
    { column: 'instituciones.nombre', order: 'asc' },
  ]);
};

export const crearInstitucion = async ({ nombre, ciudad, direccion, telefono }) => {
  const exists = await db('instituciones').where({ nombre }).first();
  if (exists) {
    throw new AppError('Ya existe una institución con ese nombre', 409);
  }

  return db.transaction(async (trx) => {
    const [inst] = await trx('instituciones')
      .insert({ nombre, ciudad, direccion, telefono })
      .returning('*');

    const rol_id = await resolveRoleId('admin', trx);
    const contrasena_temporal = buildTemporaryPassword();
    const contrasena_hash = await bcrypt.hash(contrasena_temporal, 10);
    const emailAdmin = `admin.${nombre.toLowerCase().replace(/\s+/g, '')}@logickids.dev`;

    const [usuario] = await trx('usuarios')
      .insert({
        nombre: `Admin ${nombre}`,
        email: emailAdmin,
        contrasena_hash,
        rol_id,
        institucion_id: inst.id_institucion,
        estado_id: 1,
        es_admin_principal: true,
      })
      .returning('*');

    return {
      institucion: {
        id: inst.id_institucion,
        nombre: inst.nombre,
        ciudad: inst.ciudad,
      },
      admin: {
        id: usuario.id_usuario,
        email: usuario.email,
        es_admin_principal: usuario.es_admin_principal,
        contrasena_temporal,
      },
    };
  });
};

export const eliminarInstitucion = async (id_institucion) => desactivarInstitucion(id_institucion);

export const desactivarInstitucion = async (id_institucion) => {
  const institution = await db('instituciones')
    .where({ id_institucion })
    .select('id_institucion', 'activo')
    .first();

  if (!institution) {
    throw new AppError('Institución no encontrada', 404);
  }

  if (institution.activo === false) {
    throw new AppError('La institución ya está desactivada', 409);
  }

  return db.transaction(async (trx) => {
    const gruposActivos = await trx('grupos')
      .where({ institucion_id: id_institucion })
      .select('id_grupo');

    for (const grupo of gruposActivos) {
      const sesionClase = await obtenerSesionClaseActivaPorGrupo(grupo.id_grupo, trx);
      if (!sesionClase) {
        continue;
      }

      await abandonarSesionesActivasDeClase(
        sesionClase.id,
        { estadoSesionJuego: 'abandonado' },
        trx
      );

      await cerrarSesionClasePorGrupo(
        {
          grupoId: grupo.id_grupo,
          estado: ESTADOS_SESION_CLASE.cancelada,
          cierreMotivo: 'institucion_desactivada',
        },
        trx
      );
    }

    const [updated] = await trx('instituciones')
      .where({ id_institucion })
      .update({
        activo: false,
        desactivado_en: trx.fn.now(),
      })
      .returning([
        'id_institucion as id',
        'nombre',
        'activo',
        'desactivado_en',
      ]);

    return updated;
  });
};

export const reactivarInstitucion = async (id_institucion) => {
  const institution = await db('instituciones')
    .where({ id_institucion })
    .select('id_institucion', 'activo')
    .first();

  if (!institution) {
    throw new AppError('Institución no encontrada', 404);
  }

  if (institution.activo === true) {
    throw new AppError('La institución ya está activa', 409);
  }

  const [updated] = await db('instituciones')
    .where({ id_institucion })
    .update({
      activo: true,
      desactivado_en: null,
    })
    .returning([
      'id_institucion as id',
      'nombre',
      'activo',
      'desactivado_en',
    ]);

  return updated;
};

export const actualizarInstitucion = async (id_institucion, datos) => {
  const CAMPOS_PERMITIDOS = ['nombre', 'ciudad', 'direccion', 'telefono'];
  const updates = Object.fromEntries(
    Object.entries(datos).filter(([key]) => CAMPOS_PERMITIDOS.includes(key))
  );

  if (!Object.keys(updates).length) {
    throw new AppError('No se proporcionaron campos válidos para actualizar', 400);
  }

  const existente = await db('instituciones').where({ id_institucion }).first();
  if (!existente) {
    throw new AppError('Institución no encontrada', 404);
  }

  if (updates.nombre && updates.nombre !== existente.nombre) {
    const duplicado = await db('instituciones')
      .where({ nombre: updates.nombre })
      .whereNot({ id_institucion })
      .first();

    if (duplicado) {
      throw new AppError('Ya existe una institución con ese nombre', 409);
    }
  }

  const [actualizada] = await db('instituciones')
    .where({ id_institucion })
    .update(updates)
    .returning([
      'id_institucion as id',
      'nombre',
      'ciudad',
      'direccion',
      'telefono',
      'activo',
      'desactivado_en',
      'creado_en',
    ]);

  return actualizada;
};

export const listarDashboard = async (actor) => {
  if (actor.rol === 'superadmin') {
    return buildSuperadminDashboardSummary();
  }

  return buildAdminDashboardSummary(actor);
};

export const listarMinijuegosAdmin = () =>
  db('minijuegos')
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

export const toggleMinijuego = async (id_minijuego, activo) => {
  const updated = await db('minijuegos')
    .where({ id_minijuego })
    .update({ activo })
    .returning(['id_minijuego as id', 'activo']);

  const row = updated?.[0];
  if (!row) {
    throw new AppError('Minijuego no encontrado', 404);
  }

  return row;
};
