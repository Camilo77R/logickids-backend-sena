import {
  evaluateHistoricalDifficultyPolicy,
  evaluateInActivityDifficultyPolicy,
} from '../games/adaptation/inActivityDifficultyPolicies.js';

const MIN_DIFFICULTY = 1;
const MIN_HISTORICAL_ATTEMPTS = 8;
const MIN_RECENT_SESSIONS = 2;
const RECENT_WEIGHTS = Object.freeze([0.5, 0.3, 0.2]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const sessionAttempts = (session) =>
  Number(session?.aciertos ?? 0) + Number(session?.errores ?? 0);

const sessionPrecision = (session) => {
  const attempts = sessionAttempts(session);

  if (attempts <= 0) {
    return null;
  }

  return (Number(session.aciertos ?? 0) / attempts) * 100;
};

const weightedRecentPrecision = (sessions) => {
  const observations = sessions
    .slice(0, RECENT_WEIGHTS.length)
    .map((session, index) => ({
      precision: sessionPrecision(session),
      weight: RECENT_WEIGHTS[index],
    }))
    .filter(({ precision }) => precision != null);

  if (observations.length === 0) return null;

  const totalWeight = observations.reduce((sum, item) => sum + item.weight, 0);
  const weightedTotal = observations.reduce(
    (sum, item) => sum + item.precision * item.weight,
    0
  );

  return weightedTotal / totalWeight;
};

const countSessionsAtCurrentDifficulty = (sessions, currentDifficulty) => {
  let count = 0;

  for (const session of sessions) {
    if (Number(session?.dificultad) !== currentDifficulty) break;
    count += 1;
  }

  return count;
};

const buildDecision = ({
  difficulty,
  previousDifficulty,
  maximumDifficulty,
  decision,
  reason,
  metrics,
}) => ({
  dificultad: clamp(difficulty, MIN_DIFFICULTY, maximumDifficulty),
  fuente: 'reglas',
  decision,
  motivo: reason,
  metricas: {
    ...metrics,
    decision,
    ultima_dificultad: previousDifficulty,
    dificultad_maxima: maximumDifficulty,
  },
});

export const calculateAdaptiveDifficulty = ({ stats, recentSessions = [], minigame }) => {
  const maximumDifficulty = Number(minigame?.dificultad_maxima ?? 4);
  const latestSession = recentSessions[0] ?? null;
  const previousDifficulty = clamp(
    Number(latestSession?.dificultad ?? MIN_DIFFICULTY),
    MIN_DIFFICULTY,
    maximumDifficulty
  );
  const historicalMissionDecision = latestSession
    ? evaluateHistoricalDifficultyPolicy({ previousSession: latestSession, minigame })
    : null;

  if (historicalMissionDecision) {
    const historicalBaseDifficulty = clamp(
      Number(historicalMissionDecision.baseDifficulty ?? previousDifficulty),
      MIN_DIFFICULTY,
      maximumDifficulty
    );
    const nextDifficulty = clamp(
      historicalBaseDifficulty + historicalMissionDecision.difficultyDelta,
      MIN_DIFFICULTY,
      maximumDifficulty
    );
    const decision =
      nextDifficulty > historicalBaseDifficulty
        ? 'subir'
        : nextDifficulty < historicalBaseDifficulty
          ? 'bajar'
          : 'mantener';

    return buildDecision({
      difficulty: nextDifficulty,
      previousDifficulty: historicalBaseDifficulty,
      maximumDifficulty,
      decision,
      reason:
        nextDifficulty === historicalBaseDifficulty && historicalMissionDecision.difficultyDelta !== 0
          ? 'Mantiene el nivel porque ya alcanzo el limite permitido del juego.'
          : historicalMissionDecision.reason,
      metrics: {
        alcance: 'historico_ultima_mision',
        habilidad: minigame?.habilidad,
        ...historicalMissionDecision.metrics,
        politica_adaptacion: minigame?.slug,
      },
    });
  }

  const historicalAttempts = Number(stats?.total_intentos ?? 0);
  const historicalPrecision = Number(stats?.precision_pct ?? 0);
  const recentPrecision = weightedRecentPrecision(recentSessions);
  const recentUsefulSessions = recentSessions.filter(
    (session) => sessionAttempts(session) > 0
  );
  const consecutiveAtCurrentLevel = countSessionsAtCurrentDifficulty(
    recentSessions,
    previousDifficulty
  );
  const recentAbandonments = recentSessions
    .slice(0, 2)
    .filter(
      (session) => session?.estado === 'abandonado' && sessionAttempts(session) > 0
    ).length;
  const firstTwoPrecisions = recentSessions
    .slice(0, 2)
    .map(sessionPrecision)
    .filter((precision) => precision != null);
  const twoWeakSessions =
    firstTwoPrecisions.length >= 2 && firstTwoPrecisions.every((precision) => precision < 50);
  const evidenceReady =
    historicalAttempts >= MIN_HISTORICAL_ATTEMPTS &&
    recentUsefulSessions.length >= MIN_RECENT_SESSIONS;
  const inCooldown =
    recentSessions.length >= 2 &&
    Number(recentSessions[0]?.dificultad) !== Number(recentSessions[1]?.dificultad) &&
    consecutiveAtCurrentLevel < 2;

  const metrics = {
    habilidad: minigame?.habilidad,
    precision_historica: Number(historicalPrecision.toFixed(2)),
    precision_reciente:
      recentPrecision == null ? null : Number(recentPrecision.toFixed(2)),
    total_intentos: historicalAttempts,
    sesiones_recientes: recentSessions.length,
    sesiones_recientes_utiles: recentUsefulSessions.length,
    sesiones_en_nivel_actual: consecutiveAtCurrentLevel,
    abandonos_recientes: recentAbandonments,
    evidencia_suficiente: evidenceReady,
    proteccion_cambio_activa: inCooldown,
    promedio_reaccion_ms: stats?.promedio_reaccion_ms ?? null,
  };

  if (!stats || historicalAttempts <= 0) {
    return buildDecision({
      difficulty: MIN_DIFFICULTY,
      previousDifficulty,
      maximumDifficulty,
      decision: 'inicial',
      reason: 'Primera experiencia o sin estadisticas para este juego.',
      metrics,
    });
  }

  if (!evidenceReady) {
    return buildDecision({
      difficulty: previousDifficulty,
      previousDifficulty,
      maximumDifficulty,
      decision: 'mantener',
      reason: 'Mantiene el nivel hasta reunir al menos dos sesiones recientes y ocho intentos acumulados.',
      metrics,
    });
  }

  if (inCooldown) {
    return buildDecision({
      difficulty: previousDifficulty,
      previousDifficulty,
      maximumDifficulty,
      decision: 'mantener',
      reason: 'Mantiene el nivel para completar el periodo de estabilizacion despues del ultimo cambio.',
      metrics,
    });
  }

  if (recentAbandonments >= 2 || twoWeakSessions) {
    const nextDifficulty = clamp(
      previousDifficulty - 1,
      MIN_DIFFICULTY,
      maximumDifficulty
    );
    return buildDecision({
      difficulty: nextDifficulty,
      previousDifficulty,
      maximumDifficulty,
      decision: nextDifficulty < previousDifficulty ? 'bajar' : 'mantener',
      reason:
        nextDifficulty < previousDifficulty
          ? 'Baja un nivel por dos sesiones recientes con dificultad sostenida.'
          : 'Mantiene el nivel minimo y prioriza refuerzo guiado.',
      metrics,
    });
  }

  if (historicalPrecision >= 75 && recentPrecision >= 80) {
    const nextDifficulty = previousDifficulty + 1;
    return buildDecision({
      difficulty: nextDifficulty,
      previousDifficulty,
      maximumDifficulty,
      decision: nextDifficulty <= maximumDifficulty ? 'subir' : 'mantener',
      reason:
        nextDifficulty <= maximumDifficulty
          ? 'Sube un nivel por dominio historico y buen rendimiento reciente.'
          : 'Mantiene el nivel porque ya alcanzo la dificultad maxima del juego.',
      metrics,
    });
  }

  return buildDecision({
    difficulty: previousDifficulty,
    previousDifficulty,
    maximumDifficulty,
    decision: 'mantener',
    reason: 'Mantiene el nivel para consolidar la habilidad antes del siguiente ajuste.',
    metrics,
  });
};

export const calculateInActivityDifficulty = ({ previousSession, minigame }) => {
  const maximumDifficulty = Number(minigame?.dificultad_maxima ?? 4);
  const previousDifficulty = clamp(
    Number(previousSession?.dificultad ?? MIN_DIFFICULTY),
    MIN_DIFFICULTY,
    maximumDifficulty
  );
  const hits = Number(previousSession?.aciertos ?? 0);
  const errors = Number(previousSession?.errores ?? 0);
  const attempts = hits + errors;
  const state = previousSession?.estado ?? 'desconocido';
  const commonMetrics = {
    alcance: 'actividad',
    habilidad: minigame?.habilidad,
    sesion_anterior_id: previousSession?.id_sesion_juego ?? null,
    orden_anterior: previousSession?.orden_en_ruta ?? null,
    aciertos_mision_anterior: hits,
    errores_mision_anterior: errors,
    intentos_mision_anterior: attempts,
    estado_mision_anterior: state,
  };
  const specializedDecision = evaluateInActivityDifficultyPolicy({
    previousSession,
    minigame,
  });

  if (specializedDecision) {
    const nextDifficulty = clamp(
      previousDifficulty + specializedDecision.difficultyDelta,
      MIN_DIFFICULTY,
      maximumDifficulty
    );
    const decision =
      nextDifficulty > previousDifficulty
        ? 'subir'
        : nextDifficulty < previousDifficulty
          ? 'bajar'
          : 'mantener';
    const reachedLimit =
      specializedDecision.difficultyDelta !== 0 && nextDifficulty === previousDifficulty;

    return buildDecision({
      difficulty: nextDifficulty,
      previousDifficulty,
      maximumDifficulty,
      decision,
      reason: reachedLimit
        ? `Mantiene el nivel porque ya alcanzo el limite ${
            previousDifficulty === maximumDifficulty ? 'maximo' : 'minimo'
          } del juego.`
        : specializedDecision.reason,
      metrics: {
        ...commonMetrics,
        ...specializedDecision.metrics,
        politica_adaptacion: minigame?.slug,
      },
    });
  }

  if (attempts <= 0) {
    return buildDecision({
      difficulty: previousDifficulty,
      previousDifficulty,
      maximumDifficulty,
      decision: 'mantener',
      reason: 'Mantiene el nivel porque la mision anterior no registro intentos validos.',
      metrics: {
        ...commonMetrics,
        resultado_ignorado: 'sin_intentos',
      },
    });
  }

  if (state === 'abandonado' || errors >= 2) {
    const nextDifficulty = clamp(
      previousDifficulty - 1,
      MIN_DIFFICULTY,
      maximumDifficulty
    );

    return buildDecision({
      difficulty: nextDifficulty,
      previousDifficulty,
      maximumDifficulty,
      decision: nextDifficulty < previousDifficulty ? 'bajar' : 'mantener',
      reason:
        nextDifficulty < previousDifficulty
          ? 'Baja un nivel para ofrecer una mision mas accesible despues de varios errores.'
          : 'Mantiene el nivel minimo y ofrece refuerzo en la siguiente mision.',
      metrics: commonMetrics,
    });
  }

  if (state === 'completado' && hits > 0 && errors === 0) {
    const nextDifficulty = clamp(
      previousDifficulty + 1,
      MIN_DIFFICULTY,
      maximumDifficulty
    );

    return buildDecision({
      difficulty: nextDifficulty,
      previousDifficulty,
      maximumDifficulty,
      decision: nextDifficulty > previousDifficulty ? 'subir' : 'mantener',
      reason:
        nextDifficulty > previousDifficulty
          ? 'Sube un nivel porque completo la mision anterior sin errores.'
          : 'Mantiene el reto maximo despues de una mision perfecta.',
      metrics: commonMetrics,
    });
  }

  return buildDecision({
    difficulty: previousDifficulty,
    previousDifficulty,
    maximumDifficulty,
    decision: 'mantener',
    reason: 'Mantiene el nivel porque completo la mision con un margen de practica adecuado.',
    metrics: commonMetrics,
  });
};

export const ADAPTIVE_DIFFICULTY_RULES = Object.freeze({
  minimumHistoricalAttempts: MIN_HISTORICAL_ATTEMPTS,
  minimumRecentSessions: MIN_RECENT_SESSIONS,
  recentWeights: RECENT_WEIGHTS,
});
