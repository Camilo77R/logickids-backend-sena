export const CAMINO_AR_SLUG = 'camino-ar';

export const CAMINO_AR_DIFFICULTY_PRESETS = Object.freeze({
  1: Object.freeze({
    cantidad_baldosas: 4,
    longitud_patron: 3,
    duracion_destello_ms: 1200,
    pausa_entre_destellos_ms: 500,
    tiempo_limite_ms: 22000,
    ayudas_disponibles: 2,
    errores_permitidos: 2,
  }),
  2: Object.freeze({
    cantidad_baldosas: 6,
    longitud_patron: 4,
    duracion_destello_ms: 1100,
    pausa_entre_destellos_ms: 450,
    tiempo_limite_ms: 21000,
    ayudas_disponibles: 1,
    errores_permitidos: 2,
  }),
  3: Object.freeze({
    cantidad_baldosas: 6,
    longitud_patron: 5,
    duracion_destello_ms: 1000,
    pausa_entre_destellos_ms: 400,
    tiempo_limite_ms: 20000,
    ayudas_disponibles: 1,
    errores_permitidos: 1,
  }),
  4: Object.freeze({
    cantidad_baldosas: 9,
    longitud_patron: 5,
    duracion_destello_ms: 900,
    pausa_entre_destellos_ms: 350,
    tiempo_limite_ms: 19000,
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
