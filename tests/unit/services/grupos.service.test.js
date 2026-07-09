import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockQueryBuilder } from '../setup.js';

vi.mock('../../../src/services/sesionesClase.service.js', () => ({
  crearSesionClase: vi.fn(),
  cerrarSesionClasePorGrupo: vi.fn(),
  ESTADOS_SESION_CLASE: { cancelada: 'cancelada' },
  obtenerSesionClaseActivaPorGrupo: vi.fn(),
  obtenerResumenSesionActivaParaGrupo: vi.fn(),
  resolvePlanSesionClase: vi.fn(),
}));

vi.mock('../../../src/services/sesiones.service.js', () => ({
  abandonarSesionesActivasDeClase: vi.fn(),
}));

vi.mock('../../../src/realtime/realtime.events.js', () => ({
  publishClassSessionChanged: vi.fn(),
  publishRankingUpdated: vi.fn(),
  publishStudentAccessChanged: vi.fn(),
}));

const { builders, mockKnexDb } = vi.hoisted(() => {
  const builders = {};
  function mockKnexDb(table) {
    if (!builders[table]) builders[table] = createMockQueryBuilder();
    return builders[table];
  }
  mockKnexDb.raw = vi.fn((v) => ({ toRaw: () => v }));
  mockKnexDb.fn = { now: vi.fn(() => 'NOW()') };
  mockKnexDb.client = { config: { client: 'pg' } };
  mockKnexDb.transaction = vi.fn((cb) => cb(mockKnexDb));
  return { builders, mockKnexDb };
});

vi.mock('../../../src/config/db.js', () => ({ db: mockKnexDb }));

beforeEach(() => { Object.keys(builders).forEach((k) => delete builders[k]); vi.clearAllMocks(); });

const grupos = await import('../../../src/services/grupos.service.js');
const user = { rol: 'admin', id: 1, institucion_id: 1 };
const tutorUser = { rol: 'tutor', id: 2, institucion_id: 1 };

describe('listar', () => {
  it('retorna query', () => {
    const result = grupos.listar(user);
    expect(result.then).toBeDefined();
  });
});

describe('obtener', () => {
  it('lanza error si grupo no existe', async () => {
    builders['grupos'] = createMockQueryBuilder();
    builders['grupos'].first.mockResolvedValueOnce(null);
    await expect(grupos.obtener(1, user))
      .rejects.toThrow('no encontrado');
  });
});

describe('crear', () => {
  it('crea grupo exitosamente', async () => {
    const qb = createMockQueryBuilder();
    qb.returning.mockReturnThis();
    qb.then = vi.fn((resolve) => Promise.resolve(resolve ? resolve([{ id_grupo: 1, nombre: 'G1' }]) : [{ id_grupo: 1, nombre: 'G1' }]));
    // For obtener/fetchGroupById inside crear, first must return the group
    qb.first.mockResolvedValue({ id_grupo: 1, nombre: 'G1', activo: true, institucion_id: 1, tutor_asignado_id: 1 });
    builders['grupos'] = qb;
    const result = await grupos.crear(user, { nombre: 'Grupo A', descripcion: 'Desc' });
    expect(result.id_grupo).toBe(1);
  });
});

describe('asignarTutor', () => {
  it('rechaza si grupo no existe', async () => {
    builders['grupos'] = createMockQueryBuilder();
    builders['grupos'].first.mockResolvedValueOnce(null);
    await expect(grupos.asignarTutor(1, user, 2))
      .rejects.toThrow('no encontrado');
  });
});

describe('archivar', () => {
  it('rechaza si no existe', async () => {
    builders['grupos'] = createMockQueryBuilder();
    builders['grupos'].first.mockResolvedValueOnce(null);
    await expect(grupos.archivar(1, user))
      .rejects.toThrow('no encontrado');
  });
});

describe('restaurar', () => {
  it('rechaza si no existe', async () => {
    builders['grupos'] = createMockQueryBuilder();
    builders['grupos'].first.mockResolvedValueOnce(null);
    await expect(grupos.restaurar(1, user))
      .rejects.toThrow('no encontrado');
  });
});

describe('toggleSesion', () => {
  it('lanza si grupo no existe', async () => {
    builders['grupos'] = createMockQueryBuilder();
    builders['grupos'].first.mockResolvedValueOnce(null);
    await expect(grupos.toggleSesion(1, tutorUser, { sesion_activa: false }))
      .rejects.toThrow('no encontrado');
  });
});