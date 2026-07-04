import { randomUUID } from 'node:crypto';
import request from 'supertest';
import app from '../../src/app.js';
import { getSuperadminToken, loginAs } from './auth.helper.js';
import {
  buildTestInstitutionName,
  registerTestInstitution,
} from './testFixtures.helper.js';

const buildSuffix = () =>
  `student-device-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const assertStatus = (response, expectedStatus, context) => {
  if (response.status !== expectedStatus) {
    throw new Error(`${context}: ${JSON.stringify(response.body)}`);
  }
};

export const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

export const loginStudent = ({
  qrToken,
  installationId = randomUUID(),
  deviceConflictStrategy,
}) =>
  request(app)
    .post('/api/estudiantes/login')
    .send({
      qr_token: qrToken,
      installation_id: installationId,
      app_version: 'student-device-session-test',
      device_conflict_strategy: deviceConflictStrategy,
    });

const createInstitution = async (suffix) => {
  const superToken = await getSuperadminToken();
  const response = await request(app)
    .post('/api/admin/instituciones')
    .set(authHeader(superToken))
    .send({
      nombre: buildTestInstitutionName(`Device ${suffix}`),
      ciudad: 'Bogota',
      direccion: 'Calle 123',
    });

  assertStatus(response, 201, 'No se pudo crear la institucion de prueba');
  registerTestInstitution(response.body.data.institucion.id);
  return response.body.data;
};

const createTutor = async ({ adminToken, suffix, index }) => {
  const email = `device.tutor.${index}.${suffix}@logickids.dev`;
  const response = await request(app)
    .post('/api/admin/usuarios/tutores')
    .set(authHeader(adminToken))
    .send({ nombre: `Tutor Device ${index}`, email });

  assertStatus(response, 201, 'No se pudo crear el tutor de prueba');
  return {
    id: response.body.data.id,
    token: await loginAs(email, response.body.data.contrasena_temporal),
  };
};

const createGroup = async ({ adminToken, suffix }) => {
  const response = await request(app)
    .post('/api/grupos')
    .set(authHeader(adminToken))
    .send({ nombre: `Grupo Device ${suffix}` });

  assertStatus(response, 201, 'No se pudo crear el grupo de prueba');
  return response.body.data.id;
};

export const assignTutorToGroup = async ({ adminToken, groupId, tutorId }) => {
  const response = await request(app)
    .patch(`/api/grupos/${groupId}/tutor`)
    .set(authHeader(adminToken))
    .send({ tutor_id: tutorId });

  assertStatus(response, 200, 'No se pudo asignar el tutor de prueba');
};

const createStudent = async ({ adminToken, groupId, index }) => {
  const creation = await request(app)
    .post('/api/estudiantes')
    .set(authHeader(adminToken))
    .send({
      nombre: `Estudiante Device ${index}`,
      edad: 8,
      grupo_id: groupId,
      color_avatar: '#3B82F6',
    });

  assertStatus(creation, 201, 'No se pudo crear el estudiante de prueba');
  const id = creation.body.data.id;
  const qr = await request(app)
    .get(`/api/estudiantes/${id}/qr`)
    .set(authHeader(adminToken));

  assertStatus(qr, 200, 'No se pudo obtener el QR del estudiante de prueba');
  return { id, qrToken: qr.body.data.qr_token };
};

export const provisionStudentDeviceSessionFixture = async ({
  studentCount = 1,
  tutorCount = 1,
} = {}) => {
  const suffix = buildSuffix();
  const institution = await createInstitution(suffix);
  const adminToken = await loginAs(
    institution.admin.email,
    institution.admin.contrasena_temporal
  );
  const groupId = await createGroup({ adminToken, suffix });
  const tutors = [];
  const students = [];

  for (let index = 1; index <= tutorCount; index += 1) {
    tutors.push(await createTutor({ adminToken, suffix, index }));
  }
  await assignTutorToGroup({ adminToken, groupId, tutorId: tutors[0].id });
  for (let index = 1; index <= studentCount; index += 1) {
    students.push(await createStudent({ adminToken, groupId, index }));
  }

  return { adminToken, groupId, students, tutors };
};
