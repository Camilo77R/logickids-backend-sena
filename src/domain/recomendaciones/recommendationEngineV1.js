export const RECOMMENDATION_RULES_VERSION = '1.0';
export const MIN_ATTEMPTS_PER_SKILL = 10;
export const FULL_CONFIDENCE_ATTEMPTS = 30;
export const MIN_STUDENTS_PER_GROUP_SKILL = 3;
export const FULL_CONFIDENCE_GROUP_STUDENTS = 10;

const MAX_STRENGTHS = 3;
const MAX_RECOMMENDED_GAMES = 3;

const toFiniteNumber = (value, fallback = null) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const normalizeText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const normalizeSkill = (stat) => {
  const attempts = Math.max(0, toFiniteNumber(stat.total_intentos, 0));
  const hits = Math.max(0, toFiniteNumber(stat.aciertos, 0));
  const errors = Math.max(0, toFiniteNumber(stat.errores, 0));
  const precision = toFiniteNumber(stat.precision_pct);

  return {
    id: toFiniteNumber(stat.habilidad_id ?? stat.id_habilidad),
    name: stat.habilidad ?? stat.nombre ?? 'Habilidad sin nombre',
    attempts,
    hits,
    errors,
    precision: precision == null ? null : clamp(precision, 0, 100),
    averageReactionMs: toFiniteNumber(
      stat.promedio_reaccion_ms ?? stat.tiempo_reaccion_ms
    ),
  };
};

export const classifyPerformance = (precision) => {
  const value = toFiniteNumber(precision, 0);

  if (value < 50) {
    return { level: 'apoyo_prioritario', priority: 3 };
  }
  if (value < 70) {
    return { level: 'refuerzo', priority: 2 };
  }
  if (value < 85) {
    return { level: 'consolidacion', priority: 1 };
  }
  return { level: 'fortaleza', priority: 0 };
};

const compareTargetSkills = (left, right) => {
  if (left.precision !== right.precision) return left.precision - right.precision;
  if (left.errors !== right.errors) return right.errors - left.errors;
  if (left.attempts !== right.attempts) return right.attempts - left.attempts;

  if (left.id != null && right.id != null && left.id !== right.id) {
    return left.id - right.id;
  }

  return normalizeText(left.name).localeCompare(normalizeText(right.name), 'es');
};

const findGameSkillRelation = (game, target) => {
  const relations = Array.isArray(game.skills)
    ? game.skills
    : Array.isArray(game.habilidades)
      ? game.habilidades
      : [];

  const relation = relations.find((item) => {
    const relationId = toFiniteNumber(item.skillId ?? item.habilidad_id ?? item.id_habilidad);
    const relationName = item.skillName ?? item.habilidad ?? item.nombre;
    return (
      (target.id != null && relationId === target.id) ||
      normalizeText(relationName) === normalizeText(target.name)
    );
  });

  if (relation) {
    return {
      isPrimary: Boolean(relation.isPrimary ?? relation.es_principal),
      weight: toFiniteNumber(relation.weight ?? relation.peso, 0),
    };
  }

  const legacySkillId = toFiniteNumber(game.habilidad_id ?? game.skillId);
  const legacySkillName = game.habilidad ?? game.skillName;
  const matchesLegacy =
    (target.id != null && legacySkillId === target.id) ||
    normalizeText(legacySkillName) === normalizeText(target.name);

  return matchesLegacy ? { isPrimary: true, weight: 100 } : null;
};

const isGameAvailableForStudent = (game, age) => {
  const active = game.activo ?? game.active ?? true;
  const visible = game.visible_en_catalogo ?? game.visible ?? true;
  if (!active || !visible) return false;

  if (age == null) return true;

  const minimumAge = toFiniteNumber(game.edad_minima ?? game.minimumAge);
  const maximumAge = toFiniteNumber(game.edad_maxima ?? game.maximumAge);
  if (minimumAge != null && age < minimumAge) return false;
  if (maximumAge != null && age > maximumAge) return false;
  return true;
};

const findRecentDifficulty = (recentSessions, game, target) => {
  const gameId = toFiniteNumber(game.id_minijuego ?? game.id ?? game.gameId);
  const gameSlug = normalizeText(game.slug);
  const gameTitle = normalizeText(game.titulo ?? game.name);
  const targetName = normalizeText(target.name);

  const session = recentSessions.find((item) => {
    const sessionGameId = toFiniteNumber(item.minijuego_id ?? item.gameId);
    return (
      (gameId != null && sessionGameId === gameId) ||
      (gameSlug && normalizeText(item.slug) === gameSlug) ||
      (gameTitle && normalizeText(item.minijuego ?? item.gameName) === gameTitle) ||
      normalizeText(item.habilidad ?? item.skillName) === targetName
    );
  });

  return toFiniteNumber(session?.dificultad ?? session?.difficulty, 1);
};

