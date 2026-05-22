import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { db } from '../src/config/db.js';
import {
  authHeader,
  buildCodigoEstelarSuffix,
  provisionPlayableStudent,
  resolveCodigoEstelarId,
} from './helpers/codigoEstelar.helper.js';
import { getSuperadminToken, loginAs } from './helpers/auth.helper.js';

const createInstitutionWithPrincipalAdmin = async (suffix) => {
  const superToken = await getSuperadminToken();

  const createInstitutionRes = await request(app)
    .post('/api/admin/instituciones')
    .set(authHeader(superToken))
    .send({
      nombre: `Institucion ${suffix}`,
      ciudad: 'Bogota',
      direccion: 'Calle 99',
    });

  expect(createInstitutionRes.status).toBe(201);

  const institutionId = createInstitutionRes.body.data.institucion.id;
  const { email, contrasena_temporal } = createInstitutionRes.body.data.admin;
  const adminToken = await loginAs(email, contrasena_temporal);

  return {
    superToken,
    institutionId,
    adminEmail: email,
    adminToken,
  };
};

describe('🏫 Modelo institución-céntrico', () => {
  it('✅ el admin principal puede crear otro admin y el admin auxiliar no puede crear más admins', async () => {
    const suffix = buildCodigoEstelarSuffix('admins');
    const { institutionId, adminToken } = await createInstitutionWithPrincipalAdmin(suffix);

    const createSecondAdminRes = await request(app)
      .post('/api/admin/usuarios/admins')
      .set(authHeader(adminToken))
      .send({
        nombre: `Admin Auxiliar ${suffix}`,
        email: `aux.${suffix}@logickids.dev`,
      });

    expect(createSecondAdminRes.status).toBe(201);
    expect(createSecondAdminRes.body.success).toBe(true);
    expect(createSecondAdminRes.body.data.es_admin_principal).toBe(false);

    const adminListRes = await request(app)
      .get(`/api/admin/usuarios?rol=admin&institucion_id=${institutionId}`)
      .set(authHeader(adminToken));

    expect(adminListRes.status).toBe(200);
    expect(adminListRes.body.data.some((user) => user.es_admin_principal === true)).toBe(true);
    expect(adminListRes.body.data.some((user) => user.email === `aux.${suffix}@logickids.dev`)).toBe(true);

    const auxiliarToken = await loginAs(
      `aux.${suffix}@logickids.dev`,
      createSecondAdminRes.body.data.contrasena_temporal
    );

    const forbiddenRes = await request(app)
      .post('/api/admin/usuarios/admins')
      .set(authHeader(auxiliarToken))
      .send({
        nombre: `Admin Bloqueado ${suffix}`,
        email: `blocked.${suffix}@logickids.dev`,
      });

    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.success).toBe(false);
  });

  it('✅ expone dashboard global para superadmin y dashboard institucional para admin', async () => {
    const suffix = buildCodigoEstelarSuffix('dashboard');
    const { superToken, adminToken } = await createInstitutionWithPrincipalAdmin(suffix);

    const superDashboardRes = await request(app)
      .get('/api/admin/dashboard')
      .set(authHeader(superToken));

    expect(superDashboardRes.status).toBe(200);
    expect(superDashboardRes.body.data.scope).toBe('global');
    expect(Array.isArray(superDashboardRes.body.data.instituciones)).toBe(true);

    const adminDashboardRes = await request(app)
      .get('/api/admin/dashboard')
      .set(authHeader(adminToken));

    expect(adminDashboardRes.status).toBe(200);
    expect(adminDashboardRes.body.data.scope).toBe('institucion');
    expect(adminDashboardRes.body.data.resumen.admins_totales).toBeDefined();
  });

  it('✅ el admin crea y asigna grupos; el tutor opera la sesión; el admin no puede abrir la clase', async () => {
    const fixture = await provisionPlayableStudent({
      suffix: buildCodigoEstelarSuffix('group-flow'),
      openClass: false,
    });
    const codigoEstelarId = await resolveCodigoEstelarId();

    const tutorGroupsRes = await request(app)
      .get('/api/grupos')
      .set(authHeader(fixture.tutorToken));

    expect(tutorGroupsRes.status).toBe(200);
    expect(tutorGroupsRes.body.data).toHaveLength(1);
    expect(tutorGroupsRes.body.data[0].tutor_asignado_id).toBeTruthy();

    const adminOpenRes = await request(app)
      .patch(`/api/grupos/${fixture.groupId}/sesion`)
      .set(authHeader(fixture.adminToken))
      .send({ sesion_activa: true, minijuego_id: codigoEstelarId });

    expect(adminOpenRes.status).toBe(403);

    const tutorOpenRes = await request(app)
      .patch(`/api/grupos/${fixture.groupId}/sesion`)
      .set(authHeader(fixture.tutorToken))
      .send({ sesion_activa: true, minijuego_id: codigoEstelarId });

    expect(tutorOpenRes.status).toBe(200);
    expect(tutorOpenRes.body.data.minijuego_id).toBe(codigoEstelarId);
    expect(tutorOpenRes.body.data.sesion_activa).toBe(true);

    const studentProfileRes = await request(app)
      .get('/api/estudiantes/mi-perfil')
      .set(authHeader(fixture.studentToken));

    expect(studentProfileRes.status).toBe(200);
    expect(studentProfileRes.body.data.sesion_minijuego_id).toBe(codigoEstelarId);
    expect(studentProfileRes.body.data.sesion_minijuego_slug).toBe('codigo-estelar');
  });

  it('✅ mover un estudiante entre grupos deja historial real y cierra su sesión activa', async () => {
    const fixture = await provisionPlayableStudent({
      suffix: buildCodigoEstelarSuffix('move-student'),
      openClass: false,
    });

    const createSecondGroupRes = await request(app)
      .post('/api/grupos')
      .set(authHeader(fixture.adminToken))
      .send({
        nombre: `Grupo destino ${Date.now()}`,
        descripcion: 'Grupo destino para mover estudiante',
      });

    expect(createSecondGroupRes.status).toBe(201);
    const secondGroupId = createSecondGroupRes.body.data.id;

    const assignTutorRes = await request(app)
      .patch(`/api/grupos/${secondGroupId}/tutor`)
      .set(authHeader(fixture.adminToken))
      .send({ tutor_id: fixture.tutorId });

    expect(assignTutorRes.status).toBe(200);

    const moveRes = await request(app)
      .patch(`/api/estudiantes/${fixture.studentId}/grupo`)
      .set(authHeader(fixture.adminToken))
      .send({ grupo_id: secondGroupId });

    expect(moveRes.status).toBe(200);
    expect(moveRes.body.data.grupo_id).toBe(secondGroupId);

    const currentStudent = await db('estudiantes')
      .where({ id_estudiante: fixture.studentId })
      .select('sesion_activa')
      .first();

    expect(currentStudent.sesion_activa).toBe(false);

    const historyRows = await db('estudiante_grupo_historial')
      .where({ estudiante_id: fixture.studentId })
      .orderBy('id_est_grupo', 'asc')
      .select('grupo_id', 'activo', 'fecha_fin');

    expect(historyRows).toHaveLength(2);
    expect(historyRows[0].activo).toBe(false);
    expect(historyRows[0].fecha_fin).not.toBeNull();
    expect(historyRows[1].grupo_id).toBe(secondGroupId);
    expect(historyRows[1].activo).toBe(true);
  });
});
