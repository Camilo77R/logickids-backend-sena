export const OBJETO_PERDIDO_SLUG = 'objeto-perdido';

export const OBJETO_PERDIDO_DIFFICULTY_PRESETS = Object.freeze({
  1: Object.freeze({
    rondas_por_partida: 3,
    objetos_por_ronda: 3,
    tiempo_limite_ms: 26000,
    ayudas_disponibles: 2,
    escala_objeto: 1.12,
    tipo_mision: 'figura',
    usar_tablero_limitado: true,
    usar_guia_temporal: true,
    zona_busqueda: Object.freeze({
      ancho: 3,
      profundidad: 3,
      alturaMaxima: 0.85,
      margen: 0.28,
      separacionMinima: 0.58,
      distanciaMinimaCentro: 0.75,
    }),
  }),
  2: Object.freeze({
    rondas_por_partida: 3,
    objetos_por_ronda: 4,
    tiempo_limite_ms: 22000,
    ayudas_disponibles: 1,
    escala_objeto: 1,
    tipo_mision: 'figura-color',
    usar_tablero_limitado: true,
    usar_guia_temporal: true,
    zona_busqueda: Object.freeze({
      ancho: 3.2,
      profundidad: 3.2,
      alturaMaxima: 0.95,
      margen: 0.28,
      separacionMinima: 0.56,
      distanciaMinimaCentro: 0.82,
    }),
  }),
  3: Object.freeze({
    rondas_por_partida: 4,
    objetos_por_ronda: 5,
    tiempo_limite_ms: 17000,
    ayudas_disponibles: 1,
    escala_objeto: 0.94,
    tipo_mision: 'color-forma',
    usar_tablero_limitado: true,
    usar_guia_temporal: true,
    zona_busqueda: Object.freeze({
      ancho: 3.4,
      profundidad: 3.4,
      alturaMaxima: 1.05,
      margen: 0.3,
      separacionMinima: 0.52,
      distanciaMinimaCentro: 0.88,
    }),
  }),
  4: Object.freeze({
    rondas_por_partida: 5,
    objetos_por_ronda: 6,
    tiempo_limite_ms: 13000,
    ayudas_disponibles: 0,
    escala_objeto: 0.86,
    tipo_mision: 'color-forma',
    usar_tablero_limitado: true,
    usar_guia_temporal: true,
    zona_busqueda: Object.freeze({
      ancho: 3.6,
      profundidad: 3.6,
      alturaMaxima: 1.15,
      margen: 0.32,
      separacionMinima: 0.48,
      distanciaMinimaCentro: 0.95,
    }),
  }),
});

export const buildObjetoPerdidoGameConfig = (dificultad, configuracionBase = {}) => {
  const dificultadNormalizada = OBJETO_PERDIDO_DIFFICULTY_PRESETS[dificultad]
    ? Number(dificultad)
    : 4;
  const preset = OBJETO_PERDIDO_DIFFICULTY_PRESETS[dificultadNormalizada];

  return {
    ...preset,
    ...configuracionBase,
    zona_busqueda: {
      ...preset.zona_busqueda,
      ...(configuracionBase.zona_busqueda ?? {}),
    },
    dificultad: dificultadNormalizada,
  };
};
