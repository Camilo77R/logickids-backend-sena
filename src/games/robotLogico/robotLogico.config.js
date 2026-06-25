export const ROBOT_LOGICO_SLUG = 'robot-logico';

export const ROBOT_LOGICO_DIFFICULTY_PRESETS = Object.freeze({
  1: Object.freeze({
    nivel: 1,
    tiempo_limite_ms: 300000,
    mostrar_siluetas: true,
    orden_secuencial: false,
    usar_alternativas: false,
    umbral_snap: 2.0,
  }),
  2: Object.freeze({
    nivel: 2,
    tiempo_limite_ms: 240000,
    mostrar_siluetas: false,
    orden_secuencial: true,
    usar_alternativas: false,
    umbral_snap: 1.5,
  }),
  3: Object.freeze({
    nivel: 3,
    tiempo_limite_ms: 180000,
    mostrar_siluetas: false,
    orden_secuencial: false,
    usar_alternativas: true,
    umbral_snap: 1.5,
  }),
  4: Object.freeze({
    nivel: 3,
    tiempo_limite_ms: 150000,
    mostrar_siluetas: false,
    orden_secuencial: true,
    usar_alternativas: true,
    umbral_snap: 1.25,
  }),
});

export const buildRobotLogicoGameConfig = (dificultad, configuracionBase = {}) => {
  const dificultadNormalizada = ROBOT_LOGICO_DIFFICULTY_PRESETS[dificultad]
    ? Number(dificultad)
    : 1;
  const preset = ROBOT_LOGICO_DIFFICULTY_PRESETS[dificultadNormalizada];

  return {
    ...configuracionBase,
    dificultad: dificultadNormalizada,
    nivel: preset.nivel,
    tiempo_limite_ms: preset.tiempo_limite_ms,
    mostrar_siluetas: preset.mostrar_siluetas,
    orden_secuencial: preset.orden_secuencial,
    usar_alternativas: preset.usar_alternativas,
    umbral_snap: preset.umbral_snap,
  };
};
