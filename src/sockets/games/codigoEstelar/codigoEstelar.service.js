import { db } from '../../../config/db.js';
import {
  buildCodigoEstelarGameConfig,
  buildRoomKey,
  CODIGO_ESTELAR_SLUG,
  evaluateCodigoEstelarAnswer,
} from '../../../games/codigoEstelar/codigoEstelar.config.js';
import { withActiveGroupHistory } from '../../../services/access.service.js';
import {
  finalizarSesionesAutoritativas,
  registrarEvento,
} from '../../../services/sesiones.service.js';
import { SocketAppError } from '../../socketError.utils.js';
import { codigoEstelarStore } from './codigoEstelar.store.js';

const resolveRealtimeSessionContext = (sesionId, estudianteId) =>
  withActiveGroupHistory(
    db('sesiones_juego')
      .join('estudiantes', 'estudiantes.id_estudiante', 'sesiones_juego.estudiante_id')
      .join(
        'estados_estudiante',
        'estados_estudiante.id_estado_estudiante',
        'estudiantes.estado_id'
      )
      .leftJoin('instituciones', 'instituciones.id_institucion', 'estudiantes.institucion_id')
      .join('minijuegos', 'minijuegos.id_minijuego', 'sesiones_juego.minijuego_id')
      .join('habilidades', 'habilidades.id_habilidad', 'minijuegos.habilidad_id')
      .join('estados_sesion', 'estados_sesion.id_estado_sesion', 'sesiones_juego.estado_id')
      .leftJoin('sesiones_clase', 'sesiones_clase.id_sesion_clase', 'sesiones_juego.sesion_clase_id')
  )
    .leftJoin('grupos', 'grupos.id_grupo', 'egh.grupo_id')
    .where('sesiones_juego.id_sesion_juego', sesionId)
    .where('sesiones_juego.estudiante_id', estudianteId)
    .select(
      'sesiones_juego.id_sesion_juego as sesion_id',
      'sesiones_juego.dificultad',
      'sesiones_juego.orden_en_ruta',
      'estados_sesion.nombre as sesion_estado',
      'estudiantes.id_estudiante as estudiante_id',
      'estudiantes.nombre as estudiante_nombre',
      'estudiantes.institucion_id',
      'estados_estudiante.nombre as estudiante_estado',
      'instituciones.activo as institucion_activa',
      'egh.grupo_id',
      'grupos.activo as grupo_activo',
      'sesiones_clase.estado as clase_estado',
      'minijuegos.slug as minijuego_slug',
      'habilidades.nombre as habilidad_nombre'
    )
    .first();

const assertPlayableRealtimeSession = (context) => {
  if (!context) {
    throw new SocketAppError('SESSION_NOT_FOUND', 'La sesion no existe o no te pertenece', 404);
  }

  if (context.minijuego_slug !== CODIGO_ESTELAR_SLUG) {
    throw new SocketAppError(
      'UNSUPPORTED_SESSION',
      'La sesion solicitada no pertenece a Codigo Estelar',
      409
    );
  }

  if (context.estudiante_estado !== 'activo') {
    throw new SocketAppError(
      'STUDENT_DISABLED',
      'La cuenta del estudiante no esta habilitada',
      403
    );
  }

  if (context.institucion_id != null && context.institucion_activa === false) {
    throw new SocketAppError(
      'INSTITUTION_DISABLED',
      'La institucion del estudiante esta desactivada',
      403
    );
  }

  if (!context.grupo_id || context.grupo_activo === false) {
    throw new SocketAppError(
      'GROUP_NOT_PLAYABLE',
      'El estudiante no tiene un grupo activo habilitado para jugar',
      403
    );
  }

  if (context.clase_estado !== 'activa') {
    throw new SocketAppError(
      'CLASS_NOT_ACTIVE',
      'Sesion no activa. El tutor debe abrir la clase primero.',
      403
    );
  }

  if (context.sesion_estado !== 'activo') {
    throw new SocketAppError('SESSION_NOT_ACTIVE', 'La sesion ya no esta activa', 409);
  }
};

const buildJoinedPayload = (session, room) => ({
  sesionId: session.sesion_id,
  player: {
    id: session.estudiante_id,
    nombre: session.estudiante_nombre,
  },
  room: {
    key: room.roomKey,
    grupoId: session.grupo_id,
  },
  gameState: {
    numeroObjetivo: room.numeroObjetivo,
    metaPuntaje: room.metaPuntaje,
    estado: room.status,
    leaderboard: codigoEstelarStore.getLeaderboard(room.roomKey),
  },
});

const assertSocketJoinedState = (socket, sesionId) => {
  const joinedState = socket.data.codigoEstelar;

  if (!joinedState) {
    throw new SocketAppError(
      'SOCKET_NOT_JOINED',
      'Debes unirte primero a la sala de Codigo Estelar',
      409
    );
  }

  if (joinedState.sesionId !== sesionId) {
    throw new SocketAppError(
      'SESSION_MISMATCH',
      'La sesion del evento no coincide con la sesion unida en este socket',
      409
    );
  }

  return joinedState;
};

