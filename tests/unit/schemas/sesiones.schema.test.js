import { describe, it, expect } from 'vitest';
import {
  iniciarSesionSchema,
  finalizarSesionSchema,
} from '../../../src/schemas/sesiones.schema.js';

describe('sesiones.schema — Iniciar sesión', () => {
  it('acepta datos vacíos (todos son opcionales)', () => {
    const result = iniciarSesionSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('acepta con minijuego_id y dificultad', () => {
    const result = iniciarSesionSchema.safeParse({
      minijuego_id: 2,
      dificultad: 3,
      modo_dificultad: 'manual',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza modo_dificultad inválido', () => {
    const result = iniciarSesionSchema.safeParse({ modo_dificultad: 'automatico' });
    expect(result.success).toBe(false);
  });
});

describe('sesiones.schema — Finalizar sesión', () => {
  it('acepta datos válidos', () => {
    const result = finalizarSesionSchema.safeParse({
      puntuacion: 85,
      niveles_superados: 5,
      intentos_fallidos: 2,
      tiempo_total_segundos: 120,
      datos_detallados: { aciertos: [1, 1, 0] },
    });
    expect(result.success).toBe(true);
  });

  it('acepta puntuación 0', () => {
    const result = finalizarSesionSchema.safeParse({
      puntuacion: 0,
      niveles_superados: 0,
      intentos_fallidos: 0,
    });
    expect(result.success).toBe(true);
  });
});