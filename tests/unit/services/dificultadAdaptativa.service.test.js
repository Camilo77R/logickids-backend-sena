import { describe, it, expect } from 'vitest';

const { calculateAdaptiveDifficulty, calculateInActivityDifficulty, ADAPTIVE_DIFFICULTY_RULES }
  = await import('../../../src/services/dificultadAdaptativa.service.js');

const buildMinigame = (overrides = {}) => ({
  dificultad_maxima: 4, habilidad: 'logica', slug: 'test-game', ...overrides,
});

const buildSession = (overrides = {}) => ({
  dificultad: 2, aciertos: 10, errores: 2, estado: 'completado', ...overrides,
});

describe('calculateAdaptiveDifficulty', () => {
  it('retorna "inicial" si no hay stats ni sesiones', () => {
    const result = calculateAdaptiveDifficulty({ stats: null, recentSessions: [], minigame: buildMinigame() });
    expect(result.decision).toBe('inicial');
    expect(result.dificultad).toBe(1);
  });

  it('retorna "mantener" si no hay evidencia suficiente', () => {
    const result = calculateAdaptiveDifficulty({
      stats: { total_intentos: 3, precision_pct: 100 },
      recentSessions: [buildSession({ dificultad: 1 })],
      minigame: buildMinigame(),
    });
    expect(result.decision).toBe('mantener');
    expect(result.dificultad).toBe(1);
  });

  it('retorna "mantener" si está en cooldown', () => {
    const result = calculateAdaptiveDifficulty({
      stats: { total_intentos: 10, precision_pct: 90 },
      recentSessions: [
        buildSession({ dificultad: 2 }),
        buildSession({ dificultad: 1 }),
      ],
      minigame: buildMinigame(),
    });
    expect(result.decision).toBe('mantener');
  });

  it('retorna "subir" si domina', () => {
    const result = calculateAdaptiveDifficulty({
      stats: { total_intentos: 20, precision_pct: 80 },
      recentSessions: [
        buildSession({ dificultad: 2, aciertos: 8, errores: 0 }),
        buildSession({ dificultad: 2, aciertos: 7, errores: 0 }),
        buildSession({ dificultad: 1, aciertos: 6, errores: 1 }),
      ],
      minigame: buildMinigame(),
    });
    expect(result.decision).toBe('subir');
    expect(result.dificultad).toBe(3);
  });

  it('retorna "bajar" si hay dos sesiones débiles', () => {
    const result = calculateAdaptiveDifficulty({
      stats: { total_intentos: 15, precision_pct: 30 },
      recentSessions: [
        buildSession({ dificultad: 2, aciertos: 1, errores: 5 }),
        buildSession({ dificultad: 2, aciertos: 2, errores: 4 }),
      ],
      minigame: buildMinigame(),
    });
    expect(result.decision).toBe('bajar');
    expect(result.dificultad).toBe(1);
  });

  it('no baja del nivel mínimo', () => {
    const result = calculateAdaptiveDifficulty({
      stats: { total_intentos: 10, precision_pct: 10 },
      recentSessions: [
        buildSession({ dificultad: 1, aciertos: 0, errores: 5 }),
        buildSession({ dificultad: 1, aciertos: 1, errores: 4 }),
      ],
      minigame: buildMinigame(),
    });
    expect(result.decision).toBe('mantener');
    expect(result.dificultad).toBe(1);
  });

  it('no subemás allá del máximo', () => {
    const result = calculateAdaptiveDifficulty({
      stats: { total_intentos: 20, precision_pct: 85 },
      recentSessions: [
        buildSession({ dificultad: 4, aciertos: 8, errores: 0 }),
        buildSession({ dificultad: 4, aciertos: 7, errores: 1 }),
      ],
      minigame: buildMinigame({ dificultad_maxima: 4 }),
    });
    expect(result.dificultad).toBe(4);
  });
});

describe('calculateInActivityDifficulty', () => {
  it('retorna "subir" si completó sin errores', () => {
    const result = calculateInActivityDifficulty({
      previousSession: buildSession({ aciertos: 5, errores: 0, estado: 'completado' }),
      minigame: buildMinigame(),
    });
    expect(result.decision).toBe('subir');
    expect(result.dificultad).toBe(3);
  });

  it('retorna "bajar" si abandonó o tuvo 2+ errores', () => {
    const result = calculateInActivityDifficulty({
      previousSession: buildSession({ aciertos: 1, errores: 3, estado: 'completado' }),
      minigame: buildMinigame(),
    });
    expect(result.decision).toBe('bajar');
    expect(result.dificultad).toBe(1);
  });

  it('retorna "mantener" si no hay intentos', () => {
    const result = calculateInActivityDifficulty({
      previousSession: buildSession({ aciertos: 0, errores: 0 }),
      minigame: buildMinigame(),
    });
    expect(result.decision).toBe('mantener');
  });
});

describe('ADAPTIVE_DIFFICULTY_RULES', () => {
  it('tiene valores congelados', () => {
    expect(Object.isFrozen(ADAPTIVE_DIFFICULTY_RULES)).toBe(true);
    expect(ADAPTIVE_DIFFICULTY_RULES.minimumHistoricalAttempts).toBe(8);
  });
});