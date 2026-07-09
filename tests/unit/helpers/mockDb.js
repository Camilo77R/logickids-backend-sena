import { vi } from 'vitest';
import { createMockQueryBuilder, mockKnex } from '../setup.js';

const tableBuilders = {};

beforeEach(() => {
  Object.keys(tableBuilders).forEach((k) => delete tableBuilders[k]);
});

mockKnex.mockImplementation((table) => {
  if (!tableBuilders[table]) {
    tableBuilders[table] = createMockQueryBuilder();
  }
  return tableBuilders[table];
});

export function mockQb(table) {
  return tableBuilders[table] || null;
}

export { mockKnex, tableBuilders };