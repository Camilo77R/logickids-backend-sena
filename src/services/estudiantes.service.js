import jwt from 'jsonwebtoken';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../middlewares/errorHandler.js';
import {
  applyStudentOwnershipScope,
  assertGroupBelongsToUser,
  assertStudentBelongsToUser,
  withActiveGroupHistory,
} from './access.service.js';
import {
  cerrarSesionClaseSiTermino,
  ESTADOS_PARTICIPANTE_SESION,
  obtenerResumenSesionActivaParaEstudiante,
} from './sesionesClase.service.js';
import { finalizar } from './sesiones.service.js';
import { randomCode } from '../utils/codes.js';

const SESION_ACTIVA_STUDENT_RAW = db.raw(`
  EXISTS (
    SELECT 1
    FROM sesion_clase_participantes participante
    JOIN sesiones_clase sc ON sc.id_sesion_clase = participante.sesion_clase_id
    WHERE participante.estudiante_id = estudiantes.id_estudiante
      AND sc.estado = 'activa'
      AND participante.estado IN ('pendiente', 'en_progreso')
  ) as sesion_activa
`);

/** Campos base que se devuelven en la mayoría de respuestas de estudiante */
const STUDENT_FIELDS = [
  'estudiantes.id_estudiante as id',
  'estudiantes.nombre',
  'estudiantes.edad',
  'estudiantes.color_avatar',
  SESION_ACTIVA_STUDENT_RAW,
  'estudiantes.creado_en',
  'estados_estudiante.nombre as estado',
  'egh.grupo_id',
];

/**
 * Query base reutilizable: estudiante + estado + grupo activo via historial.
 * Centraliza el join repetido en todo el servicio.
 */
const baseQuery = () =>
  withActiveGroupHistory(
    db('estudiantes').join(
      'estados_estudiante',
      'estados_estudiante.id_estado_estudiante',
      'estudiantes.estado_id'
    )
  );

const buildBaseStudentRow = (executor = db) =>
  withActiveGroupHistory(
    executor('estudiantes').join(
      'estados_estudiante',
      'estados_estudiante.id_estado_estudiante',
      'estudiantes.estado_id'
    )
  )
    .leftJoin('grupos', 'grupos.id_grupo', 'egh.grupo_id')
    .select([
      ...STUDENT_FIELDS,
      'grupos.nombre as grupo_nombre',
      'grupos.activo as grupo_activo',
    ]);

const enrichStudentWithActiveSession = async (student, executor = db) => {
  if (!student) {
    return null;
  }

  if (!student.grupo_id || student.grupo_activo === false) {
    return {
      ...student,
      sesion_activa: false,
      sesion_clase_id: null,
      sesion_modo: null,
      sesion_ruta_id: null,
      sesion_ruta_slug: null,
      sesion_ruta_nombre: null,
      sesion_total_pasos: 0,
      sesion_paso_actual: null,
      sesion_bloque_actual: null,
      sesion_nivel_en_bloque: null,
      sesion_participante_estado: null,
      sesion_minijuego_id: null,
      sesion_minijuego_slug: null,
      sesion_minijuego_titulo: null,
      sesion_configuracion_base: null,
    };
  }

  const resumenSesion = await obtenerResumenSesionActivaParaEstudiante(
    {
      grupoId: student.grupo_id,
      estudianteId: student.id,
    },
    executor
  );

  return {
    ...student,
    sesion_activa: ['pendiente', 'en_progreso'].includes(
      resumenSesion?.sesion_participante_estado ?? ''
    ),
    sesion_clase_id: resumenSesion?.sesion_clase_id ?? null,
    sesion_modo: resumenSesion?.sesion_modo ?? null,
    sesion_ruta_id: resumenSesion?.sesion_ruta_id ?? null,
    sesion_ruta_slug: resumenSesion?.sesion_ruta_slug ?? null,
    sesion_ruta_nombre: resumenSesion?.sesion_ruta_nombre ?? null,
    sesion_total_pasos: Number(resumenSesion?.sesion_total_pasos ?? 0),
    sesion_paso_actual: resumenSesion?.sesion_paso_actual ?? null,
    sesion_bloque_actual: resumenSesion?.sesion_bloque_actual ?? null,
    sesion_nivel_en_bloque: resumenSesion?.sesion_nivel_en_bloque ?? null,
    sesion_participante_estado: resumenSesion?.sesion_participante_estado ?? null,
    sesion_minijuego_id: resumenSesion?.sesion_minijuego_id ?? null,
    sesion_minijuego_slug: resumenSesion?.sesion_minijuego_slug ?? null,
    sesion_minijuego_titulo: resumenSesion?.sesion_minijuego_titulo ?? null,
    sesion_configuracion_base: resumenSesion?.sesion_configuracion_base ?? null,
  };
};

