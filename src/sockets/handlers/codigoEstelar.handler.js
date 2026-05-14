import { parseCodigoEstelarJoinPayload, parseCodigoEstelarSubmitPayload } from '../games/codigoEstelar/codigoEstelar.socket.schema.js';
import {
  disconnectCodigoEstelarSocket,
  joinCodigoEstelarSession,
  submitCodigoEstelarAnswer,
} from '../games/codigoEstelar/codigoEstelar.service.js';
import { emitSocketError } from '../socketError.utils.js';
import { CODIGO_ESTELAR_SOCKET_EVENTS } from '../../games/codigoEstelar/codigoEstelar.config.js';

export const registerCodigoEstelarHandlers = (io, socket) => {
  socket.on(CODIGO_ESTELAR_SOCKET_EVENTS.join, async (payload) => {
    try {
      const parsedPayload = parseCodigoEstelarJoinPayload(payload);
      const result = await joinCodigoEstelarSession(socket, parsedPayload);

      if (result.replacedSocketId) {
        const previousSocket = io.sockets.sockets.get(result.replacedSocketId);
        if (previousSocket) {
          previousSocket.leave(result.roomKey);
          previousSocket.data.codigoEstelar = undefined;
          emitSocketError(previousSocket, CODIGO_ESTELAR_SOCKET_EVENTS.error, {
            code: 'STALE_SOCKET',
            message: 'Otra conexion reemplazo esta sesion en tiempo real',
          });
        }
      }

      socket.emit(CODIGO_ESTELAR_SOCKET_EVENTS.joined, result.joinedPayload);

      if (result.gameOverPayload) {
        socket.emit(CODIGO_ESTELAR_SOCKET_EVENTS.game_over, result.gameOverPayload);
      }
    } catch (error) {
      emitSocketError(socket, CODIGO_ESTELAR_SOCKET_EVENTS.error, error);
    }
  });

  socket.on(CODIGO_ESTELAR_SOCKET_EVENTS.submit, async (payload) => {
    try {
      const parsedPayload = parseCodigoEstelarSubmitPayload(payload);
      const result = await submitCodigoEstelarAnswer(socket, parsedPayload);

      io.to(result.roomKey).emit(CODIGO_ESTELAR_SOCKET_EVENTS.leaderboard, result.leaderboardPayload);

      if (result.gameOverPayload) {
        io.to(result.roomKey).emit(CODIGO_ESTELAR_SOCKET_EVENTS.game_over, result.gameOverPayload);
      }
    } catch (error) {
      emitSocketError(socket, CODIGO_ESTELAR_SOCKET_EVENTS.error, error);
    }
  });

  socket.on('disconnect', () => {
    const result = disconnectCodigoEstelarSocket(socket);
    if (!result) {
      return;
    }

    io.to(result.roomKey).emit(CODIGO_ESTELAR_SOCKET_EVENTS.leaderboard, result.leaderboardPayload);
  });
};