const resolveRecommendedDifficulty = ({ game, target, recentSessions }) => {
  const minimum = Math.max(
    1,
    toFiniteNumber(game.dificultad_minima ?? game.minimumDifficulty, 1)
  );
  const maximum = Math.max(
    minimum,
    toFiniteNumber(game.dificultad_maxima ?? game.maximumDifficulty, minimum)
  );
  const current = clamp(findRecentDifficulty(recentSessions, game, target), minimum, maximum);

  let adjustment = 0;
  if (target.precision < 50) adjustment = -1;
  if (target.precision >= 85) adjustment = 1;

  return {
    current,
    recommended: clamp(current + adjustment, minimum, maximum),
    minimum,
    maximum,
  };
};

const selectRecommendedGames = ({ games, target, recentSessions, studentAge }) =>
  games
    .map((game) => ({
      game,
      relation: findGameSkillRelation(game, target),
    }))
    .filter(({ game, relation }) => relation && isGameAvailableForStudent(game, studentAge))
    .sort((left, right) => {
      if (left.relation.isPrimary !== right.relation.isPrimary) {
        return left.relation.isPrimary ? -1 : 1;
      }
      if (left.relation.weight !== right.relation.weight) {
        return right.relation.weight - left.relation.weight;
      }
      return (
        toFiniteNumber(left.game.orden_catalogo ?? left.game.catalogOrder, 100) -
        toFiniteNumber(right.game.orden_catalogo ?? right.game.catalogOrder, 100)
      );
    })
    .slice(0, MAX_RECOMMENDED_GAMES)
    .map(({ game, relation }) => ({
      id: toFiniteNumber(game.id_minijuego ?? game.id ?? game.gameId),
      slug: game.slug ?? null,
      name: game.titulo ?? game.name ?? 'Juego sin nombre',
      skillWeight: relation.weight,
      isPrimarySkill: relation.isPrimary,
      difficulty: resolveRecommendedDifficulty({ game, target, recentSessions }),
    }));

const buildInsufficientEvidenceResult = ({ studentId, skills }) => ({
  status: 'insufficient_evidence',
  subjectType: 'student',
  subjectId: studentId,
  skillTarget: null,
  strengths: [],
  evidence: {
    skillsReceived: skills.length,
    eligibleSkills: 0,
    minimumAttempts: MIN_ATTEMPTS_PER_SKILL,
    attemptsNeededBySkill: skills.map((skill) => ({
      skillId: skill.id,
      skillName: skill.name,
      currentAttempts: skill.attempts,
      missingAttempts: Math.max(0, MIN_ATTEMPTS_PER_SKILL - skill.attempts),
    })),
  },
  recommendedGames: [],
  recommendationReason: 'insufficient_evidence',
  followUpGoal: null,
  confidence: 0,
  rulesVersion: RECOMMENDATION_RULES_VERSION,
});

export const buildStudentRecommendationV1 = ({
  studentId,
  studentAge = null,
  stats = [],
  games = [],
  recentSessions = [],
} = {}) => {
  if (!Array.isArray(stats) || !Array.isArray(games) || !Array.isArray(recentSessions)) {
    throw new TypeError('stats, games y recentSessions deben ser arreglos');
  }

  const skills = stats.map(normalizeSkill);
  const eligibleSkills = skills.filter(
    (skill) => skill.attempts >= MIN_ATTEMPTS_PER_SKILL && skill.precision != null
  );

  if (!eligibleSkills.length) {
    return buildInsufficientEvidenceResult({ studentId, skills });
  }

  const target = [...eligibleSkills].sort(compareTargetSkills)[0];
  const performance = classifyPerformance(target.precision);
  const strengths = eligibleSkills
    .filter((skill) => skill.id !== target.id && skill.precision >= 85)
    .sort((left, right) => right.precision - left.precision)
    .slice(0, MAX_STRENGTHS)
    .map((skill) => ({
      skillId: skill.id,
      skillName: skill.name,
      precision: skill.precision,
      attempts: skill.attempts,
    }));
  const recommendedGames = selectRecommendedGames({
    games,
    target,
    recentSessions,
    studentAge: toFiniteNumber(studentAge),
  });
  const confidence = Math.min(1, target.attempts / FULL_CONFIDENCE_ATTEMPTS);

  return {
    status: 'ready',
    subjectType: 'student',
    subjectId: studentId,
    skillTarget: {
      id: target.id,
      name: target.name,
      precision: target.precision,
      attempts: target.attempts,
      hits: target.hits,
      errors: target.errors,
      averageReactionMs: target.averageReactionMs,
      performanceLevel: performance.level,
      priority: performance.priority,
    },
    strengths,
    evidence: {
      skillsReceived: skills.length,
      eligibleSkills: eligibleSkills.length,
      minimumAttempts: MIN_ATTEMPTS_PER_SKILL,
    },
    recommendedGames,
    recommendationReason: recommendedGames.length ? 'matched_catalog_games' : 'no_compatible_game',
    followUpGoal: {
      metric: 'precision_pct',
      currentValue: target.precision,
      targetValue: Math.min(100, Math.ceil(target.precision + 10)),
      sessionsToReview: 3,
    },
    confidence: Number(confidence.toFixed(2)),
    rulesVersion: RECOMMENDATION_RULES_VERSION,
  };
};

