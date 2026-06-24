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
import {
  buildTestInstitutionName,
  registerTestInstitution,
} from './helpers/testFixtures.helper.js';

const createInstitutionWithPrincipalAdmin = async (suffix) => {
  const superToken = await getSuperadminToken();

  const createInstitutionRes = await request(app)
    .post('/api/admin/instituciones')
    .set(authHeader(superToken))
    .send({
      nombre: buildTestInstitutionName(`Institucion ${suffix}`),
      ciudad: 'Bogota',
      direccion: 'Calle 99',
    });

  expect(createInstitutionRes.status).toBe(201);

  const institutionId = createInstitutionRes.body.data.institucion.id;
  registerTestInstitution(institutionId);
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

  it('✅ cualquier admin institucional puede crear tutores activos con contraseña temporal', async () => {
    const suffix = buildCodigoEstelarSuffix('tutors');
    const { institutionId, adminToken } = await createInstitutionWithPrincipalAdmin(suffix);

    const createSecondAdminRes = await request(app)
      .post('/api/admin/usuarios/admins')
      .set(authHeader(adminToken))
      .send({
        nombre: `Admin Auxiliar ${suffix}`,
        email: `aux.${suffix}@logickids.dev`,
      });

    expect(createSecondAdminRes.status).toBe(201);

    const auxiliarToken = await loginAs(
      `aux.${suffix}@logickids.dev`,
      createSecondAdminRes.body.data.contrasena_temporal
    );

    const createTutorRes = await request(app)
      .post('/api/admin/usuarios/tutores')
      .set(authHeader(auxiliarToken))
      .send({
        nombre: `Tutor Institucional ${suffix}`,
        email: `tutor.${suffix}@logickids.dev`,
      });

    expect(createTutorRes.status).toBe(201);
    expect(createTutorRes.body.success).toBe(true);
    expect(createTutorRes.body.data.rol).toBe('tutor');
    expect(createTutorRes.body.data.estado).toBe('activo');
    expect(createTutorRes.body.data.es_admin_principal).toBe(false);
    expect(createTutorRes.body.data.institucion_id).toBe(institutionId);
    expect(createTutorRes.body.data.contrasena_temporal).toEqual(expect.any(String));

    const tutorToken = await loginAs(
      `tutor.${suffix}@logickids.dev`,
      createTutorRes.body.data.contrasena_temporal
    );

    expect(typeof tutorToken).toBe('string');
  });

  it('✅ el superadmin puede crear un tutor institucional indicando la institución destino', async () => {
    const suffix = buildCodigoEstelarSuffix('super-tutor');
    const { superToken, institutionId } = await createInstitutionWithPrincipalAdmin(suffix);

    const createTutorRes = await request(app)
      .post('/api/admin/usuarios/tutores')
      .set(authHeader(superToken))
      .send({
        nombre: `Tutor Global ${suffix}`,
        email: `global.${suffix}@logickids.dev`,
        institucion_id: institutionId,
      });

    expect(createTutorRes.status).toBe(201);
    expect(createTutorRes.body.success).toBe(true);
    expect(createTutorRes.body.data.rol).toBe('tutor');
    expect(createTutorRes.body.data.institucion_id).toBe(institutionId);
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
      .send({
        sesion_activa: true,
        modo: 'single',
        minijuego_id: codigoEstelarId,
        niveles: 1,
      });

    expect(adminOpenRes.status).toBe(403);

    const tutorOpenRes = await request(app)
      .patch(`/api/grupos/${fixture.groupId}/sesion`)
      .set(authHeader(fixture.tutorToken))
      .send({
        sesion_activa: true,
        modo: 'single',
        minijuego_id: codigoEstelarId,
        niveles: 1,
      });

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

    const studentProfileRes = await request(app)
      .get('/api/estudiantes/mi-perfil')
      .set(authHeader(fixture.studentToken));

    expect(studentProfileRes.status).toBe(200);
    expect(studentProfileRes.body.data.grupo_id).toBe(secondGroupId);
    expect(studentProfileRes.body.data.sesion_activa).toBe(false);

    const participacionesActivas = await db('sesion_clase_participantes')
      .where({ estudiante_id: fixture.studentId })
      .whereIn('estado', ['pendiente', 'en_progreso']);

    expect(participacionesActivas).toHaveLength(0);

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

  it('✅ impide más de un grupo activo simultáneo para el mismo estudiante', async () => {
    const fixture = await provisionPlayableStudent({
      suffix: buildCodigoEstelarSuffix('single-active-group'),
      openClass: false,
    });

    const createSecondGroupRes = await request(app)
      .post('/api/grupos')
      .set(authHeader(fixture.adminToken))
      .send({
        nombre: `Grupo exclusivo ${Date.now()}`,
        descripcion: 'Grupo para validar la restricción de historial activo',
      });

    expect(createSecondGroupRes.status).toBe(201);
    const secondGroupId = createSecondGroupRes.body.data.id;

    await expect(
      db('estudiante_grupo_historial').insert({
        estudiante_id: fixture.studentId,
        grupo_id: secondGroupId,
        fecha_inicio: new Date(),
        activo: true,
      })
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('✅ archivar y restaurar un grupo cambia su estado de vida y evita transiciones inválidas', async () => {
    const fixture = await provisionPlayableStudent({
      suffix: buildCodigoEstelarSuffix('archive-restore-group'),
      openClass: false,
    });

    const archiveRes = await request(app)
      .patch(`/api/grupos/${fixture.groupId}/archivar`)
      .set(authHeader(fixture.adminToken));

    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.success).toBe(true);
    expect(archiveRes.body.data.activo).toBe(false);

    const secondArchiveRes = await request(app)
      .patch(`/api/grupos/${fixture.groupId}/archivar`)
      .set(authHeader(fixture.adminToken));

    expect(secondArchiveRes.status).toBe(409);
    expect(secondArchiveRes.body.success).toBe(false);

    const restoreRes = await request(app)
      .patch(`/api/grupos/${fixture.groupId}/restaurar`)
      .set(authHeader(fixture.adminToken));

    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.success).toBe(true);
    expect(restoreRes.body.data.activo).toBe(true);

    const secondRestoreRes = await request(app)
      .patch(`/api/grupos/${fixture.groupId}/restaurar`)
      .set(authHeader(fixture.adminToken));

    expect(secondRestoreRes.status).toBe(409);
    expect(secondRestoreRes.body.success).toBe(false);
  });

  it('✅ desactivar y reactivar un estudiante respeta su ciclo de vida y bloquea transiciones inválidas', async () => {
    const fixture = await provisionPlayableStudent({
      suffix: buildCodigoEstelarSuffix('student-lifecycle'),
      openClass: false,
    });

    const deactivateRes = await request(app)
      .delete(`/api/estudiantes/${fixture.studentId}`)
      .set(authHeader(fixture.adminToken));

    expect(deactivateRes.status).toBe(204);

    const secondDeactivateRes = await request(app)
      .delete(`/api/estudiantes/${fixture.studentId}`)
      .set(authHeader(fixture.adminToken));

    expect(secondDeactivateRes.status).toBe(409);
    expect(secondDeactivateRes.body.success).toBe(false);

    const reactivateRes = await request(app)
      .patch(`/api/estudiantes/${fixture.studentId}/reactivar`)
      .set(authHeader(fixture.adminToken));

    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.success).toBe(true);
    expect(reactivateRes.body.message).toBe('Estudiante reactivado correctamente');

    const secondReactivateRes = await request(app)
      .patch(`/api/estudiantes/${fixture.studentId}/reactivar`)
      .set(authHeader(fixture.adminToken));

    expect(secondReactivateRes.status).toBe(409);
    expect(secondReactivateRes.body.success).toBe(false);
  });

  it('✅ el admin no puede cambiar su propio estado administrativo y un admin auxiliar no puede suspender a otro admin', async () => {
    const suffix = buildCodigoEstelarSuffix('admin-state-rules');
    const { adminToken } = await createInstitutionWithPrincipalAdmin(suffix);

    const createSecondAdminRes = await request(app)
      .post('/api/admin/usuarios/admins')
      .set(authHeader(adminToken))
      .send({
        nombre: `Admin Auxiliar ${suffix}`,
        email: `aux.state.${suffix}@logickids.dev`,
      });

    expect(createSecondAdminRes.status).toBe(201);
    const auxiliarId = createSecondAdminRes.body.data.id;
    const auxiliarPassword = createSecondAdminRes.body.data.contrasena_temporal;

    const adminSelfStateRes = await request(app)
      .get('/api/admin/usuarios?rol=admin')
      .set(authHeader(adminToken));

    expect(adminSelfStateRes.status).toBe(200);
    const principalAdmin = adminSelfStateRes.body.data.find((user) => user.es_admin_principal === true);
    expect(principalAdmin).toBeTruthy();

    const selfSuspendRes = await request(app)
      .patch(`/api/admin/usuarios/${principalAdmin.id}/estado`)
      .set(authHeader(adminToken))
      .send({ estado: 'suspendido' });

    expect(selfSuspendRes.status).toBe(403);
    expect(selfSuspendRes.body.success).toBe(false);

    const auxiliarToken = await loginAs(
      `aux.state.${suffix}@logickids.dev`,
      auxiliarPassword
    );

    const suspendPrincipalRes = await request(app)
      .patch(`/api/admin/usuarios/${principalAdmin.id}/estado`)
      .set(authHeader(auxiliarToken))
      .send({ estado: 'suspendido' });

    expect(suspendPrincipalRes.status).toBe(403);
    expect(suspendPrincipalRes.body.success).toBe(false);

    const suspendAuxiliarRes = await request(app)
      .patch(`/api/admin/usuarios/${auxiliarId}/estado`)
      .set(authHeader(adminToken))
      .send({ estado: 'suspendido' });

    expect(suspendAuxiliarRes.status).toBe(200);
    expect(suspendAuxiliarRes.body.success).toBe(true);
    expect(suspendAuxiliarRes.body.data.estado).toBe('suspendido');
  });

  it('✅ suspender y reactivar un tutor cambia su acceso real a la plataforma', async () => {
    const suffix = buildCodigoEstelarSuffix('tutor-state-cycle');
    const { adminToken } = await createInstitutionWithPrincipalAdmin(suffix);

    const tutorEmail = `tutor.state.${suffix}@logickids.dev`;
    const createTutorRes = await request(app)
      .post('/api/admin/usuarios/tutores')
      .set(authHeader(adminToken))
      .send({
        nombre: `Tutor Estado ${suffix}`,
        email: tutorEmail,
      });

    expect(createTutorRes.status).toBe(201);
    const tutorId = createTutorRes.body.data.id;
    const tutorPassword = createTutorRes.body.data.contrasena_temporal;

    const firstLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: tutorEmail, contrasena: tutorPassword });

    expect(firstLogin.status).toBe(200);
    expect(firstLogin.body.success).toBe(true);

    const suspendRes = await request(app)
      .patch(`/api/admin/usuarios/${tutorId}/estado`)
      .set(authHeader(adminToken))
      .send({ estado: 'suspendido' });

    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.success).toBe(true);
    expect(suspendRes.body.data.estado).toBe('suspendido');

    const blockedLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: tutorEmail, contrasena: tutorPassword });

    expect(blockedLogin.status).toBe(403);
    expect(blockedLogin.body.success).toBe(false);
    expect(blockedLogin.body.estado).toBe('suspendido');

    const reactivateRes = await request(app)
      .patch(`/api/admin/usuarios/${tutorId}/estado`)
      .set(authHeader(adminToken))
      .send({ estado: 'activo' });

    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.success).toBe(true);
    expect(reactivateRes.body.data.estado).toBe('activo');

    const restoredLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: tutorEmail, contrasena: tutorPassword });

    expect(restoredLogin.status).toBe(200);
    expect(restoredLogin.body.success).toBe(true);
  });

  it('✅ no permite asignar a un grupo un tutor suspendido', async () => {
    const suffix = buildCodigoEstelarSuffix('suspended-tutor-group');
    const { adminToken } = await createInstitutionWithPrincipalAdmin(suffix);

    const tutorEmail = `tutor.blocked.${suffix}@logickids.dev`;
    const createTutorRes = await request(app)
      .post('/api/admin/usuarios/tutores')
      .set(authHeader(adminToken))
      .send({
        nombre: `Tutor Bloqueado ${suffix}`,
        email: tutorEmail,
      });

    expect(createTutorRes.status).toBe(201);
    const tutorId = createTutorRes.body.data.id;

    const suspendRes = await request(app)
      .patch(`/api/admin/usuarios/${tutorId}/estado`)
      .set(authHeader(adminToken))
      .send({ estado: 'suspendido' });

    expect(suspendRes.status).toBe(200);

    const createGroupRes = await request(app)
      .post('/api/grupos')
      .set(authHeader(adminToken))
      .send({
        nombre: `Grupo sin tutor ${suffix}`,
        descripcion: 'Grupo para validar tutor suspendido',
      });

    expect(createGroupRes.status).toBe(201);
    const groupId = createGroupRes.body.data.id;

    const assignRes = await request(app)
      .patch(`/api/grupos/${groupId}/tutor`)
      .set(authHeader(adminToken))
      .send({ tutor_id: tutorId });

    expect(assignRes.status).toBe(409);
    expect(assignRes.body.success).toBe(false);
  });
});
