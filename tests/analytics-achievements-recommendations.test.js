import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import {
  authHeader,
  buildCodigoEstelarSuffix,
  provisionPlayableStudent,
  resolveCodigoEstelarId,
} from './helpers/codigoEstelar.helper.js';

const createStudentForExistingGroup = async ({
  adminToken,
  tutorToken,
  groupId,
  suffix,
  color_avatar = '#22C55E',
}) => {
  const createStudentRes = await request(app)
    .post('/api/estudiantes')
    .set(authHeader(adminToken))
    .send({
      nombre: `Estudiante ${suffix}`,
      edad: 8,
      grupo_id: groupId,
      color_avatar,
    });

  expect(createStudentRes.status).toBe(201);

  const studentId = createStudentRes.body.data.id;
  const qrRes = await request(app)
    .get(`/api/estudiantes/${studentId}/qr`)
    .set(authHeader(tutorToken));

  expect(qrRes.status).toBe(200);

  const loginRes = await request(app)
    .post('/api/estudiantes/login')
    .send({ qr_token: qrRes.body.data.qr_token });

  expect(loginRes.status).toBe(200);

  return {
    studentId,
    studentToken: loginRes.body.data.token,
  };
};

const openSingleClass = async ({ tutorToken, groupId, minijuegoId, niveles = 1 }) => {
  const res = await request(app)
    .patch(`/api/grupos/${groupId}/sesion`)
    .set(authHeader(tutorToken))
    .send({
      sesion_activa: true,
      modo: 'single',
      minijuego_id: minijuegoId,
      niveles,
    });

  expect(res.status).toBe(200);
  return res;
};

const startSession = async ({ studentToken, minijuegoId }) =>
  request(app)
    .post('/api/sesiones/iniciar')
    .set(authHeader(studentToken))
    .send({ minijuego_id: minijuegoId, dificultad: 2 });

const registerEvents = async ({ studentToken, sessionId, events }) => {
  for (const event of events) {
    const res = await request(app)
      .post(`/api/sesiones/${sessionId}/eventos`)
      .set(authHeader(studentToken))
      .send(event);

    expect(res.status).toBe(201);
  }
};

const finalizeSession = async ({ studentToken, sessionId, estado = 'completado', payload = {} }) =>
  request(app)
    .post(`/api/sesiones/${sessionId}/finalizar`)
    .set(authHeader(studentToken))
    .send({ estado, ...payload });

