import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { db } from '../src/config/db.js';
import { getSuperadminToken, loginAs } from './helpers/auth.helper.js';
import {
  buildTestInstitutionName,
  registerTestInstitution,
} from './helpers/testFixtures.helper.js';

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

const buildSuffix = (label = 'solicitudes') =>
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const ensureSolicitudesTable = async () => {
  const exists = await db.schema.hasTable('solicitudes_reactivacion');
  if (exists) return;

  try {
    await db.raw(`
      CREATE TABLE IF NOT EXISTS solicitudes_reactivacion (
        id_solicitud SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        correo_contacto VARCHAR(255) NOT NULL,
        motivo TEXT NOT NULL,
        descripcion TEXT,
        estado_solicitud VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        respuesta_admin TEXT,
        leida_admin BOOLEAN NOT NULL DEFAULT FALSE,
        fecha_solicitud TIMESTAMP NOT NULL DEFAULT NOW(),
        fecha_respuesta TIMESTAMP,
        CONSTRAINT chk_estado_solicitud_test CHECK (
          estado_solicitud IN ('pendiente', 'aprobado', 'rechazado')
        )
      );
    `);
  } catch (error) {
    if (!['42P07', '23505'].includes(error.code)) {
      throw error;
    }
  }
};

const provisionSuspendedTutor = async () => {
  const suffix = buildSuffix();
  const superToken = await getSuperadminToken();

  const createInstitutionRes = await request(app)
    .post('/api/admin/instituciones')
    .set(authHeader(superToken))
    .send({
      nombre: buildTestInstitutionName(`Inst ${suffix}`),
      ciudad: 'Bogota',
      direccion: 'Calle 123',
    });

  expect(createInstitutionRes.status).toBe(201);

  const institutionId = createInstitutionRes.body.data.institucion.id;
  registerTestInstitution(institutionId);
  const adminEmail = createInstitutionRes.body.data.admin.email;
  const adminPassword = createInstitutionRes.body.data.admin.contrasena_temporal;
  const adminToken = await loginAs(adminEmail, adminPassword);

  const tutorEmail = `tutor.${suffix}@logickids.dev`;
  const tutorPassword = 'TutorPass123!';

  const registerTutorRes = await request(app)
    .post('/api/auth/registro')
    .send({
      nombre: `Tutor ${suffix}`,
      email: tutorEmail,
      contrasena: tutorPassword,
      institucion_id: institutionId,
    });

  expect(registerTutorRes.status).toBe(201);

  const listUsersRes = await request(app)
    .get('/api/admin/usuarios')
    .set(authHeader(adminToken));

  const tutor = listUsersRes.body.data.find((user) => user.email === tutorEmail);
  expect(tutor).toBeTruthy();

  const suspendTutorRes = await request(app)
    .patch(`/api/admin/usuarios/${tutor.id}/estado`)
    .set(authHeader(adminToken))
    .send({ estado: 'suspendido' });

  expect(suspendTutorRes.status).toBe(200);

  return {
    superToken,
    adminToken,
    tutorEmail,
    institutionId,
  };
};

describe('📝 Solicitudes de reactivación', () => {
  beforeAll(async () => {
    await ensureSolicitudesTable();
  });

  it('✅ crea una solicitud pendiente para un tutor suspendido con respuesta estándar', async () => {
    const fixture = await provisionSuspendedTutor();

    const res = await request(app)
      .post('/api/solicitudes/reactivacion')
      .send({
        email: fixture.tutorEmail,
        motivo: 'Necesito recuperar mi acceso para continuar con mis grupos',
        descripcion: 'El bloqueo ya fue revisado con mi institución.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.solicitud.id).toEqual(expect.any(Number));
    expect(res.body.data.solicitud.estado).toBe('pendiente');
  });

  it('❌ impide duplicar una solicitud pendiente del mismo tutor suspendido', async () => {
    const fixture = await provisionSuspendedTutor();

    const firstRes = await request(app)
      .post('/api/solicitudes/reactivacion')
      .send({
        email: fixture.tutorEmail,
        motivo: 'Necesito recuperar mi acceso para continuar con mis grupos',
      });

    expect(firstRes.status).toBe(201);

    const secondRes = await request(app)
      .post('/api/solicitudes/reactivacion')
      .send({
        email: fixture.tutorEmail,
        motivo: 'Vuelvo a intentarlo mientras la primera sigue pendiente',
      });

    expect(secondRes.status).toBe(409);
    expect(secondRes.body.success).toBe(false);
  });

  it('✅ permite al admin institucional listar solicitudes con contrato estándar y bloquea a superadmin', async () => {
    const fixture = await provisionSuspendedTutor();

    await request(app)
      .post('/api/solicitudes/reactivacion')
      .send({
        email: fixture.tutorEmail,
        motivo: 'Necesito recuperar mi acceso para continuar con mis grupos',
      });

    const forbiddenForSuperadmin = await request(app)
      .get('/api/solicitudes/admin/solicitudes')
      .set(authHeader(fixture.superToken));

    expect(forbiddenForSuperadmin.status).toBe(403);

    const res = await request(app)
      .get('/api/solicitudes/admin/solicitudes')
      .set(authHeader(fixture.adminToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((solicitud) => solicitud.tutor_email === fixture.tutorEmail)).toBe(true);
  });
});
