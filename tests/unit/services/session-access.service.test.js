import { describe, it, expect, vi } from 'vitest';
import { createMockQueryBuilder } from '../setup.js';

const { builders, mockKnexDb } = vi.hoisted(() => {
  const builders = {};
  function mockKnexDb(table) {
    if (!builders[table]) builders[table] = createMockQueryBuilder();
    return builders[table];
  }
  mockKnexDb.raw = vi.fn((v) => ({ toRaw: () => v }));
  mockKnexDb.client = { config: { client: 'pg' } };
  return { builders, mockKnexDb };
});

vi.mock('../../../src/config/db.js', () => ({ db: mockKnexDb }));

const { validarSesionWeb, validarSesionEstudiante }
  = await import('../../../src/services/session-access.service.js');

describe('validarSesionWeb', () => {
  it('lanza error si user es null', () => {
    expect(() => validarSesionWeb(null)).toThrow('Usuario autenticado no encontrado');
  });

  it('lanza error si user no está activo', () => {
    expect(() => validarSesionWeb({ estado: 'inactivo', rol: 'tutor' })).toThrow('ya no está habilitada');
  });

  it('lanza error si la institución está desactivada', () => {
    expect(() => validarSesionWeb({
      estado: 'activo', rol: 'tutor', institucion_id: 1, institucion_activa: false,
    })).toThrow('institución está desactivada');
  });

  it('no lanza error para superadmin sin institución', () => {
    expect(() => validarSesionWeb({
      estado: 'activo', rol: 'superadmin', institucion_id: null, institucion_activa: null,
    })).not.toThrow();
  });
});

describe('validarSesionEstudiante', () => {
  it('lanza error si student es null', () => {
    expect(() => validarSesionEstudiante(null)).toThrow('Estudiante autenticado no encontrado');
  });

  it('lanza error si estado no es activo', () => {
    expect(() => validarSesionEstudiante({ estado: 'inactivo' })).toThrow('no está habilitada');
  });

  it('lanza error si institución desactivada', () => {
    expect(() => validarSesionEstudiante({
      estado: 'activo', institucion_id: 1, institucion_activa: false,
    })).toThrow('institución del estudiante está desactivada');
  });

  it('retorna el estudiante si todo ok', () => {
    const student = { estado: 'activo', institucion_id: null, institucion_activa: null };
    expect(validarSesionEstudiante(student)).toBe(student);
  });
});