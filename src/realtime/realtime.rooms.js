import { REALTIME_ACTOR_TYPES, REALTIME_DOMAIN_EVENTS } from './realtime.contract.js';

export const buildUserRoomKey = (userId) => `user:${userId}`;
export const buildStudentRoomKey = (studentId) => `student:${studentId}`;
export const buildGroupRoomKey = (groupId) => `group:${groupId}`;
export const buildInstitutionRoomKey = (institutionId) => `institution:${institutionId}`;

const compactUniqueRooms = (rooms) => [...new Set(rooms.filter(Boolean))];

export const resolveRealtimeActorRooms = (actor) => {
  if (!actor) {
    return [];
  }

  const rooms = [];

  if (actor.institucion_id != null) {
    rooms.push(buildInstitutionRoomKey(actor.institucion_id));
  }

  if (actor.actorType === REALTIME_ACTOR_TYPES.web) {
    rooms.push(buildUserRoomKey(actor.id));
  }

  if (actor.actorType === REALTIME_ACTOR_TYPES.student) {
    rooms.push(buildStudentRoomKey(actor.id));

    if (actor.grupo_id != null) {
      rooms.push(buildGroupRoomKey(actor.grupo_id));
    }
  }

  return compactUniqueRooms(rooms);
};

const addStudentRooms = (rooms, studentIds = []) => {
  studentIds.forEach((studentId) => {
    if (studentId != null) {
      rooms.push(buildStudentRoomKey(studentId));
    }
  });
};

export const resolveRoomsForRealtimeEvent = (eventName, payload = {}) => {
  const rooms = [];

  if (payload.institucionId != null) {
    rooms.push(buildInstitutionRoomKey(payload.institucionId));
  }

  if (payload.grupoId != null) {
    rooms.push(buildGroupRoomKey(payload.grupoId));
  }

  if (payload.grupoAnteriorId != null) {
    rooms.push(buildGroupRoomKey(payload.grupoAnteriorId));
  }

  if (payload.tutorId != null) {
    rooms.push(buildUserRoomKey(payload.tutorId));
  }

  if (payload.studentId != null) {
    rooms.push(buildStudentRoomKey(payload.studentId));
  }

  addStudentRooms(rooms, payload.studentIds);

  if (eventName === REALTIME_DOMAIN_EVENTS.rankingUpdated && payload.ownerStudentId != null) {
    rooms.push(buildStudentRoomKey(payload.ownerStudentId));
  }

  return compactUniqueRooms(rooms);
};
