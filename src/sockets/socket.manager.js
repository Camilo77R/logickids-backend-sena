import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { corsOriginHandler } from '../config/cors.js';
import { registerCodigoEstelarHandlers } from './handlers/codigoEstelar.handler.js';
import { resolveRealtimeActorFromToken } from '../services/auth-session.service.js';
import { AppError } from '../middlewares/errorHandler.js';
import { toSocketConnectError } from './socketError.utils.js';
import { REALTIME_ACTOR_TYPES, REALTIME_DOMAIN_EVENTS } from '../realtime/realtime.contract.js';
import { subscribeRealtimeDomainHandlers } from '../realtime/realtime.events.js';
import {
  resolveRealtimeActorRooms,
  resolveRoomsForRealtimeEvent,
} from '../realtime/realtime.rooms.js';

const attachRealtimeBridge = (io) => {
  const emitToResolvedRooms = (eventName, payload) => {
    const rooms = resolveRoomsForRealtimeEvent(eventName, payload);

    rooms.forEach((room) => {
      io.to(room).emit(eventName, payload);
    });
  };

  const detach = subscribeRealtimeDomainHandlers({
    onClassSessionChanged: (payload) =>
      emitToResolvedRooms(REALTIME_DOMAIN_EVENTS.classSessionChanged, payload),
    onRankingUpdated: (payload) =>
      emitToResolvedRooms(REALTIME_DOMAIN_EVENTS.rankingUpdated, payload),
    onStudentAccessChanged: (payload) =>
      emitToResolvedRooms(REALTIME_DOMAIN_EVENTS.studentAccessChanged, payload),
  });

  const originalClose = io.close.bind(io);
  io.close = (callback) => {
    detach();
    return originalClose(callback);
  };
};

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
        throw new AppError('Token requerido para conectar por socket', 401);
      }

      const actor = await resolveRealtimeActorFromToken(token);
      socket.data.actor = actor;

      if (actor.actorType === REALTIME_ACTOR_TYPES.student) {
        socket.data.estudiante = actor.session;
      }

      if (actor.actorType === REALTIME_ACTOR_TYPES.web) {
        socket.data.user = actor.session;
      }

      next();
    } catch (error) {
      next(toSocketConnectError(error));
    }
  });

  attachRealtimeBridge(io);

  io.on('connection', async (socket) => {
    const actor = socket.data.actor;
    const actorRooms = resolveRealtimeActorRooms(actor);

    if (actorRooms.length) {
      await socket.join(actorRooms);
    }

    console.log(
      `[Socket] Cliente autenticado: ${socket.id} actor=${actor?.actorType} id=${actor?.id}`
    );

    if (actor?.actorType === REALTIME_ACTOR_TYPES.student) {
      registerCodigoEstelarHandlers(io, socket);
    }
  });

  return io;
};
