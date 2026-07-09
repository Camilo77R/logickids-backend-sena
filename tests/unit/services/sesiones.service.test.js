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
  mockKnexDb.transaction = vi.fn((cb) => cb(mockKnexDb));
  return { builders, mockKnexDb };
});

vi.mock('../../../src/config/db.js', () => ({ db: mockKnexDb }));
vi.mock('../../../src/services/estadisticas.service.js', () => ({ actualizarStats: vi.fn() }));
vi.mock('../../../src/services/logros.service.js', () => ({ evaluarLogrosSesion: vi.fn() }));
vi.mock('../../../src/services/dificultadAdaptativa.service.js', () => ({ calculateAdaptiveDifficulty: vi.fn(), calculateInActivityDifficulty: vi.fn() }));
vi.mock('../../../src/services/sesionesClase.service.js', () => ({
  avanzarParticipacionSesionClase: vi.fn(),
  cerrarSesionClaseSiTermino: vi.fn(),
  ESTADOS_PARTICIPANTE_SESION: { pendiente: 'pendiente', enProgreso: 'en_progreso', completado: 'completado', abandonado: 'abandonado' },
  esEstadoParticipanteTerminal: vi.fn(() => false),
  marcarParticipanteEnProgreso: vi.fn(),
}));
vi.mock('../../../src/realtime/realtime.events.js', () => ({
  publishClassSessionChanged: vi.fn(), publishRankingUpdated: vi.fn(), publishStudentAccessChanged: vi.fn(),
}));
vi.mock('../../../src/services/student-idempotency.service.js', () => ({
  executeIdempotent: vi.fn((ctx, handler) => handler()),
}));

beforeEach(() => { Object.keys(builders).forEach((k) => delete builders[k]); vi.clearAllMocks(); });

const ses = await import('../../../src/services/sesiones.service.js');

describe('obtenerCheckpoint', () => {
  it('retorna version 0 si no existe checkpoint', async () => {
    builders['sesiones_juego'] = createMockQueryBuilder();
    builders['sesiones_juego'].first.mockResolvedValueOnce({ id_sesion_juego: 1 });
    builders['checkpoints_juego'] = createMockQueryBuilder();
    builders['checkpoints_juego'].first.mockResolvedValueOnce(null);
    const result = await ses.obtenerCheckpoint(1, 1);
    expect(result.version).toBe(0);
  });
});

describe('abandonarSesionesActivasDeClase', () => {
  it('no lanza error', async () => {
    builders['sesiones_juego'] = createMockQueryBuilder();
    builders['sesiones_juego'].where.mockReturnThis();
    builders['sesiones_juego'].select.mockResolvedValueOnce([]);
    builders['estados_sesion'] = createMockQueryBuilder();
    builders['estados_sesion'].first.mockResolvedValueOnce({ id_estado_sesion: 1, nombre: 'activo' });
    await expect(ses.abandonarSesionesActivasDeClase(1, {}, mockKnexDb))
      .resolves.not.toThrow();
  });
});