export const CODIGO_ESTELAR_SLUG = 'codigo-estelar';

export const CODIGO_ESTELAR_SOCKET_EVENTS = Object.freeze({
  join: 'codigo_estelar:join',
  joined: 'codigo_estelar:joined',
  submit: 'codigo_estelar:submit_answer',
  leaderboard: 'codigo_estelar:leaderboard_update',
  game_over: 'codigo_estelar:game_over',
  error: 'codigo_estelar:error',
});

export const CODIGO_ESTELAR_META_PUNTAJE = 100;
export const CODIGO_ESTELAR_ACIERTO_PUNTOS = 10;
export const CODIGO_ESTELAR_BONUS_RAPIDO_PUNTOS = 5;
export const CODIGO_ESTELAR_ERROR_PUNTOS = -3;
export const CODIGO_ESTELAR_TIEMPO_RAPIDO_MS = 1_500;

export const CODIGO_ESTELAR_DIFFICULTY_PRESETS = Object.freeze({
  1: Object.freeze({
    rango_numeros: Object.freeze({ min: 0, max: 20 }),
    permite_igual: false,
  }),
  2: Object.freeze({
    rango_numeros: Object.freeze({ min: 0, max: 50 }),
    permite_igual: true,
  }),
  3: Object.freeze({
    rango_numeros: Object.freeze({ min: 0, max: 100 }),
    permite_igual: true,
  }),
  4: Object.freeze({
    rango_numeros: Object.freeze({ min: -100, max: 150 }),
    permite_igual: true,
  }),
});

export const normalizeRoomSlug = (slug) => slug.replace(/-/g, '_');

export const buildRoomKey = (grupoId, minijuegoSlug = CODIGO_ESTELAR_SLUG) =>
  `room:grupo_${grupoId}:${normalizeRoomSlug(minijuegoSlug)}`;

export const pickDeterministicTarget = (grupoId, dificultad, { min, max }) => {
  const span = max - min + 1;
  return min + ((grupoId * 17 + dificultad * 13) % span);
};

export const buildCodigoEstelarGameConfig = (grupoId, dificultad) => {
  const preset = CODIGO_ESTELAR_DIFFICULTY_PRESETS[dificultad] ?? CODIGO_ESTELAR_DIFFICULTY_PRESETS[4];

  return {
    numero_objetivo: pickDeterministicTarget(grupoId, dificultad, preset.rango_numeros),
    meta_puntaje: CODIGO_ESTELAR_META_PUNTAJE,
    permite_igual: preset.permite_igual,
    dificultad,
    rango_numeros: preset.rango_numeros,
  };
};

export const resolveExpectedClassification = (numeroMeteorito, numeroObjetivo) => {
  if (numeroMeteorito < numeroObjetivo) {
    return 'menor';
  }

  if (numeroMeteorito > numeroObjetivo) {
    return 'mayor';
  }

  return 'igual';
};

/**
 * Evalua la respuesta oficial sin confiar en puntos enviados por el cliente.
 *
 * POR QUE:
 * el cliente reporta la jugada; el servidor lleva el marcador.
 */
export const evaluateCodigoEstelarAnswer = ({
  numeroMeteorito,
  numeroObjetivo,
  clasificacionElegida,
  tiempoReaccionMs,
}) => {
  const clasificacionEsperada = resolveExpectedClassification(numeroMeteorito, numeroObjetivo);
  const esCorrecto = clasificacionElegida === clasificacionEsperada;
  const tuvoBonusRapidez =
    esCorrecto &&
    Number.isFinite(tiempoReaccionMs) &&
    tiempoReaccionMs <= CODIGO_ESTELAR_TIEMPO_RAPIDO_MS;

  const deltaPuntos = esCorrecto
    ? CODIGO_ESTELAR_ACIERTO_PUNTOS + (tuvoBonusRapidez ? CODIGO_ESTELAR_BONUS_RAPIDO_PUNTOS : 0)
    : CODIGO_ESTELAR_ERROR_PUNTOS;

  return {
    esCorrecto,
    clasificacionEsperada,
    deltaPuntos,
    tuvoBonusRapidez,
  };
};
