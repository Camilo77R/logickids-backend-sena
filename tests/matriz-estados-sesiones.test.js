import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { db } from '../src/config/db.js';
import {
  authHeader,
  provisionPlayableStudent,
  resolveCodigoEstelarId,
} from './helpers/codigoEstelar.helper.js';

const obtenerSesionClaseActivaOReciente = async (groupId) =>
  db('sesiones_clase')
    .where({ grupo_id: groupId })
    .orderBy('abierta_en', 'desc')
    .first();

const obtenerParticipanteSesionClase = async (sesionClaseId, studentId) =>
  db('sesion_clase_participantes')
    .where({
      sesion_clase_id: sesionClaseId,
      estudiante_id: studentId,
    })
    .first();

const obtenerSesionesJuegoDelEstudiante = async (studentId) =>
  db('sesiones_juego as sj')
    .join('estados_sesion as es', 'es.id_estado_sesion', 'sj.estado_id')
    .where('sj.estudiante_id', studentId)
    .orderBy('sj.iniciada_en', 'desc')
    .select(
      'sj.id_sesion_juego',
      'sj.sesion_clase_id',
      'sj.finalizada_en',
      'sj.puntaje',
      'sj.aciertos',
      'sj.errores',
      'es.nombre as estado'
    );

describe('🧭 Matriz oficial de estados de sesiones y participantes', () => {
  it(
    '✅ completa bien: cierra la sesion_juego, marca participante completado y cierra la clase si era el unico estudiante',
    async () => {
      const codigoEstelarId = await resolveCodigoEstelarId();
      const fixture = await provisionPlayableStudent();

      const startRes = await request(app)
        .post('/api/sesiones/iniciar')
        .set(authHeader(fixture.studentToken))
        .send({
          minijuego_id: codigoEstelarId,
          dificultad: 2,
        });

      expect(startRes.status).toBe(201);
      const sesionId = startRes.body.data.sesion.id;
      const sesionClaseId = startRes.body.data.sesion.sesion_clase_id;

      const eventoRes = await request(app)
        .post(`/api/sesiones/${sesionId}/eventos`)
        .set(authHeader(fixture.studentToken))
        .send({
          tipo_evento: 'acierto',
          habilidad: 'Lógica',
          tiempo_reaccion_ms: 900,
          puntos: 10,
          combo_en_evento: 1,
        });

      expect(eventoRes.status).toBe(201);

      const finishRes = await request(app)
        .post(`/api/sesiones/${sesionId}/finalizar`)
        .set(authHeader(fixture.studentToken))
        .send({ estado: 'completado' });

      expect(finishRes.status).toBe(200);
      expect(finishRes.body.data.progreso_ruta).toMatchObject({
        haySiguientePaso: false,
        participanteEstado: 'completado',
      });

      const participante = await obtenerParticipanteSesionClase(sesionClaseId, fixture.studentId);
      expect(participante.estado).toBe('completado');
      expect(participante.finalizada_en).not.toBeNull();

      const sesionClase = await obtenerSesionClaseActivaOReciente(fixture.groupId);
      expect(sesionClase.estado).toBe('cerrada');
      expect(sesionClase.cierre_motivo).toBe('finalizada');

      const sesionesJuego = await obtenerSesionesJuegoDelEstudiante(fixture.studentId);
      expect(sesionesJuego[0].estado).toBe('completado');
      expect(sesionesJuego[0].finalizada_en).not.toBeNull();
    },
    30_000
  );

  it(
    '✅ completa mal: si la ronda termina naturalmente con errores, igual cierra como completado y no como abandonado',
    async () => {
      const codigoEstelarId = await resolveCodigoEstelarId();
      const fixture = await provisionPlayableStudent();

      const startRes = await request(app)
        .post('/api/sesiones/iniciar')
        .set(authHeader(fixture.studentToken))
        .send({
          minijuego_id: codigoEstelarId,
          dificultad: 2,
        });

      expect(startRes.status).toBe(201);
      const sesionId = startRes.body.data.sesion.id;
      const sesionClaseId = startRes.body.data.sesion.sesion_clase_id;

      const errorRes = await request(app)
        .post(`/api/sesiones/${sesionId}/eventos`)
        .set(authHeader(fixture.studentToken))
        .send({
          tipo_evento: 'error',
          habilidad: 'Lógica',
          tiempo_reaccion_ms: 1500,
          puntos: 0,
          combo_en_evento: 0,
        });

      expect(errorRes.status).toBe(201);

      const finishRes = await request(app)
        .post(`/api/sesiones/${sesionId}/finalizar`)
        .set(authHeader(fixture.studentToken))
        .send({
          estado: 'completado',
          errores: 1,
        });

      expect(finishRes.status).toBe(200);
      expect(finishRes.body.data.progreso_ruta).toMatchObject({
        haySiguientePaso: false,
        participanteEstado: 'completado',
      });

      const participante = await obtenerParticipanteSesionClase(sesionClaseId, fixture.studentId);
      expect(participante.estado).toBe('completado');

      const sesionesJuego = await obtenerSesionesJuegoDelEstudiante(fixture.studentId);
      expect(sesionesJuego[0].estado).toBe('completado');
      expect(Number(sesionesJuego[0].errores)).toBe(1);
    },
    30_000
  );

  it(
    '✅ si el tutor cierra la clase mientras el estudiante juega, la sesion_juego queda abandonada y la clase se cierra',
    async () => {
      const codigoEstelarId = await resolveCodigoEstelarId();
      const fixture = await provisionPlayableStudent();

      const startRes = await request(app)
        .post('/api/sesiones/iniciar')
        .set(authHeader(fixture.studentToken))
        .send({
          minijuego_id: codigoEstelarId,
          dificultad: 2,
        });

      expect(startRes.status).toBe(201);
      const sesionClaseId = startRes.body.data.sesion.sesion_clase_id;

      const closeRes = await request(app)
        .patch(`/api/grupos/${fixture.groupId}/sesion`)
        .set(authHeader(fixture.tutorToken))
        .send({ sesion_activa: false });

      expect(closeRes.status).toBe(200);

      const participante = await obtenerParticipanteSesionClase(sesionClaseId, fixture.studentId);
      expect(participante.estado).toBe('abandonado');
      expect(participante.finalizada_en).not.toBeNull();

      const sesionesJuego = await obtenerSesionesJuegoDelEstudiante(fixture.studentId);
      expect(sesionesJuego[0].estado).toBe('abandonado');
      expect(sesionesJuego[0].finalizada_en).not.toBeNull();

      const sesionClase = await obtenerSesionClaseActivaOReciente(fixture.groupId);
      expect(sesionClase.estado).toBe('cerrada');
      expect(sesionClase.cierre_motivo).toBe('manual');
    },
    30_000
  );

  it(
    '✅ si el tutor cierra la clase y el estudiante nunca entro, no se crea sesion_juego y el participante queda cerrado',
    async () => {
      const fixture = await provisionPlayableStudent();
      const sesionClase = await obtenerSesionClaseActivaOReciente(fixture.groupId);

      expect(sesionClase).toBeTruthy();

      const closeRes = await request(app)
        .patch(`/api/grupos/${fixture.groupId}/sesion`)
        .set(authHeader(fixture.tutorToken))
        .send({ sesion_activa: false });

      expect(closeRes.status).toBe(200);

      const participante = await obtenerParticipanteSesionClase(sesionClase.id_sesion_clase, fixture.studentId);
      expect(participante.estado).toBe('cerrado');
      expect(participante.iniciada_en).toBeNull();
      expect(participante.finalizada_en).not.toBeNull();

      const sesionesJuego = await obtenerSesionesJuegoDelEstudiante(fixture.studentId);
      expect(sesionesJuego).toHaveLength(0);

      const sesionClaseCerrada = await obtenerSesionClaseActivaOReciente(fixture.groupId);
      expect(sesionClaseCerrada.estado).toBe('cerrada');
      expect(sesionClaseCerrada.cierre_motivo).toBe('manual');
    },
    30_000
  );

  it(
    '✅ el historial del tutor conserva sesiones hijas separadas pero las marca como una misma actividad single con niveles',
    async () => {
      const fixture = await provisionPlayableStudent({ openClass: false });
      const codigoEstelarId = await resolveCodigoEstelarId();

      const openClassRes = await request(app)
        .patch(`/api/grupos/${fixture.groupId}/sesion`)
        .set(authHeader(fixture.tutorToken))
        .send({
          sesion_activa: true,
          modo: 'single',
          minijuego_id: codigoEstelarId,
          niveles: 2,
        });

      expect(openClassRes.status).toBe(200);

      const firstStartRes = await request(app)
        .post('/api/sesiones/iniciar')
        .set(authHeader(fixture.studentToken))
        .send({
          minijuego_id: codigoEstelarId,
          dificultad: 2,
        });

      expect(firstStartRes.status).toBe(201);

      const firstSessionId = firstStartRes.body.data.sesion.id;

      const firstFinishRes = await request(app)
        .post(`/api/sesiones/${firstSessionId}/finalizar`)
        .set(authHeader(fixture.studentToken))
        .send({ estado: 'completado' });

      expect(firstFinishRes.status).toBe(200);
      expect(firstFinishRes.body.data.progreso_ruta).toMatchObject({
        haySiguientePaso: true,
        participanteEstado: 'pendiente',
      });

      const secondStartRes = await request(app)
        .post('/api/sesiones/iniciar')
        .set(authHeader(fixture.studentToken))
        .send({
          minijuego_id: codigoEstelarId,
          dificultad: 2,
        });

      expect(secondStartRes.status).toBe(201);

      const secondSessionId = secondStartRes.body.data.sesion.id;

      const secondFinishRes = await request(app)
        .post(`/api/sesiones/${secondSessionId}/finalizar`)
        .set(authHeader(fixture.studentToken))
        .send({ estado: 'completado' });

      expect(secondFinishRes.status).toBe(200);
      expect(secondFinishRes.body.data.progreso_ruta).toMatchObject({
        haySiguientePaso: false,
        participanteEstado: 'completado',
      });

      const historyRes = await request(app)
        .get(`/api/sesiones/estudiante/${fixture.studentId}`)
        .set(authHeader(fixture.tutorToken));

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.success).toBe(true);
      expect(historyRes.body.data).toHaveLength(2);

      const [latest, previous] = historyRes.body.data;

      expect(latest.sesion_clase_id).toBe(previous.sesion_clase_id);
      expect(latest.sesion_modo).toBe('single');
      expect(previous.sesion_modo).toBe('single');
      expect(Number(latest.sesion_total_pasos)).toBe(2);
      expect(Number(previous.sesion_total_pasos)).toBe(2);
      expect(Number(latest.nivel_en_bloque)).toBe(2);
      expect(Number(previous.nivel_en_bloque)).toBe(1);
      expect(Number(latest.orden_en_ruta)).toBe(2);
      expect(Number(previous.orden_en_ruta)).toBe(1);
      expect(latest.minijuego).toBe(previous.minijuego);
    },
    30_000
  );
});
