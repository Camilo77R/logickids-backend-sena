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
vi.mock('../../../src/config/env.js', () => ({ env: { GEMINI_API_KEY: 'test-key' } }));
global.fetch = vi.fn();

beforeEach(() => { Object.keys(builders).forEach((k) => delete builders[k]); vi.clearAllMocks(); });

const recom = await import('../../../src/services/recomendaciones.service.js');
const user = { rol: 'tutor', id: 1, institucion_id: 1 };

describe('generarParaEstudiante', () => {
  it('lanza error si estudiante no existe', async () => {
    builders['estudiantes'] = createMockQueryBuilder();
    builders['estudiantes'].first.mockResolvedValueOnce(null);
    await expect(recom.generarParaEstudiante(1, user))
      .rejects.toThrow('no encontrado');
  });
});

describe('generarParaGrupo', () => {
  it('lanza error si grupo no existe', async () => {
    builders['grupos'] = createMockQueryBuilder();
    builders['grupos'].first.mockResolvedValueOnce(null);
    await expect(recom.generarParaGrupo(1, user))
      .rejects.toThrow('no encontrado');
  });
});

describe('listarEstudiante', () => {
  it('lanza error si estudiante no existe', async () => {
    builders['estudiantes'] = createMockQueryBuilder();
    builders['estudiantes'].first.mockResolvedValueOnce(null);
    await expect(recom.listarEstudiante(1, user))
      .rejects.toThrow('no encontrado');
  });
});

describe('listarGrupo', () => {
  it('lanza error si grupo no existe', async () => {
    builders['grupos'] = createMockQueryBuilder();
    builders['grupos'].first.mockResolvedValueOnce(null);
    await expect(recom.listarGrupo(1, user))
      .rejects.toThrow('no encontrado');
  });
});