import { afterEach, beforeAll } from 'vitest';
import {
  cleanupRegisteredTestInstitutions,
  normalizeOfficialCatalogFixtures,
} from '../helpers/testFixtures.helper.js';

beforeAll(async () => {
  await normalizeOfficialCatalogFixtures();
});

afterEach(async () => {
  await cleanupRegisteredTestInstitutions();
});