const closeClassStateForStudent = async (id_estudiante, executor = db) => {
  const activoId = await executor('estados_sesion')
    .where({ nombre: 'activo' })
    .select('id_estado_sesion')
    .first();

  const sesionesActivas = await executor('sesiones_juego')
    .where({ estudiante_id: id_estudiante, estado_id: activoId.id_estado_sesion })
    .select('id_sesion_juego as id', 'sesion_clase_id');

  const sesionesClaseTocadas = new Set();

  for (const sesion of sesionesActivas) {
    const resultado = await finalizar(
      sesion.id,
      id_estudiante,
      { estado: 'abandonado', cerrarSesionClase: false },
      executor
    );
    if (resultado.sesion_clase_id != null) {
      sesionesClaseTocadas.add(resultado.sesion_clase_id);
    }
  }

  const participacionesPendientes = await executor('sesion_clase_participantes as participante')
    .join('sesiones_clase as sc', 'sc.id_sesion_clase', 'participante.sesion_clase_id')
    .where('participante.estudiante_id', id_estudiante)
    .where('sc.estado', 'activa')
    .whereIn('participante.estado', [
      ESTADOS_PARTICIPANTE_SESION.pendiente,
      ESTADOS_PARTICIPANTE_SESION.enProgreso,
    ])
    .select('participante.sesion_clase_id');

  if (participacionesPendientes.length) {
    await executor('sesion_clase_participantes')
      .whereIn(
        'sesion_clase_id',
        participacionesPendientes.map((participacion) => participacion.sesion_clase_id)
      )
      .andWhere({ estudiante_id: id_estudiante })
      .update({
        estado: ESTADOS_PARTICIPANTE_SESION.cerrado,
        finalizada_en: executor.fn.now(),
      });

    participacionesPendientes.forEach((participacion) =>
      sesionesClaseTocadas.add(participacion.sesion_clase_id)
    );
  }

  for (const sesionClaseId of sesionesClaseTocadas) {
    await cerrarSesionClaseSiTermino(sesionClaseId, executor);
  }
};

/**
 * Genera un QR token único con reintentos.
 * Formato: QR-XXXXXX-XXXXXX
 * @returns {Promise<string>} Token único garantizado
 */
const generateUniqueQR = async () => {
  for (let i = 0; i < 10; i++) {
    const token = `QR-${randomCode(6)}-${randomCode(6)}`;
    const exists = await db('estudiantes').where({ qr_token: token }).first();
    if (!exists) return token;
  }
  throw new AppError('No se pudo generar QR único', 500);
};

/**
 * Autentica a un estudiante mediante su QR token.
 * Emite un JWT firmado con JWT_STUDENT_SECRET (diferente al de tutores).
 */
