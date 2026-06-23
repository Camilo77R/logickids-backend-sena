import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { db } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import {
  assignTutorToGroup,
  authHeader,
  loginStudent,
  provisionStudentDeviceSessionFixture,
} from './helpers/studentDeviceSession.helper.js';

const RECOVERY_ACTION = 'restart_current_activity';

const verifyStudentToken = (token) =>
  jwt.verify(token, env.JWT_STUDENT_SECRET, {
    algorithms: ['HS256'],
    audience: env.JWT_STUDENT_AUDIENCE,
    issuer: env.JWT_STUDENT_ISSUER,
  });

const digestInstallationId = (installationId) =>
  createHash('sha256').update(installationId).digest('hex');

const getDeviceState = ({ studentId, adultToken }) =>
  request(app)
    .get(`/api/estudiantes/${studentId}/dispositivo-activo`)
    .set(authHeader(adultToken));

const recoverDeviceSession = ({ studentId, adultToken, body }) =>
  request(app)
    .post(`/api/estudiantes/${studentId}/recuperar-sesion-dispositivo`)
    .set(authHeader(adultToken))
    .send(body);

describe('Contrato endurecido de sesiones de dispositivo estudiantil', () => {
  it('emite un JWT minimo sin identidad mutable duplicada', async () => {
    const fixture = await provisionStudentDeviceSessionFixture();
    const student = fixture.students[0];
    const login = await loginStudent({ qrToken: student.qrToken });

    expect(login.status).toBe(200);
    const payload = verifyStudentToken(login.body.data.token);

    expect(payload).toMatchObject({
      sid: login.body.data.device_session.id,
      sub: String(student.id),
    });
    expect(Object.keys(payload).sort()).toEqual(
      ['aud', 'exp', 'iat', 'iss', 'sid', 'sub'].sort()
    );
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('nombre');
    expect(payload).not.toHaveProperty('grupo_id');
  });

  it('no expone la instalacion y persiste solamente su digest', async () => {
    const fixture = await provisionStudentDeviceSessionFixture();
    const student = fixture.students[0];
    const installationId = randomUUID();
    const login = await loginStudent({
      qrToken: student.qrToken,
      installationId,
    });

    expect(login.status).toBe(200);
    expect(login.body.data.device_session).toEqual({
      id: expect.any(String),
      reused: false,
    });
    expect(JSON.stringify(login.body.data)).not.toContain(installationId);

    const persisted = await db('student_device_sessions')
      .where({ id_student_device_session: login.body.data.device_session.id })
      .select('installation_hash')
      .first();

    expect(persisted.installation_hash).toBe(digestInstallationId(installationId));
    expect(persisted.installation_hash).not.toBe(installationId);
    expect(persisted.installation_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('devuelve el estado canonico y responde 200 cuando no hay sesion', async () => {
    const fixture = await provisionStudentDeviceSessionFixture();
    const student = fixture.students[0];
    const tutor = fixture.tutors[0];

    const withoutSession = await getDeviceState({
      studentId: student.id,
      adultToken: tutor.token,
    });

    expect(withoutSession.status).toBe(200);
    expect(withoutSession.body.data).toEqual({
      tiene_dispositivo_activo: false,
      puede_recuperar: false,
      dispositivo_activo: null,
    });

    const login = await loginStudent({ qrToken: student.qrToken });
    expect(login.status).toBe(200);

    const withSession = await getDeviceState({
      studentId: student.id,
      adultToken: tutor.token,
    });

    expect(withSession.status).toBe(200);
    expect(withSession.body.data).toMatchObject({
      tiene_dispositivo_activo: true,
      puede_recuperar: true,
      dispositivo_activo: {
        estado: 'activo',
        actividad_actual: null,
      },
    });
    expect(Object.keys(withSession.body.data.dispositivo_activo).sort()).toEqual(
      ['actividad_actual', 'conectado_desde', 'estado', 'ultima_actividad_en'].sort()
    );
  });

  it('exige action y responde 409 cuando no existe una sesion viva', async () => {
    const fixture = await provisionStudentDeviceSessionFixture();
    const student = fixture.students[0];
    const tutor = fixture.tutors[0];

    const missingAction = await recoverDeviceSession({
      studentId: student.id,
      adultToken: tutor.token,
      body: {},
    });

    expect(missingAction.status).toBe(400);
    expect(missingAction.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'action' })])
    );

    const withoutLiveSession = await recoverDeviceSession({
      studentId: student.id,
      adultToken: tutor.token,
      body: { action: RECOVERY_ACTION },
    });

    expect(withoutLiveSession.status).toBe(409);
    expect(withoutLiveSession.body.code).toBe('STUDENT_DEVICE_SESSION_NOT_ACTIVE');
  });

  it('rechaza al tutor historico despues de reasignar el grupo', async () => {
    const fixture = await provisionStudentDeviceSessionFixture({ tutorCount: 2 });
    const student = fixture.students[0];
    const [historicalTutor, currentTutor] = fixture.tutors;

    await assignTutorToGroup({
      adminToken: fixture.adminToken,
      groupId: fixture.groupId,
      tutorId: currentTutor.id,
    });

    const historicalRead = await getDeviceState({
      studentId: student.id,
      adultToken: historicalTutor.token,
    });
    const historicalRecovery = await recoverDeviceSession({
      studentId: student.id,
      adultToken: historicalTutor.token,
      body: { action: RECOVERY_ACTION },
    });
    const currentRead = await getDeviceState({
      studentId: student.id,
      adultToken: currentTutor.token,
    });

    expect(historicalRead.status).toBe(403);
    expect(historicalRecovery.status).toBe(403);
    expect(currentRead.status).toBe(200);
  });

  it('distingue SESSION_REVOKED de TOKEN_EXPIRED', async () => {
    const fixture = await provisionStudentDeviceSessionFixture();
    const student = fixture.students[0];
    const firstLogin = await loginStudent({ qrToken: student.qrToken });

    expect(firstLogin.status).toBe(200);
    const logout = await request(app)
      .delete('/api/estudiantes/mi-sesion-dispositivo')
      .set(authHeader(firstLogin.body.data.token));
    expect(logout.status).toBe(200);

    const revoked = await request(app)
      .get('/api/estudiantes/mi-perfil')
      .set(authHeader(firstLogin.body.data.token));
    expect(revoked.status).toBe(401);
    expect(revoked.body.code).toBe('SESSION_REVOKED');

    const secondLogin = await loginStudent({ qrToken: student.qrToken });
    expect(secondLogin.status).toBe(200);
    const expiredAt = new Date(Date.now() - 60_000);
    const createdAt = new Date(expiredAt.getTime() - 60_000);
    await db('student_device_sessions')
      .where({ id_student_device_session: secondLogin.body.data.device_session.id })
      .update({
        creada_en: createdAt,
        ultima_actividad_en: createdAt,
        expira_en: expiredAt,
      });

    const expired = await request(app)
      .get('/api/estudiantes/mi-perfil')
      .set(authHeader(secondLogin.body.data.token));
    expect(expired.status).toBe(401);
    expect(expired.body.code).toBe('TOKEN_EXPIRED');
  });

  it('impide que una instalacion mantenga dos estudiantes activos', async () => {
    const fixture = await provisionStudentDeviceSessionFixture({ studentCount: 2 });
    const [firstStudent, secondStudent] = fixture.students;
    const installationId = randomUUID();

    const firstLogin = await loginStudent({
      qrToken: firstStudent.qrToken,
      installationId,
    });
    const secondLogin = await loginStudent({
      qrToken: secondStudent.qrToken,
      installationId,
    });

    expect(firstLogin.status).toBe(200);
    expect(secondLogin.status).toBe(409);
    expect(secondLogin.body.code).toBe('STUDENT_SESSION_ACTIVE');

    const activeRows = await db('student_device_sessions')
      .where({ installation_hash: digestInstallationId(installationId) })
      .whereNull('revocada_en')
      .select('estudiante_id');

    expect(activeRows).toEqual([{ estudiante_id: firstStudent.id }]);
  });
});
