import { randomUUID } from 'node:crypto';
import request from 'supertest';
import app from '../../src/app.js';
import { db } from '../../src/config/db.js';
import { getSuperadminToken, loginAs } from './auth.helper.js';
import {
  buildTestInstitutionName,
  registerTestInstitution,
} from './testFixtures.helper.js';

export const buildCodigoEstelarSuffix = (label = 'codigo-estelar') =>
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

export const resolveMinijuegoIdBySlug = async (slug) => {
  const minijuego = await db('minijuegos')
    .where({ slug })
    .select('id_minijuego')
    .first();

  if (!minijuego) {
    throw new Error(`El minijuego ${slug} no existe en la base de datos de pruebas.`);
  }

  return minijuego.id_minijuego;
};

export const resolveCodigoEstelarId = async () => resolveMinijuegoIdBySlug('codigo-estelar');

export const resolveRutaPedagogicaIdBySlug = async (slug) => {
  const route = await db('rutas_pedagogicas')
    .where({ slug })
    .select('id_ruta_pedagogica')
    .first();

  if (!route) {
    throw new Error(`La ruta pedagógica ${slug} no existe en la base de datos de pruebas.`);
  }

  return route.id_ruta_pedagogica;
};

/**
 * Construye un escenario real jugable usando los mismos bordes publicos de la app.
 *
 * POR QUE:
 * probar por HTTP y socket con entidades reales detecta mejor los errores de
 * contrato, multitenancy y ciclo de vida.
 */
export const provisionPlayableStudent = async ({
  openClass = true,
  loginStudent = true,
  installationId = randomUUID(),
  suffix = buildCodigoEstelarSuffix(),
} = {}) => {
  const superToken = await getSuperadminToken();

  const createInstitutionRes = await request(app)
    .post('/api/admin/instituciones')
    .set(authHeader(superToken))
    .send({
      nombre: buildTestInstitutionName(`Inst ${suffix}`),
      ciudad: 'Bogota',
      direccion: 'Calle 123',
    });

  if (createInstitutionRes.status !== 201) {
    throw new Error(`No se pudo crear la institucion: ${JSON.stringify(createInstitutionRes.body)}`);
  }

  const institutionId = createInstitutionRes.body.data.institucion.id;
  registerTestInstitution(institutionId);
  const { email: adminEmail, contrasena_temporal: adminPassword } = createInstitutionRes.body.data.admin;
  const adminToken = await loginAs(adminEmail, adminPassword);

  const tutorEmail = `tutor.${suffix}@logickids.dev`;
  const createTutorRes = await request(app)
    .post('/api/admin/usuarios/tutores')
    .set(authHeader(adminToken))
    .send({
      nombre: `Tutor ${suffix}`,
      email: tutorEmail,
    });

  if (createTutorRes.status !== 201) {
    throw new Error(`No se pudo crear el tutor: ${JSON.stringify(createTutorRes.body)}`);
  }

  const tutorId = createTutorRes.body.data?.id;
  const tutorPassword = createTutorRes.body.data?.contrasena_temporal;
  if (!Number.isInteger(tutorId) || !tutorPassword) {
    throw new Error(
      `La respuesta de creacion del tutor no incluyo credenciales validas: ${JSON.stringify(createTutorRes.body)}`
    );
  }

  const tutorToken = await loginAs(tutorEmail, tutorPassword);

  const codigoEstelarId = await resolveCodigoEstelarId();

  const createGroupRes = await request(app)
    .post('/api/grupos')
    .set(authHeader(adminToken))
    .send({
      nombre: `Grupo ${suffix}`,
      descripcion: 'Grupo de pruebas para Codigo Estelar',
    });

  if (createGroupRes.status !== 201) {
    throw new Error(`No se pudo crear el grupo: ${JSON.stringify(createGroupRes.body)}`);
  }

  const groupId = createGroupRes.body.data.id;

  const assignTutorRes = await request(app)
    .patch(`/api/grupos/${groupId}/tutor`)
    .set(authHeader(adminToken))
    .send({ tutor_id: tutorId });

  if (assignTutorRes.status !== 200) {
    throw new Error(`No se pudo asignar el tutor al grupo: ${JSON.stringify(assignTutorRes.body)}`);
  }

  const createStudentRes = await request(app)
    .post('/api/estudiantes')
    .set(authHeader(adminToken))
    .send({
      nombre: `Estudiante ${suffix}`,
      edad: 8,
      grupo_id: groupId,
      color_avatar: '#3B82F6',
    });

  if (createStudentRes.status !== 201) {
    throw new Error(`No se pudo crear el estudiante: ${JSON.stringify(createStudentRes.body)}`);
  }

  const studentId = createStudentRes.body.data.id;

  if (openClass) {
    const openClassRes = await request(app)
      .patch(`/api/grupos/${groupId}/sesion`)
      .set(authHeader(tutorToken))
      .send({
        sesion_activa: true,
        modo: 'single',
        minijuego_id: codigoEstelarId,
        niveles: 1,
      });

    if (openClassRes.status !== 200) {
      throw new Error(`No se pudo abrir la clase: ${JSON.stringify(openClassRes.body)}`);
    }
  }

  const qrRes = await request(app)
    .get(`/api/estudiantes/${studentId}/qr`)
    .set(authHeader(tutorToken));

  if (qrRes.status !== 200) {
    throw new Error(`No se pudo obtener el QR del estudiante: ${JSON.stringify(qrRes.body)}`);
  }

  const studentLoginRes = loginStudent
    ? await request(app)
        .post('/api/estudiantes/login')
        .send({
          qr_token: qrRes.body.data.qr_token,
          installation_id: installationId,
          app_version: 'test',
        })
    : null;

  if (studentLoginRes && studentLoginRes.status !== 200) {
    throw new Error(`No se pudo loguear al estudiante: ${JSON.stringify(studentLoginRes.body)}`);
  }

  return {
    superToken,
    adminToken,
    tutorToken,
    studentToken: studentLoginRes?.body.data.token ?? null,
    qrToken: qrRes.body.data.qr_token,
    installationId,
    institutionId,
    groupId,
    tutorId,
    studentId,
  };
};

export const startCodigoEstelarSession = async ({
  studentToken,
  minijuegoId,
  dificultad = 2,
}) =>
  request(app)
    .post('/api/sesiones/iniciar')
    .set(authHeader(studentToken))
    .send({
      minijuego_id: minijuegoId,
      dificultad,
    });
