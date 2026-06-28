import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { db } from '../src/config/db.js';
import {
  authHeader,
  provisionPlayableStudent,
  resolveCodigoEstelarId,
} from './helpers/codigoEstelar.helper.js';

describe('cierre automatico de actividades', () => {
  it('cierra la actividad cuando termina el ultimo jugador conectado', async () => {
    const fixture = await provisionPlayableStudent({ openClass: false });
    const minijuegoId = await resolveCodigoEstelarId();

    const secondStudentRes = await request(app)
      .post('/api/estudiantes')
      .set(authHeader(fixture.adminToken))
      .send({
        nombre: 'Estudiante pendiente sin conexion',
        edad: 8,
        grupo_id: fixture.groupId,
        color_avatar: '#8E35D5',
      });

    expect(secondStudentRes.status).toBe(201);

    const openClassRes = await request(app)
      .patch(`/api/grupos/${fixture.groupId}/sesion`)
      .set(authHeader(fixture.tutorToken))
      .send({
        sesion_activa: true,
        modo: 'single',
        minijuego_id: minijuegoId,
      });

    expect(openClassRes.status).toBe(200);
    expect(openClassRes.body.data.sesion_total_pasos).toBe(1);

    const startRes = await request(app)
      .post('/api/sesiones/iniciar')
      .set(authHeader(fixture.studentToken))
      .send({});

    expect(startRes.status).toBe(201);

    const finalizeRes = await request(app)
      .post(`/api/sesiones/${startRes.body.data.sesion.id}/finalizar`)
      .set(authHeader(fixture.studentToken))
      .send({ estado: 'completado' });

    expect(finalizeRes.status).toBe(200);
    expect(finalizeRes.body.data.progreso_ruta).toMatchObject({
      haySiguientePaso: false,
      participanteEstado: 'completado',
    });
    expect(finalizeRes.body.data.sesion_clase_cerrada).toBe(true);

    const classSession = await db('sesiones_clase')
      .where({ id_sesion_clase: startRes.body.data.sesion.sesion_clase_id })
      .select('estado', 'cierre_motivo')
      .first();

    expect(classSession).toEqual({
      estado: 'cerrada',
      cierre_motivo: 'sin_jugadores_activos',
    });

    const pendingParticipant = await db('sesion_clase_participantes')
      .where({
        sesion_clase_id: startRes.body.data.sesion.sesion_clase_id,
        estudiante_id: secondStudentRes.body.data.id,
      })
      .select('estado')
      .first();

    expect(pendingParticipant.estado).toBe('cerrado');

    const replayRes = await request(app)
      .post('/api/sesiones/iniciar')
      .set(authHeader(fixture.studentToken))
      .send({});

    expect(replayRes.status).toBe(403);
  });

  it('cierra la actividad cuando el unico estudiante conectado sale', async () => {
    const fixture = await provisionPlayableStudent();

    const logoutRes = await request(app)
      .delete('/api/estudiantes/mi-sesion-dispositivo')
      .set(authHeader(fixture.studentToken));

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.data).toMatchObject({
      revoked: true,
      legacy: false,
    });

    const classSession = await db('sesiones_clase')
      .where({ grupo_id: fixture.groupId })
      .orderBy('id_sesion_clase', 'desc')
      .select('estado', 'cierre_motivo')
      .first();

    expect(classSession.estado).toBe('cerrada');
    expect(['finalizada', 'sin_jugadores_activos']).toContain(classSession.cierre_motivo);
  });
});
