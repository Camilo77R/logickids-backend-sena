const toFiniteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const parseMissionMetadata = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return {};
};

export const evaluateMercadoInteligenteMission = ({ previousSession }) => {
  const metadata = parseMissionMetadata(previousSession?.resultado_mision);
  const baseDifficulty = toFiniteNumber(
    metadata.difficulty,
    previousSession?.dificultad ?? 1
  );
  const hits = toFiniteNumber(previousSession?.aciertos);
  const errors = toFiniteNumber(previousSession?.errores);
  const completed = previousSession?.estado === 'completado' && hits > 0;
  const correctedAfterError = Boolean(metadata.correccion);

  const metrics = {
    juego: 'mercado-inteligente',
    dificultad_mision: baseDifficulty,
    aciertos_mision: hits,
    errores_mision: errors,
    compra_corregida: correctedAfterError,
    total_gastado: metadata.totalGastado ?? null,
  };

  if (!completed || errors >= 2) {
    return {
      baseDifficulty,
      difficultyDelta: -1,
      reason: completed
        ? 'Baja un nivel porque la compra necesito varios intentos antes de resolverse.'
        : 'Baja un nivel porque la compra no se completo correctamente.',
      metrics,
    };
  }

  if (errors === 0 && !correctedAfterError) {
    return {
      baseDifficulty,
      difficultyDelta: 1,
      reason: 'Sube un nivel porque completo la compra sin errores ni correcciones.',
      metrics,
    };
  }

  return {
    baseDifficulty,
    difficultyDelta: 0,
    reason: 'Mantiene el nivel porque resolvio la compra, pero necesito correccion o consolidacion.',
    metrics,
  };
};
