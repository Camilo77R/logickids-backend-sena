import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { corsOriginHandler } from '../config/cors.js';
import { registerCodigoEstelarHandlers } from './handlers/codigoEstelar.handler.js';
import { resolveStudentSessionFromToken } from '../services/auth-session.service.js';
import { AppError } from '../middlewares/errorHandler.js';
import { toSocketConnectError } from './socketError.utils.js';

export const setupSockets = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOriginHandler,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        throw new AppError('Token de estudiante requerido para conectar por socket', 401);
      }

      socket.data.estudiante = await resolveStudentSessionFromToken(token);
      next();
    } catch (error) {
      next(toSocketConnectError(error));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Cliente autenticado: ${socket.id} estudiante=${socket.data.estudiante?.id}`);

    registerCodigoEstelarHandlers(io, socket);
  });

  return io;
};
