import { describe, it, expect, vi, beforeEach } from 'vitest';

const jwtVerify = vi.fn();
const jwtDecode = vi.fn();

vi.mock('jsonwebtoken', () => ({ default: { verify: jwtVerify, decode: jwtDecode }, verify: jwtVerify, decode: jwtDecode }));
vi.mock('../../../src/config/env.js', () => ({ env: { JWT_SECRET: 'secret', JWT_STUDENT_SECRET: 'student-secret', JWT_STUDENT_AUDIENCE: 'logickids', JWT_STUDENT_ISSUER: 'logickids' } }));

const mockValidarSesionWeb = vi.fn();
const mockValidarSesionEstudiante = vi.fn();
const mockObtenerUsuarioAutenticado = vi.fn();
const mockObtenerEstudianteAutenticado = vi.fn();
const mockValidateStudentDeviceSession = vi.fn();

vi.mock('../../../src/services/session-access.service.js', () => ({
  validarSesionWeb: mockValidarSesionWeb,
  validarSesionEstudiante: mockValidarSesionEstudiante,
  obtenerUsuarioAutenticado: mockObtenerUsuarioAutenticado,
  obtenerEstudianteAutenticado: mockObtenerEstudianteAutenticado,
}));

vi.mock('../../../src/services/student-device-session.service.js', () => ({
  validateStudentDeviceSession: mockValidateStudentDeviceSession,
}));

beforeEach(() => { vi.clearAllMocks(); });

const { resolveWebSessionFromToken, resolveStudentSessionFromToken, resolveRealtimeActorFromToken } = await import('../../../src/services/auth-session.service.js');

describe('resolveWebSessionFromToken', () => {
  it('retorna sesion web valida', async () => {
    jwtVerify.mockReturnValue({ id: 1 });
    mockObtenerUsuarioAutenticado.mockResolvedValue({ id: 1, rol: 'admin', estado: 'activo' });
    mockValidarSesionWeb.mockReturnValue({ id: 1, rol: 'admin' });
    const result = await resolveWebSessionFromToken('token');
    expect(result.rol).toBe('admin');
  });

  it('lanza error si token expiro', async () => {
    const err = new Error('expired');
    err.name = 'TokenExpiredError';
    jwtVerify.mockImplementation(() => { throw err; });
    await expect(resolveWebSessionFromToken('token')).rejects.toThrow('Sesion expirada');
  });
});

describe('resolveRealtimeActorFromToken', () => {
  it('retorna actor web si token es valido', async () => {
    jwtVerify.mockReturnValue({ id: 1 });
    mockObtenerUsuarioAutenticado.mockResolvedValue({ id: 1, rol: 'admin', estado: 'activo', institucion_id: 1 });
    mockValidarSesionWeb.mockReturnValue({ id: 1, rol: 'admin', institucion_id: 1 });
    const result = await resolveRealtimeActorFromToken('token');
    expect(result.actorType).toBe('web');
  });
});