/**
 * TESTS DE SEGURIDAD MULTITENANT
 * ==============================
 * El test mas importante del proyecto.
 * Verifica que un usuario NO pueda ver datos de otra institucion.
 * Cubre las Reglas de Negocio: RN-04, RN-05, RN-22
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { getSuperadminToken } from './helpers/auth.helper.js';
import {
  authHeader,
  provisionPlayableStudent,
  resolveCodigoEstelarId,
  startCodigoEstelarSession,
} from './helpers/codigoEstelar.helper.js';
import {
  buildTestInstitutionName,
  registerTestInstitution,
} from './helpers/testFixtures.helper.js';

describe('Seguridad - Solo superadmin gestiona instituciones', () => {
  it('superadmin puede listar todas las instituciones', async () => {
    const token = await getSuperadminToken();

    const res = await request(app)
      .get('/api/admin/instituciones')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('superadmin puede buscar instituciones por texto', async () => {
    const token = await getSuperadminToken();

    const res = await request(app)
      .get('/api/admin/instituciones?search=colegio')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(
      res.body.data.every(
        (inst) =>
          /colegio/i.test(inst.nombre) ||
          /colegio/i.test(inst.institucion_ciudad || inst.ciudad) ||
          /colegio/i.test(inst.direccion || '') ||
          /colegio/i.test(inst.telefono || '')
      )
    ).toBe(true);
  });

  it('rechaza listar instituciones sin token', async () => {
    const res = await request(app).get('/api/admin/instituciones');
    expect(res.status).toBe(401);
  });

  it('endpoint de superadmin requiere rol correcto y un admin recibe 403', async () => {
    const superToken = await getSuperadminToken();

    const instRes = await request(app)
      .post('/api/admin/instituciones')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ nombre: buildTestInstitutionName(`Test Tenant ${Date.now()}`), ciudad: 'Bogota' });

    expect(instRes.status).toBe(201);
    registerTestInstitution(instRes.body.data.institucion.id);

    const { admin } = instRes.body.data;

    const adminToken = await import('./helpers/auth.helper.js').then((h) =>
      h.loginAs(admin.email, admin.contrasena_temporal)
    );

    const res = await request(app)
      .get('/api/admin/instituciones')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(403);
  });
});

describe('Seguridad - Health check siempre disponible', () => {
  it('GET /api/health responde sin token', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  it('GET /api/logros/catalogo sigue siendo publico', async () => {
    const res = await request(app).get('/api/logros/catalogo');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/logros/catalogo?estudiante_id=1 ya no expone progreso sin sesion', async () => {
    const res = await request(app).get('/api/logros/catalogo?estudiante_id=1');
    expect(res.status).toBe(401);
  });
});

describe('Seguridad - Aislamiento multitenant real', () => {
  it('un admin institucional no puede obtener el QR de un estudiante de otra institucion', async () => {
    const tenantA = await provisionPlayableStudent({ openClass: false });
    const tenantB = await provisionPlayableStudent({ openClass: false });

    const res = await request(app)
      .get(`/api/estudiantes/${tenantB.studentId}/qr`)
      .set(authHeader(tenantA.adminToken));

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('un admin institucional no puede consultar el detalle de un estudiante de otra institucion', async () => {
    const tenantA = await provisionPlayableStudent({ openClass: false });
    const tenantB = await provisionPlayableStudent({ openClass: false });

    const res = await request(app)
      .get(`/api/estudiantes/${tenantB.studentId}`)
      .set(authHeader(tenantA.adminToken));

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('un tutor no puede consultar un grupo asignado a otra institucion', async () => {
    const tenantA = await provisionPlayableStudent({ openClass: false });
    const tenantB = await provisionPlayableStudent({ openClass: false });

    const res = await request(app)
      .get(`/api/grupos/${tenantB.groupId}`)
      .set(authHeader(tenantA.tutorToken));

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('un tutor no puede consultar el historial de sesiones de un estudiante fuera de su alcance', async () => {
    const tenantA = await provisionPlayableStudent({ openClass: false });
    const tenantB = await provisionPlayableStudent({ openClass: true });
    const codigoEstelarId = await resolveCodigoEstelarId();

    const inicioRes = await startCodigoEstelarSession({
      studentToken: tenantB.studentToken,
      minijuegoId: codigoEstelarId,
      dificultad: 2,
    });

    expect(inicioRes.status).toBe(201);

    const res = await request(app)
      .get(`/api/sesiones/estudiante/${tenantB.studentId}`)
      .set(authHeader(tenantA.tutorToken));

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('un tutor no puede consultar los eventos de una sesion que pertenece a otra institucion', async () => {
    const tenantA = await provisionPlayableStudent({ openClass: false });
    const tenantB = await provisionPlayableStudent({ openClass: true });
    const codigoEstelarId = await resolveCodigoEstelarId();

    const inicioRes = await startCodigoEstelarSession({
      studentToken: tenantB.studentToken,
      minijuegoId: codigoEstelarId,
      dificultad: 2,
    });

    expect(inicioRes.status).toBe(201);
    const sesionId = inicioRes.body.data.sesion.id;

    const res = await request(app)
      .get(`/api/sesiones/${sesionId}/eventos`)
      .set(authHeader(tenantA.tutorToken));

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('un admin institucional no puede reasignar tutor en un grupo de otra institucion', async () => {
    const tenantA = await provisionPlayableStudent({ openClass: false });
    const tenantB = await provisionPlayableStudent({ openClass: false });

    const res = await request(app)
      .patch(`/api/grupos/${tenantB.groupId}/tutor`)
      .set(authHeader(tenantA.adminToken))
      .send({ tutor_id: tenantA.tutorId });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

describe('Seguridad - Endpoints protegidos rechazan sin token', () => {
  const rutasProtegidas = [
    { method: 'GET', url: '/api/grupos' },
    { method: 'GET', url: '/api/estudiantes' },
    { method: 'GET', url: '/api/estadisticas/grupo/1' },
    { method: 'GET', url: '/api/recomendaciones/grupo/1' },
    { method: 'GET', url: '/api/logros/estudiante/1' },
    { method: 'GET', url: '/api/sesiones/estudiante/1' },
    { method: 'GET', url: '/api/admin/usuarios' },
  ];

  for (const { method, url } of rutasProtegidas) {
    it(`${method} ${url} devuelve 401 sin token`, async () => {
      const res = await request(app)[method.toLowerCase()](url);
      expect(res.status).toBe(401);
    });
  }
});
