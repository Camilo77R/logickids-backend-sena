import { describe, expect, it } from 'vitest';
import {
  buildObjetoPerdidoGameConfig,
  OBJETO_PERDIDO_DIFFICULTY_PRESETS,
  OBJETO_PERDIDO_SLUG,
} from '../src/games/objetoPerdido/objetoPerdido.config.js';

describe('Objeto Perdido AR - contrato de dificultad', () => {
  it('construye la configuracion oficial de cada dificultad', () => {
    Object.entries(OBJETO_PERDIDO_DIFFICULTY_PRESETS).forEach(
      ([dificultad, preset]) => {
        expect(buildObjetoPerdidoGameConfig(Number(dificultad))).toEqual({
          ...preset,
          zona_busqueda: { ...preset.zona_busqueda },
          dificultad: Number(dificultad),
        });
      }
    );
  });

  it('hace perceptible el aumento de dificultad entre niveles 1 y 4', () => {
    const levelOne = buildObjetoPerdidoGameConfig(1);
    const levelFour = buildObjetoPerdidoGameConfig(4);

    expect(levelFour.objetos_por_ronda).toBeGreaterThan(levelOne.objetos_por_ronda);
    expect(levelFour.rondas_por_partida).toBeGreaterThan(levelOne.rondas_por_partida);
    expect(levelFour.tiempo_limite_ms).toBeLessThan(levelOne.tiempo_limite_ms);
    expect(levelFour.ayudas_disponibles).toBeLessThan(levelOne.ayudas_disponibles);
    expect(levelFour.escala_objeto).toBeLessThan(levelOne.escala_objeto);
    expect(levelFour.zona_busqueda.ancho).toBeGreaterThan(levelOne.zona_busqueda.ancho);
  });

  it('permite ajustes explicitos sin mutar el preset protegido', () => {
    const configuracion = buildObjetoPerdidoGameConfig(3, {
      tiempo_limite_ms: 19000,
      zona_busqueda: {
        ancho: 4,
      },
      dificultad: 1,
    });

    expect(configuracion).toMatchObject({
      dificultad: 3,
      objetos_por_ronda: 5,
      tiempo_limite_ms: 19000,
      zona_busqueda: {
        ancho: 4,
        profundidad: 3.4,
      },
    });
    expect(OBJETO_PERDIDO_DIFFICULTY_PRESETS[3].tiempo_limite_ms).toBe(17000);
  });

  it('mantiene identidad oficial y usa el preset mas exigente como respaldo', () => {
    expect(OBJETO_PERDIDO_SLUG).toBe('objeto-perdido');
    expect(buildObjetoPerdidoGameConfig(99)).toMatchObject({
      dificultad: 4,
      objetos_por_ronda: 6,
      tiempo_limite_ms: 13000,
      ayudas_disponibles: 0,
      tipo_mision: 'color-forma',
    });
  });
});
