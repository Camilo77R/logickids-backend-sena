import {
  CODIGO_ESTELAR_META_PUNTAJE,
} from '../../../games/codigoEstelar/codigoEstelar.config.js';
import { SocketAppError } from '../../socketError.utils.js';

const sortLeaderboard = (left, right) => {
  if (right.puntaje !== left.puntaje) return right.puntaje - left.puntaje;
  if (right.aciertos !== left.aciertos) return right.aciertos - left.aciertos;
  if (left.errores !== right.errores) return left.errores - right.errores;
  return left.nombre.localeCompare(right.nombre, 'es');
};

const toLeaderboardEntry = (player) => ({
  estudianteId: player.estudianteId,
  nombre: player.nombre,
  puntaje: player.puntaje,
  combo: player.combo,
  aciertos: player.aciertos,
  errores: player.errores,
});

const buildNextPlayerState = (player, evaluation) => {
  const baseState = {
    ...player,
    puntaje: player.puntaje + evaluation.deltaPuntos,
    aciertos: player.aciertos,
    errores: player.errores,
    combo: player.combo,
    comboMaximo: player.comboMaximo,
  };

  if (evaluation.esCorrecto) {
    baseState.aciertos += 1;
    baseState.combo += 1;
    baseState.comboMaximo = Math.max(baseState.comboMaximo, baseState.combo);
    return baseState;
  }

  baseState.errores += 1;
  baseState.combo = 0;
  return baseState;
};

class CodigoEstelarStore {
  constructor() {
    this.rooms = new Map();
    this.socketIndex = new Map();
  }

  ensureRoom(roomKey, roomSeed) {
    const existingRoom = this.rooms.get(roomKey);

    if (existingRoom) {
      const configMismatch =
        existingRoom.grupoId !== roomSeed.grupoId ||
        existingRoom.dificultad !== roomSeed.dificultad ||
        existingRoom.numeroObjetivo !== roomSeed.numeroObjetivo ||
        existingRoom.metaPuntaje !== roomSeed.metaPuntaje;

      if (configMismatch) {
        throw new SocketAppError(
          'ROOM_CONFIG_CONFLICT',
          'La sala ya esta corriendo con una configuracion distinta',
          409
        );
      }

      return existingRoom;
    }

    const room = {
      roomKey,
      grupoId: roomSeed.grupoId,
      dificultad: roomSeed.dificultad,
      numeroObjetivo: roomSeed.numeroObjetivo,
      metaPuntaje: roomSeed.metaPuntaje ?? CODIGO_ESTELAR_META_PUNTAJE,
      status: 'playing',
      players: new Map(),
      winner: null,
      gameOverPayload: null,
    };

    this.rooms.set(roomKey, room);
    return room;
  }

  getRoom(roomKey) {
    return this.rooms.get(roomKey) ?? null;
  }

  getLeaderboard(roomKey) {
    const room = this.getRoom(roomKey);
    if (!room) {
      return [];
    }

    return [...room.players.values()].map(toLeaderboardEntry).sort(sortLeaderboard);
  }

  getPlayer(roomKey, estudianteId) {
    const room = this.getRoom(roomKey);
    return room?.players.get(estudianteId) ?? null;
  }

  upsertPlayer(roomKey, roomSeed, playerSeed) {
    const room = this.ensureRoom(roomKey, roomSeed);
    const existingPlayer = room.players.get(playerSeed.estudianteId);
    const replacedSocketId =
      existingPlayer && existingPlayer.socketId !== playerSeed.socketId
        ? existingPlayer.socketId
        : null;

    if (replacedSocketId) {
      this.socketIndex.delete(replacedSocketId);
    }

    room.players.set(playerSeed.estudianteId, {
      ...existingPlayer,
      ...playerSeed,
      puntaje: existingPlayer?.puntaje ?? playerSeed.puntaje ?? 0,
      combo: existingPlayer?.combo ?? playerSeed.combo ?? 0,
      aciertos: existingPlayer?.aciertos ?? playerSeed.aciertos ?? 0,
      errores: existingPlayer?.errores ?? playerSeed.errores ?? 0,
      comboMaximo: existingPlayer?.comboMaximo ?? playerSeed.comboMaximo ?? 0,
    });

    this.socketIndex.set(playerSeed.socketId, {
      roomKey,
      estudianteId: playerSeed.estudianteId,
    });

    return {
      room,
      player: room.players.get(playerSeed.estudianteId),
      replacedSocketId,
    };
  }

  assertPlayerSocket(roomKey, estudianteId, socketId) {
    const player = this.getPlayer(roomKey, estudianteId);

    if (!player) {
      throw new SocketAppError(
        'SOCKET_NOT_JOINED',
        'El estudiante no esta unido a la sala de Codigo Estelar',
        409
      );
    }

    if (player.socketId !== socketId) {
      throw new SocketAppError(
        'STALE_SOCKET',
        'Esta conexion ya fue reemplazada por otra mas reciente',
        409
      );
    }

    return player;
  }

  previewAnswerResult(roomKey, estudianteId, evaluation) {
    const room = this.getRoom(roomKey);
    if (!room) {
      throw new SocketAppError('ROOM_NOT_FOUND', 'La sala ya no existe en memoria', 404);
    }

    if (room.status === 'finished') {
      throw new SocketAppError('GAME_ALREADY_FINISHED', 'La partida ya termino', 409);
    }

    const player = this.getPlayer(roomKey, estudianteId);
    if (!player) {
      throw new SocketAppError(
        'SOCKET_NOT_JOINED',
        'El estudiante no esta unido a la sala de Codigo Estelar',
        409
      );
    }

    return {
      room,
      nextPlayer: buildNextPlayerState(player, evaluation),
    };
  }

  applyAnswerResult(roomKey, estudianteId, evaluation) {
    const { room, nextPlayer } = this.previewAnswerResult(roomKey, estudianteId, evaluation);
    room.players.set(estudianteId, nextPlayer);

    const leaderboard = this.getLeaderboard(roomKey);
    let gameOverPayload = null;

    if (nextPlayer.puntaje >= room.metaPuntaje) {
      room.status = 'finished';
      room.winner = {
        estudianteId: nextPlayer.estudianteId,
        nombre: nextPlayer.nombre,
        puntaje: nextPlayer.puntaje,
      };
      room.gameOverPayload = {
        motivo: 'meta_alcanzada',
        ganador: room.winner,
        rankingFinal: leaderboard,
      };
      gameOverPayload = room.gameOverPayload;
    }

    return {
      room,
      player: nextPlayer,
      leaderboard,
      gameOverPayload,
    };
  }

  removePlayerBySocketId(socketId) {
    const index = this.socketIndex.get(socketId);
    if (!index) {
      return null;
    }

    this.socketIndex.delete(socketId);

    const room = this.getRoom(index.roomKey);
    if (!room) {
      return null;
    }

    const player = room.players.get(index.estudianteId);
    if (!player || player.socketId !== socketId) {
      return null;
    }

    room.players.delete(index.estudianteId);

    const leaderboard = this.getLeaderboard(index.roomKey);
    if (room.players.size === 0) {
      this.rooms.delete(index.roomKey);
    }

    return {
      roomKey: index.roomKey,
      leaderboard,
      status: room.players.size === 0 ? 'deleted' : room.status,
    };
  }
}

export const codigoEstelarStore = new CodigoEstelarStore();
