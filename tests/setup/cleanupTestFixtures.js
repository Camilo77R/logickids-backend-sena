import { createHash } from 'node:crypto';
import { afterEach } from 'vitest';
import { db } from '../../src/config/db.js';
import { cleanupRegisteredTestInstitutions } from '../helpers/testFixtures.helper.js';

const LOCAL_TEST_IPS = ['::ffff:127.0.0.1', '127.0.0.1', '::1', 'unknown'];

const hashRateLimitKey = (value) =>
  createHash('sha256').update(value).digest('hex');

const cleanupLocalStudentLoginRateLimits = () =>
  db('student_login_rate_limits')
    .whereIn(
      'key_hash',
      LOCAL_TEST_IPS.map((ip) => hashRateLimitKey(`ip|${ip}`)),
    )
    .del();

afterEach(async () => {
  try {
    await cleanupRegisteredTestInstitutions();
  } finally {
    // Supertest comparte loopback entre casos; no debe simular una red escolar completa.
    await cleanupLocalStudentLoginRateLimits();
  }
});
