import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { authHeader, buildCodigoEstelarSuffix, provisionPlayableStudent } from './helpers/codigoEstelar.helper.js';
import { loginAs } from './helpers/auth.helper.js';

const createTutor = async ({ adminToken, suffix }) => {
  const email = `tutor.extra.${suffix}@logickids.dev`;
  const res = await request(app)
    .post('/api/admin/usuarios/tutores')
    .set(authHeader(adminToken))
    .send({
      nombre: `Tutor Extra ${suffix}`,
      email,
    });

  expect(res.status).toBe(201);

  return {
    tutorId: res.body.data.id,
    tutorToken: await loginAs(email, res.body.data.contrasena_temporal),
  };
};

const createGroup = async ({ adminToken, suffix }) => {
  const res = await request(app)
    .post('/api/grupos')
    .set(authHeader(adminToken))
    .send({
      nombre: `Grupo Operativo ${suffix}`,
      descripcion: 'Grupo auxiliar para cobertura operativa de estudiantes',
    });

  expect(res.status).toBe(201);
  return res.body.data.id;
};

const assignTutorToGroup = async ({ adminToken, groupId, tutorId }) => {
  const res = await request(app)
    .patch(`/api/grupos/${groupId}/tutor`)
    .set(authHeader(adminToken))
    .send({ tutor_id: tutorId });

  expect(res.status).toBe(200);
};

const createStudent = async ({ adminToken, groupId, suffix }) => {
  const res = await request(app)
    .post('/api/estudiantes')
    .set(authHeader(adminToken))
    .send({
      nombre: `Estudiante Operativo ${suffix}`,
      edad: 8,
      grupo_id: groupId,
      color_avatar: '#22C55E',
    });

  expect(res.status).toBe(201);
  return res.body.data.id;
};

const getStudentQr = async ({ actorToken, studentId }) =>
  request(app)
    .get(`/api/estudiantes/${studentId}/qr`)
    .set(authHeader(actorToken));

describe('Operacion estudiantil - acceso QR y visibilidad por tutor', () => {
  it('rechaza login infantil cuando el QR no existe', async () => {
    const res = await request(app)
      .post('/api/estudiantes/login')
      .send({ qr_token: 'QR-NO-EXISTE-123456' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('rechaza login infantil cuando el estudiante fue desactivado', async () => {
    const fixture = await provisionPlayableStudent({ openClass: false });
    const qrRes = await getStudentQr({
      actorToken: fixture.tutorToken,
      studentId: fixture.studentId,
    });

    expect(qrRes.status).toBe(200);

    const deactivateRes = await request(app)
      .delete(`/api/estudiantes/${fixture.studentId}`)
      .set(authHeader(fixture.adminToken));

    expect(deactivateRes.status).toBe(204);

    const loginRes = await request(app)
      .post('/api/estudiantes/login')
      .send({ qr_token: qrRes.body.data.qr_token });

    expect(loginRes.status).toBe(403);
    expect(loginRes.body.success).toBe(false);
  });

  it('rechaza login infantil cuando la institucion del estudiante fue desactivada', async () => {
    const fixture = await provisionPlayableStudent({ openClass: false });
    const qrRes = await getStudentQr({
      actorToken: fixture.tutorToken,
      studentId: fixture.studentId,
    });

    expect(qrRes.status).toBe(200);

    const deactivateInstitutionRes = await request(app)
      .patch(`/api/admin/instituciones/${fixture.institutionId}/desactivar`)
      .set(authHeader(fixture.superToken));

    expect(deactivateInstitutionRes.status).toBe(200);

    const loginRes = await request(app)
      .post('/api/estudiantes/login')
      .send({ qr_token: qrRes.body.data.qr_token });

    expect(loginRes.status).toBe(403);
    expect(loginRes.body.success).toBe(false);
  });

  it('limita al tutor a los estudiantes de sus grupos dentro del mismo tenant', async () => {
    const suffix = buildCodigoEstelarSuffix('scope-tutor');
    const fixture = await provisionPlayableStudent({
      openClass: false,
      suffix,
    });

    const secondTutor = await createTutor({
      adminToken: fixture.adminToken,
      suffix: `${suffix}-2`,
    });
    const secondGroupId = await createGroup({
      adminToken: fixture.adminToken,
      suffix: `${suffix}-2`,
    });

    await assignTutorToGroup({
      adminToken: fixture.adminToken,
      groupId: secondGroupId,
      tutorId: secondTutor.tutorId,
    });

    const secondStudentId = await createStudent({
      adminToken: fixture.adminToken,
      groupId: secondGroupId,
      suffix: `${suffix}-2`,
    });

    const tutorListRes = await request(app)
      .get('/api/estudiantes')
      .set(authHeader(fixture.tutorToken));

    expect(tutorListRes.status).toBe(200);
    expect(tutorListRes.body.success).toBe(true);
    expect(tutorListRes.body.data.map((student) => student.id)).toContain(fixture.studentId);
    expect(tutorListRes.body.data.map((student) => student.id)).not.toContain(secondStudentId);

    const ownStudentQrRes = await getStudentQr({
      actorToken: fixture.tutorToken,
      studentId: fixture.studentId,
    });
    expect(ownStudentQrRes.status).toBe(200);

    const foreignStudentQrRes = await getStudentQr({
      actorToken: fixture.tutorToken,
      studentId: secondStudentId,
    });
    expect(foreignStudentQrRes.status).toBe(403);

    const adminFilteredListRes = await request(app)
      .get(`/api/estudiantes?grupo_id=${secondGroupId}`)
      .set(authHeader(fixture.adminToken));

    expect(adminFilteredListRes.status).toBe(200);
    expect(adminFilteredListRes.body.success).toBe(true);
    expect(adminFilteredListRes.body.data).toHaveLength(1);
    expect(adminFilteredListRes.body.data[0].id).toBe(secondStudentId);
  });
});
