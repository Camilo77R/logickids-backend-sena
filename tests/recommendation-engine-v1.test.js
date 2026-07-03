import { describe, expect, it } from 'vitest';
import {
  buildGroupRecommendationV1,
  buildStudentRecommendationV1,
  classifyPerformance,
} from '../src/domain/recomendaciones/recommendationEngineV1.js';

const skill = (overrides = {}) => ({
  habilidad_id: 1,
  habilidad: 'Logica',
  total_intentos: 30,
  aciertos: 18,
  errores: 12,
  precision_pct: 60,
  promedio_reaccion_ms: 500,
  ...overrides,
});

describe('Motor determinista grupal v1', () => {
  const groupSkill = (overrides = {}) => ({
    id_habilidad: 1,
    habilidad: 'Logica',
    precision_promedio: 62,
    reaccion_promedio: 500,
    estudiantes_evaluados: 5,
    intentos_totales: 60,
    aciertos_totales: 37,
    errores_totales: 23,
    precision_minima: 40,
    precision_maxima: 85,
    ...overrides,
  });

  it('exige al menos tres estudiantes y diez intentos por estudiante', () => {
    const tooFewStudents = buildGroupRecommendationV1({
      groupId: 1,
      stats: [groupSkill({ estudiantes_evaluados: 2, intentos_totales: 40 })],
    });
    const tooFewAttempts = buildGroupRecommendationV1({
      groupId: 1,
      stats: [groupSkill({ estudiantes_evaluados: 5, intentos_totales: 49 })],
    });

    expect(tooFewStudents.status).toBe('insufficient_evidence');
    expect(tooFewAttempts.status).toBe('insufficient_evidence');
  });

  it('selecciona la menor precision grupal y conserva rango y fortalezas', () => {
    const result = buildGroupRecommendationV1({
      groupId: 7,
      stats: [
        groupSkill({ id_habilidad: 1, habilidad: 'Logica', precision_promedio: 88 }),
        groupSkill({
          id_habilidad: 2,
          habilidad: 'Memoria',
          precision_promedio: 55,
          precision_minima: 30,
          precision_maxima: 75,
        }),
      ],
      games: [
        game({
          id_minijuego: 20,
          slug: 'camino-ar',
          habilidad_id: 2,
          habilidad: 'Memoria',
        }),
      ],
    });

    expect(result.status).toBe('ready');
    expect(result.subjectType).toBe('group');
    expect(result.skillTarget.name).toBe('Memoria');
    expect(result.skillTarget.precisionRange).toEqual({ minimum: 30, maximum: 75 });
    expect(result.strengths[0].skillName).toBe('Logica');
    expect(result.recommendedGames[0].slug).toBe('camino-ar');
  });

  it('calcula confianza segun estudiantes evaluados', () => {
    const result = buildGroupRecommendationV1({
      stats: [groupSkill({ estudiantes_evaluados: 5, intentos_totales: 50 })],
    });

    expect(result.confidence).toBe(0.5);
  });
});

const game = (overrides = {}) => ({
  id_minijuego: 10,
  slug: 'robot-logico',
  titulo: 'Robot Logico',
  habilidad_id: 1,
  habilidad: 'Logica',
  dificultad_minima: 1,
  dificultad_maxima: 4,
  activo: true,
  visible_en_catalogo: true,
  orden_catalogo: 1,
  ...overrides,
});

