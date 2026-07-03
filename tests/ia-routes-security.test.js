import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Seguridad de endpoints heredados de IA', () => {
  it.each([
    '/api/ia/recomendaciones/test',
    '/api/ia/recomendaciones/test-desde-archivo',
    '/api/ia/recomendaciones/generar',
  ])('no expone el endpoint heredado POST %s', async (url) => {
    const response = await request(app).post(url).send({});

    expect(response.status).toBe(404);
  });
});
