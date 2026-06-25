export const TREN_FIGURAS_SLUG = 'tren-figuras';

export const TREN_FIGURAS_DIFFICULTY_PRESETS = Object.freeze({
  1: Object.freeze({
    velocidad_tren: 0.75,
    vueltas_maximas: 6,
    vagones_por_nivel: 10,
    longitud_secuencia: 2,
    max_opciones_figuras: 4,
    usa_colores: false,
    pares_consecutivos: false,
    variacion_ciclica: false,
    opacidad_figura_guia: 0.86,
  }),
  2: Object.freeze({
    velocidad_tren: 0.85,
    vueltas_maximas: 5,
    vagones_por_nivel: 10,
    longitud_secuencia: 3,
    max_opciones_figuras: 4,
    usa_colores: false,
    pares_consecutivos: false,
    variacion_ciclica: false,
    opacidad_figura_guia: 0.86,
  }),
  3: Object.freeze({
    velocidad_tren: 0.95,
    vueltas_maximas: 4,
    vagones_por_nivel: 10,
    longitud_secuencia: 4,
    max_opciones_figuras: 4,
    usa_colores: true,
    pares_consecutivos: true,
    variacion_ciclica: false,
    opacidad_figura_guia: 0.86,
  }),
  4: Object.freeze({
    velocidad_tren: 1.18,
    vueltas_maximas: 3,
    vagones_por_nivel: 12,
    longitud_secuencia: 4,
    max_opciones_figuras: 4,
    usa_colores: true,
    pares_consecutivos: false,
    variacion_ciclica: true,
    opacidad_figura_guia: 0.86,
  }),
});

export const buildTrenFigurasGameConfig = (dificultad, configuracionBase = {}) => {
  const preset =
    TREN_FIGURAS_DIFFICULTY_PRESETS[dificultad] ??
    TREN_FIGURAS_DIFFICULTY_PRESETS[4];

  return {
    ...configuracionBase,
    dificultad,
    ...preset,
  };
};
