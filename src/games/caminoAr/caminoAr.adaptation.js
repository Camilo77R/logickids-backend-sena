const CAMINO_AR_END_REASONS = Object.freeze({
  completed: 'patron_completado',
  sequenceError: 'error_secuencia',
  timeout: 'tiempo_agotado',
  technical: 'fallo_tecnico',
});

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

export const evaluateCaminoArMission = ({ previousSession }) => {
  const outcome = normalizeMetadata(previousSession?.resultado_mision);

  if (outcome?.game !== 'camino-ar') {
    return null;
  }

  const endReason = outcome.end_reason;
  const patternResolved = outcome.pattern_resolved === true;
  const progressPct = Math.max(0, Math.min(100, toFiniteNumber(outcome.progress_pct)));
  const hintsUsed = Math.max(0, toFiniteNumber(outcome.hints_used));
  const errors = Math.max(0, toFiniteNumber(outcome.errors, previousSession?.errores));
  const metrics = {
    resultado_mision: patternResolved ? 'completada' : 'no_completada',
    motivo_fin_mision: endReason ?? 'desconocido',
    progreso_patron_pct: progressPct,
    pistas_usadas_mision: hintsUsed,
  };

  if (endReason === CAMINO_AR_END_REASONS.technical) {
    return {
      difficultyDelta: 0,
      reason: 'Mantiene el nivel porque la mision termino por una interrupcion tecnica de AR.',
      metrics: { ...metrics, resultado_ignorado: 'fallo_tecnico' },
    };
  }

  if (patternResolved) {
    if (errors === 0 && hintsUsed === 0) {
      return {
        difficultyDelta: 1,
        reason: 'Sube un nivel porque completo el patron sin errores ni pistas.',
        metrics,
      };
    }

    return {
      difficultyDelta: 0,
      reason: 'Mantiene el nivel porque completo el patron con apoyo o correcciones.',
      metrics,
    };
  }

  if (endReason === CAMINO_AR_END_REASONS.timeout || progressPct < 50) {
    return {
      difficultyDelta: -1,
      reason:
        endReason === CAMINO_AR_END_REASONS.timeout
          ? 'Baja un nivel porque se agoto el tiempo antes de completar el patron.'
          : 'Baja un nivel para reforzar la memoria despues de recordar menos de la mitad del patron.',
      metrics,
    };
  }

  return {
    difficultyDelta: 0,
    reason: 'Mantiene el nivel porque recordo al menos la mitad del patron antes del error.',
    metrics,
  };
};

export { CAMINO_AR_END_REASONS };
