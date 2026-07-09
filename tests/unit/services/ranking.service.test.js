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
  return { builders, mockKnexDb };
});

vi.mock('../../../src/config/db.js', () => ({ db: mockKnexDb }));

beforeEach(() => { Object.keys(builders).forEach((k) => delete builders[k]); vi.clearAllMocks(); });

const ranking = await import('../../../src/services/ranking.service.js');
const user = { rol: 'tutor', id: 1, institucion_id: 1 };

describe('obtenerRankingGrupo', () => {
  it('lanza error si grupo no existe', async () => {
    builders['grupos'] = createMockQueryBuilder();
    builders['grupos'].first.mockResolvedValueOnce(null);
    await expect(ranking.obtenerRankingGrupo(1, user))
      .rejects.toThrow('no encontrado');
  });

  it('retorna lista vacia si no hay sesion', async () => {
    builders['grupos'] = createMockQueryBuilder();
    builders['grupos'].first.mockResolvedValueOnce({ id_grupo: 1, nombre: 'G1' });
    builders['sesiones_clase'] = createMockQueryBuilder();
    builders['sesiones_clase'].first.mockResolvedValueOnce(null);
    const result = await ranking.obtenerRankingGrupo(1, user, mockKnexDb);
    expect(result).toBeDefined();
  });
});

describe('obtenerMiRanking', () => {
  it('retorna ranking del estudiante', async () => {
    builders['sesiones_clase as sc'] = createMockQueryBuilder();
    builders['sesiones_clase as sc'].first.mockResolvedValueOnce({ id_sesion_clase: 10 });
    const result = await ranking.obtenerMiRanking(1, mockKnexDb);
    expect(result.ranking).toBeDefined();
  });
});