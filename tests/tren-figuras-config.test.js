import { describe, expect, it } from 'vitest';
import {
  buildTrenFigurasGameConfig,
  TREN_FIGURAS_DIFFICULTY_PRESETS,
} from '../src/games/trenFiguras/trenFiguras.config.js';

describe('Tren de Figuras - contrato de dificultad', () => {
  it('reduce las vueltas y aumenta gradualmente la velocidad', () => {
    const levels = Object.keys(TREN_FIGURAS_DIFFICULTY_PRESETS).map((level) =>
      buildTrenFigurasGameConfig(Number(level))
    );

    expect(levels).toHaveLength(4);
    expect(levels.map((level) => level.vueltas_maximas)).toEqual([6, 5, 4, 3]);
    expect(levels.map((level) => level.velocidad_tren)).toEqual([0.75, 0.85, 0.95, 1.18]);
    expect(levels.map((level) => level.vagones_por_nivel)).toEqual([10, 10, 10, 12]);
    expect(levels.map((level) => level.max_opciones_figuras)).toEqual([4, 4, 4, 4]);
    expect(levels[3].longitud_secuencia).toBeGreaterThan(levels[0].longitud_secuencia);
    expect(levels[3].variacion_ciclica).toBe(true);
  });

  it('conserva opciones ajenas pero protege el preset adaptativo', () => {
    expect(buildTrenFigurasGameConfig(3, {
      velocidad_tren: 9,
      vueltas_maximas: 99,
      tema: 'montana',
    })).toMatchObject({
      dificultad: 3,
      velocidad_tren: 0.95,
      vueltas_maximas: 4,
      tema: 'montana',
    });
  });
});
