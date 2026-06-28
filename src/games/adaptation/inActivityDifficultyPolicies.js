import { evaluateCaminoArMission } from '../caminoAr/caminoAr.adaptation.js';
import { evaluateMercadoInteligenteMission } from '../mercadoInteligente/mercadoInteligente.adaptation.js';
import { evaluateObjetoPerdidoMission } from '../objetoPerdido/objetoPerdido.adaptation.js';
import { evaluateTrenFigurasMission } from '../trenFiguras/trenFiguras.adaptation.js';

const POLICIES_BY_SLUG = Object.freeze({
  'camino-ar': Object.freeze({ inActivity: evaluateCaminoArMission }),
  'tren-figuras': Object.freeze({
    inActivity: evaluateTrenFigurasMission,
    historical: evaluateTrenFigurasMission,
  }),
  'mercado-inteligente': Object.freeze({
    inActivity: evaluateMercadoInteligenteMission,
    historical: evaluateMercadoInteligenteMission,
  }),
  'objeto-perdido': Object.freeze({
    inActivity: evaluateObjetoPerdidoMission,
    historical: evaluateObjetoPerdidoMission,
  }),
});

export const evaluateInActivityDifficultyPolicy = ({ previousSession, minigame }) => {
  const policy = POLICIES_BY_SLUG[minigame?.slug]?.inActivity;

  return typeof policy === 'function' ? policy({ previousSession, minigame }) : null;
};

export const evaluateHistoricalDifficultyPolicy = ({ previousSession, minigame }) => {
  const policy = POLICIES_BY_SLUG[minigame?.slug]?.historical;

  return typeof policy === 'function' ? policy({ previousSession, minigame }) : null;
};
