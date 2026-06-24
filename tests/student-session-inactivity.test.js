import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { db } from '../src/config/db.js';
import {
  authHeader,
  provisionPlayableStudent,
  resolveCodigoEstelarId,
} from './helpers/codigoEstelar.helper.js';

describe('Inactividad de la sesion infantil', () => {
  it('expira fuera de juego y conserva la sesion durante una partida activa', async () => {
    const fixture = await provisionPlayableStudent();
    const staleAt = new Date(Date.now() - 31 * 60 * 1000);

    await db('student_device_sessions')
      .where({ estudiante_id: fixture.studentId })
      .update({ ultima_actividad_en: staleAt });

    const inactiveProfile = await request(app)
      .get('/api/estudiantes/mi-perfil')
      .set(authHeader(fixture.studentToken));
    expect(inactiveProfile.status).toBe(401);
    expect(inactiveProfile.body.code).toBe('SESSION_REVOKED');

    const relogin = await request(app)
      .post('/api/estudiantes/login')
      .send({
        qr_token: fixture.qrToken,
        installation_id: fixture.installationId,
        app_version: 'integration-test',
      });
    expect(relogin.status).toBe(200);

    const minijuegoId = await resolveCodigoEstelarId();
    const start = await request(app)
      .post('/api/sesiones/iniciar')
      .set(authHeader(relogin.body.data.token))
      .send({
        attempt_id: randomUUID(),
        minijuego_id: minijuegoId,
        dificultad: 2,
      });
    expect(start.status).toBe(201);

    await db('student_device_sessions')
      .where({ estudiante_id: fixture.studentId })
      .whereNull('revocada_en')
      .update({ ultima_actividad_en: staleAt });

    const activeGameProfile = await request(app)
      .get('/api/estudiantes/mi-perfil')
      .set(authHeader(relogin.body.data.token));
    expect(activeGameProfile.status).toBe(200);
  });
});
