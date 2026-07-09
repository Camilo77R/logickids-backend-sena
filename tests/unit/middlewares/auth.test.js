import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockResolveWebSession = vi.fn();
const mockResolveStudentSession = vi.fn();

vi.mock('../../../src/services/auth-session.service.js', () => ({
  resolveWebSessionFromToken: mockResolveWebSession,
  resolveStudentSessionFromToken: mockResolveStudentSession,
}));

const { requireAuth, requireRole, requireEstudiante, attachOptionalSession } = await import('../../../src/middlewares/auth.js');

function mockReqRes(token) {
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {} };
  const res = {};
  const next = vi.fn();
  return { req, res, next };
}

describe('requireAuth', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('pasa al siguiente middleware si el token es válido', async () => {
    mockResolveWebSession.mockResolvedValueOnce({ id: 1, rol: 'superadmin' });
    const { req, res, next } = mockReqRes('token-valido');
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user.rol).toBe('superadmin');
  });

  it('rechaza si no hay token', async () => {
    const { req, res, next } = mockReqRes(null);
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('rechaza token expirado', async () => {
    const err = new Error('jwt expired');
    err.name = 'TokenExpiredError';
    mockResolveWebSession.mockRejectedValueOnce(err);
    const { req, res, next } = mockReqRes('token-expirado');
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});

describe('requireRole', () => {
  it('permite paso si el rol coincide', () => {
    const req = { user: { rol: 'admin' } };
    const next = vi.fn();
    requireRole('admin', 'superadmin')(req, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rechaza si el rol no coincide', () => {
    const req = { user: { rol: 'tutor' } };
    const next = vi.fn();
    requireRole('superadmin')(req, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});

describe('requireEstudiante', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('pasa si token estudiante válido', async () => {
    mockResolveStudentSession.mockResolvedValueOnce({ id_estudiante: 5 });
    const { req, res, next } = mockReqRes('token-estudiante');
    await requireEstudiante(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.estudiante.id_estudiante).toBe(5);
  });
});

describe('attachOptionalSession', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('continúa si no hay token', async () => {
    const { req, res, next } = mockReqRes(null);
    await attachOptionalSession(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('adjunta user si web token válido', async () => {
    mockResolveWebSession.mockResolvedValueOnce({ id: 1, rol: 'tutor' });
    const { req, res, next } = mockReqRes('token-web');
    await attachOptionalSession(req, res, next);
    expect(req.user).toBeDefined();
    expect(req.user.rol).toBe('tutor');
  });

  it('intenta student token si web token falla', async () => {
    mockResolveWebSession.mockRejectedValueOnce(new Error('falló'));
    mockResolveStudentSession.mockResolvedValueOnce({ id_estudiante: 3 });
    const { req, res, next } = mockReqRes('token-mixto');
    await attachOptionalSession(req, res, next);
    expect(req.estudiante).toBeDefined();
    expect(req.estudiante.id_estudiante).toBe(3);
  });
});