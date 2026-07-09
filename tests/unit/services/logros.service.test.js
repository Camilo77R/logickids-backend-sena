import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockQueryBuilder } from '../setup.js';

const { builders, mockKnexDb } = vi.hoisted(() => {
  const builders = {};
  function mockKnexDb(table) {
    if (!builders[table]) builders[table] = createMockQueryBuilder();
    return builders[table];
  }
  mockKnexDb.raw = vi.fn((v) => ({ toRaw: () => v }));
  mockKnexDb.fn = { now: vi.fn(() => 'NOW()') };
  mockKnexDb.client = { config: { client: 'pg' } };
  return { builders, mockKnexDb };
});

vi.mock('../../../src/config/db.js', () => ({ db: mockKnexDb }));

beforeEach(() => { Object.keys(builders).forEach((k) => delete builders[k]); vi.clearAllMocks(); });

const logros = await import('../../../src/services/logros.service.js');

describe('listarCatalogo', () => {
  it('retorna catalogo', () => {
    expect(logros.listarCatalogo().then).toBeDefined();
  });
});

describe('desbloquearSiDisponible', () => {
  it('no lanza error si logro no existe', async () => {
    await expect(logros.desbloquearSiDisponible(1, 'no_existe', mockKnexDb))
      .resolves.toBeDefined();
  });
});