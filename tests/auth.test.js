/**
 * TESTS DE AUTENTICACIÓN
 * ======================
 * Verifica que el sistema de login y registro funcione correctamente.
 * Cubre las Reglas de Negocio: RN-01, RN-02, RN-03
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { getSuperadminToken } from './helpers/auth.helper.js';

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

describe('POST /api/auth/login-qr', () => {

  it('devuelve token de estudiante al hacer login con QR valido', async () => {
    const res = await request(app)
      .post('/api/auth/login-qr')
      .send({ qr_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test_qr_token' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toMatch(/^eyJ/);
    expect(res.body.data.estudiante.nombre).toBe('Ana García');
  });

  it('rechaza un QR invalido', async () => {
    const res = await request(app)
      .post('/api/auth/login-qr')
      .send({ qr_token: 'QR-NO-EXISTE' });

    expect(res.status).toBe(404);
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

describe('GET /api/auth/instituciones', () => {

  it('✅ devuelve lista de instituciones sin necesitar token', async () => {
    const res = await request(app).get('/api/auth/instituciones');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

});
