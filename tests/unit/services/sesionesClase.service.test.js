import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockQueryBuilder } from '../setup.js';

vi.mock('../../../src/services/rutasPedagogicas.service.js', () => ({
  obtenerRutaPedagogicaActivaPorId: vi.fn(),
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
  return { builders, mockKnexDb };
});

vi.mock('../../../src/config/db.js', () => ({ db: mockKnexDb }));

beforeEach(() => { Object.keys(builders).forEach((k) => delete builders[k]); vi.clearAllMocks(); });

const sc = await import('../../../src/services/sesionesClase.service.js');

describe('MODOS_SESION_CLASE', () => {
  it('tiene valores esperados', () => {
    expect(sc.MODOS_SESION_CLASE).toEqual({ single: 'single', path: 'path' });
  });
});

describe('ESTADOS_SESION_CLASE', () => {
  it('tiene activa, cerrada, cancelada', () => {
    expect(sc.ESTADOS_SESION_CLASE.activa).toBe('activa');
  });
});

describe('ESTADOS_PARTICIPANTE_SESION', () => {
  it('tiene estados esperados', () => {
    expect(sc.ESTADOS_PARTICIPANTE_SESION.pendiente).toBe('pendiente');
  });
});

describe('esEstadoParticipanteTerminal', () => {
  it('retorna true para completado', () => {
    expect(sc.esEstadoParticipanteTerminal('completado')).toBe(true);
  });

  it('retorna false para pendiente', () => {
    expect(sc.esEstadoParticipanteTerminal('pendiente')).toBe(false);
  });
});

describe('resolvePlanSesionClase', () => {
  it('lanza error si modo invalido', async () => {
    await expect(sc.resolvePlanSesionClase({ modo: 'invalido' }, mockKnexDb))
      .rejects.toThrow('no es válido');
  });

  it('lanza error si modo single sin minijuego_id', async () => {
    await expect(sc.resolvePlanSesionClase({ modo: 'single' }, mockKnexDb))
      .rejects.toThrow('minijuego');
  });
});

describe('obtenerSesionClaseActivaPorGrupo', () => {
  it('retorna null si no hay sesion activa', async () => {
    builders['sesiones_clase'] = createMockQueryBuilder();
    builders['sesiones_clase'].first.mockResolvedValueOnce(null);
    const result = await sc.obtenerSesionClaseActivaPorGrupo(1, mockKnexDb);
    expect(result).toBeNull();
  });
});