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

const minijuegos = await import('../../../src/services/minijuegos.service.js');

describe('minijuegos.service — listar', () => {
  it('retorna query builder (sin ejecución)', () => {
    const result = minijuegos.listar();
    expect(result.then).toBeDefined();
  });
});

describe('minijuegos.service — obtener', () => {
  it('lanza error si no existe', async () => {
    const qb = createMockQueryBuilder();
    qb.join.mockReturnThis();
    qb.where.mockReturnThis();
    qb.select.mockReturnThis();
    qb.first.mockResolvedValueOnce(null);
    builders['minijuegos'] = qb;
    await expect(minijuegos.obtener(999)).rejects.toThrow('Minijuego no encontrado');
  });
});

describe('minijuegos.service — crear', () => {
  it('lanza error si habilidad no existe', async () => {
    builders['habilidades'] = createMockQueryBuilder();
    builders['habilidades'].where.mockReturnThis();
    builders['habilidades'].select.mockReturnThis();
    builders['habilidades'].first.mockResolvedValueOnce(null);
    await expect(minijuegos.crear({ slug: 'test', titulo: 'Test', habilidad: 'inexistente' }))
      .rejects.toThrow('Habilidad');
  });
});

describe('minijuegos.service — actualizar', () => {
  it('lanza error si minijuego no existe', async () => {
    builders['minijuegos'] = createMockQueryBuilder();
    builders['minijuegos'].where.mockReturnThis();
    builders['minijuegos'].first.mockResolvedValueOnce(null);
    await expect(minijuegos.actualizar(999, { titulo: 'Nuevo' }))
      .rejects.toThrow('Minijuego no encontrado');
  });
});