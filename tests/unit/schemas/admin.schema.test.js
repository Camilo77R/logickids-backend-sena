import { describe, it, expect } from 'vitest';
import {
  crearAdminInstitucionalSchema,
  crearTutorInstitucionalSchema,
  crearInstitucionSchema,
  cambiarEstadoUsuarioSchema,
  toggleMinijuegoSchema,
} from '../../../src/schemas/admin.schema.js';

describe('admin.schema — Crear admin institucional', () => {
  it('acepta datos válidos', () => {
    const result = crearAdminInstitucionalSchema.safeParse({
      nombre: 'Admin Test',
      email: 'admin@test.com',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza email inválido', () => {
    const result = crearAdminInstitucionalSchema.safeParse({
      nombre: 'Admin',
      email: 'no-email',
    });
    expect(result.success).toBe(false);
  });
});

describe('admin.schema — Crear institución', () => {
  it('acepta datos válidos con todos los campos', () => {
    const result = crearInstitucionSchema.safeParse({
      nombre: 'Instituto Test',
      ciudad: 'Bogotá',
      direccion: 'Calle 123',
      telefono: '1234567',
    });
    expect(result.success).toBe(true);
  });

  it('acepta solo nombre', () => {
    const result = crearInstitucionSchema.safeParse({ nombre: 'Instituto' });
    expect(result.success).toBe(true);
  });

  it('rechaza nombre vacío', () => {
    const result = crearInstitucionSchema.safeParse({ nombre: '' });
    expect(result.success).toBe(false);
  });
});

describe('admin.schema — Cambiar estado usuario', () => {
  it('acepta estado válido', () => {
    const result = cambiarEstadoUsuarioSchema.safeParse({ estado: 'activo' });
    expect(result.success).toBe(true);
  });

  it('rechaza estado vacío', () => {
    const result = cambiarEstadoUsuarioSchema.safeParse({ estado: '' });
    expect(result.success).toBe(false);
  });
});

describe('admin.schema — Toggle minijuego', () => {
  it('acepta boolean', () => {
    expect(toggleMinijuegoSchema.safeParse({ activo: true }).success).toBe(true);
    expect(toggleMinijuegoSchema.safeParse({ activo: false }).success).toBe(true);
  });

  it('rechaza string', () => {
    const result = toggleMinijuegoSchema.safeParse({ activo: 'si' });
    expect(result.success).toBe(false);
  });
});