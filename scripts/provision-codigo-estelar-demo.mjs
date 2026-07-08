import os from 'node:os';
import request from 'supertest';
import app from '../src/app.js';
import { db } from '../src/config/db.js';

const SUPERADMIN_EMAIL = 'superadmin@logickids.dev';
const SUPERADMIN_PASSWORD = 'SuperAdmin2025!';
const DEFAULT_TUTOR_PASSWORD = 'TutorPass123!';
const DEFAULT_STUDENT_COUNT = 3;
const STUDENT_COLOR_PALETTE = Object.freeze([
  '#3B82F6',
  '#F97316',
  '#10B981',
  '#EC4899',
  '#FACC15',
  '#8B5CF6',
  '#14B8A6',
  '#EF4444',
]);

/**
 * Genera un sufijo único y legible para no chocar con escenarios anteriores.
 *
 * POR QUÉ:
 * - la demo necesita datos controlados y repetibles
 * - si reusamos nombres fijos, los UNIQUE de email/grupo nos frenan
 */
const buildSuffix = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

const resolveStudentCount = () => {
  const countArg = process.argv.find((arg) => arg.startsWith('--students='));
  const rawValue = countArg
    ? countArg.split('=')[1]
    : process.argv[process.argv.indexOf('--students') + 1];

  if (!rawValue) {
    return DEFAULT_STUDENT_COUNT;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('El parametro --students debe ser un entero positivo. Ej: --students=6');
  }

  return parsed;
};

const assertStatus = (response, expectedStatus, action) => {
  if (response.status !== expectedStatus) {
    throw new Error(
      `${action} fallo con status ${response.status}: ${JSON.stringify(response.body, null, 2)}`
    );
  }
};

/**
 * Intenta sugerir una IP LAN util para pegar en el celular.
 *
 * ANALOGÍA:
 * es como decirle al visitante qué dirección de la casa sirve desde la calle,
 * no la dirección interna del cuarto.
 */
const resolveSuggestedApiBaseUrl = () => {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [interfaceName, entries] of Object.entries(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;

      const isPrivateLan =
        entry.address.startsWith('192.168.') ||
        entry.address.startsWith('10.') ||
        entry.address.startsWith('172.16.') ||
        entry.address.startsWith('172.17.') ||
        entry.address.startsWith('172.18.') ||
        entry.address.startsWith('172.19.') ||
        entry.address.startsWith('172.2');

      if (!isPrivateLan) continue;

      const lowerName = interfaceName.toLowerCase();
      let score = 0;

      if (lowerName.includes('wi-fi') || lowerName.includes('wifi') || lowerName.includes('wlan')) {
        score += 100;
      }

      if (lowerName.includes('virtual') || lowerName.includes('vmware') || lowerName.includes('loopback')) {
        score -= 100;
      }

      if (entry.address.startsWith('192.168.56.')) {
        score -= 50;
      }

      if (entry.address.startsWith('192.168.')) {
        score += 20;
      }

      candidates.push({ score, address: entry.address });
    }
  }

  const bestCandidate = candidates.sort((a, b) => b.score - a.score)[0];
  if (bestCandidate) {
    return `http://${bestCandidate.address}:3000/api`;
  }

  return 'http://TU_IP_LOCAL:3000/api';
};

const login = async (email, contrasena) => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, contrasena });

  assertStatus(response, 200, `Login de ${email}`);
  return response.body.data.token;
};

const createDemoStudent = async ({ tutorToken, groupId, suffix, index }) => {
  const studentName = `Estudiante Demo ${index} ${suffix}`;
  const colorAvatar = STUDENT_COLOR_PALETTE[(index - 1) % STUDENT_COLOR_PALETTE.length];

  const createStudentRes = await request(app)
    .post('/api/estudiantes')
    .set(authHeader(tutorToken))
    .send({
      nombre: studentName,
      edad: 8,
      grupo_id: groupId,
      color_avatar: colorAvatar,
    });

  assertStatus(createStudentRes, 201, `Creacion del estudiante demo ${index}`);

  const student = createStudentRes.body.data;

  const qrRes = await request(app)
    .get(`/api/estudiantes/${student.id}/qr`)
    .set(authHeader(tutorToken));

  assertStatus(qrRes, 200, `Obtencion del QR del estudiante demo ${index}`);

  return {
    ...student,
    qr_token: qrRes.body.data.qr_token,
    color_avatar: colorAvatar,
  };
};

