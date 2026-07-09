import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockQueryBuilder } from '../setup.js';

const { builders, mockKnexDb } = vi.hoisted(() => {
  const builders = {};
  function mockKnexDb(table) {
    if (!builders[table]) builders[table] = createMockQueryBuilder();
    return builders[table];
  }
  mockKnexDb.raw = vi.fn((v) => ({ toRaw: () => v }));
  mockKnexDb.fn = { now: () => 'NOW()' };
  mockKnexDb.client = { config: { client: 'pg' } };
  return { builders, mockKnexDb };
});

vi.mock('../../../src/config/db.js', () => ({ db: mockKnexDb }));
vi.mock('bcrypt', () => ({ default: { hash: vi.fn(() => 'hashed'), compare: vi.fn() }, hash: vi.fn(() => 'hashed'), compare: vi.fn(() => true) }));
vi.mock('jsonwebtoken', () => ({ default: { sign: vi.fn(() => 'token'), verify: vi.fn() }, sign: vi.fn(() => 'token'), verify: vi.fn() }));
vi.mock('../../../src/config/env.js', () => ({ env: { JWT_SECRET: 'test', JWT_EXPIRES_IN: '1h' } }));

beforeEach(() => { Object.keys(builders).forEach((k) => delete builders[k]); vi.clearAllMocks(); });

const auth = await import('../../../src/services/auth.service.js');

describe('auth.service — listarInstitucionesPublicas', () => {
  it('retorna query builder', () => {
    expect(auth.listarInstitucionesPublicas().then).toBeDefined();
  });
});

describe('auth.service — registrar', () => {
  it('rechaza si el email ya existe', async () => {
    builders['usuarios'] = createMockQueryBuilder();
    builders['usuarios'].first.mockResolvedValueOnce({ id_usuario: 1 });
    await expect(auth.registrar({ nombre: 'Test', email: 'dup@test.com', contrasena: '123456', institucion_id: 1 }))
      .rejects.toThrow('El email ya está registrado');
  });

  it('rechaza si institución no existe', async () => {
    builders['usuarios'] = createMockQueryBuilder();
    builders['usuarios'].first.mockResolvedValueOnce(null);
    builders['instituciones'] = createMockQueryBuilder();
    builders['instituciones'].first.mockResolvedValueOnce(null);
    await expect(auth.registrar({ nombre: 'Test', email: 't@t.com', contrasena: '123456', institucion_id: 99 }))
      .rejects.toThrow('no existe');
  });
});

describe('auth.service — login', () => {
  it('rechaza credenciales inválidas (usuario no existe)', async () => {
    await expect(auth.login({ email: 'no@existe.com', contrasena: 'x' }))
      .rejects.toThrow('Credenciales incorrectas');
  });
});