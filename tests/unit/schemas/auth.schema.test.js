import { describe, it, expect } from 'vitest';
import {
  registroSchema,
  loginSchema,
  actualizarPerfilSchema,
  cambiarContrasenaSchema,
} from '../../../src/schemas/auth.schema.js';

describe('auth.schema — Registro', () => {
  it('acepta datos válidos de registro', () => {
    const result = registroSchema.safeParse({
      nombre: 'Carlos Pérez',
      email: 'carlos@test.com',
      contrasena: '123456',
      institucion_id: 1,
    });
    expect(result.success).toBe(true);
    expect(result.data.rol).toBe('tutor');
  });

  it('rechaza nombre menor a 2 caracteres', () => {
    const result = registroSchema.safeParse({
      nombre: 'A',
      email: 'carlos@test.com',
      contrasena: '123456',
      institucion_id: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza email inválido', () => {
    const result = registroSchema.safeParse({
      nombre: 'Carlos',
      email: 'no-email',
      contrasena: '123456',
      institucion_id: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza contraseña menor a 6 caracteres', () => {
    const result = registroSchema.safeParse({
      nombre: 'Carlos',
      email: 'carlos@test.com',
      contrasena: '12345',
      institucion_id: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza institucion_id no positivo', () => {
    const result = registroSchema.safeParse({
      nombre: 'Carlos',
      email: 'carlos@test.com',
      contrasena: '123456',
      institucion_id: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe('auth.schema — Login', () => {
  it('acepta credenciales válidas', () => {
    const result = loginSchema.safeParse({
      email: 'user@test.com',
      contrasena: 'miClave',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza email vacío', () => {
    const result = loginSchema.safeParse({ email: '', contrasena: 'clave' });
    expect(result.success).toBe(false);
  });

  it('rechaza contraseña vacía', () => {
    const result = loginSchema.safeParse({ email: 'user@test.com', contrasena: '' });
    expect(result.success).toBe(false);
  });
});

describe('auth.schema — Actualizar Perfil', () => {
  it('acepta nombre válido', () => {
    const result = actualizarPerfilSchema.safeParse({ nombre: 'Nuevo Nombre' });
    expect(result.success).toBe(true);
  });

  it('rechaza objeto vacío', () => {
    const result = actualizarPerfilSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('auth.schema — Cambiar Contraseña', () => {
  it('acepta cambio válido', () => {
    const result = cambiarContrasenaSchema.safeParse({
      contrasena_actual: 'viejaClave',
      contrasena_nueva: 'nuevaClaveLarga',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza nueva contraseña menor a 8 caracteres', () => {
    const result = cambiarContrasenaSchema.safeParse({
      contrasena_actual: 'vieja',
      contrasena_nueva: 'corta',
    });
    expect(result.success).toBe(false);
  });
});