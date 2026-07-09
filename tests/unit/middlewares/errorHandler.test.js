import { describe, it, expect } from 'vitest';
import { AppError } from '../../../src/middlewares/errorHandler.js';

describe('AppError', () => {
  it('crea error con mensaje y statusCode', () => {
    const err = new AppError('No encontrado', 404);
    expect(err.message).toBe('No encontrado');
    expect(err.statusCode).toBe(404);
  });

  it('hereda de Error', () => {
    const err = new AppError('Error', 500);
    expect(err).toBeInstanceOf(Error);
  });
});