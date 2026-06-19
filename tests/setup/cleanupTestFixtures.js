import { afterEach } from 'vitest';
import { cleanupRegisteredTestInstitutions } from '../helpers/testFixtures.helper.js';

afterEach(async () => {
  await cleanupRegisteredTestInstitutions();
});