const normalizeGroupSkill = (stat) => ({
  id: toFiniteNumber(stat.id_habilidad ?? stat.habilidad_id),
  name: stat.habilidad ?? stat.nombre ?? 'Habilidad sin nombre',
  precision: (() => {
    const value = toFiniteNumber(stat.precision_promedio);
    return value == null ? null : clamp(value, 0, 100);
  })(),
  averageReactionMs: toFiniteNumber(stat.reaccion_promedio),
  studentsEvaluated: Math.max(0, toFiniteNumber(stat.estudiantes_evaluados, 0)),
  attempts: Math.max(0, toFiniteNumber(stat.intentos_totales, 0)),
  hits: Math.max(0, toFiniteNumber(stat.aciertos_totales, 0)),
  errors: Math.max(0, toFiniteNumber(stat.errores_totales, 0)),
  minimumPrecision: toFiniteNumber(stat.precision_minima),
  maximumPrecision: toFiniteNumber(stat.precision_maxima),
});

export const buildGroupRecommendationV1 = ({
  groupId,
  stats = [],
  games = [],
} = {}) => {
  if (!Array.isArray(stats) || !Array.isArray(games)) {
    throw new TypeError('stats y games deben ser arreglos');
  }

  const skills = stats.map(normalizeGroupSkill);
  const eligibleSkills = skills.filter(
    (skill) =>
      skill.precision != null &&
      skill.studentsEvaluated >= MIN_STUDENTS_PER_GROUP_SKILL &&
      skill.attempts >= skill.studentsEvaluated * MIN_ATTEMPTS_PER_SKILL
  );

  if (!eligibleSkills.length) {
    return {
      status: 'insufficient_evidence',
      subjectType: 'group',
      subjectId: groupId,
      skillTarget: null,
      strengths: [],
      evidence: {
        skillsReceived: skills.length,
        eligibleSkills: 0,
        minimumStudents: MIN_STUDENTS_PER_GROUP_SKILL,
        minimumAttemptsPerStudent: MIN_ATTEMPTS_PER_SKILL,
      },
      recommendedGames: [],
      recommendationReason: 'insufficient_evidence',
      followUpGoal: null,
      confidence: 0,
      rulesVersion: RECOMMENDATION_RULES_VERSION,
    };
  }

  const target = [...eligibleSkills].sort(compareTargetSkills)[0];
  const performance = classifyPerformance(target.precision);
  const strengths = eligibleSkills
    .filter((skill) => skill.id !== target.id && skill.precision >= 85)
    .sort((left, right) => right.precision - left.precision)
    .slice(0, MAX_STRENGTHS)
    .map((skill) => ({
      skillId: skill.id,
      skillName: skill.name,
      precision: skill.precision,
      studentsEvaluated: skill.studentsEvaluated,
    }));
  const recommendedGames = selectRecommendedGames({
    games,
    target,
    recentSessions: [],
    studentAge: null,
  });

  return {
    status: 'ready',
    subjectType: 'group',
    subjectId: groupId,
    skillTarget: {
      id: target.id,
      name: target.name,
      precision: target.precision,
      precisionRange: {
        minimum: target.minimumPrecision,
        maximum: target.maximumPrecision,
      },
      studentsEvaluated: target.studentsEvaluated,
      attempts: target.attempts,
      hits: target.hits,
      errors: target.errors,
      averageReactionMs: target.averageReactionMs,
      performanceLevel: performance.level,
      priority: performance.priority,
    },
    strengths,
    evidence: {
      skillsReceived: skills.length,
      eligibleSkills: eligibleSkills.length,
      minimumStudents: MIN_STUDENTS_PER_GROUP_SKILL,
      minimumAttemptsPerStudent: MIN_ATTEMPTS_PER_SKILL,
    },
    recommendedGames,
    recommendationReason: recommendedGames.length ? 'matched_catalog_games' : 'no_compatible_game',
    followUpGoal: {
      metric: 'precision_promedio',
      currentValue: target.precision,
      targetValue: Math.min(100, Math.ceil(target.precision + 10)),
      sessionsToReview: 3,
    },
    confidence: Number(
      Math.min(1, target.studentsEvaluated / FULL_CONFIDENCE_GROUP_STUDENTS).toFixed(2)
    ),
    rulesVersion: RECOMMENDATION_RULES_VERSION,
  };
};
