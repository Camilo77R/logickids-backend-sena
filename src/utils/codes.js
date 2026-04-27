const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const randomCode = (length = 6) =>
  Array.from({ length }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
