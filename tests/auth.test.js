/**
 * TESTS DE AUTENTICACIÓN
 * ======================
 * Verifica que el sistema de login y registro funcione correctamente.
 * Cubre las Reglas de Negocio: RN-01, RN-02, RN-03
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { getSuperadminToken, loginAs } from './helpers/auth.helper.js';
import {
  buildTestInstitutionName,
  registerTestInstitution,
} from './helpers/testFixtures.helper.js';

const buildAuthSuffix = (label = 'auth') =>
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createInstitutionFixture = async (label = 'auth') => {
  const suffix = buildAuthSuffix(label);
  const superToken = await getSuperadminToken();

  const res = await request(app)
    .post('/api/admin/instituciones')
    .set('Authorization', `Bearer ${superToken}`)
    .send({
      nombre: buildTestInstitutionName(`Inst ${suffix}`),
      ciudad: 'Bogota',
      direccion: 'Calle 123',
    });

  if (res.status !== 201) {
    throw new Error(`No se pudo crear la institucion de prueba: ${JSON.stringify(res.body)}`);
  }

  const institutionId = res.body.data.institucion.id;
  registerTestInstitution(institutionId);

  return {
    institutionId,
    adminEmail: res.body.data.admin.email,
    adminPassword: res.body.data.admin.contrasena_temporal,
  };
};

describe('POST /api/auth/login', () => {

  it('✅ devuelve token al hacer login con credenciales correctas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'superadmin@logickids.dev', contrasena: 'SuperAdmin2025!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // El token debe existir y empezar con "eyJ" (formato JWT)
    expect(res.body.data.token).toMatch(/^eyJ/);
    // El rol debe ser superadmin
    expect(res.body.data.usuario.rol).toBe('superadmin');
  });

  it('❌ rechaza contraseña incorrecta con error 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'superadmin@logickids.dev', contrasena: 'CLAVE_INCORRECTA' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('❌ rechaza email que no existe con error 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'noexiste@test.com', contrasena: 'CualquierClave' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('❌ rechaza body vacío con error 400 (validación Zod)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

});

describe('GET /api/auth/perfil', () => {

  it('✅ devuelve el perfil del superadmin autenticado', async () => {
    const token = await getSuperadminToken();

    const res = await request(app)
      .get('/api/auth/perfil')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('superadmin@logickids.dev');
  });

  it('❌ rechaza petición sin token con error 401', async () => {
    const res = await request(app).get('/api/auth/perfil');

    expect(res.status).toBe(401);
  });

  it('❌ rechaza token falso o expirado con error 401', async () => {
    const res = await request(app)
      .get('/api/auth/perfil')
      .set('Authorization', 'Bearer token.falso.aqui');

    expect(res.status).toBe(401);
  });

});

describe('PUT /api/auth/perfil', () => {
  it('✅ actualiza el nombre del usuario autenticado', async () => {
    const fixture = await createInstitutionFixture('perfil');
    const token = await loginAs(fixture.adminEmail, fixture.adminPassword);

    const res = await request(app)
      .put('/api/auth/perfil')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Admin Renombrado QA' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nombre).toBe('Admin Renombrado QA');
    expect(res.body.data.email).toBe(fixture.adminEmail);
  });

  it('❌ rechaza actualizar el perfil con body vacío', async () => {
    const fixture = await createInstitutionFixture('perfil-empty');
    const token = await loginAs(fixture.adminEmail, fixture.adminPassword);

    const res = await request(app)
      .put('/api/auth/perfil')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('PUT /api/auth/cambiar-contrasena', () => {
  it('✅ cambia la contraseña y permite iniciar sesión con la nueva credencial', async () => {
    const fixture = await createInstitutionFixture('password');
    const token = await loginAs(fixture.adminEmail, fixture.adminPassword);
    const nuevaContrasena = 'AdminNueva123!';

    const changeRes = await request(app)
      .put('/api/auth/cambiar-contrasena')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contrasena_actual: fixture.adminPassword,
        contrasena_nueva: nuevaContrasena,
      });

    expect(changeRes.status).toBe(200);
    expect(changeRes.body.success).toBe(true);
    expect(changeRes.body.data.actualizada).toBe(true);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: fixture.adminEmail,
        contrasena: nuevaContrasena,
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.token).toMatch(/^eyJ/);
  });

  it('❌ rechaza el cambio si la contraseña actual es incorrecta', async () => {
    const fixture = await createInstitutionFixture('password-invalid');
    const token = await loginAs(fixture.adminEmail, fixture.adminPassword);

    const res = await request(app)
      .put('/api/auth/cambiar-contrasena')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contrasena_actual: 'incorrecta-total',
        contrasena_nueva: 'AdminNueva123!',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/auth/instituciones', () => {

  it('✅ devuelve lista de instituciones sin necesitar token', async () => {
    const res = await request(app).get('/api/auth/instituciones');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

});

describe('POST /api/auth/registro', () => {
  it('❌ rechaza registrar un email ya existente', async () => {
    const fixture = await createInstitutionFixture('registro-duplicado');

    const firstRes = await request(app)
      .post('/api/auth/registro')
      .send({
        nombre: 'Tutor Duplicado',
        email: `tutor.duplicado.${Date.now()}@logickids.dev`,
        contrasena: 'Tutor12345!',
        institucion_id: fixture.institutionId,
      });

    expect(firstRes.status).toBe(201);
    expect(firstRes.body.success).toBe(true);

    const secondRes = await request(app)
      .post('/api/auth/registro')
      .send({
        nombre: 'Tutor Duplicado 2',
        email: firstRes.body.data.email,
        contrasena: 'Tutor12345!',
        institucion_id: fixture.institutionId,
      });

    expect(secondRes.status).toBe(409);
    expect(secondRes.body.success).toBe(false);
  });

  it('❌ bloquea el registro si la institución fue desactivada', async () => {
    const fixture = await createInstitutionFixture('registro-inactivo');
    const superToken = await getSuperadminToken();

    const disableRes = await request(app)
      .patch(`/api/admin/instituciones/${fixture.institutionId}/desactivar`)
      .set('Authorization', `Bearer ${superToken}`);

    expect(disableRes.status).toBe(200);

    const registroRes = await request(app)
      .post('/api/auth/registro')
      .send({
        nombre: 'Tutor Bloqueado',
        email: `tutor.bloqueado.${Date.now()}@logickids.dev`,
        contrasena: 'Tutor12345!',
        institucion_id: fixture.institutionId,
      });

    expect(registroRes.status).toBe(409);
    expect(registroRes.body.success).toBe(false);
  });
});

describe('Validaciones de auth', () => {
  it('❌ rechaza cambiar contraseña si la nueva clave no cumple longitud mínima', async () => {
    const fixture = await createInstitutionFixture('password-short');
    const token = await loginAs(fixture.adminEmail, fixture.adminPassword);

    const res = await request(app)
      .put('/api/auth/cambiar-contrasena')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contrasena_actual: fixture.adminPassword,
        contrasena_nueva: 'corta',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