describe('Motor determinista de recomendaciones v1', () => {
  it.each([
    [49.99, 'apoyo_prioritario', 3],
    [50, 'refuerzo', 2],
    [69.99, 'refuerzo', 2],
    [70, 'consolidacion', 1],
    [84.99, 'consolidacion', 1],
    [85, 'fortaleza', 0],
  ])('clasifica %s como %s', (precision, level, priority) => {
    expect(classifyPerformance(precision)).toEqual({ level, priority });
  });

  it('no recomienda cuando ninguna habilidad alcanza diez intentos', () => {
    const result = buildStudentRecommendationV1({
      studentId: 101,
      stats: [skill({ total_intentos: 6 }), skill({ habilidad_id: 2, total_intentos: 9 })],
    });

    expect(result.status).toBe('insufficient_evidence');
    expect(result.recommendedGames).toEqual([]);
    expect(result.evidence.attemptsNeededBySkill[0].missingAttempts).toBe(4);
  });

  it('elige la menor precision y conserva una fortaleza', () => {
    const result = buildStudentRecommendationV1({
      studentId: 101,
      stats: [
        skill({ habilidad_id: 1, habilidad: 'Logica', precision_pct: 88 }),
        skill({ habilidad_id: 2, habilidad: 'Memoria', precision_pct: 45 }),
      ],
      games: [
        game({
          id_minijuego: 20,
          slug: 'camino-ar',
          titulo: 'Camino AR',
          habilidad_id: 2,
          habilidad: 'Memoria',
        }),
      ],
    });

    expect(result.skillTarget.name).toBe('Memoria');
    expect(result.skillTarget.performanceLevel).toBe('apoyo_prioritario');
    expect(result.strengths).toEqual([
      expect.objectContaining({ skillName: 'Logica', precision: 88 }),
    ]);
    expect(result.recommendedGames[0].slug).toBe('camino-ar');
  });

  it('desempata por errores, luego intentos y finalmente id', () => {
    const resultByErrors = buildStudentRecommendationV1({
      stats: [
        skill({ habilidad_id: 1, errores: 8, precision_pct: 60 }),
        skill({ habilidad_id: 2, habilidad: 'Patrones', errores: 12, precision_pct: 60 }),
      ],
    });
    expect(resultByErrors.skillTarget.id).toBe(2);

    const resultByAttempts = buildStudentRecommendationV1({
      stats: [
        skill({ habilidad_id: 1, errores: 8, total_intentos: 20 }),
        skill({ habilidad_id: 2, errores: 8, total_intentos: 30 }),
      ],
    });
    expect(resultByAttempts.skillTarget.id).toBe(2);

    const resultById = buildStudentRecommendationV1({
      stats: [skill({ habilidad_id: 2 }), skill({ habilidad_id: 1 })],
    });
    expect(resultById.skillTarget.id).toBe(1);
  });

  it('no inventa un juego cuando el catalogo no cubre la habilidad', () => {
    const result = buildStudentRecommendationV1({
      stats: [skill({ habilidad_id: 6, habilidad: 'Velocidad', precision_pct: 40 })],
      games: [game()],
    });

    expect(result.recommendationReason).toBe('no_compatible_game');
    expect(result.recommendedGames).toEqual([]);
  });

  it('reduce la dificultad con desempeno critico sin bajar de uno', () => {
    const result = buildStudentRecommendationV1({
      stats: [skill({ precision_pct: 40 })],
      games: [game()],
      recentSessions: [{ minijuego_id: 10, dificultad: 2 }],
    });

    expect(result.recommendedGames[0].difficulty.recommended).toBe(1);
  });

  it('sube la dificultad para una fortaleza sin superar el maximo', () => {
    const result = buildStudentRecommendationV1({
      stats: [skill({ precision_pct: 90 })],
      games: [game()],
      recentSessions: [{ minijuego_id: 10, dificultad: 4 }],
    });

    expect(result.recommendedGames[0].difficulty.recommended).toBe(4);
  });

  it('acepta relaciones ponderadas y prioriza la habilidad principal', () => {
    const result = buildStudentRecommendationV1({
      stats: [skill({ habilidad_id: 3, habilidad: 'Patrones' })],
      games: [
        game({
          id_minijuego: 11,
          slug: 'secundario',
          skills: [{ habilidad_id: 3, peso: 80, es_principal: false }],
        }),
        game({
          id_minijuego: 12,
          slug: 'principal',
          skills: [{ habilidad_id: 3, peso: 60, es_principal: true }],
        }),
      ],
    });

    expect(result.recommendedGames.map((item) => item.slug)).toEqual([
      'principal',
      'secundario',
    ]);
  });

  it('filtra juegos inactivos, ocultos o fuera del rango de edad', () => {
    const result = buildStudentRecommendationV1({
      studentAge: 9,
      stats: [skill()],
      games: [
        game({ slug: 'inactivo', activo: false }),
        game({ slug: 'oculto', visible_en_catalogo: false }),
        game({ slug: 'mayores', edad_minima: 12, edad_maxima: 15 }),
        game({ slug: 'compatible', edad_minima: 7, edad_maxima: 11 }),
      ],
    });

    expect(result.recommendedGames.map((item) => item.slug)).toEqual(['compatible']);
  });

  it('calcula confianza por cantidad de evidencia y la limita a uno', () => {
    expect(buildStudentRecommendationV1({ stats: [skill({ total_intentos: 15 })] }).confidence)
      .toBe(0.5);
    expect(buildStudentRecommendationV1({ stats: [skill({ total_intentos: 90 })] }).confidence)
      .toBe(1);
  });
});
