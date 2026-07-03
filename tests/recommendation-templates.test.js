import { describe, expect, it } from 'vitest';
import {
  buildTemplateRecommendation,
  hasRecommendationTemplate,
} from '../src/domain/recomendaciones/recommendationTemplates.js';

const decision = (skillName = 'Memoria') => ({
  status: 'ready',
  skillTarget: {
    name: skillName,
    precision: 60,
    attempts: 20,
    hits: 12,
    errors: 8,
    averageReactionMs: 520,
    performanceLevel: 'refuerzo',
  },
  recommendedGames: [{ name: 'Camino AR' }],
  followUpGoal: { targetValue: 70, sessionsToReview: 3 },
});

describe('Catalogo local de recomendaciones', () => {
  it.each(['Lógica', 'Memoria', 'Patrones', 'Atención', 'Razonamiento', 'Velocidad'])(
    'cubre la habilidad %s sin consultar IA',
    (skillName) => {
      expect(hasRecommendationTemplate(skillName)).toBe(true);
      expect(
        buildTemplateRecommendation({
          subjectType: 'student',
          subjectName: 'Ana',
          decision: decision(skillName),
        })
      ).toContain('Acciones sugeridas:');
    }
  );

  it('genera los cuatro bloques esperados para un estudiante', () => {
    const result = buildTemplateRecommendation({
      subjectType: 'student',
      subjectName: 'Ana',
      decision: decision(),
    });

    expect(result).toContain('Hallazgo principal: Ana');
    expect(result).toContain('Interpretacion:');
    expect(result).toContain('Acciones sugeridas:');
    expect(result).toContain('Seguimiento:');
    expect(result).toContain('Camino AR');
  });

  it('genera una recomendacion grupal con lenguaje colectivo', () => {
    const result = buildTemplateRecommendation({
      subjectType: 'group',
      subjectName: 'Grupo A',
      decision: decision('Atención'),
    });

    expect(result).toContain('El grupo Grupo A');
    expect(result).toContain('precision promedio');
  });

  it('devuelve null para una habilidad no catalogada', () => {
    expect(
      buildTemplateRecommendation({
        subjectType: 'student',
        subjectName: 'Ana',
        decision: decision('Creatividad'),
      })
    ).toBeNull();
  });
});
