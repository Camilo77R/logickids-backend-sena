import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockQueryBuilder } from '../setup.js';

const { builders, mockKnexDb } = vi.hoisted(() => {
  const builders = {};
  function mockKnexDb(table) {
    if (!builders[table]) builders[table] = createMockQueryBuilder();
    return builders[table];
  }
  mockKnexDb.raw = vi.fn((v) => ({ toRaw: () => v }));
  mockKnexDb.client = { config: { client: 'pg' } };
  return { builders, mockKnexDb };
});

vi.mock('../../../src/config/db.js', () => ({ db: mockKnexDb }));

beforeEach(() => { Object.keys(builders).forEach((k) => delete builders[k]); vi.clearAllMocks(); });

const rutas = await import('../../../src/services/rutasPedagogicas.service.js');

describe('rutasPedagogicas.service — obtenerRutaPedagogicaActivaPorId', () => {
  it('lanza error si rutaId no es entero positivo', async () => {
    await expect(rutas.obtenerRutaPedagogicaActivaPorId(-1)).rejects.toThrow('no es válida');
    await expect(rutas.obtenerRutaPedagogicaActivaPorId(0)).rejects.toThrow('no es válida');
  });

  it('lanza error si ruta no existe', async () => {
    builders['rutas_pedagogicas'] = createMockQueryBuilder();
    builders['rutas_pedagogicas'].where.mockReturnThis();
    builders['rutas_pedagogicas'].first.mockResolvedValueOnce(null);
    await expect(rutas.obtenerRutaPedagogicaActivaPorId(999)).rejects.toThrow('no existe');
  });
});

describe('rutasPedagogicas.service — listar', () => {
  it('retorna lista vacía si no hay rutas', async () => {
    const executor = vi.fn();
    const builder = createMockQueryBuilder();
    builder.where.mockReturnThis();
    builder.select.mockReturnThis();
    builder.orderBy.mockReturnThis();
    builder.then.mockImplementation((r) => Promise.resolve(r ? r([]) : []));
    executor.mockReturnValue(builder);
    const result = await rutas.listar(executor);
    expect(result).toEqual([]);
  });
});