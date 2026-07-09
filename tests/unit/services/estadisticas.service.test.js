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

const estadisticas = await import('../../../src/services/estadisticas.service.js');
const user = { rol: 'tutor', id: 1, institucion_id: 1 };

describe('obtenerEstudiante', () => {
  it('lanza error si estudiante no existe', async () => {
    builders['estudiantes'] = createMockQueryBuilder();
    builders['estudiantes'].first.mockResolvedValueOnce(null);
    await expect(estadisticas.obtenerEstudiante(1, user))
      .rejects.toThrow('no encontrado');
  });
});

describe('listarStatsEstudiante', () => {
  it('retorna query builder', () => {
    const result = estadisticas.listarStatsEstudiante(1);
    expect(result.then).toBeDefined();
  });
});

describe('obtenerGrupo', () => {
  it('lanza error si grupo no existe', async () => {
    builders['grupos'] = createMockQueryBuilder();
    builders['grupos'].first.mockResolvedValueOnce(null);
    await expect(estadisticas.obtenerGrupo(1, user))
      .rejects.toThrow('no encontrado');
  });
});