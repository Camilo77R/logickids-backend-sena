export const CAMINO_AR_SLUG = 'camino-ar';

export const CAMINO_AR_DIFFICULTY_PRESETS = Object.freeze({
  1: Object.freeze({
    cantidad_baldosas: 4,
    longitud_patron: 3,
    duracion_destello_ms: 900,
    pausa_entre_destellos_ms: 350,
    tiempo_limite_ms: 18000,
    ayudas_disponibles: 2,
    errores_permitidos: 2,
  }),
  2: Object.freeze({
    cantidad_baldosas: 6,
    longitud_patron: 4,
    duracion_destello_ms: 800,
    pausa_entre_destellos_ms: 300,
    tiempo_limite_ms: 17000,
    ayudas_disponibles: 1,
    errores_permitidos: 2,
  }),
  3: Object.freeze({
    cantidad_baldosas: 6,
    longitud_patron: 5,
    duracion_destello_ms: 700,
    pausa_entre_destellos_ms: 260,
    tiempo_limite_ms: 16000,
    ayudas_disponibles: 1,
    errores_permitidos: 1,
  }),
  4: Object.freeze({
    cantidad_baldosas: 9,
    longitud_patron: 6,
    duracion_destello_ms: 600,
    pausa_entre_destellos_ms: 220,
    tiempo_limite_ms: 15000,
    ayudas_disponibles: 0,
    errores_permitidos: 1,
  }),
});

export const buildCaminoArGameConfig = (dificultad, configuracionBase = {}) => {
  const preset =
    CAMINO_AR_DIFFICULTY_PRESETS[dificultad] ?? CAMINO_AR_DIFFICULTY_PRESETS[4];

  return {
    ...configuracionBase,
    dificultad,
    cantidad_baldosas: preset.cantidad_baldosas,
    longitud_patron: preset.longitud_patron,
    duracion_destello_ms: preset.duracion_destello_ms,
    pausa_entre_destellos_ms: preset.pausa_entre_destellos_ms,
    tiempo_limite_ms: preset.tiempo_limite_ms,
    ayudas_disponibles: preset.ayudas_disponibles,
    errores_permitidos: preset.errores_permitidos,
  };
};
