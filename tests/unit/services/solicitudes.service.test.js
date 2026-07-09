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

beforeEach(() => {
  Object.keys(builders).forEach((k) => delete builders[k]);
  vi.clearAllMocks();
});

const { crearSolicitudReactivacion, listarSolicitudes } = await import('../../../src/services/solicitudes.service.js');

describe('solicitudes.service — crearSolicitudReactivacion', () => {
  it('rechaza si el usuario no existe', async () => {
    await expect(crearSolicitudReactivacion({
      email: 'noexiste@test.com',
      motivo: 'olvido_contrasena',
    })).rejects.toThrow('No existe una cuenta con ese correo');
  });

  it('rechaza si el usuario no es tutor', async () => {
    const qb = createMockQueryBuilder();
    qb.first.mockResolvedValueOnce({ id_usuario: 1, rol: 'admin', estado_id: 2 });
    builders['usuarios as u'] = qb;
    await expect(crearSolicitudReactivacion({
      email: 'admin@test.com',
      motivo: 'otro',
    })).rejects.toThrow('Solo los tutores');
  });
});

describe('solicitudes.service — listarSolicitudes', () => {
  it('retorna lista vacía si no hay solicitudes', async () => {
    const result = await listarSolicitudes({ rol: 'superadmin' });
    expect(result).toEqual([]);
  });
});