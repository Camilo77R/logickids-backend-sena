import { describe, it, expect, vi } from 'vitest';
import { ok, created, noContent } from '../../../src/utils/response.js';

describe('response utils', () => {
  const mockRes = () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
    return res;
  };

  describe('ok', () => {
    it('responde con 200 y datos', () => {
      const res = mockRes();
      ok(res, { id: 1 }, 'OK');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 1 },
        message: 'OK',
      });
    });

    it('usa status code personalizado', () => {
      const res = mockRes();
      ok(res, null, 'Custom', 206);
      expect(res.status).toHaveBeenCalledWith(206);
    });
  });

  describe('created', () => {
    it('responde con 201', () => {
      const res = mockRes();
      created(res, { id: 1 });
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('noContent', () => {
    it('responde con 204', () => {
      const res = mockRes();
      noContent(res);
      expect(res.status).toHaveBeenCalledWith(204);
    });
  });
});