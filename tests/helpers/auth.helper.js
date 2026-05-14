/**
 * HELPER DE AUTENTICACIÓN PARA TESTS
 * -----------------------------------
 * Centraliza el login para que todos los tests
 * puedan obtener un token sin repetir código.
 */
import request from 'supertest';
import app from '../../src/app.js';

/**
 * Hace login y devuelve el token JWT.
 * @param {string} email
 * @param {string} contrasena
 * @returns {Promise<string>} Token JWT listo para usar en headers
 */
export const loginAs = async (email, contrasena) => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, contrasena });

  if (!res.body?.data?.token) {
    throw new Error(`Login fallido para ${email}: ${JSON.stringify(res.body)}`);
  }

  return res.body.data.token;
};

/** Token del superadmin (disponible en el seed) */
export const getSuperadminToken = () =>
  loginAs('superadmin@logickids.dev', 'SuperAdmin2025!');
