import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'http';
import request from 'supertest';
import { io as createSocketClient } from 'socket.io-client';
import app from '../src/app.js';
import { setupSockets } from '../src/sockets/socket.manager.js';
import {
  authHeader,
  provisionPlayableStudent,
  resolveCodigoEstelarId,
  startCodigoEstelarSession,
} from './helpers/codigoEstelar.helper.js';

const SOCKET_TIMEOUT_MS = 15_000;

const waitForSocketEvent = (socket, eventName, { rejectOn, timeoutMs = SOCKET_TIMEOUT_MS } = {}) =>
  new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      socket.off(eventName, handleSuccess);

      if (rejectOn) {
        socket.off(rejectOn, handleFailure);
      }
    };

    const handleSuccess = (payload) => {
      cleanup();
      resolve(payload);
    };

    const handleFailure = (payload) => {
      cleanup();
      reject(new Error(`${rejectOn}: ${JSON.stringify(payload)}`));
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout esperando ${eventName}`));
    }, timeoutMs);

    socket.once(eventName, handleSuccess);

    if (rejectOn) {
      socket.once(rejectOn, handleFailure);
    }
  });

const createRealtimeSocket = (baseUrl, token) =>
  createSocketClient(baseUrl, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
  });

const closeSocket = async (socket) => {
  if (!socket) {
    return;
  }

  if (socket.disconnected) {
    socket.close();
    return;
  }

  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 500);

    socket.once('disconnect', () => {
      clearTimeout(timer);
      resolve();
    });

    socket.disconnect();
  });
};

const createStudentForExistingGroup = async ({
  adminToken,
  tutorToken,
  groupId,
  suffix,
  color_avatar = '#22C55E',
}) => {
  const createStudentRes = await request(app)
    .post('/api/estudiantes')
    .set(authHeader(adminToken))
    .send({
      nombre: `Estudiante ${suffix}`,
      edad: 8,
      grupo_id: groupId,
      color_avatar,
    });

  expect(createStudentRes.status).toBe(201);

  const studentId = createStudentRes.body.data.id;
  const qrRes = await request(app)
    .get(`/api/estudiantes/${studentId}/qr`)
    .set(authHeader(tutorToken));

  expect(qrRes.status).toBe(200);

  const loginRes = await request(app)
    .post('/api/estudiantes/login')
    .send({
      qr_token: qrRes.body.data.qr_token,
      installation_id: `ranking-${suffix}`,
      app_version: 'test',
    });

  expect(loginRes.status).toBe(200);

  return {
    studentId,
    studentToken: loginRes.body.data.token,
  };
};

const openSingleClass = async ({ tutorToken, groupId, minijuegoId, niveles }) => {
  const openClassRes = await request(app)
    .patch(`/api/grupos/${groupId}/sesion`)
    .set(authHeader(tutorToken))
    .send({
      sesion_activa: true,
      modo: 'single',
      minijuego_id: minijuegoId,
      niveles,
    });

  expect(openClassRes.status).toBe(200);
  return openClassRes;
};

const registerEventsAndFinalize = async ({
  studentToken,
  sessionId,
  events,
  finalPayload = {},
}) => {
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
    .send(finalPayload);

  expect(finalizeRes.status).toBe(200);
  return finalizeRes;
};

describe('🏆 Ranking oficial y realtime', () => {
  let httpServer;
  let ioServer;
  let socketBaseUrl;

  beforeAll(async () => {
    httpServer = createServer(app);
    ioServer = setupSockets(httpServer);

    await new Promise((resolve) => {
      httpServer.listen(0, '127.0.0.1', resolve);
    });

    const address = httpServer.address();
    socketBaseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => ioServer.close(resolve));
    await new Promise((resolve) => httpServer.close(resolve));
  });

  it(
    '✅ agrega el ranking oficial por sesion_clase y desempata con reglas del backend',
    async () => {
      const minijuegoId = await resolveCodigoEstelarId();
      const fixture = await provisionPlayableStudent({ openClass: false });
      const secondStudent = await createStudentForExistingGroup({
        adminToken: fixture.adminToken,
        tutorToken: fixture.tutorToken,
        groupId: fixture.groupId,
        suffix: 'segundo-ranking',
      });

      const openClassRes = await openSingleClass({
        tutorToken: fixture.tutorToken,
        groupId: fixture.groupId,
        minijuegoId,
        niveles: 2,
      });

      expect(openClassRes.body.data.sesion_total_pasos).toBe(2);

      const firstStepStudentOne = await startCodigoEstelarSession({
        studentToken: fixture.studentToken,
        minijuegoId,
        dificultad: 2,
      });
      const firstStepStudentTwo = await startCodigoEstelarSession({
        studentToken: secondStudent.studentToken,
        minijuegoId,
        dificultad: 2,
      });

      expect(firstStepStudentOne.status).toBe(201);
      expect(firstStepStudentTwo.status).toBe(201);
      expect(firstStepStudentOne.body.data.sesion.sesion_clase_id).toBe(
        firstStepStudentTwo.body.data.sesion.sesion_clase_id
      );

      const firstFinalizeStudentOne = await registerEventsAndFinalize({
        studentToken: fixture.studentToken,
        sessionId: firstStepStudentOne.body.data.sesion.id,
        events: [
          { tipo_evento: 'acierto', puntos: 10, combo_en_evento: 1 },
        ],
        finalPayload: {
          puntaje: 9_999,
          aciertos: 99,
          errores: 99,
        },
      });

      const firstFinalizeStudentTwo = await registerEventsAndFinalize({
        studentToken: secondStudent.studentToken,
        sessionId: firstStepStudentTwo.body.data.sesion.id,
        events: [
          { tipo_evento: 'acierto', puntos: 10, combo_en_evento: 1 },
        ],
        finalPayload: {
          puntaje: 9_999,
          aciertos: 99,
          errores: 99,
        },
      });

      expect(firstFinalizeStudentOne.body.data.puntaje).toBe(10);
      expect(firstFinalizeStudentTwo.body.data.puntaje).toBe(10);

      const secondStepStudentOne = await startCodigoEstelarSession({
        studentToken: fixture.studentToken,
        minijuegoId,
        dificultad: 2,
      });
      const secondStepStudentTwo = await startCodigoEstelarSession({
        studentToken: secondStudent.studentToken,
        minijuegoId,
        dificultad: 2,
      });

      expect(secondStepStudentOne.status).toBe(201);
      expect(secondStepStudentTwo.status).toBe(201);
      expect(secondStepStudentOne.body.data.sesion.orden_en_ruta).toBe(2);
      expect(secondStepStudentTwo.body.data.sesion.orden_en_ruta).toBe(2);

      await registerEventsAndFinalize({
        studentToken: fixture.studentToken,
        sessionId: secondStepStudentOne.body.data.sesion.id,
        events: [
          { tipo_evento: 'acierto', puntos: 5, combo_en_evento: 1 },
          { tipo_evento: 'error', puntos: 0, combo_en_evento: 0 },
        ],
        finalPayload: {
          puntaje: 1_234,
          aciertos: 50,
          errores: 0,
        },
      });

      await registerEventsAndFinalize({
        studentToken: secondStudent.studentToken,
        sessionId: secondStepStudentTwo.body.data.sesion.id,
        events: [
          { tipo_evento: 'acierto', puntos: 5, combo_en_evento: 1 },
        ],
        finalPayload: {
          puntaje: 4_321,
          aciertos: 0,
          errores: 50,
        },
      });

      const rankingRes = await request(app)
        .get(`/api/grupos/${fixture.groupId}/ranking`)
        .set(authHeader(fixture.tutorToken));

      expect(rankingRes.status).toBe(200);
      expect(rankingRes.body.success).toBe(true);
      expect(rankingRes.body.data.scope.sesion_clase_id).toBe(
        firstStepStudentOne.body.data.sesion.sesion_clase_id
      );
      expect(rankingRes.body.data.total_participantes).toBe(2);
      expect(rankingRes.body.data.ranking).toHaveLength(2);

      const [leader, challenger] = rankingRes.body.data.ranking;
      expect(leader.estudiante_id).toBe(secondStudent.studentId);
      expect(leader.puntaje).toBe(15);
      expect(leader.aciertos).toBe(2);
      expect(leader.errores).toBe(0);
      expect(challenger.estudiante_id).toBe(fixture.studentId);
      expect(challenger.puntaje).toBe(15);
      expect(challenger.aciertos).toBe(2);
      expect(challenger.errores).toBe(1);
    },
    60_000
  );

  it('✅ devuelve mi posicion oficial desde el JWT infantil', async () => {
    const minijuegoId = await resolveCodigoEstelarId();
    const fixture = await provisionPlayableStudent({ openClass: false });
    const secondStudent = await createStudentForExistingGroup({
      adminToken: fixture.adminToken,
      tutorToken: fixture.tutorToken,
      groupId: fixture.groupId,
      suffix: 'mi-ranking',
    });

    await openSingleClass({
      tutorToken: fixture.tutorToken,
      groupId: fixture.groupId,
      minijuegoId,
      niveles: 1,
    });

    const firstSession = await startCodigoEstelarSession({
      studentToken: fixture.studentToken,
      minijuegoId,
      dificultad: 2,
    });
    const secondSession = await startCodigoEstelarSession({
      studentToken: secondStudent.studentToken,
      minijuegoId,
      dificultad: 2,
    });

    expect(firstSession.status).toBe(201);
    expect(secondSession.status).toBe(201);

    await registerEventsAndFinalize({
      studentToken: fixture.studentToken,
      sessionId: firstSession.body.data.sesion.id,
      events: [
        { tipo_evento: 'acierto', puntos: 8, combo_en_evento: 1 },
      ],
      finalPayload: {
        puntaje: 500,
      },
    });

    await registerEventsAndFinalize({
      studentToken: secondStudent.studentToken,
      sessionId: secondSession.body.data.sesion.id,
      events: [
        { tipo_evento: 'acierto', puntos: 12, combo_en_evento: 1 },
      ],
      finalPayload: {
        puntaje: 1_000,
      },
    });

    const myRankingRes = await request(app)
      .get('/api/estudiantes/mi-ranking')
      .set(authHeader(fixture.studentToken));

    expect(myRankingRes.status).toBe(200);
    expect(myRankingRes.body.success).toBe(true);
    expect(myRankingRes.body.data.mi_posicion.estudiante_id).toBe(fixture.studentId);
    expect(myRankingRes.body.data.mi_posicion.posicion).toBe(2);
    expect(myRankingRes.body.data.top3).toHaveLength(2);
    expect(myRankingRes.body.data.top3[0].estudiante_id).toBe(secondStudent.studentId);
  }, 45_000);

  it(
    '✅ el tutor conectado por socket recibe invalidaciones al abrir clase y al actualizar ranking',
    async () => {
      const minijuegoId = await resolveCodigoEstelarId();
      const fixture = await provisionPlayableStudent({ openClass: false });
      const socket = createRealtimeSocket(socketBaseUrl, fixture.tutorToken);

      try {
        await waitForSocketEvent(socket, 'connect', { rejectOn: 'connect_error' });

        const classChangedPromise = waitForSocketEvent(socket, 'class_session:changed');
        const openClassRes = await openSingleClass({
          tutorToken: fixture.tutorToken,
          groupId: fixture.groupId,
          minijuegoId,
          niveles: 1,
        });
        const classChanged = await classChangedPromise;

        expect(classChanged.grupoId).toBe(fixture.groupId);
        expect(classChanged.sessionState).toBe('activa');

        const startRes = await startCodigoEstelarSession({
          studentToken: fixture.studentToken,
          minijuegoId,
          dificultad: 2,
        });

        expect(startRes.status).toBe(201);
        expect(startRes.body.data.sesion.sesion_clase_id).toBe(openClassRes.body.data.sesion_clase_id);

        const rankingUpdatedPromise = waitForSocketEvent(socket, 'ranking:updated');
        await registerEventsAndFinalize({
          studentToken: fixture.studentToken,
          sessionId: startRes.body.data.sesion.id,
          events: [
            { tipo_evento: 'acierto', puntos: 12, combo_en_evento: 1 },
          ],
        });

        const rankingUpdated = await rankingUpdatedPromise;
        expect(rankingUpdated.grupoId).toBe(fixture.groupId);
        expect(rankingUpdated.studentId).toBe(fixture.studentId);
        expect(rankingUpdated.reason).toBe('session_finalized');
      } finally {
        await closeSocket(socket);
      }
    },
    45_000
  );
});
