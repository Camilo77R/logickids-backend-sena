import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockQueryBuilder } from '../setup.js';

const { fnMockKnexDb, fnBuilders } = vi.hoisted(() => {
  const builders = {};
  function mockKnexDb(table) {
    if (!builders[table]) builders[table] = createMockQueryBuilder();
    return builders[table];
  }
  mockKnexDb.raw = vi.fn((v) => ({ toRaw: () => v }));
  mockKnexDb.fn = { now: vi.fn(() => 'NOW()') };
  mockKnexDb.client = { config: { client: 'pg' } };
  return { fnBuilders: builders, fnMockKnexDb: mockKnexDb };
});

vi.mock('../../../src/config/db.js', () => ({ db: fnMockKnexDb }));

beforeEach(() => { Object.keys(fnBuilders).forEach((k) => delete fnBuilders[k]); vi.clearAllMocks(); });

const { executeIdempotent } = await import('../../../src/services/student-idempotency.service.js');

describe('executeIdempotent', () => {
  it('ejecuta handler si no hay key', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const result = await executeIdempotent(
      { estudianteId: 1, operacion: 'test', key: null, payload: {}, executor: fnMockKnexDb },
      handler,
    );
    expect(result).toEqual({ replayed: false, value: { ok: true } });
    expect(handler).toHaveBeenCalled();
  });

  it('detecta conflicto de hash', async () => {
    fnBuilders['student_idempotency_keys'] = createMockQueryBuilder();
    fnBuilders['student_idempotency_keys'].returning.mockResolvedValueOnce([]);
    fnBuilders['student_idempotency_keys'].first.mockResolvedValueOnce({
      id_student_idempotency_key: 1,
      request_hash: 'hash-diferente',
      response_json: null,
    });
    const handler = vi.fn().mockResolvedValue({ ok: true });
    await expect(executeIdempotent(
      { estudianteId: 1, operacion: 'test', key: 'k1', payload: { x: 1 }, executor: fnMockKnexDb },
      handler,
    )).rejects.toThrow('clave idempotente');
  });
});