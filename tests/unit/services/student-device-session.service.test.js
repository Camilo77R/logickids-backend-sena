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
vi.mock('../../../src/config/env.js', () => ({ env: { STUDENT_SESSION_TTL_SECONDS: 3600 } }));

beforeEach(() => { Object.keys(builders).forEach((k) => delete builders[k]); vi.clearAllMocks(); });

const sds = await import('../../../src/services/student-device-session.service.js');

describe('STUDENT_DEVICE_CONFLICT_STRATEGIES', () => {
  it('tiene replaceExistingDeviceSession', () => {
    expect(sds.STUDENT_DEVICE_CONFLICT_STRATEGIES.replaceExistingDeviceSession).toBeDefined();
  });
});

describe('buildStudentLoginRateLimitKeys', () => {
  it('retorna keys con hash', () => {
    const keys = sds.buildStudentLoginRateLimitKeys({ ip: '127.0.0.1', installationId: 'inst-1' });
    expect(keys.deviceKeyHash).toBeDefined();
    expect(keys.ipKeyHash).toBeDefined();
  });
});

describe('clearStudentLoginRateLimit', () => {
  it('no lanza error', async () => {
    builders['student_login_rate_limits'] = createMockQueryBuilder();
    builders['student_login_rate_limits'].where.mockReturnThis();
    builders['student_login_rate_limits'].del = vi.fn().mockResolvedValue(1);
    await expect(sds.clearStudentLoginRateLimit({ deviceKeyHash: 'h1', ipKeyHash: 'h2' }))
      .resolves.not.toThrow();
  });
});