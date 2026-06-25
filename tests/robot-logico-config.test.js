import { describe, expect, it } from 'vitest';
import {
  buildRobotLogicoGameConfig,
  ROBOT_LOGICO_DIFFICULTY_PRESETS,
} from '../src/games/robotLogico/robotLogico.config.js';

describe('Robot Logico - contrato de dificultad', () => {
  it('define cuatro niveles adaptativos con progresion perceptible', () => {
    const nivelUno = buildRobotLogicoGameConfig(1);
    const nivelCuatro = buildRobotLogicoGameConfig(4);

    expect(Object.keys(ROBOT_LOGICO_DIFFICULTY_PRESETS)).toEqual(['1', '2', '3', '4']);
    expect(nivelUno.mostrar_siluetas).toBe(true);
    expect(nivelCuatro.mostrar_siluetas).toBe(false);
    expect(nivelCuatro.tiempo_limite_ms).toBeLessThan(nivelUno.tiempo_limite_ms);
    expect(nivelCuatro.umbral_snap).toBeLessThan(nivelUno.umbral_snap);
    expect(nivelCuatro.usar_alternativas).toBe(true);
  });

  it('conserva configuracion ajena pero protege los parametros adaptativos', () => {
    const config = buildRobotLogicoGameConfig(4, {
      modo: 'ruta',
      tiempo_limite_ms: 999999,
      mostrar_siluetas: true,
    });

    expect(config.modo).toBe('ruta');
    expect(config.tiempo_limite_ms).toBe(150000);
    expect(config.mostrar_siluetas).toBe(false);
    expect(config.dificultad).toBe(4);
    expect(config.nivel).toBe(3);
  });
});
