import { describe, expect, it } from 'vitest';
import {
  buildCaminoArGameConfig,
  CAMINO_AR_DIFFICULTY_PRESETS,
} from '../src/games/caminoAr/caminoAr.config.js';

describe('Camino AR - contrato de dificultad', () => {
  it('ofrece cuatro niveles con progresion perceptible y tiempos aptos para ninos', () => {
    const levelOne = buildCaminoArGameConfig(1);
    const levelFour = buildCaminoArGameConfig(4);

    expect(Object.keys(CAMINO_AR_DIFFICULTY_PRESETS)).toHaveLength(4);
    expect(levelFour.cantidad_baldosas).toBeGreaterThan(levelOne.cantidad_baldosas);
    expect(levelFour.longitud_patron).toBeGreaterThan(levelOne.longitud_patron);
    expect(levelFour.duracion_destello_ms).toBeLessThan(levelOne.duracion_destello_ms);
    expect(levelFour.duracion_destello_ms).toBeGreaterThanOrEqual(600);
    expect(levelFour.ayudas_disponibles).toBeLessThan(levelOne.ayudas_disponibles);
  });

  it('protege los parametros adaptativos frente a una configuracion base obsoleta', () => {
    const config = buildCaminoArGameConfig(3, {
      dificultad: 1,
      longitud_patron: 99,
      duracion_destello_ms: 100,
      tema: 'bosque',
    });

    expect(config).toMatchObject({
      dificultad: 3,
      longitud_patron: 5,
      duracion_destello_ms: 700,
      tema: 'bosque',
    });
  });
});
