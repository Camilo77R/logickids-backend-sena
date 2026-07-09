import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockQueryBuilder } from '../setup.js';

vi.mock('../../../src/services/student-device-session.service.js', () => ({
  buildStudentLoginRateLimitKeys: vi.fn(() => ({ deviceKeyHash: 'h1', ipKeyHash: 'h2' })),
  clearStudentLoginRateLimit: vi.fn(),
  createOrReuseStudentDeviceSession: vi.fn(),
  recordStudentLoginAttempt: vi.fn(),
  resolveActiveStudentDeviceSession: vi.fn(),
  resolveActiveStudentDeviceSessionByInstallation: vi.fn(),
  revokeAllStudentDeviceSessions: vi.fn(),
  revokeStudentDeviceSession: vi.fn(),
  STUDENT_DEVICE_CONFLICT_STRATEGIES: { replaceExistingDeviceSession: 'replace' },
  STUDENT_SESSION_TTL_SECONDS: 3600,
}));

vi.mock('../../../src/services/sesionesClase.service.js', () => ({
  cerrarSesionClaseSiTermino: vi.fn(),
  ESTADOS_PARTICIPANTE_SESION: { pendiente: 'pendiente', enProgreso: 'en_progreso' },
  obtenerResumenSesionActivaParaEstudiante: vi.fn(),
}));

vi.mock('../../../src/services/sesiones.service.js', () => ({ finalizar: vi.fn() }));
vi.mock('../../../src/realtime/realtime.events.js', () => ({ publishStudentAccessChanged: vi.fn() }));
vi.mock('../../../src/utils/codes.js', () => ({ randomCode: vi.fn(() => 'ABC123') }));

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
vi.mock('jsonwebtoken', () => ({ default: { sign: vi.fn(() => 'token') }, sign: vi.fn(() => 'token') }));
vi.mock('../../../src/config/env.js', () => ({ env: { JWT_STUDENT_SECRET: 's', JWT_STUDENT_AUDIENCE: 'a', JWT_STUDENT_ISSUER: 'i' } }));

beforeEach(() => { Object.keys(builders).forEach((k) => delete builders[k]); vi.clearAllMocks(); });

const est = await import('../../../src/services/estudiantes.service.js');
const user = { rol: 'tutor', id: 1, institucion_id: 1 };

describe('listar', () => {
  it('retorna query', () => {
    const result = est.listar(user);
    expect(result.then).toBeDefined();
  });
});

describe('listarTodos', () => {
  it('retorna query', () => {
    const result = est.listarTodos(user);
    expect(result.then).toBeDefined();
  });
});

describe('obtener', () => {
  it('lanza error si estudiante no existe', async () => {
    builders['estudiantes'] = createMockQueryBuilder();
    builders['estudiantes'].first.mockResolvedValueOnce(null);
    await expect(est.obtener(1, user))
      .rejects.toThrow('no encontrado');
  });
});

describe('obtenerPerfilInfantil', () => {
  it('retorna null si no existe', async () => {
    builders['estudiantes'] = createMockQueryBuilder();
    builders['estudiantes'].first.mockResolvedValueOnce(null);
    const result = await est.obtenerPerfilInfantil(1);
    expect(result).toBeNull();
  });
});

describe('crear', () => {
  it('lanza error si grupo no existe', async () => {
    builders['grupos'] = createMockQueryBuilder();
    builders['grupos'].first.mockResolvedValueOnce(null);
    await expect(est.crear(user, { nombre: 'Pepe', edad: 7, grupo_id: 999 }))
      .rejects.toThrow('no encontrado');
  });
});

describe('obtenerQR', () => {
  it('retorna QR del estudiante', async () => {
    const qb = createMockQueryBuilder();
    qb.first.mockResolvedValueOnce({ id_estudiante: 1, nombre: 'Pepe', estado: 'activo', grupo_id: null });
    qb.first.mockResolvedValueOnce({ qr_token: 'QR-ABC123-DEF456' });
    builders['estudiantes'] = qb;
    const result = await est.obtenerQR(1, user);
    expect(result.qr_token).toContain('QR-');
  });
});

describe('cambiarGrupo', () => {
  it('rechaza si estudiante no existe', async () => {
    builders['estudiantes'] = createMockQueryBuilder();
    builders['estudiantes'].first.mockResolvedValueOnce(null);
    await expect(est.cambiarGrupo(1, user, 2))
      .rejects.toThrow('no encontrado');
  });
});

describe('logoutEstudiante', () => {
  it('retorna legacy=true si no hay deviceSessionId', async () => {
    const result = await est.logoutEstudiante(null);
    expect(result.legacy).toBe(true);
    expect(result.revoked).toBe(false);
  });
});