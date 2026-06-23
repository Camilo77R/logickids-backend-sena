import { randomInt } from 'node:crypto';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const randomCode = (length = 6) =>
  Array.from({ length }, () => CHARS[randomInt(CHARS.length)]).join('');