export const loginEstudiante = async (qr_token) => {
  const est = await buildBaseStudentRow()
    .leftJoin('instituciones', 'instituciones.id_institucion', 'estudiantes.institucion_id')
    .where('estudiantes.qr_token', qr_token)
    .select('estudiantes.qr_token', 'instituciones.activo as institucion_activa')
    .first();

  if (!est) throw new AppError('QR inválido', 404);
  if (est.estado !== 'activo') throw new AppError('Estudiante inactivo', 403);
  if (est.institucion_activa === false) {
    throw new AppError('La institución del estudiante está desactivada', 403);
  }

  const perfil = await enrichStudentWithActiveSession(est);

  const token = jwt.sign(
    { id: perfil.id, nombre: perfil.nombre, grupo_id: perfil.grupo_id },
    env.JWT_STUDENT_SECRET,
    { expiresIn: env.JWT_STUDENT_EXPIRES_IN }
  );

  const { qr_token: _, ...estudiante } = perfil;
  return { token, estudiante };
};

export const listar = async (user, grupo_id) => {
  let query = baseQuery()
    .leftJoin('grupos', 'grupos.id_grupo', 'egh.grupo_id')
    .where('estados_estudiante.nombre', 'activo')
    .select([...STUDENT_FIELDS, 'grupos.nombre as grupo_nombre', 'grupos.activo as grupo_activo'])
    .orderBy('estudiantes.nombre');

  query = applyStudentOwnershipScope(query, user);

  if (grupo_id) query = query.where('egh.grupo_id', grupo_id);
  return query;
};

export const listarTodos = async (user, grupo_id) => {
  let query = withActiveGroupHistory(
    db('estudiantes').join(
      'estados_estudiante',
      'estados_estudiante.id_estado_estudiante',
      'estudiantes.estado_id'
    )
  )
    .leftJoin('grupos', 'grupos.id_grupo', 'egh.grupo_id')
    .leftJoin('instituciones', 'instituciones.id_institucion', 'estudiantes.institucion_id')
    .select([
      ...STUDENT_FIELDS,
      'grupos.nombre as grupo_nombre',
      'grupos.activo as grupo_activo',
      'instituciones.nombre as institucion',
      'instituciones.ciudad as institucion_ciudad',
    ])
    .orderBy('estudiantes.nombre');

  query = applyStudentOwnershipScope(query, user);

  if (grupo_id) query = query.where('egh.grupo_id', grupo_id);
  return query;
};

export const obtener = async (id_estudiante, user) => {
  await assertStudentBelongsToUser(id_estudiante, user);
  return baseQuery()
    .where('estudiantes.id_estudiante', id_estudiante)
    .select(STUDENT_FIELDS)
    .first();
};

export const obtenerPerfilInfantil = async (id_estudiante) => {
  const student = await buildBaseStudentRow()
    .where('estudiantes.id_estudiante', id_estudiante)
    .first();

  return enrichStudentWithActiveSession(student);
};

export const crear = async (user, { grupo_id, nombre, edad, color_avatar }) => {
  if (grupo_id) {
    const group = await assertGroupBelongsToUser(grupo_id, user);
    if (group.activo === false) {
      throw new AppError('No se puede asignar un estudiante a un grupo archivado', 409);
    }
  }

  const qr_token = await generateUniqueQR();

  const [est] = await db('estudiantes')
    .insert({
      nombre,
      edad,
      color_avatar: color_avatar ?? '#3B82F6',
      qr_token,
      estado_id: 1,
      institucion_id: user.institucion_id ?? null,
    })
    .returning('*');

  if (grupo_id) {
    await db('estudiante_grupo_historial').insert({
      estudiante_id: est.id_estudiante,
      grupo_id,
      fecha_inicio: db.fn.now(),
      activo: true,
    });
  }

  return obtener(est.id_estudiante, user);
};

export const actualizar = async (id_estudiante, user, datos) => {
  await assertStudentBelongsToUser(id_estudiante, user);
  const allowed = ['nombre', 'edad', 'color_avatar'];
  const updates = Object.fromEntries(Object.entries(datos).filter(([k]) => allowed.includes(k)));
  updates.actualizado_en = db.fn.now();
  await db('estudiantes').where({ id_estudiante }).update(updates);
  return baseQuery().where('estudiantes.id_estudiante', id_estudiante).select(STUDENT_FIELDS).first();
};

