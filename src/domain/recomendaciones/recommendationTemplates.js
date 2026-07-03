const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const SKILL_TEMPLATES = {
  logica: {
    interpretation: 'Conviene reforzar la organizacion de pasos y la explicacion de por que una respuesta es correcta.',
    actions: ['resolver retos guiados paso a paso', 'comparar dos estrategias posibles', 'explicar en voz alta la regla utilizada'],
  },
  memoria: {
    interpretation: 'Conviene apoyar la retencion y recuperacion de informacion con practicas breves y repetidas.',
    actions: ['usar apoyos visuales y asociaciones', 'dividir las instrucciones en secuencias cortas', 'repetir el reto aumentando gradualmente la cantidad de elementos'],
  },
  patrones: {
    interpretation: 'Conviene fortalecer la identificacion de regularidades antes de aumentar la complejidad.',
    actions: ['marcar los elementos que se repiten', 'completar secuencias con material visual', 'pedir que explique la regla antes de responder'],
  },
  atencion: {
    interpretation: 'Conviene trabajar el foco y la revision de informacion relevante antes de responder.',
    actions: ['realizar rondas cortas sin distractores', 'usar una pausa de revision antes de confirmar', 'identificar primero las pistas importantes de la actividad'],
  },
  razonamiento: {
    interpretation: 'Conviene reforzar la comparacion de alternativas y la toma de decisiones sustentada en datos.',
    actions: ['plantear problemas con dos alternativas', 'subrayar los datos necesarios para decidir', 'justificar la eleccion antes de continuar'],
  },
  velocidad: {
    interpretation: 'Conviene desarrollar agilidad sin sacrificar la precision de las respuestas.',
    actions: ['practicar rondas breves con tiempo visible', 'automatizar primero ejercicios sencillos', 'aumentar la velocidad solo cuando se mantenga la precision'],
  },
};

const PERFORMANCE_TEXT = {
  apoyo_prioritario: 'requiere apoyo prioritario',
  refuerzo: 'se encuentra en etapa de refuerzo',
  consolidacion: 'se encuentra en proceso de consolidacion',
  fortaleza: 'se comporta como una fortaleza',
};

const formatNumber = (value, fallback = 'sin dato') => {
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString('es-CO') : fallback;
};

const buildActions = (actions, gameName, subjectType) => {
  const scope = subjectType === 'group' ? 'con el grupo' : 'con el estudiante';
  const gameContext = gameName ? ` en ${gameName}` : '';
  return actions
    .map((action, index) => `${index + 1}) ${action}${index === 0 ? `${gameContext} ${scope}` : ''}`)
    .join('; ');
};

export const buildTemplateRecommendation = ({ subjectType, subjectName, decision } = {}) => {
  if (decision?.status !== 'ready' || !decision.skillTarget) return null;

  const target = decision.skillTarget;
  const template = SKILL_TEMPLATES[normalize(target.name)];
  if (!template) return null;

  const isGroup = subjectType === 'group';
  const subject = isGroup ? `El grupo ${subjectName}` : subjectName;
  const precisionLabel = isGroup ? 'precision promedio' : 'precision';
  const evidence = `${formatNumber(target.attempts)} intentos, ${formatNumber(target.hits)} aciertos y ${formatNumber(target.errors)} errores`;
  const performance = PERFORMANCE_TEXT[target.performanceLevel] ?? 'requiere seguimiento';
  const gameName = decision.recommendedGames?.[0]?.name;
  const goal = decision.followUpGoal?.targetValue;
  const sessions = decision.followUpGoal?.sessionsToReview ?? 3;

  return `Hallazgo principal: ${subject} registra ${formatNumber(target.precision)}% de ${precisionLabel} en ${target.name}, con ${evidence}.
Interpretacion: Este desempeno ${performance}. ${template.interpretation} El tiempo de reaccion promedio es ${formatNumber(target.averageReactionMs)} ms.
Acciones sugeridas: ${buildActions(template.actions, gameName, subjectType)}.
Seguimiento: Revisar las proximas ${sessions} partidas y buscar una precision de al menos ${formatNumber(goal)}%, manteniendo o reduciendo los errores.`;
};

export const hasRecommendationTemplate = (skillName) =>
  Boolean(SKILL_TEMPLATES[normalize(skillName)]);
