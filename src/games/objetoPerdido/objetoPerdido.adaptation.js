const toFiniteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeMetadata = (value) => {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const evaluateObjetoPerdidoMission = ({ previousSession }) => {
  const outcome = normalizeMetadata(previousSession?.resultado_mision);
  const baseDifficulty = Math.max(1, toFiniteNumber(previousSession?.dificultad, 1));
  const hits = Math.max(0, toFiniteNumber(previousSession?.aciertos));
  const errors = Math.max(0, toFiniteNumber(previousSession?.errores));
  const attempts = hits + errors;
  const state = previousSession?.estado ?? 'desconocido';
  const remainingMs = Math.max(0, toFiniteNumber(outcome?.tiempoRestanteMs));
  const helpsUsed = Math.max(0, toFiniteNumber(outcome?.ayudasUsadas));
  const completed = state === 'completado' && hits > 0;

  const metrics = {
    juego: 'objeto-perdido',
    dificultad_mision: baseDifficulty,
    resultado_mision: completed ? 'completada' : 'no_completada',
    aciertos_mision: hits,
    errores_mision: errors,
    intentos_mision: attempts,
    ayudas_usadas_mision: helpsUsed,
    tiempo_restante_ms: remainingMs,
    motivo_fin_mision: outcome?.reason ?? 'desconocido',
  };

  if (attempts <= 0) {
    return {
      baseDifficulty,
      difficultyDelta: 0,
      reason: 'Mantiene el nivel porque la busqueda anterior no registro intentos validos.',
      metrics: { ...metrics, resultado_ignorado: 'sin_intentos' },
    };
  }

  if (!completed || state === 'abandonado' || errors >= 2) {
    return {
      baseDifficulty,
      difficultyDelta: -1,
      reason: completed
        ? 'Baja un nivel porque necesito varios intentos para encontrar la figura.'
        : 'Baja un nivel porque la busqueda no se completo correctamente.',
      metrics,
    };
  }

  if (errors === 0 && helpsUsed === 0 && remainingMs >= 4000) {
    return {
      baseDifficulty,
      difficultyDelta: 1,
      reason: 'Sube un nivel porque encontro la figura sin errores, sin pistas y con buen tiempo restante.',
      metrics,
    };
  }

  return {
    baseDifficulty,
    difficultyDelta: 0,
    reason: 'Mantiene el nivel porque completo la busqueda con margen de practica adecuado.',
    metrics,
  };
};
