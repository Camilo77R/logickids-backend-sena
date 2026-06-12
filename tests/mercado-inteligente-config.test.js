import { describe, expect, it } from 'vitest';
import {
  buildMercadoInteligenteGameConfig,
  MERCADO_INTELIGENTE_DIFFICULTY_PRESETS,
  MERCADO_INTELIGENTE_SLUG,
} from '../src/games/mercadoInteligente/mercadoInteligente.config.js';

describe('Mercado Inteligente - contrato de configuracion', () => {
  it('construye la configuracion oficial de cada dificultad', () => {
    Object.entries(MERCADO_INTELIGENTE_DIFFICULTY_PRESETS).forEach(
      ([dificultad, preset]) => {
        expect(buildMercadoInteligenteGameConfig(Number(dificultad))).toEqual({
          dificultad: Number(dificultad),
          ...preset,
        });
      }
    );
  });

  it('permite sobrescribir reglas explicitas de la sesion sin mutar el preset', () => {
    const configuracion = buildMercadoInteligenteGameConfig(3, {
      presupuesto_monedas: 15,
      ayudas_disponibles: 0,
      dificultad: 1,
    });

    expect(configuracion).toMatchObject({
      dificultad: 3,
      presupuesto_monedas: 15,
      cantidad_productos_visibles: 6,
      cantidad_objetivos: 3,
      modo_objetivo: 'categoria_objetivo',
      ayudas_disponibles: 0,
    });
    expect(MERCADO_INTELIGENTE_DIFFICULTY_PRESETS[3].presupuesto_monedas).toBe(12);
  });

  it('mantiene la identidad oficial y usa el preset mas exigente como respaldo', () => {
    expect(MERCADO_INTELIGENTE_SLUG).toBe('mercado-inteligente');
    expect(buildMercadoInteligenteGameConfig(99)).toMatchObject({
      dificultad: 4,
      presupuesto_monedas: 14,
      cantidad_productos_visibles: 6,
      cantidad_objetivos: 3,
      modo_objetivo: 'presupuesto_exacto',
      ayudas_disponibles: 0,
    });
  });
});
