import { describe, expect, it } from 'vitest';
import {
  ADAPTIVE_DIFFICULTY_RULES,
  calculateAdaptiveDifficulty,
  calculateInActivityDifficulty,
} from '../src/services/dificultadAdaptativa.service.js';
import {
  buildMercadoInteligenteGameConfig,
  MERCADO_INTELIGENTE_DIFFICULTY_PRESETS,
} from '../src/games/mercadoInteligente/mercadoInteligente.config.js';

const minigame = {
  habilidad: 'Razonamiento',
  dificultad_maxima: 4,
};

const stats = (precision = 80, attempts = 20) => ({
  precision_pct: precision,
  total_intentos: attempts,
  promedio_reaccion_ms: 1800,
});

const completedSession = ({ difficulty = 2, hits = 1, errors = 0 } = {}) => ({
  dificultad: difficulty,
  aciertos: hits,
  errores: errors,
  estado: 'completado',
});

describe('motor de dificultad adaptativa V2', () => {
  it('inicia en nivel 1 cuando el estudiante no tiene estadisticas', () => {
    const result = calculateAdaptiveDifficulty({ stats: null, recentSessions: [], minigame });

    expect(result.dificultad).toBe(1);
    expect(result.decision).toBe('inicial');
    expect(result.fuente).toBe('reglas');
  });

  it('mantiene el nivel cuando aun no existe evidencia suficiente', () => {
    const result = calculateAdaptiveDifficulty({
      stats: stats(100, ADAPTIVE_DIFFICULTY_RULES.minimumHistoricalAttempts - 1),
      recentSessions: [completedSession({ difficulty: 2 })],
      minigame,
    });

    expect(result.dificultad).toBe(2);
    expect(result.decision).toBe('mantener');
    expect(result.metricas.evidencia_suficiente).toBe(false);
  });

  it('sube un nivel con dominio historico y dos sesiones recientes fuertes', () => {
    const result = calculateAdaptiveDifficulty({
      stats: stats(83.7, 49),
      recentSessions: [
        completedSession({ difficulty: 2, hits: 1 }),
        completedSession({ difficulty: 2, hits: 1 }),
        completedSession({ difficulty: 2, hits: 4, errors: 1 }),
      ],
      minigame,
    });

    expect(result.dificultad).toBe(3);
    expect(result.decision).toBe('subir');
    expect(result.metricas.precision_reciente).toBeGreaterThanOrEqual(80);
  });

  it('mantiene el nivel cuando el rendimiento reciente es intermedio', () => {
    const result = calculateAdaptiveDifficulty({
      stats: stats(70, 30),
      recentSessions: [
        completedSession({ difficulty: 2, hits: 3, errors: 2 }),
        completedSession({ difficulty: 2, hits: 2, errors: 2 }),
      ],
      minigame,
    });

    expect(result.dificultad).toBe(2);
    expect(result.decision).toBe('mantener');
  });

  it('baja solo un nivel tras dos sesiones recientes debiles', () => {
    const result = calculateAdaptiveDifficulty({
      stats: stats(48, 30),
      recentSessions: [
        completedSession({ difficulty: 3, hits: 1, errors: 3 }),
        completedSession({ difficulty: 3, hits: 1, errors: 2 }),
      ],
      minigame,
    });

    expect(result.dificultad).toBe(2);
    expect(result.decision).toBe('bajar');
  });

  it('mantiene durante el periodo de estabilizacion despues de un cambio', () => {
    const result = calculateAdaptiveDifficulty({
      stats: stats(90, 40),
      recentSessions: [
        completedSession({ difficulty: 3 }),
        completedSession({ difficulty: 2 }),
        completedSession({ difficulty: 2 }),
      ],
      minigame,
    });

    expect(result.dificultad).toBe(3);
    expect(result.decision).toBe('mantener');
    expect(result.metricas.proteccion_cambio_activa).toBe(true);
  });

  it('ignora abandonos tecnicos sin intentos al evaluar rendimiento reciente', () => {
    const result = calculateAdaptiveDifficulty({
      stats: stats(84, 50),
      recentSessions: [
        completedSession({ difficulty: 2 }),
        completedSession({ difficulty: 2 }),
        { dificultad: 2, aciertos: 0, errores: 0, estado: 'abandonado' },
      ],
      minigame,
    });

    expect(result.dificultad).toBe(3);
    expect(result.decision).toBe('subir');
    expect(result.metricas.abandonos_recientes).toBe(0);
  });

  it('nunca supera la dificultad maxima ni baja del nivel minimo', () => {
    const maximumResult = calculateAdaptiveDifficulty({
      stats: stats(95, 50),
      recentSessions: [
        completedSession({ difficulty: 4 }),
        completedSession({ difficulty: 4 }),
      ],
      minigame,
    });
    const minimumResult = calculateAdaptiveDifficulty({
      stats: stats(20, 50),
      recentSessions: [
        completedSession({ difficulty: 1, hits: 0, errors: 2 }),
        completedSession({ difficulty: 1, hits: 0, errors: 2 }),
      ],
      minigame,
    });

    expect(maximumResult.dificultad).toBe(4);
    expect(maximumResult.decision).toBe('mantener');
    expect(minimumResult.dificultad).toBe(1);
    expect(minimumResult.decision).toBe('mantener');
  });
});

