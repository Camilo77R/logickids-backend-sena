import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../setup.js';

vi.mock('nodemailer', () => {
  const sendMail = vi.fn().mockResolvedValue({ messageId: 'test-id' });
  return {
    default: {
      createTransport: vi.fn(() => ({ sendMail })),
    },
    createTransport: vi.fn(() => ({ sendMail })),
  };
});

vi.mock('../../../src/config/env.js', () => ({
  env: {
    EMAIL_HOST: 'smtp.test.com',
    EMAIL_PORT: '587',
    EMAIL_USER: 'test',
    EMAIL_PASS: 'test',
    EMAIL_FROM: 'test@test.com',
  },
}));

const { enviarResultadoReactivacion } = await import('../../../src/services/email.service.js');

describe('email.service — enviarResultadoReactivacion', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('envía correo de resultado de reactivación aprobada', async () => {
    await expect(enviarResultadoReactivacion({
      email: 'tutor@test.com',
      nombre: 'Tutor Test',
      estado: 'aprobada',
      respuesta: 'Su cuenta ha sido reactivada',
    })).resolves.not.toThrow();
  });

  it('envía correo de resultado de reactivación rechazada', async () => {
    await expect(enviarResultadoReactivacion({
      email: 'tutor@test.com',
      nombre: 'Tutor Test',
      estado: 'rechazada',
      respuesta: 'No cumple los requisitos',
    })).resolves.not.toThrow();
  });
});