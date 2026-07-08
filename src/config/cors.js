import { env } from './env.js';

const configuredOriginRules = env.CORS_ORIGIN
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const escapeRegex = (value) => value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');

const buildWildcardMatcher = (originRule) =>
  new RegExp(`^${originRule.split('*').map(escapeRegex).join('.*')}$`);

const configuredOrigins = configuredOriginRules.filter((origin) => !origin.includes('*'));
const configuredOriginMatchers = configuredOriginRules
  .filter((origin) => origin.includes('*'))
  .map(buildWildcardMatcher);

const isPrivate172Address = (hostname) => {
  const match = /^172\.(\d{1,2})\./.exec(hostname);
  if (!match) return false;

  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
};

const isDevelopmentFriendlyOrigin = (origin) => {
  try {
    const { protocol, hostname } = new URL(origin);

    if (protocol === 'exp:' || protocol === 'exps:') {
      return true;
    }

    if (!['http:', 'https:'].includes(protocol)) {
      return false;
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }

    if (hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
      return true;
    }

    return isPrivate172Address(hostname);
  } catch {
    return false;
  }
};

/**
 * Decide si un origin puede hablar con la API.
 *
 * POR QUE:
 * - web local usa localhost:5173/5174
 * - celular y paginas debug usan IP LAN o esquemas de Expo
 * - mantener una sola regla evita que HTTP y sockets diverjan
 */
export const isAllowedCorsOrigin = (origin) => {
  if (!origin || origin === 'null') {
    return true;
  }

  if (configuredOrigins.includes(origin)) {
    return true;
  }

  if (configuredOriginMatchers.some((matcher) => matcher.test(origin))) {
    return true;
  }

  if (env.NODE_ENV !== 'production' && isDevelopmentFriendlyOrigin(origin)) {
    return true;
  }

  return false;
};

export const corsOriginHandler = (origin, callback) => {
  if (isAllowedCorsOrigin(origin)) {
    return callback(null, true);
  }

  return callback(new Error(`CORS bloqueado para origin ${origin}`));
};