describe('presets adaptativos de Mercado Inteligente', () => {
  it('hace perceptible el aumento de dificultad entre niveles 1 y 4', () => {
    const levelOne = buildMercadoInteligenteGameConfig(1);
    const levelFour = buildMercadoInteligenteGameConfig(4);

    expect(levelFour.cantidad_productos_visibles).toBeGreaterThan(
      levelOne.cantidad_productos_visibles
    );
    expect(levelFour.cantidad_objetivos).toBeGreaterThan(levelOne.cantidad_objetivos);
    expect(levelFour.ayudas_disponibles).toBeLessThan(levelOne.ayudas_disponibles);
    expect(levelFour.modo_objetivo).not.toBe(levelOne.modo_objetivo);
    expect(MERCADO_INTELIGENTE_DIFFICULTY_PRESETS).toHaveProperty('2');
    expect(MERCADO_INTELIGENTE_DIFFICULTY_PRESETS).toHaveProperty('3');
  });
});

describe('adaptacion entre misiones de una misma actividad', () => {
  const previousMission = (overrides = {}) => ({
    id_sesion_juego: 100,
    orden_en_ruta: 1,
    dificultad: 2,
    aciertos: 1,
    errores: 0,
    estado: 'completado',
    ...overrides,
  });

  it('sube inmediatamente despues de una mision perfecta', () => {
    const result = calculateInActivityDifficulty({
      previousSession: previousMission(),
      minigame,
    });

    expect(result.dificultad).toBe(3);
    expect(result.decision).toBe('subir');
    expect(result.metricas.alcance).toBe('actividad');
  });

  it('mantiene el nivel cuando completa con un error', () => {
    const result = calculateInActivityDifficulty({
      previousSession: previousMission({ errores: 1 }),
      minigame,
    });

    expect(result.dificultad).toBe(2);
    expect(result.decision).toBe('mantener');
  });

  it('baja un nivel cuando acumula dos o mas errores', () => {
    const result = calculateInActivityDifficulty({
      previousSession: previousMission({ dificultad: 3, errores: 2 }),
      minigame,
    });

    expect(result.dificultad).toBe(2);
    expect(result.decision).toBe('bajar');
  });

  it('ignora una mision tecnica sin intentos', () => {
    const result = calculateInActivityDifficulty({
      previousSession: previousMission({ aciertos: 0, errores: 0, estado: 'abandonado' }),
      minigame,
    });

    expect(result.dificultad).toBe(2);
    expect(result.decision).toBe('mantener');
    expect(result.metricas.resultado_ignorado).toBe('sin_intentos');
  });
});

