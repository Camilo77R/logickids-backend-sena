import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'http';
import request from 'supertest';
import { io as createSocketClient } from 'socket.io-client';
import app from '../src/app.js';
import { db } from '../src/config/db.js';
import { CODIGO_ESTELAR_SOCKET_EVENTS } from '../src/games/codigoEstelar/codigoEstelar.config.js';
import { setupSockets } from '../src/sockets/socket.manager.js';
import {
  authHeader,
  provisionPlayableStudent,
  resolveCodigoEstelarId,
  startCodigoEstelarSession,
} from './helpers/codigoEstelar.helper.js';

const SOCKET_TIMEOUT_MS = 5_000;

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

const createStudentSocket = (baseUrl, token) =>
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

describe('🔌 Sockets — Codigo Estelar', () => {
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

  it('✅ autentica, une por sesionId y calcula el puntaje oficial en el servidor', async () => {
    const minijuegoId = await resolveCodigoEstelarId();
    const fixture = await provisionPlayableStudent();
    const startRes = await startCodigoEstelarSession({
      studentToken: fixture.studentToken,
      minijuegoId,
      dificultad: 2,
    });

    expect(startRes.status).toBe(201);

    const sesionId = startRes.body.data.sesion.id;
    const numeroObjetivo = startRes.body.data.game_config.numero_objetivo;
    const socket = createStudentSocket(socketBaseUrl, fixture.studentToken);

    try {
      await waitForSocketEvent(socket, 'connect', { rejectOn: 'connect_error' });

      socket.emit(CODIGO_ESTELAR_SOCKET_EVENTS.join, { sesionId });
      const joined = await waitForSocketEvent(socket, CODIGO_ESTELAR_SOCKET_EVENTS.joined, {
        rejectOn: CODIGO_ESTELAR_SOCKET_EVENTS.error,
      });

      expect(joined.sesionId).toBe(sesionId);
      expect(joined.player.id).toBe(fixture.studentId);
      expect(joined.gameState.numeroObjetivo).toBe(numeroObjetivo);
      expect(joined.gameState.leaderboard[0]).toMatchObject({
        estudianteId: fixture.studentId,
        puntaje: 0,
      });

      socket.emit(CODIGO_ESTELAR_SOCKET_EVENTS.submit, {
        sesionId,
        numeroMeteorito: numeroObjetivo + 1,
        clasificacionElegida: 'mayor',
        tiempoReaccionMs: 1_200,
      });

      const leaderboardUpdate = await waitForSocketEvent(
        socket,
        CODIGO_ESTELAR_SOCKET_EVENTS.leaderboard,
        { rejectOn: CODIGO_ESTELAR_SOCKET_EVENTS.error }
      );

      expect(leaderboardUpdate.resultadoJugador.esCorrecto).toBe(true);
      expect(leaderboardUpdate.resultadoJugador.deltaPuntos).toBe(15);
      expect(leaderboardUpdate.resultadoJugador.comboActual).toBe(1);
      expect(leaderboardUpdate.leaderboard[0]).toMatchObject({
        estudianteId: fixture.studentId,
        puntaje: 15,
        combo: 1,
      });

      const persistedEvent = await db('eventos_sesion')
        .join('tipos_evento', 'tipos_evento.id_tipo_evento', 'eventos_sesion.tipo_evento_id')
        .where('eventos_sesion.sesion_id', sesionId)
        .select('tipos_evento.nombre as tipo', 'eventos_sesion.puntos', 'eventos_sesion.combo_en_evento')
        .orderBy('eventos_sesion.ocurrido_en', 'desc')
        .first();

      expect(persistedEvent).toMatchObject({
        tipo: 'acierto',
        puntos: 15,
        combo_en_evento: 1,
      });
    } finally {
      await closeSocket(socket);
    }
  });

  it('❌ rechaza el handshake si la institucion fue desactivada aunque el token sea viejo', async () => {
    const fixture = await provisionPlayableStudent();

    const deactivateInstitutionRes = await request(app)
      .patch(`/api/admin/instituciones/${fixture.institutionId}/desactivar`)
      .set(authHeader(fixture.superToken));

    expect(deactivateInstitutionRes.status).toBe(200);

    const socket = createStudentSocket(socketBaseUrl, fixture.studentToken);

    try {
      const connectionError = await waitForSocketEvent(socket, 'connect_error');
      expect(connectionError.message.toLowerCase()).toContain('instituci');
      expect(connectionError.data.code).toBe('FORBIDDEN');
    } finally {
      await closeSocket(socket);
    }
  });

  it('❌ bloquea nuevas respuestas si el grupo fue archivado durante la partida', async () => {
    const minijuegoId = await resolveCodigoEstelarId();
    const fixture = await provisionPlayableStudent();
    const startRes = await startCodigoEstelarSession({
      studentToken: fixture.studentToken,
      minijuegoId,
      dificultad: 2,
    });

    expect(startRes.status).toBe(201);

    const sesionId = startRes.body.data.sesion.id;
    const numeroObjetivo = startRes.body.data.game_config.numero_objetivo;
    const socket = createStudentSocket(socketBaseUrl, fixture.studentToken);

    try {
      await waitForSocketEvent(socket, 'connect', { rejectOn: 'connect_error' });

      socket.emit(CODIGO_ESTELAR_SOCKET_EVENTS.join, { sesionId });
      await waitForSocketEvent(socket, CODIGO_ESTELAR_SOCKET_EVENTS.joined, {
        rejectOn: CODIGO_ESTELAR_SOCKET_EVENTS.error,
      });

      const archiveGroupRes = await request(app)
        .patch(`/api/grupos/${fixture.groupId}/archivar`)
        .set(authHeader(fixture.adminToken));

      expect(archiveGroupRes.status).toBe(200);

      socket.emit(CODIGO_ESTELAR_SOCKET_EVENTS.submit, {
        sesionId,
        numeroMeteorito: numeroObjetivo + 2,
        clasificacionElegida: 'mayor',
        tiempoReaccionMs: 900,
      });

      const gameError = await waitForSocketEvent(socket, CODIGO_ESTELAR_SOCKET_EVENTS.error);
      expect(gameError.code).toBe('GROUP_NOT_PLAYABLE');
      expect(gameError.message).toContain('grupo activo');
    } finally {
      await closeSocket(socket);
    }
  });

  it(
    '✅ auto-finaliza la sesión cuando llega game_over y tolera un finalize tardío del móvil',
    async () => {
    const minijuegoId = await resolveCodigoEstelarId();
    const fixture = await provisionPlayableStudent();
    const startRes = await startCodigoEstelarSession({
      studentToken: fixture.studentToken,
      minijuegoId,
      dificultad: 2,
    });

    expect(startRes.status).toBe(201);

    const sesionId = startRes.body.data.sesion.id;
    const numeroObjetivo = startRes.body.data.game_config.numero_objetivo;
    const socket = createStudentSocket(socketBaseUrl, fixture.studentToken);

    try {
      await waitForSocketEvent(socket, 'connect', { rejectOn: 'connect_error' });

      socket.emit(CODIGO_ESTELAR_SOCKET_EVENTS.join, { sesionId });
      await waitForSocketEvent(socket, CODIGO_ESTELAR_SOCKET_EVENTS.joined, {
        rejectOn: CODIGO_ESTELAR_SOCKET_EVENTS.error,
      });

      for (let attempt = 0; attempt < 6; attempt += 1) {
        socket.emit(CODIGO_ESTELAR_SOCKET_EVENTS.submit, {
          sesionId,
          numeroMeteorito: numeroObjetivo + 1,
          clasificacionElegida: 'mayor',
          tiempoReaccionMs: 1_000,
        });

        await waitForSocketEvent(socket, CODIGO_ESTELAR_SOCKET_EVENTS.leaderboard, {
          rejectOn: CODIGO_ESTELAR_SOCKET_EVENTS.error,
        });
      }

      const gameOverPromise = waitForSocketEvent(socket, CODIGO_ESTELAR_SOCKET_EVENTS.game_over, {
        rejectOn: CODIGO_ESTELAR_SOCKET_EVENTS.error,
        timeoutMs: 15_000,
      });
      socket.emit(CODIGO_ESTELAR_SOCKET_EVENTS.submit, {
        sesionId,
        numeroMeteorito: numeroObjetivo + 1,
        clasificacionElegida: 'mayor',
        tiempoReaccionMs: 1_000,
      });

      const gameOver = await gameOverPromise;

      expect(gameOver.ganador.estudianteId).toBe(fixture.studentId);
      expect(gameOver.ganador.puntaje).toBeGreaterThanOrEqual(100);

      const persistedSession = await db('sesiones_juego')
        .join('estados_sesion', 'estados_sesion.id_estado_sesion', 'sesiones_juego.estado_id')
        .where('sesiones_juego.id_sesion_juego', sesionId)
        .select(
          'sesiones_juego.puntaje',
          'sesiones_juego.aciertos',
          'sesiones_juego.errores',
          'sesiones_juego.combo_maximo',
          'estados_sesion.nombre as estado'
        )
        .first();

      expect(persistedSession).toMatchObject({
        puntaje: 105,
        aciertos: 7,
        errores: 0,
        combo_maximo: 7,
        estado: 'completado',
      });

      const lateFinalize = await request(app)
        .post(`/api/sesiones/${sesionId}/finalizar`)
        .set(authHeader(fixture.studentToken))
        .send({ estado: 'completado' });

      expect(lateFinalize.status).toBe(200);
      expect(lateFinalize.body.data.finalizacion_idempotente).toBe(true);
      expect(lateFinalize.body.data.resumen_oficial).toEqual({
        puntaje: 105,
        aciertos: 7,
        errores: 0,
        combo_maximo: 7,
      });
    } finally {
      await closeSocket(socket);
    }
    },
    30_000
  );
});
