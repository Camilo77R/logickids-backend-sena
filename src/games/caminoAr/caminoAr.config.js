export const CAMINO_AR_SLUG = 'camino-ar';

export const CAMINO_AR_DIFFICULTY_PRESETS = Object.freeze({
  1: Object.freeze({
    cantidad_baldosas: 6,
    longitud_patron: 3,
    duracion_destello_ms: 650,
    pausa_entre_destellos_ms: 220,
    tiempo_limite_ms: 15000,
    ayudas_disponibles: 1,
  }),
  2: Object.freeze({
    cantidad_baldosas: 6,
    longitud_patron: 4,
    duracion_destello_ms: 600,
    pausa_entre_destellos_ms: 200,
    tiempo_limite_ms: 14000,
    ayudas_disponibles: 1,
  }),
  3: Object.freeze({
    cantidad_baldosas: 9,
    longitud_patron: 5,
    duracion_destello_ms: 520,
    pausa_entre_destellos_ms: 180,
    tiempo_limite_ms: 13000,
    ayudas_disponibles: 1,
  }),
  4: Object.freeze({
    cantidad_baldosas: 9,
    longitud_patron: 6,
    duracion_destello_ms: 460,
    pausa_entre_destellos_ms: 160,
    tiempo_limite_ms: 12000,
    ayudas_disponibles: 0,
  }),
});

export const buildCaminoArGameConfig = (dificultad) => {
  const preset =
    CAMINO_AR_DIFFICULTY_PRESETS[dificultad] ?? CAMINO_AR_DIFFICULTY_PRESETS[4];

  return {
    dificultad,
    fuente_adaptacion: 'base',
    version_adaptacion: 'v1-base',
    cantidad_baldosas: preset.cantidad_baldosas,
    longitud_patron: preset.longitud_patron,
    duracion_destello_ms: preset.duracion_destello_ms,
    pausa_entre_destellos_ms: preset.pausa_entre_destellos_ms,
    tiempo_limite_ms: preset.tiempo_limite_ms,
    ayudas_disponibles: preset.ayudas_disponibles,
  };
};