describe('adaptacion especializada de Camino AR', () => {
  const caminoAr = {
    slug: 'camino-ar',
    habilidad: 'Memoria',
    dificultad_maxima: 4,
  };
  const previousMission = (metadata, overrides = {}) => ({
    id_sesion_juego: 200,
    orden_en_ruta: 2,
    dificultad: 2,
    aciertos: 3,
    errores: 0,
    estado: 'completado',
    resultado_mision: metadata,
    ...overrides,
  });

  it('sube tras recordar el patron sin errores ni pistas', () => {
    const result = calculateInActivityDifficulty({
      previousSession: previousMission({
        game: 'camino-ar',
        end_reason: 'patron_completado',
        pattern_resolved: true,
        progress_pct: 100,
        hints_used: 0,
        errors: 0,
      }),
      minigame: caminoAr,
    });

    expect(result.dificultad).toBe(3);
    expect(result.decision).toBe('subir');
    expect(result.metricas.politica_adaptacion).toBe('camino-ar');
  });

  it('mantiene cuando completa el patron usando apoyo', () => {
    const result = calculateInActivityDifficulty({
      previousSession: previousMission({
        game: 'camino-ar',
        end_reason: 'patron_completado',
        pattern_resolved: true,
        progress_pct: 100,
        hints_used: 1,
        errors: 0,
      }),
      minigame: caminoAr,
    });

    expect(result.dificultad).toBe(2);
    expect(result.decision).toBe('mantener');
  });

  it('baja cuando se agota el tiempo', () => {
    const result = calculateInActivityDifficulty({
      previousSession: previousMission(
        {
          game: 'camino-ar',
          end_reason: 'tiempo_agotado',
          pattern_resolved: false,
          progress_pct: 75,
          hints_used: 0,
          errors: 0,
        },
        { dificultad: 3 }
      ),
      minigame: caminoAr,
    });

    expect(result.dificultad).toBe(2);
    expect(result.decision).toBe('bajar');
  });

  it('mantiene tras un error cuando recordo al menos la mitad', () => {
    const result = calculateInActivityDifficulty({
      previousSession: previousMission({
        game: 'camino-ar',
        end_reason: 'error_secuencia',
        pattern_resolved: false,
        progress_pct: 60,
        hints_used: 0,
        errors: 1,
      }),
      minigame: caminoAr,
    });

    expect(result.dificultad).toBe(2);
    expect(result.decision).toBe('mantener');
  });
});

describe('adaptacion historica especializada de Tren de Figuras', () => {
  const trenFiguras = {
    slug: 'tren-figuras',
    habilidad: 'Patrones',
    dificultad_maxima: 4,
  };
  const recentMission = (metadata) => ({
    dificultad: 1,
    aciertos: 8,
    errores: 2,
    estado: 'completado',
    resultado_mision: metadata,
  });

  it('continua desde la dificultad interna reportada y sube con dominio', () => {
    const result = calculateAdaptiveDifficulty({
      stats: stats(90, 20),
      recentSessions: [
        recentMission({
          game: 'tren-figuras',
          mission_completed: true,
          precision_pct: 90,
          difficulty: 3,
          laps_used: 2,
          max_laps: 4,
          pending_wagons: 0,
        }),
      ],
      minigame: trenFiguras,
    });

    expect(result.dificultad).toBe(4);
    expect(result.decision).toBe('subir');
    expect(result.metricas.alcance).toBe('historico_ultima_mision');
  });

  it('baja cuando se agotan las vueltas aunque los clics hayan sido precisos', () => {
    const result = calculateAdaptiveDifficulty({
      stats: stats(90, 20),
      recentSessions: [
        recentMission({
          game: 'tren-figuras',
          mission_completed: false,
          end_reason: 'vueltas_agotadas',
          precision_pct: 80,
          difficulty: 3,
          laps_used: 4,
          max_laps: 4,
          pending_wagons: 2,
        }),
      ],
      minigame: trenFiguras,
    });

    expect(result.dificultad).toBe(2);
    expect(result.decision).toBe('bajar');
    expect(result.metricas.vagones_pendientes).toBe(2);
  });
});
