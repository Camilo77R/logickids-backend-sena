import { describe, it, expect } from 'vitest';
import {
  crearSolicitudReactivacionSchema,
  rechazarSolicitudSchema,
} from '../../../src/schemas/solicitudes.schema.js';

describe('solicitudes.schema — Crear solicitud', () => {
  it('acepta datos válidos con todos los campos', () => {
    const result = crearSolicitudReactivacionSchema.safeParse({
      email: 'tutor@test.com',
      correo_respuesta: 'respuesta@test.com',
      motivo: 'olvido_contrasena',
      descripcion: 'No recuerdo mi contraseña',
    });
    expect(result.success).toBe(true);
  });

  it('acepta solo email y motivo (mínimos)', () => {
    const result = crearSolicitudReactivacionSchema.safeParse({
      email: 'tutor@test.com',
      motivo: 'olvido_contrasena',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza email inválido', () => {
    const result = crearSolicitudReactivacionSchema.safeParse({
      email: 'invalido',
      motivo: 'olvido_contrasena',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza motivo vacío', () => {
    const result = crearSolicitudReactivacionSchema.safeParse({
      email: 'tutor@test.com',
      motivo: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('solicitudes.schema — Rechazar solicitud', () => {
  it('acepta motivo de rechazo válido', () => {
    const result = rechazarSolicitudSchema.safeParse({
      motivo_rechazo: 'No cumple con los requisitos de reactivación',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza motivo muy corto', () => {
    const result = rechazarSolicitudSchema.safeParse({
      motivo_rechazo: 'No',
    });
    expect(result.success).toBe(false);
  });
});