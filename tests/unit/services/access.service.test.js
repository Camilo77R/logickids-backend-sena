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
  return { builders, mockKnexDb };
});

vi.mock('../../../src/config/db.js', () => ({ db: mockKnexDb }));

beforeEach(() => { Object.keys(builders).forEach((k) => delete builders[k]); vi.clearAllMocks(); });

const access = await import('../../../src/services/access.service.js');

const superadmin = { rol: 'superadmin', id: 1, institucion_id: null };
const admin = { rol: 'admin', id: 2, institucion_id: 1 };
const tutor = { rol: 'tutor', id: 3, institucion_id: 1 };

describe('applyInstitutionScope', () => {
  it('no modifica query para superadmin', () => {
    const qb = createMockQueryBuilder();
    expect(access.applyInstitutionScope(qb, superadmin)).toBe(qb);
    expect(qb.where).not.toHaveBeenCalled();
  });

  it('agrega where para admin', () => {
    const qb = createMockQueryBuilder();
    access.applyInstitutionScope(qb, admin);
    expect(qb.where).toHaveBeenCalledWith('institucion_id', 1);
  });
});

describe('applyGroupAccessScope', () => {
  it('no filtra para superadmin', () => {
    const qb = createMockQueryBuilder();
    expect(access.applyGroupAccessScope(qb, superadmin)).toBe(qb);
    expect(qb.where).not.toHaveBeenCalled();
  });

  it('filtra por institucion para admin', () => {
    const qb = createMockQueryBuilder();
    access.applyGroupAccessScope(qb, admin);
    expect(qb.where).toHaveBeenCalledWith('grupos.institucion_id', 1);
  });
});

describe('assertGroupBelongsToUser', () => {
  it('lanza error si grupo no existe', async () => {
    builders['grupos'] = createMockQueryBuilder();
    builders['grupos'].first.mockResolvedValueOnce(null);
    await expect(access.assertGroupBelongsToUser(1, tutor))
      .rejects.toThrow('no encontrado');
  });

  it('retorna grupo si existe', async () => {
    builders['grupos'] = createMockQueryBuilder();
    builders['grupos'].first.mockResolvedValueOnce({ id_grupo: 1, nombre: 'Grupo A' });
    const result = await access.assertGroupBelongsToUser(1, tutor);
    expect(result.nombre).toBe('Grupo A');
  });
});

describe('assertGroupAssignedToTutor', () => {
  it('lanza error si el grupo no pertenece al tutor', async () => {
    builders['grupos'] = createMockQueryBuilder();
    builders['grupos'].first.mockResolvedValueOnce({ id_grupo: 1, tutor_asignado_id: 99 });
    await expect(access.assertGroupAssignedToTutor(1, tutor))
      .rejects.toThrow('Solo el tutor asignado');
  });
});