describe('Analitica, logros y recomendaciones oficiales', () => {
  it(
    'expone estadisticas oficiales para estudiante y grupo a partir de sesiones finalizadas',
    async () => {
      const suffix = buildCodigoEstelarSuffix('stats-layer');
      const minijuegoId = await resolveCodigoEstelarId();
      const fixture = await provisionPlayableStudent({ openClass: false, suffix });
      const secondStudent = await createStudentForExistingGroup({
        adminToken: fixture.adminToken,
        tutorToken: fixture.tutorToken,
        groupId: fixture.groupId,
        suffix: `${suffix}-2`,
      });

      await openSingleClass({
        tutorToken: fixture.tutorToken,
        groupId: fixture.groupId,
        minijuegoId,
      });

      const firstStart = await startSession({
        studentToken: fixture.studentToken,
        minijuegoId,
      });
      const secondStart = await startSession({
        studentToken: secondStudent.studentToken,
        minijuegoId,
      });

      expect(firstStart.status).toBe(201);
      expect(secondStart.status).toBe(201);

      await registerEvents({
        studentToken: fixture.studentToken,
        sessionId: firstStart.body.data.sesion.id,
        events: [
          { tipo_evento: 'acierto', habilidad: 'Lógica', tiempo_reaccion_ms: 1000, puntos: 10, combo_en_evento: 1 },
          { tipo_evento: 'error', habilidad: 'Lógica', tiempo_reaccion_ms: 1400, puntos: 0, combo_en_evento: 0 },
        ],
      });

      await registerEvents({
        studentToken: secondStudent.studentToken,
        sessionId: secondStart.body.data.sesion.id,
        events: [
          { tipo_evento: 'acierto', habilidad: 'Lógica', tiempo_reaccion_ms: 900, puntos: 10, combo_en_evento: 1 },
        ],
      });

      const firstFinish = await finalizeSession({
        studentToken: fixture.studentToken,
        sessionId: firstStart.body.data.sesion.id,
      });
      const secondFinish = await finalizeSession({
        studentToken: secondStudent.studentToken,
        sessionId: secondStart.body.data.sesion.id,
      });

      expect(firstFinish.status).toBe(200);
      expect(secondFinish.status).toBe(200);

      const myStatsRes = await request(app)
        .get('/api/estadisticas/mis-estadisticas')
        .set(authHeader(fixture.studentToken));

      expect(myStatsRes.status).toBe(200);
      expect(myStatsRes.body.success).toBe(true);
      expect(myStatsRes.body.data).toHaveLength(1);
      expect(myStatsRes.body.data[0]).toMatchObject({
        total_intentos: 2,
        aciertos: 1,
        errores: 1,
      });
      expect(Number(myStatsRes.body.data[0].precision_pct)).toBe(50);
      expect(Number(myStatsRes.body.data[0].promedio_reaccion_ms)).toBe(1200);

      const tutorStudentStatsRes = await request(app)
        .get(`/api/estadisticas/estudiante/${fixture.studentId}`)
        .set(authHeader(fixture.tutorToken));

      expect(tutorStudentStatsRes.status).toBe(200);
      expect(tutorStudentStatsRes.body.data[0].total_intentos).toBe(2);
      expect(Number(tutorStudentStatsRes.body.data[0].precision_pct)).toBe(50);

      const groupStatsRes = await request(app)
        .get(`/api/estadisticas/grupo/${fixture.groupId}`)
        .set(authHeader(fixture.tutorToken));

      expect(groupStatsRes.status).toBe(200);
      expect(groupStatsRes.body.success).toBe(true);
      expect(groupStatsRes.body.data).toHaveLength(1);
      expect(Number(groupStatsRes.body.data[0].precision_promedio)).toBe(75);
      expect(Number(groupStatsRes.body.data[0].reaccion_promedio)).toBe(1050);
      expect(Number(groupStatsRes.body.data[0].estudiantes_evaluados)).toBe(2);
    },
    45_000
  );

  it(
    'acumula estadisticas por habilidad entre sesiones y conserva la media ponderada de reaccion',
    async () => {
      const minijuegoId = await resolveCodigoEstelarId();
      const fixture = await provisionPlayableStudent({ openClass: false });

      await openSingleClass({
        tutorToken: fixture.tutorToken,
        groupId: fixture.groupId,
        minijuegoId,
        niveles: 2,
      });

      const firstStart = await startSession({
        studentToken: fixture.studentToken,
        minijuegoId,
      });
      expect(firstStart.status).toBe(201);

      await registerEvents({
        studentToken: fixture.studentToken,
        sessionId: firstStart.body.data.sesion.id,
        events: [
          { tipo_evento: 'acierto', habilidad: 'Lógica', tiempo_reaccion_ms: 1000, puntos: 10, combo_en_evento: 1 },
          { tipo_evento: 'error', habilidad: 'Lógica', tiempo_reaccion_ms: 1400, puntos: 0, combo_en_evento: 0 },
        ],
      });

      const firstFinish = await finalizeSession({
        studentToken: fixture.studentToken,
        sessionId: firstStart.body.data.sesion.id,
      });
      expect(firstFinish.status).toBe(200);

      const secondStart = await startSession({
        studentToken: fixture.studentToken,
        minijuegoId,
      });
      expect(secondStart.status).toBe(201);

      await registerEvents({
        studentToken: fixture.studentToken,
        sessionId: secondStart.body.data.sesion.id,
        events: [
          { tipo_evento: 'acierto', habilidad: 'Lógica', tiempo_reaccion_ms: 800, puntos: 10, combo_en_evento: 1 },
          { tipo_evento: 'acierto', habilidad: 'Lógica', tiempo_reaccion_ms: 1000, puntos: 15, combo_en_evento: 2 },
        ],
      });

      const secondFinish = await finalizeSession({
        studentToken: fixture.studentToken,
        sessionId: secondStart.body.data.sesion.id,
      });
      expect(secondFinish.status).toBe(200);

      const statsRes = await request(app)
        .get('/api/estadisticas/mis-estadisticas')
        .set(authHeader(fixture.studentToken));

      expect(statsRes.status).toBe(200);
      expect(statsRes.body.data).toHaveLength(1);
      expect(statsRes.body.data[0]).toMatchObject({
        total_intentos: 4,
        aciertos: 3,
        errores: 1,
      });
      expect(Number(statsRes.body.data[0].precision_pct)).toBe(75);
      expect(Number(statsRes.body.data[0].promedio_reaccion_ms)).toBe(1050);
    },
    45_000
  );

  it(
    'desbloquea logros oficiales al finalizar una sesion completa y los refleja en catalogo y mis-logros',
    async () => {
      const minijuegoId = await resolveCodigoEstelarId();
      const fixture = await provisionPlayableStudent({ openClass: false });

      await openSingleClass({
        tutorToken: fixture.tutorToken,
        groupId: fixture.groupId,
        minijuegoId,
      });

      const startRes = await startSession({
        studentToken: fixture.studentToken,
        minijuegoId,
      });
      expect(startRes.status).toBe(201);

      await registerEvents({
        studentToken: fixture.studentToken,
        sessionId: startRes.body.data.sesion.id,
        events: [
          { tipo_evento: 'acierto', habilidad: 'Lógica', tiempo_reaccion_ms: 800, puntos: 10, combo_en_evento: 1 },
          { tipo_evento: 'acierto', habilidad: 'Lógica', tiempo_reaccion_ms: 850, puntos: 10, combo_en_evento: 2 },
          { tipo_evento: 'acierto', habilidad: 'Lógica', tiempo_reaccion_ms: 900, puntos: 10, combo_en_evento: 3 },
          { tipo_evento: 'acierto', habilidad: 'Lógica', tiempo_reaccion_ms: 950, puntos: 10, combo_en_evento: 4 },
          { tipo_evento: 'acierto', habilidad: 'Lógica', tiempo_reaccion_ms: 1000, puntos: 10, combo_en_evento: 5 },
        ],
      });

      const finishRes = await finalizeSession({
        studentToken: fixture.studentToken,
        sessionId: startRes.body.data.sesion.id,
      });

      expect(finishRes.status).toBe(200);
      expect(finishRes.body.data.logros_desbloqueados.map((logro) => logro.clave_logro).sort()).toEqual([
        'combo_5',
        'precision_90',
        'primer_intento',
      ]);

      const myLogrosRes = await request(app)
        .get('/api/logros/mis-logros')
        .set(authHeader(fixture.studentToken));

      expect(myLogrosRes.status).toBe(200);
      const unlockedKeys = myLogrosRes.body.data.map((logro) => logro.clave_logro);
      expect(unlockedKeys).toEqual(
        expect.arrayContaining(['primer_intento', 'combo_5', 'precision_90'])
      );

      const catalogRes = await request(app)
        .get(`/api/logros/catalogo?estudiante_id=${fixture.studentId}`)
        .set(authHeader(fixture.studentToken));

      expect(catalogRes.status).toBe(200);

      const primerIntento = catalogRes.body.data.find((item) => item.clave === 'primer_intento');
      const combo = catalogRes.body.data.find((item) => item.clave === 'combo_5');
      const precision = catalogRes.body.data.find((item) => item.clave === 'precision_90');

      expect(primerIntento?.desbloqueado).toBe(true);
      expect(combo?.desbloqueado).toBe(true);
      expect(precision?.desbloqueado).toBe(true);
    },
    45_000
  );

  it(
    'genera, lista y archiva recomendaciones de estudiante y grupo a partir de estadisticas reales',
    async () => {
      const suffix = buildCodigoEstelarSuffix('recommend-layer');
      const minijuegoId = await resolveCodigoEstelarId();
      const fixture = await provisionPlayableStudent({ openClass: false, suffix });
      const secondStudent = await createStudentForExistingGroup({
        adminToken: fixture.adminToken,
        tutorToken: fixture.tutorToken,
        groupId: fixture.groupId,
        suffix: `${suffix}-2`,
      });

      await openSingleClass({
        tutorToken: fixture.tutorToken,
        groupId: fixture.groupId,
        minijuegoId,
      });

      const firstStart = await startSession({
        studentToken: fixture.studentToken,
        minijuegoId,
      });
      const secondStart = await startSession({
        studentToken: secondStudent.studentToken,
        minijuegoId,
      });

      expect(firstStart.status).toBe(201);
      expect(secondStart.status).toBe(201);

      await registerEvents({
        studentToken: fixture.studentToken,
        sessionId: firstStart.body.data.sesion.id,
        events: [
          { tipo_evento: 'acierto', habilidad: 'Lógica', tiempo_reaccion_ms: 900, puntos: 10, combo_en_evento: 1 },
          { tipo_evento: 'error', habilidad: 'Lógica', tiempo_reaccion_ms: 1500, puntos: 0, combo_en_evento: 0 },
        ],
      });

      await registerEvents({
        studentToken: secondStudent.studentToken,
        sessionId: secondStart.body.data.sesion.id,
        events: [
          { tipo_evento: 'acierto', habilidad: 'Lógica', tiempo_reaccion_ms: 950, puntos: 10, combo_en_evento: 1 },
        ],
      });

      const firstFinish = await finalizeSession({
        studentToken: fixture.studentToken,
        sessionId: firstStart.body.data.sesion.id,
      });
      const secondFinish = await finalizeSession({
        studentToken: secondStudent.studentToken,
        sessionId: secondStart.body.data.sesion.id,
      });

      expect(firstFinish.status).toBe(200);
      expect(secondFinish.status).toBe(200);

      const studentRecommendationRes = await request(app)
        .post(`/api/recomendaciones/generar/estudiante/${fixture.studentId}`)
        .set(authHeader(fixture.tutorToken));

      expect(studentRecommendationRes.status).toBe(201);
      expect(studentRecommendationRes.body.success).toBe(true);
      expect(studentRecommendationRes.body.data.estudiante_id).toBe(fixture.studentId);
      expect(studentRecommendationRes.body.data.grupo_id).toBeNull();
      expect(studentRecommendationRes.body.data.habilidad).toBeTruthy();
      expect(studentRecommendationRes.body.data.severidad).toBeTruthy();
      expect(studentRecommendationRes.body.data.mensaje).toContain('Hallazgo principal');

      const studentListRes = await request(app)
        .get(`/api/recomendaciones/estudiante/${fixture.studentId}`)
        .set(authHeader(fixture.tutorToken));

      expect(studentListRes.status).toBe(200);
      expect(studentListRes.body.data).toHaveLength(1);

      const groupRecommendationRes = await request(app)
        .post(`/api/recomendaciones/generar/grupo/${fixture.groupId}`)
        .set(authHeader(fixture.tutorToken));

      expect(groupRecommendationRes.status).toBe(201);
      expect(groupRecommendationRes.body.data.estudiante_id).toBeNull();
      expect(groupRecommendationRes.body.data.grupo_id).toBe(fixture.groupId);
      expect(groupRecommendationRes.body.data.mensaje).toContain('Hallazgo principal');

      const groupListRes = await request(app)
        .get(`/api/recomendaciones/grupo/${fixture.groupId}`)
        .set(authHeader(fixture.tutorToken));

      expect(groupListRes.status).toBe(200);
      expect(groupListRes.body.data).toHaveLength(1);

      const archiveStudentRecommendationRes = await request(app)
        .patch(`/api/recomendaciones/${studentRecommendationRes.body.data.id}/archivar`)
        .set(authHeader(fixture.tutorToken));
      const archiveGroupRecommendationRes = await request(app)
        .patch(`/api/recomendaciones/${groupRecommendationRes.body.data.id}/archivar`)
        .set(authHeader(fixture.tutorToken));

      expect(archiveStudentRecommendationRes.status).toBe(204);
      expect(archiveGroupRecommendationRes.status).toBe(204);

      const studentListAfterArchiveRes = await request(app)
        .get(`/api/recomendaciones/estudiante/${fixture.studentId}`)
        .set(authHeader(fixture.tutorToken));
      const groupListAfterArchiveRes = await request(app)
        .get(`/api/recomendaciones/grupo/${fixture.groupId}`)
        .set(authHeader(fixture.tutorToken));

      expect(studentListAfterArchiveRes.status).toBe(200);
      expect(studentListAfterArchiveRes.body.data).toHaveLength(0);
      expect(groupListAfterArchiveRes.status).toBe(200);
      expect(groupListAfterArchiveRes.body.data).toHaveLength(0);
    },
    60_000
  );
});
