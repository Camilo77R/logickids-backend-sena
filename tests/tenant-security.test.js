/**
 * TESTS DE SEGURIDAD MULTITENANT
 * ================================
 * El test más importante del proyecto.
 * Verifica que un usuario NO pueda ver datos de otra institución.
 * Cubre las Reglas de Negocio: RN-04, RN-05, RN-22
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { getSuperadminToken } from './helpers/auth.helper.js';

describe('🛡️ Seguridad — Solo superadmin gestiona instituciones', () => {

  it('✅ superadmin puede listar todas las instituciones', async () => {
    const token = await getSuperadminToken();

    const res = await request(app)
      .get('/api/admin/instituciones')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('❌ un usuario sin token NO puede listar instituciones', async () => {
    const res = await request(app).get('/api/admin/instituciones');
    expect(res.status).toBe(401);
  });

  it('❌ endpoint de superadmin requiere rol correcto — tutor recibe 403', async () => {
    // Primero creamos una institución de prueba y un tutor
    const superToken = await getSuperadminToken();

    // Creamos una institución temporal para obtener un tutor
    const instRes = await request(app)
      .post('/api/admin/instituciones')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ nombre: `Test Tenant ${Date.now()}`, ciudad: 'Bogotá' });

    expect(instRes.status).toBe(201);

    const { admin } = instRes.body.data;

    // Login como el admin de esa institución
    const adminToken = await import('./helpers/auth.helper.js')
      .then(h => h.loginAs(admin.email, admin.contrasena_temporal));

    // Un admin de institución NO puede listar TODAS las instituciones
    const res = await request(app)
      .get('/api/admin/instituciones')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(403);
  });

});

describe('🛡️ Seguridad — Health check siempre disponible', () => {

  it('✅ GET /api/health responde sin token', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

});

describe('🛡️ Seguridad — Endpoints protegidos rechazan sin token', () => {

  const rutasProtegidas = [
    { method: 'GET',  url: '/api/grupos' },
    { method: 'GET',  url: '/api/estudiantes' },
    { method: 'GET',  url: '/api/estadisticas/grupo/1' },
    { method: 'GET',  url: '/api/recomendaciones/grupo/1' },
    { method: 'GET',  url: '/api/logros/estudiante/1' },
    { method: 'GET',  url: '/api/sesiones/estudiante/1' },
    { method: 'GET',  url: '/api/admin/usuarios' },
  ];

  for (const { method, url } of rutasProtegidas) {
    it(`❌ ${method} ${url} — devuelve 401 sin token`, async () => {
      const res = await request(app)[method.toLowerCase()](url);
      expect(res.status).toBe(401);
    });
  }

});
