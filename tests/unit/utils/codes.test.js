import { describe, it, expect } from 'vitest';
import { randomCode } from '../../../src/utils/codes.js';

describe('randomCode', () => {
  it('genera código de 6 caracteres por defecto', () => {
    const code = randomCode();
    expect(code).toHaveLength(6);
  });

  it('genera código con longitud personalizada', () => {
    const code = randomCode(10);
    expect(code).toHaveLength(10);
  });

  it('solo contiene caracteres válidos', () => {
    const validChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 100; i++) {
      const code = randomCode(8);
      [...code].forEach((ch) => {
        expect(validChars).toContain(ch);
      });
    }
  });

  it('genera códigos diferentes en cada llamada', () => {
    const codes = new Set(Array.from({ length: 50 }, () => randomCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});