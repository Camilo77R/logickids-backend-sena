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
vi.mock('axios', () => ({ default: { post: vi.fn() }, post: vi.fn() }));
vi.mock('node:fs/promises', () => ({ readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn(), access: vi.fn(), unlink: vi.fn() }));
vi.mock('../../../src/config/env.js', () => ({ env: { IA_SERVICE_URL: 'http://ia.test' } }));

beforeEach(() => { Object.keys(builders).forEach((k) => delete builders[k]); vi.clearAllMocks(); });

const ia = await import('../../../src/services/ia.service.js');

const mockRes = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

describe('generarRecomendacionesDesdeCSV', () => {
  it('retorna resultado de ia service', async () => {
    const axios = await import('axios');
    axios.default.post.mockResolvedValue({ data: { recomendaciones: ['rec1'] } });
    const result = await ia.generarRecomendacionesDesdeCSV(Buffer.from('a,b,c'), 'test.csv');
    expect(result).toEqual({ recomendaciones: ['rec1'] });
  });
});