const normalizeMinijuegoSlug = (slug) =>
  typeof slug === 'string' && slug.trim() ? slug.trim().toLowerCase() : null;

const GLOBAL_ACHIEVEMENT_RULES = Object.freeze([
  {
    key: 'primer_intento',
    when: ({ total_completed_sessions }) => total_completed_sessions === 1,
  },
  {
    key: 'combo_5',
    when: ({ combo_maximo }) => combo_maximo >= 5,
  },
  {
    key: 'precision_90',
    when: ({ precision }) => precision >= 90,
  },
  {
    key: 'maratonista',
    when: ({ total_completed_sessions }) => total_completed_sessions >= 10,
  },
]);

// Los logros de un minijuego se registran por slug para que no se vuelvan
// reglas globales por accidente cuando el catalogo crezca.
const GAME_ACHIEVEMENT_RULES = Object.freeze({
  'mercado-inteligente': Object.freeze([]),
});

const resolveApplicableAchievementRules = (minijuegoSlug) => [
  ...GLOBAL_ACHIEVEMENT_RULES,
  ...(GAME_ACHIEVEMENT_RULES[normalizeMinijuegoSlug(minijuegoSlug)] ?? []),
];

export const resolveAchievementKeysForSession = (context) => {
  const keys = resolveApplicableAchievementRules(context.minijuego_slug)
    .filter((rule) => rule.when(context))
    .map((rule) => rule.key)
    .filter(Boolean);

  return [...new Set(keys)];
};
