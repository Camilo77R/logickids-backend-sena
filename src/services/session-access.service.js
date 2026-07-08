import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import { withActiveGroupHistory } from './access.service.js';

/**
 * CAMPOS BASE DE UNA SESIÓN WEB AUTENTICADA
 * -----------------------------------------
 * Esta consulta se usa para "revalidar" un token. El token dice quién era el
 * usuario cuando inició sesión; la base de datos nos dice si SIGUE habilitado.
 */
const WEB_SESSION_FIELDS = [
  'usuarios.id_usuario as id',
  'usuarios.nombre',
  'usuarios.email',
  'usuarios.institucion_id',
  'usuarios.es_admin_principal',
  'roles.nombre as rol',
  'estados_usuario.nombre as estado',
  'instituciones.nombre as institucion',
  'instituciones.activo as institucion_activa',
];

/**
 * Busca el estado vivo de un usuario web autenticado.
 *
 * POR QUÉ: si un tutor o admin se desactiva después del login, el token viejo
 * por sí solo no basta para saberlo. Hay que volver a mirar la base.
 */
export const obtenerUsuarioAutenticado = (id_usuario) =>
  db('usuarios')
    .join('roles', 'roles.id_rol', 'usuarios.rol_id')
    .join('estados_usuario', 'estados_usuario.id_estado_usuario', 'usuarios.estado_id')
    .leftJoin('instituciones', 'instituciones.id_institucion', 'usuarios.institucion_id')
    .where('usuarios.id_usuario', id_usuario)
    .select(WEB_SESSION_FIELDS)
    .first();

/**
 * Valida si un usuario web puede seguir operando con su sesión actual.
 */
export const validarSesionWeb = (user) => {
  if (!user) {
    throw new AppError('Usuario autenticado no encontrado', 401, { code: 'TOKEN_INVALID' });
  }

  if (user.estado !== 'activo') {
    throw new AppError('Tu cuenta ya no está habilitada para operar', 403);
  }

  const requiereInstitucionActiva = user.rol !== 'superadmin' && user.institucion_id != null;
  if (requiereInstitucionActiva && user.institucion_activa === false) {
    throw new AppError('Tu institución está desactivada y no puede operar en este momento', 403);
  }

  return user;
};

const STUDENT_SESSION_FIELDS = [
  'estudiantes.id_estudiante as id',
  'estudiantes.nombre',
  'estudiantes.institucion_id',
  'estados_estudiante.nombre as estado',
  'egh.grupo_id',
  'instituciones.activo as institucion_activa',
];

/**
 * Estado vivo de un estudiante autenticado.
 *
 * Importante: aquí NO bloqueamos por grupo archivado o sin grupo activo,
 * porque el estudiante todavía puede entrar a su dashboard. El bloqueo del
 * juego ocurre más adelante, en la lógica de sesiones.
 */
export const obtenerEstudianteAutenticado = (id_estudiante) =>
  withActiveGroupHistory(
    db('estudiantes')
      .join('estados_estudiante', 'estados_estudiante.id_estado_estudiante', 'estudiantes.estado_id')
      .leftJoin('instituciones', 'instituciones.id_institucion', 'estudiantes.institucion_id')
  )
    .where('estudiantes.id_estudiante', id_estudiante)
    .select(STUDENT_SESSION_FIELDS)
    .first();

/**
 * Valida si un estudiante puede seguir usando su sesión.
 */
export const validarSesionEstudiante = (student) => {
  if (!student) {
    throw new AppError('Estudiante autenticado no encontrado', 401, { code: 'TOKEN_INVALID' });
  }

  if (student.estado !== 'activo') {
    throw new AppError('La cuenta del estudiante no está habilitada', 403, {
      code: 'STUDENT_INACTIVE',
    });
  }

  if (student.institucion_id != null && student.institucion_activa === false) {
    throw new AppError('La institución del estudiante está desactivada', 403, {
      code: 'INSTITUTION_INACTIVE',
    });
  }

  return student;
};
