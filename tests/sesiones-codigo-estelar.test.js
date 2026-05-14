import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { db } from '../src/config/db.js';
import {
  authHeader,
  provisionPlayableStudent,
  resolveCodigoEstelarId,
} from './helpers/codigoEstelar.helper.js';

describe('🎮 Sesiones — Código Estelar MVP', () => {
  it('✅ inicia la sesión con contrato completo para Código Estelar', async () => {
    const codigoEstelarId = await resolveCodigoEstelarId();
    const fixture = await provisionPlayableStudent();

    const res = await request(app)
      .post('/api/sesiones/iniciar')
      .set(authHeader(fixture.studentToken))
      .send({
        minijuego_id: codigoEstelarId,
        dificultad: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sesion.id).toEqual(expect.any(Number));
    expect(res.body.data.sesion.estado).toBe('activo');
    expect(res.body.data.sesion.dificultad).toBe(2);
    expect(res.body.data.sesion.minijuego_id).toBe(codigoEstelarId);
    expect(res.body.data.sesion.minijuego_slug).toBe('codigo-estelar');
    expect(res.body.data.realtime.room_key).toBe(`room:grupo_${fixture.groupId}:codigo_estelar`);
    expect(res.body.data.realtime.socket_events.submit).toBe('codigo_estelar:submit_answer');
    expect(res.body.data.game_config.meta_puntaje).toBe(100);
    expect(res.body.data.game_config.permite_igual).toBe(true);
    expect(res.body.data.game_config.rango_numeros).toEqual({ min: 0, max: 50 });
    expect(res.body.data.game_config.numero_objetivo).toBeGreaterThanOrEqual(0);
    expect(res.body.data.game_config.numero_objetivo).toBeLessThanOrEqual(50);
  });

  it('❌ no permite iniciar si la institución fue desactivada aunque el estudiante conserve un token viejo', async () => {
    const codigoEstelarId = await resolveCodigoEstelarId();
    const fixture = await provisionPlayableStudent();

    const deactivateInstitutionRes = await request(app)
      .patch(`/api/admin/instituciones/${fixture.institutionId}/desactivar`)
      .set(authHeader(fixture.superToken));

    expect(deactivateInstitutionRes.status).toBe(200);

    const res = await request(app)
      .post('/api/sesiones/iniciar')
      .set(authHeader(fixture.studentToken))
      .send({ minijuego_id: codigoEstelarId });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('❌ no permite iniciar si el estudiante fue desactivado aunque conserve un token viejo', async () => {
    const codigoEstelarId = await resolveCodigoEstelarId();
    const fixture = await provisionPlayableStudent();

    const deactivateStudentRes = await request(app)
      .delete(`/api/estudiantes/${fixture.studentId}`)
      .set(authHeader(fixture.tutorToken));

    expect(deactivateStudentRes.status).toBe(204);

    const res = await request(app)
      .post('/api/sesiones/iniciar')
      .set(authHeader(fixture.studentToken))
      .send({ minijuego_id: codigoEstelarId });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('❌ no permite iniciar si el grupo fue archivado', async () => {
    const codigoEstelarId = await resolveCodigoEstelarId();
    const fixture = await provisionPlayableStudent();

    const archiveGroupRes = await request(app)
      .patch(`/api/grupos/${fixture.groupId}/archivar`)
      .set(authHeader(fixture.tutorToken));

    expect(archiveGroupRes.status).toBe(200);

    const res = await request(app)
      .post('/api/sesiones/iniciar')
      .set(authHeader(fixture.studentToken))
      .send({ minijuego_id: codigoEstelarId });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('❌ no permite iniciar si la clase aún no fue abierta por el tutor', async () => {
    const codigoEstelarId = await resolveCodigoEstelarId();
    const fixture = await provisionPlayableStudent({ openClass: false });

    const res = await request(app)
      .post('/api/sesiones/iniciar')
      .set(authHeader(fixture.studentToken))
      .send({ minijuego_id: codigoEstelarId });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Sesión no activa');
  });

  it('✅ finaliza con resumen oficial calculado desde eventos e ignora cifras infladas del cliente', async () => {
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

    const registrarAciertoUno = await request(app)
      .post(`/api/sesiones/${sesionId}/eventos`)
      .set(authHeader(fixture.studentToken))
      .send({
        tipo_evento: 'acierto',
        habilidad: 'Lógica',
        tiempo_reaccion_ms: 900,
        puntos: 10,
        combo_en_evento: 1,
      });

    expect(registrarAciertoUno.status).toBe(201);

    const registrarAciertoDos = await request(app)
      .post(`/api/sesiones/${sesionId}/eventos`)
      .set(authHeader(fixture.studentToken))
      .send({
        tipo_evento: 'acierto',
        habilidad: 'Lógica',
        tiempo_reaccion_ms: 1100,
        puntos: 15,
        combo_en_evento: 2,
      });

    expect(registrarAciertoDos.status).toBe(201);

    const registrarError = await request(app)
      .post(`/api/sesiones/${sesionId}/eventos`)
      .set(authHeader(fixture.studentToken))
      .send({
        tipo_evento: 'error',
        habilidad: 'Lógica',
        tiempo_reaccion_ms: 1500,
        puntos: 0,
        combo_en_evento: 0,
      });

    expect(registrarError.status).toBe(201);

    const finalizarRes = await request(app)
      .post(`/api/sesiones/${sesionId}/finalizar`)
      .set(authHeader(fixture.studentToken))
      .send({
        puntaje: 9999,
        aciertos: 999,
        errores: 0,
        combo_maximo: 999,
        dificultad: 4,
        estado: 'completado',
      });

    expect(finalizarRes.status).toBe(200);
    expect(finalizarRes.body.success).toBe(true);
    expect(finalizarRes.body.data.puntaje).toBe(25);
    expect(finalizarRes.body.data.aciertos).toBe(2);
    expect(finalizarRes.body.data.errores).toBe(1);
    expect(finalizarRes.body.data.combo_maximo).toBe(2);
    expect(finalizarRes.body.data.dificultad).toBe(2);
    expect(finalizarRes.body.data.resumen_oficial).toEqual({
      puntaje: 25,
      aciertos: 2,
      errores: 1,
      combo_maximo: 2,
    });

    const stats = await db('estadisticas_habilidad')
      .where({ estudiante_id: fixture.studentId })
      .select('total_intentos', 'aciertos', 'errores')
      .first();

    expect(stats).toMatchObject({
      total_intentos: 3,
      aciertos: 2,
      errores: 1,
    });
  });

  it('✅ permite reintentar finalizar sin duplicar el conteo histórico', async () => {
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

    const registrarAcierto = await request(app)
      .post(`/api/sesiones/${sesionId}/eventos`)
      .set(authHeader(fixture.studentToken))
      .send({
        tipo_evento: 'acierto',
        habilidad: 'Lógica',
        tiempo_reaccion_ms: 1000,
        puntos: 10,
        combo_en_evento: 1,
      });

    expect(registrarAcierto.status).toBe(201);

    const primerCierre = await request(app)
      .post(`/api/sesiones/${sesionId}/finalizar`)
      .set(authHeader(fixture.studentToken))
      .send({ estado: 'completado' });

    expect(primerCierre.status).toBe(200);

    const segundoCierre = await request(app)
      .post(`/api/sesiones/${sesionId}/finalizar`)
      .set(authHeader(fixture.studentToken))
      .send({ estado: 'completado' });

    expect(segundoCierre.status).toBe(200);
    expect(segundoCierre.body.success).toBe(true);
    expect(segundoCierre.body.data.finalizacion_idempotente).toBe(true);
    expect(segundoCierre.body.data.resumen_oficial).toEqual({
      puntaje: 10,
      aciertos: 1,
      errores: 0,
      combo_maximo: 1,
    });

    const stats = await db('estadisticas_habilidad')
      .where({ estudiante_id: fixture.studentId })
      .select('total_intentos', 'aciertos', 'errores')
      .first();

    expect(stats).toMatchObject({
      total_intentos: 1,
      aciertos: 1,
      errores: 0,
    });
  });
});
