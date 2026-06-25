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

export const evaluateTrenFigurasMission = ({ previousSession }) => {
  const outcome = normalizeMetadata(previousSession?.resultado_mision);

  if (outcome?.game !== 'tren-figuras') {
    return null;
  }

  const completed = outcome.mission_completed === true;
  const precisionPct = Math.max(0, Math.min(100, toFiniteNumber(outcome.precision_pct)));
  const baseDifficulty = Math.max(1, toFiniteNumber(outcome.difficulty, previousSession?.dificultad));
  const metrics = {
    resultado_mision: completed ? 'completada' : 'no_completada',
    motivo_fin_mision: outcome.end_reason ?? 'desconocido',
    precision_mision_pct: precisionPct,
    vueltas_usadas: Math.max(0, toFiniteNumber(outcome.laps_used)),
    vueltas_maximas: Math.max(0, toFiniteNumber(outcome.max_laps)),
    vagones_pendientes: Math.max(0, toFiniteNumber(outcome.pending_wagons)),
  };

  if (!completed || precisionPct < 70) {
    return {
      difficultyDelta: -1,
      baseDifficulty,
      reason: completed
        ? 'Baja un nivel para reforzar el patron despues de una precision menor al 70%.'
        : 'Baja un nivel porque se agotaron las vueltas antes de completar el tren.',
      metrics,
    };
  }

  if (precisionPct >= 90) {
    return {
      difficultyDelta: 1,
      baseDifficulty,
      reason: 'Sube un nivel porque completo el tren con al menos 90% de precision.',
      metrics,
    };
  }

  return {
    difficultyDelta: 0,
    baseDifficulty,
    reason: 'Mantiene el nivel porque completo el tren con una precision de consolidacion.',
    metrics,
  };
};