/**
 * Une al estudiante autenticado a su sala oficial.
 *
 * ANALOGIA:
 * el cliente trae su ticket (`sesionId`), pero el servidor mira la lista
 * oficial y decide a que salon entra realmente.
 */
export const joinCodigoEstelarSession = async (socket, { sesionId }) => {
  const session = await resolveRealtimeSessionContext(sesionId, socket.data.estudiante.id);
  assertPlayableRealtimeSession(session);

  const gameConfig = buildCodigoEstelarGameConfig(session.grupo_id, session.dificultad);
  const roomKey = buildRoomKey(session.grupo_id, session.minijuego_slug);
  const joinResult = codigoEstelarStore.upsertPlayer(
    roomKey,
    {
      grupoId: session.grupo_id,
      dificultad: session.dificultad,
      numeroObjetivo: gameConfig.numero_objetivo,
      metaPuntaje: gameConfig.meta_puntaje,
    },
    {
      sesionId: session.sesion_id,
      estudianteId: session.estudiante_id,
      nombre: session.estudiante_nombre,
      socketId: socket.id,
      puntaje: 0,
      combo: 0,
      aciertos: 0,
      errores: 0,
      comboMaximo: 0,
    }
  );

  await socket.join(roomKey);
  socket.data.codigoEstelar = {
    sesionId: session.sesion_id,
    roomKey,
    estudianteId: session.estudiante_id,
  };

  return {
    joinedPayload: buildJoinedPayload(session, joinResult.room),
    replacedSocketId: joinResult.replacedSocketId,
    roomKey,
    gameOverPayload: joinResult.room.gameOverPayload,
  };
};

/**
 * Procesa una respuesta oficial de Codigo Estelar.
 *
 * PARETO:
 * el cliente manda la jugada; el servidor calcula si fue buena, actualiza el
 * combo, persiste el evento y recien ahi emite el ranking.
 */
export const submitCodigoEstelarAnswer = async (
  socket,
  { sesionId, numeroMeteorito, clasificacionElegida, tiempoReaccionMs }
) => {
  const joinedState = assertSocketJoinedState(socket, sesionId);
  const session = await resolveRealtimeSessionContext(sesionId, socket.data.estudiante.id);
  assertPlayableRealtimeSession(session);

  const roomKey = buildRoomKey(session.grupo_id, session.minijuego_slug);
  if (joinedState.roomKey !== roomKey) {
    throw new SocketAppError(
      'SESSION_ROOM_MISMATCH',
      'La sesion ya no coincide con la sala unida por este socket',
      409
    );
  }

  const room = codigoEstelarStore.getRoom(roomKey);
  if (!room) {
    throw new SocketAppError(
      'ROOM_NOT_FOUND',
      'La sala no esta disponible. Vuelve a unirte antes de jugar.',
      404
    );
  }

  const roomConfig = buildCodigoEstelarGameConfig(session.grupo_id, session.dificultad);
  if (!roomConfig.permite_igual && clasificacionElegida === 'igual') {
    throw new SocketAppError(
      'INVALID_CLASSIFICATION',
      'Esta dificultad no habilita la clasificacion igual',
      400
    );
  }

  codigoEstelarStore.assertPlayerSocket(roomKey, session.estudiante_id, socket.id);

  const evaluation = evaluateCodigoEstelarAnswer({
    numeroMeteorito,
    numeroObjetivo: room.numeroObjetivo,
    clasificacionElegida,
    tiempoReaccionMs,
  });

  const { nextPlayer } = codigoEstelarStore.previewAnswerResult(
    roomKey,
    session.estudiante_id,
    evaluation
  );

  await registrarEvento(session.sesion_id, session.estudiante_id, {
    tipo_evento: evaluation.esCorrecto ? 'acierto' : 'error',
    habilidad: session.habilidad_nombre,
    tiempo_reaccion_ms: tiempoReaccionMs,
    puntos: evaluation.deltaPuntos,
    combo_en_evento: nextPlayer.combo,
  });

  const result = codigoEstelarStore.applyAnswerResult(roomKey, session.estudiante_id, evaluation);

  if (result.gameOverPayload) {
    await finalizarSesionesAutoritativas(
      [...result.room.players.values()].map((player) => ({
        sesionId: player.sesionId,
        estudianteId: player.estudianteId,
      })),
      { estado: 'completado' }
    );
  }

  return {
    roomKey,
    leaderboardPayload: {
      sesionId: session.sesion_id,
      resultadoJugador: {
        estudianteId: result.player.estudianteId,
        esCorrecto: evaluation.esCorrecto,
        clasificacionEsperada: evaluation.clasificacionEsperada,
        deltaPuntos: evaluation.deltaPuntos,
        puntajeActual: result.player.puntaje,
        comboActual: result.player.combo,
      },
      leaderboard: result.leaderboard,
    },
    gameOverPayload: result.gameOverPayload,
  };
};

export const disconnectCodigoEstelarSocket = (socket) => {
  const removal = codigoEstelarStore.removePlayerBySocketId(socket.id);
  socket.data.codigoEstelar = undefined;

  if (!removal || removal.status === 'deleted') {
    return null;
  }

  return {
    roomKey: removal.roomKey,
    leaderboardPayload: {
      sesionId: null,
      leaderboard: removal.leaderboard,
    },
  };
};
