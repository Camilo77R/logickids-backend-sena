/**
 * TESTS DE CICLO DE VIDA
 * ======================
 * Estos tests explican con hechos la nueva regla de negocio:
 * ya no "borramos" instituciones; ahora las desactivamos y reactivamos.
 *
 * La idea para novatos es simple:
 * - activa  = puede operar
 * - inactiva = conserva historia, pero no puede usar la plataforma
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { getSuperadminToken, loginAs } from './helpers/auth.helper.js';

const buildInstitutionPayload = (suffix) => ({
  nombre: `Tenant Lifecycle ${suffix}`,
  ciudad: 'Bogotá',
  direccion: 'Calle de pruebas 123',
});

describe('🔄 Ciclo de vida — instituciones activas e inactivas', () => {
  it('✅ una institución desactivada desaparece del registro público y vuelve al reactivarse', async () => {
    const superToken = await getSuperadminToken();
    const payload = buildInstitutionPayload(Date.now());

    const createRes = await request(app)
      .post('/api/admin/instituciones')
      .set('Authorization', `Bearer ${superToken}`)
      .send(payload);

    expect(createRes.status).toBe(201);
    const institutionId = createRes.body.data.institucion.id;

    const publicBefore = await request(app).get('/api/auth/instituciones');
    expect(publicBefore.status).toBe(200);
    expect(publicBefore.body.data.some((inst) => inst.id_institucion === institutionId)).toBe(true);

    const deactivateRes = await request(app)
      .patch(`/api/admin/instituciones/${institutionId}/desactivar`)
      .set('Authorization', `Bearer ${superToken}`);

    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.data.activo).toBe(false);

    const publicAfterDeactivate = await request(app).get('/api/auth/instituciones');
    expect(publicAfterDeactivate.status).toBe(200);
    expect(publicAfterDeactivate.body.data.some((inst) => inst.id_institucion === institutionId)).toBe(false);

    const disabledList = await request(app)
      .get('/api/admin/instituciones?estado=desactivadas')
      .set('Authorization', `Bearer ${superToken}`);

    expect(disabledList.status).toBe(200);
    expect(disabledList.body.data.some((inst) => inst.id === institutionId)).toBe(true);

    const activeList = await request(app)
      .get('/api/admin/instituciones?estado=activas')
      .set('Authorization', `Bearer ${superToken}`);

    expect(activeList.status).toBe(200);
    expect(activeList.body.data.some((inst) => inst.id === institutionId)).toBe(false);

    const reactivateRes = await request(app)
      .patch(`/api/admin/instituciones/${institutionId}/reactivar`)
      .set('Authorization', `Bearer ${superToken}`);

    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.data.activo).toBe(true);

    const publicAfterReactivate = await request(app).get('/api/auth/instituciones');
    expect(publicAfterReactivate.status).toBe(200);
    expect(publicAfterReactivate.body.data.some((inst) => inst.id_institucion === institutionId)).toBe(true);

    const activeListAfterReactivate = await request(app)
      .get('/api/admin/instituciones?estado=activas')
      .set('Authorization', `Bearer ${superToken}`);

    expect(activeListAfterReactivate.status).toBe(200);
    expect(activeListAfterReactivate.body.data.some((inst) => inst.id === institutionId)).toBe(true);
  });

  it('✅ si una institución se desactiva, el token viejo del admin deja de servir y el login se bloquea', async () => {
    const superToken = await getSuperadminToken();
    const payload = buildInstitutionPayload(`admin-${Date.now()}`);

    const createRes = await request(app)
      .post('/api/admin/instituciones')
      .set('Authorization', `Bearer ${superToken}`)
      .send(payload);

    expect(createRes.status).toBe(201);

    const institutionId = createRes.body.data.institucion.id;
    const { email, contrasena_temporal } = createRes.body.data.admin;

    const adminToken = await loginAs(email, contrasena_temporal);

    const activeAccess = await request(app)
      .get('/api/admin/usuarios')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(activeAccess.status).toBe(200);

    const deactivateRes = await request(app)
      .patch(`/api/admin/instituciones/${institutionId}/desactivar`)
      .set('Authorization', `Bearer ${superToken}`);

    expect(deactivateRes.status).toBe(200);

    const oldTokenAccess = await request(app)
      .get('/api/admin/usuarios')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(oldTokenAccess.status).toBe(403);
    expect(oldTokenAccess.body.success).toBe(false);

    const blockedLogin = await request(app)
      .post('/api/auth/login')
      .send({ email, contrasena: contrasena_temporal });

    expect(blockedLogin.status).toBe(403);

    const reactivateRes = await request(app)
      .patch(`/api/admin/instituciones/${institutionId}/reactivar`)
      .set('Authorization', `Bearer ${superToken}`);

    expect(reactivateRes.status).toBe(200);

    const restoredLogin = await request(app)
      .post('/api/auth/login')
      .send({ email, contrasena: contrasena_temporal });

    expect(restoredLogin.status).toBe(200);
    expect(restoredLogin.body.success).toBe(true);
  });
});