export const desactivar = async (id_estudiante, user) => {
  await assertStudentBelongsToUser(id_estudiante, user);

  const { id_estado_estudiante: idInactivo } = await db('estados_estudiante')
    .where({ nombre: 'inactivo' })
    .select('id_estado_estudiante')
    .first();

  const estudiante = await db('estudiantes').where({ id_estudiante }).select('estado_id').first();

  if (!estudiante) {
    throw new AppError('Estudiante no encontrado', 404);
  }

  if (estudiante.estado_id === idInactivo) {
    throw new AppError('El estudiante ya está inactivo', 409);
  }

  await db.transaction(async (trx) => {
    await closeClassStateForStudent(id_estudiante, trx);

    await trx('estudiantes')
      .where({ id_estudiante })
      .update({ estado_id: idInactivo, actualizado_en: trx.fn.now() });
  });
};

export const reactivar = async (id_estudiante, user) => {
  await assertStudentBelongsToUser(id_estudiante, user);

  const { id_estado_estudiante: idActivo } = await db('estados_estudiante')
    .where({ nombre: 'activo' })
    .select('id_estado_estudiante')
    .first();

  const estudiante = await db('estudiantes').where({ id_estudiante }).select('estado_id').first();

  if (!estudiante) {
    throw new AppError('Estudiante no encontrado', 404);
  }

  if (estudiante.estado_id === idActivo) {
    throw new AppError('El estudiante ya está activo', 409);
  }

  await db('estudiantes')
    .where({ id_estudiante })
    .update({ estado_id: idActivo, actualizado_en: db.fn.now() });
};

export const obtenerQR = async (id_estudiante, user) => {
  await assertStudentBelongsToUser(id_estudiante, user);
  const est = await db('estudiantes').where({ id_estudiante }).select('qr_token').first();
  if (!est) throw new AppError('Estudiante no encontrado', 404);
  return { qr_token: est.qr_token };
};

export const cambiarGrupo = async (id_estudiante, user, nuevo_grupo_id) => {
  const student = await assertStudentBelongsToUser(id_estudiante, user);
  const newGroup = await assertGroupBelongsToUser(nuevo_grupo_id, user);

  if (newGroup.activo === false) {
    throw new AppError('No se puede mover el estudiante a un grupo archivado', 409);
  }

  if (student.grupo_id === nuevo_grupo_id) {
    throw new AppError('El estudiante ya pertenece a ese grupo', 409);
  }

  await db.transaction(async (trx) => {
    await closeClassStateForStudent(id_estudiante, trx);

    await trx('estudiante_grupo_historial')
      .where({ estudiante_id: id_estudiante, activo: true })
      .update({ activo: false, fecha_fin: trx.fn.now() });

    await trx('estudiante_grupo_historial')
      .insert({
        estudiante_id: id_estudiante,
        grupo_id: nuevo_grupo_id,
        fecha_inicio: trx.fn.now(),
        activo: true,
      })
      .onConflict(['estudiante_id', 'grupo_id', 'fecha_inicio'])
      .merge({ activo: true, fecha_fin: null });
  });

  return db('estudiantes')
    .join('estados_estudiante', 'estados_estudiante.id_estado_estudiante', 'estudiantes.estado_id')
    .leftJoin('estudiante_grupo_historial', function joinActiveMembership() {
      this.on('estudiante_grupo_historial.estudiante_id', 'estudiantes.id_estudiante')
        .andOn('estudiante_grupo_historial.activo', db.raw('TRUE'))
        .andOnNull('estudiante_grupo_historial.fecha_fin');
    })
    .leftJoin('grupos', 'grupos.id_grupo', 'estudiante_grupo_historial.grupo_id')
    .where('estudiantes.id_estudiante', id_estudiante)
    .select(
      'estudiantes.id_estudiante as id',
      'estudiantes.nombre',
      'estudiantes.edad',
      'estudiantes.color_avatar',
      SESION_ACTIVA_STUDENT_RAW,
      'estudiantes.creado_en',
      'estados_estudiante.nombre as estado',
      'estudiante_grupo_historial.grupo_id'
    )
    .first();
};
