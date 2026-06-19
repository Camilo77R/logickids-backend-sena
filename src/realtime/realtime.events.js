import { EventEmitter } from 'node:events';
import { REALTIME_DOMAIN_EVENTS } from './realtime.contract.js';

const realtimeBus = new EventEmitter();
realtimeBus.setMaxListeners(100);

const buildStampedPayload = (payload = {}) => ({
  ...payload,
  occurredAt: payload.occurredAt ?? new Date().toISOString(),
});

const publishRealtimeEvent = (eventName, payload) => {
  const stampedPayload = buildStampedPayload(payload);
  realtimeBus.emit(eventName, stampedPayload);
  return stampedPayload;
};

export const publishClassSessionChanged = (payload) =>
  publishRealtimeEvent(REALTIME_DOMAIN_EVENTS.classSessionChanged, payload);

export const publishRankingUpdated = (payload) =>
  publishRealtimeEvent(REALTIME_DOMAIN_EVENTS.rankingUpdated, payload);

export const publishStudentAccessChanged = (payload) =>
  publishRealtimeEvent(REALTIME_DOMAIN_EVENTS.studentAccessChanged, payload);

const subscribeRealtimeEvent = (eventName, handler) => {
  realtimeBus.on(eventName, handler);
  return () => realtimeBus.off(eventName, handler);
};

export const subscribeRealtimeDomainHandlers = ({
  onClassSessionChanged,
  onRankingUpdated,
  onStudentAccessChanged,
} = {}) => {
  const cleanups = [];

  if (onClassSessionChanged) {
    cleanups.push(
      subscribeRealtimeEvent(REALTIME_DOMAIN_EVENTS.classSessionChanged, onClassSessionChanged)
    );
  }

  if (onRankingUpdated) {
    cleanups.push(subscribeRealtimeEvent(REALTIME_DOMAIN_EVENTS.rankingUpdated, onRankingUpdated));
  }

  if (onStudentAccessChanged) {
    cleanups.push(
      subscribeRealtimeEvent(REALTIME_DOMAIN_EVENTS.studentAccessChanged, onStudentAccessChanged)
    );
  }

  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
};
