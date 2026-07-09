import { describe, it, expect } from 'vitest';
import { crearEstudianteSchema, actualizarEstudianteSchema, cambiarGrupoEstudianteSchema, loginEstudianteSchema } from '../../../src/schemas/estudiantes.schema.js';

describe('estudiantes.schema — Crear estudiante', () => {
  it('acepta datos válidos', () => {
    const result = crearEstudianteSchema.safeParse({
      nombre: 'Juanito',
      edad: 8,
      grupo_id: 1,
      color_avatar: '#FF5733',
    });
    expect(result.success).toBe(true);
  });

  it('acepta solo nombre y edad (mínimos)', () => {
    const result = crearEstudianteSchema.safeParse({ nombre: 'Ana', edad: 7 });
    expect(result.success).toBe(true);
  });

  it('rechaza nombre muy corto', () => {
    const result = crearEstudianteSchema.safeParse({ nombre: 'A', edad: 7 });
    expect(result.success).toBe(false);
  });

  it('rechaza edad negativa', () => {
    const result = crearEstudianteSchema.safeParse({ nombre: 'Ana', edad: -1 });
    expect(result.success).toBe(false);
  });

  it('rechaza color hexadecimal inválido', () => {
    const result = crearEstudianteSchema.safeParse({
      nombre: 'Ana', edad: 7, color_avatar: 'rojo',
    });
    expect(result.success).toBe(false);
  });
});

describe('estudiantes.schema — Actualizar estudiante', () => {
  it('acepta actualización parcial', () => {
    const result = actualizarEstudianteSchema.safeParse({ nombre: 'Nuevo Nombre' });
    expect(result.success).toBe(true);
  });

  it('rechaza objeto vacío', () => {
    const result = actualizarEstudianteSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('estudiantes.schema — Login estudiante', () => {
  it('acepta QR token válido', () => {
    const result = loginEstudianteSchema.safeParse({
      qr_token: 'ABC123',
      installation_id: 'install-001',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza token muy corto', () => {
    const result = loginEstudianteSchema.safeParse({
      qr_token: 'AB',
      installation_id: 'install-001',
    });
    expect(result.success).toBe(false);
  });
});

describe('estudiantes.schema — Cambiar grupo', () => {
  it('acepta grupo_id válido', () => {
    const result = cambiarGrupoEstudianteSchema.safeParse({ grupo_id: 5 });
    expect(result.success).toBe(true);
  });

  it('rechaza grupo no positivo', () => {
    const result = cambiarGrupoEstudianteSchema.safeParse({ grupo_id: 0 });
    expect(result.success).toBe(false);
  });
});