const provisionCodigoEstelarDemo = async () => {
  const suffix = buildSuffix();
  const studentCount = resolveStudentCount();
  const suggestedApiBaseUrl = resolveSuggestedApiBaseUrl();

  const superToken = await login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);

  const institutionName = `Inst Demo Codigo Estelar ${suffix}`;
  const createInstitutionRes = await request(app)
    .post('/api/admin/instituciones')
    .set(authHeader(superToken))
    .send({
      nombre: institutionName,
      ciudad: 'Bogota',
      direccion: 'Calle Demo 123',
    });

  assertStatus(createInstitutionRes, 201, 'Creacion de institucion');

  const institution = createInstitutionRes.body.data.institucion;
  const admin = createInstitutionRes.body.data.admin;
  const adminToken = await login(admin.email, admin.contrasena_temporal);

  const tutorEmail = `tutor.codigo-estelar.${suffix}@logickids.dev`;
  const tutorName = `Tutor Codigo Estelar ${suffix}`;
  const registerTutorRes = await request(app)
    .post('/api/auth/registro')
    .send({
      nombre: tutorName,
      email: tutorEmail,
      contrasena: DEFAULT_TUTOR_PASSWORD,
      institucion_id: institution.id,
    });

  assertStatus(registerTutorRes, 201, 'Registro de tutor');

  const listUsersRes = await request(app)
    .get('/api/admin/usuarios')
    .set(authHeader(adminToken));

  assertStatus(listUsersRes, 200, 'Listado de usuarios de la institucion');

  const tutorRecord = listUsersRes.body.data.find((user) => user.email === tutorEmail);
  if (!tutorRecord) {
    throw new Error('No se encontro el tutor recien creado en la institucion.');
  }

  const activateTutorRes = await request(app)
    .patch(`/api/admin/usuarios/${tutorRecord.id}/estado`)
    .set(authHeader(adminToken))
    .send({ estado: 'activo' });

  assertStatus(activateTutorRes, 200, 'Activacion del tutor');

  const tutorToken = await login(tutorEmail, DEFAULT_TUTOR_PASSWORD);

  const groupName = `Grupo Demo ${suffix}`;
  const createGroupRes = await request(app)
    .post('/api/grupos')
    .set(authHeader(tutorToken))
    .send({
      nombre: groupName,
      descripcion: 'Grupo de demo controlado para Codigo Estelar',
    });

  assertStatus(createGroupRes, 201, 'Creacion de grupo');

  const group = createGroupRes.body.data;
  const students = [];

  for (let index = 1; index <= studentCount; index += 1) {
    const student = await createDemoStudent({
      tutorToken,
      groupId: group.id,
      suffix,
      index,
    });
    students.push(student);
  }

  const openClassRes = await request(app)
    .patch(`/api/grupos/${group.id}/sesion`)
    .set(authHeader(tutorToken))
    .send({ sesion_activa: true });

  assertStatus(openClassRes, 200, 'Apertura de la clase');

  console.log('');
  console.log('=== Escenario Codigo Estelar listo ===');
  console.log(`Institucion: ${institution.nombre} (id ${institution.id})`);
  console.log(`Admin: ${admin.email}`);
  console.log(`Clave admin temporal: ${admin.contrasena_temporal}`);
  console.log(`Tutor: ${tutorName}`);
  console.log(`Tutor email: ${tutorEmail}`);
  console.log(`Tutor clave: ${DEFAULT_TUTOR_PASSWORD}`);
  console.log(`Grupo: ${group.nombre} (id ${group.id})`);
  console.log(`Estudiantes creados: ${students.length}`);
  console.log(`API sugerida para el movil: ${suggestedApiBaseUrl}`);
  console.log('Dificultad sugerida: 2');
  console.log('');
  console.log('QR listos para la demo:');
  students.forEach((student, index) => {
    console.log(
      `${index + 1}. ${student.nombre} (id ${student.id}) -> ${student.qr_token}`
    );
  });
  console.log('');
  console.log('Use en cada celular:');
  console.log(`1. API Base URL = ${suggestedApiBaseUrl}`);
  console.log('2. QR Token = uno de la lista anterior');
  console.log('3. Dificultad = 2');
  console.log('');
};

provisionCodigoEstelarDemo()
  .catch((error) => {
    console.error('');
    console.error('No se pudo provisionar la demo de Codigo Estelar.');
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.destroy();
  });
