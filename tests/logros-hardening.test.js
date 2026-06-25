import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import {
  authHeader,
  provisionPlayableStudent,
  resolveCodigoEstelarId,
  resolveMinijuegoIdBySlug,
  startCodigoEstelarSession,
} from './helpers/codigoEstelar.helper.js';

const openSingleClass = async ({ tutorToken, groupId, minijuegoId, niveles = 1 }) => {
  const res = await request(app)
    .patch(`/api/grupos/${groupId}/sesion`)
    .set(authHeader(tutorToken))
    .send({
      sesion_activa: true,
      modo: 'single',
      minijuego_id: minijuegoId,
      niveles,
    });

  expect(res.status).toBe(200);
  return res;
};

const registerEventsAndFinalize = async ({ studentToken, sessionId, events }) => {
  for (const event of events) {
    const eventRes = await request(app)
      .post(`/api/sesiones/${sessionId}/eventos`)
      .set(authHeader(studentToken))
      .send(event);

    expect(eventRes.status).toBe(201);
  }

  const finalizeRes = await request(app)
    .post(`/api/sesiones/${sessionId}/finalizar`)
    .set(authHeader(studentToken))
    .send({});

  expect(finalizeRes.status).toBe(200);
  return finalizeRes;
};

describe('Logros - hardening e idempotencia observable', () => {
  it('no expone un endpoint manual de desbloqueo aunque el estudiante este autenticado', async () => {
    const fixture = await provisionPlayableStudent();

    const res = await request(app)
      .post('/api/logros/desbloquear')
      .set(authHeader(fixture.studentToken))
      .send({ clave_logro: 'combo_5' });

    expect(res.status).toBe(404);
  });

  it('solo reporta logros nuevos cuando la misma condicion vuelve a ocurrir', async () => {
    const fixture = await provisionPlayableStudent();
    const codigoEstelarId = await resolveCodigoEstelarId();

    const firstStartRes = await startCodigoEstelarSession({
      studentToken: fixture.studentToken,
      minijuegoId: codigoEstelarId,
      dificultad: 2,
    });

    expect(firstStartRes.status).toBe(201);

    const firstFinalizeRes = await registerEventsAndFinalize({
      studentToken: fixture.studentToken,
      sessionId: firstStartRes.body.data.sesion.id,
      events: [
        { tipo_evento: 'acierto', puntos: 10, combo_en_evento: 1 },
        { tipo_evento: 'acierto', puntos: 10, combo_en_evento: 2 },
        { tipo_evento: 'acierto', puntos: 10, combo_en_evento: 3 },
        { tipo_evento: 'acierto', puntos: 10, combo_en_evento: 4 },
        { tipo_evento: 'acierto', puntos: 10, combo_en_evento: 5 },
        { tipo_evento: 'error', puntos: 0, combo_en_evento: 0 },
        { tipo_evento: 'error', puntos: 0, combo_en_evento: 0 },
      ],
    });

    const firstAchievementKeys = firstFinalizeRes.body.data.logros_desbloqueados
      .map((achievement) => achievement.clave_logro)
      .sort();

    expect(new Set(firstAchievementKeys).size).toBe(firstAchievementKeys.length);
    expect(
      firstAchievementKeys.every((key) => ['combo_5', 'primer_intento'].includes(key))
    ).toBe(true);

    await openSingleClass({
      tutorToken: fixture.tutorToken,
      groupId: fixture.groupId,
      minijuegoId: codigoEstelarId,
    });

    const secondStartRes = await startCodigoEstelarSession({
      studentToken: fixture.studentToken,
      minijuegoId: codigoEstelarId,
      dificultad: 2,
    });

    expect(secondStartRes.status).toBe(201);

    const secondFinalizeRes = await registerEventsAndFinalize({
      studentToken: fixture.studentToken,
      sessionId: secondStartRes.body.data.sesion.id,
      events: [
        { tipo_evento: 'acierto', puntos: 10, combo_en_evento: 1 },
        { tipo_evento: 'acierto', puntos: 10, combo_en_evento: 2 },
        { tipo_evento: 'acierto', puntos: 10, combo_en_evento: 3 },
        { tipo_evento: 'acierto', puntos: 10, combo_en_evento: 4 },
        { tipo_evento: 'acierto', puntos: 10, combo_en_evento: 5 },
        { tipo_evento: 'error', puntos: 0, combo_en_evento: 0 },
      ],
    });

    expect(secondFinalizeRes.body.data.logros_desbloqueados).toEqual([]);
  });

  it('mantiene el flujo sano de logros globales cuando la sesion es de Mercado Inteligente', async () => {
    const fixture = await provisionPlayableStudent({ openClass: false });
    const mercadoId = await resolveMinijuegoIdBySlug('mercado-inteligente');

    await openSingleClass({
      tutorToken: fixture.tutorToken,
      groupId: fixture.groupId,
      minijuegoId: mercadoId,
    });

    const startRes = await request(app)
      .post('/api/sesiones/iniciar')
      .set(authHeader(fixture.studentToken))
      .send({
        minijuego_id: mercadoId,
        dificultad: 1,
      });

    expect(startRes.status).toBe(201);
    expect(startRes.body.data.sesion.minijuego_slug).toBe('mercado-inteligente');

    const finalizeRes = await registerEventsAndFinalize({
      studentToken: fixture.studentToken,
      sessionId: startRes.body.data.sesion.id,
      events: [
        { tipo_evento: 'acierto', puntos: 5, combo_en_evento: 1 },
        { tipo_evento: 'error', puntos: 0, combo_en_evento: 0 },
      ],
    });

    const achievementKeys = finalizeRes.body.data.logros_desbloqueados.map(
      (achievement) => achievement.clave_logro
    );

    expect(achievementKeys.every((key) => ['primer_intento'].includes(key))).toBe(true);
  });
});
