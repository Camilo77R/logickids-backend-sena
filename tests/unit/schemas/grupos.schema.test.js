import { describe, it, expect } from 'vitest';
import {
  crearGrupoSchema,
  actualizarGrupoSchema,
  asignarTutorGrupoSchema,
  toggleSesionGrupoSchema,
} from '../../../src/schemas/grupos.schema.js';

describe('grupos.schema — Crear grupo', () => {
  it('acepta datos válidos', () => {
    const result = crearGrupoSchema.safeParse({
      nombre: 'Grupo A',
      descripcion: 'Primer grupo',
    });
    expect(result.success).toBe(true);
  });

  it('acepta solo nombre', () => {
    const result = crearGrupoSchema.safeParse({ nombre: 'Grupo B' });
    expect(result.success).toBe(true);
  });

  it('rechaza nombre vacío', () => {
    const result = crearGrupoSchema.safeParse({ nombre: '' });
    expect(result.success).toBe(false);
  });

  it('rechaza descripción muy larga', () => {
    const result = crearGrupoSchema.safeParse({
      nombre: 'Grupo',
      descripcion: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe('grupos.schema — Actualizar grupo', () => {
  it('acepta actualizar nombre', () => {
    const result = actualizarGrupoSchema.safeParse({ nombre: 'Nuevo nombre' });
    expect(result.success).toBe(true);
  });

  it('rechaza objeto vacío', () => {
    const result = actualizarGrupoSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('grupos.schema — Asignar tutor', () => {
  it('acepta tutor_id válido', () => {
    const result = asignarTutorGrupoSchema.safeParse({ tutor_id: 10 });
    expect(result.success).toBe(true);
  });

  it('acepta tutor_id null (desasignar)', () => {
    const result = asignarTutorGrupoSchema.safeParse({ tutor_id: null });
    expect(result.success).toBe(true);
  });

  it('rechaza tutor_id no positivo', () => {
    const result = asignarTutorGrupoSchema.safeParse({ tutor_id: -1 });
    expect(result.success).toBe(false);
  });
});

describe('grupos.schema — Toggle sesión', () => {
  it('acepta modo single con minijuego', () => {
    const result = toggleSesionGrupoSchema.safeParse({
      sesion_activa: true,
      modo: 'single',
      minijuego_id: 1,
    });
    expect(result.success).toBe(true);
  });

  it('acepta modo path con ruta', () => {
    const result = toggleSesionGrupoSchema.safeParse({
      sesion_activa: true,
      modo: 'path',
      ruta_id: 1,
    });
    expect(result.success).toBe(true);
  });

  it('acepta desactivar sesión sin extras', () => {
    const result = toggleSesionGrupoSchema.safeParse({ sesion_activa: false });
    expect(result.success).toBe(true);
  });

  it('rechaza modo sin minijuego_id ni ruta_id', () => {
    const result = toggleSesionGrupoSchema.safeParse({
      sesion_activa: true,
      modo: 'single',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza modo path con minijuego_id', () => {
    const result = toggleSesionGrupoSchema.safeParse({
      sesion_activa: true,
      modo: 'path',
      ruta_id: 1,
      minijuego_id: 2,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza modo single con ruta_id', () => {
    const result = toggleSesionGrupoSchema.safeParse({
      sesion_activa: true,
      modo: 'single',
      minijuego_id: 1,
      ruta_id: 2,
    });
    expect(result.success).toBe(false);
  });
});