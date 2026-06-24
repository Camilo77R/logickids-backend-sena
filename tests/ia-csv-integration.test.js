import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import app from '../src/app.js';
import {
  authHeader,
  provisionPlayableStudent,
  resolveCodigoEstelarId,
} from './helpers/codigoEstelar.helper.js';

const ROOT_DIR = path.resolve(process.cwd());
const CSV_PATH = path.join(ROOT_DIR, 'datos_estudiantes.csv');
const HISTORY_PATH = path.join(
  ROOT_DIR,
  'datasets',
  'recomendaciones_ia',
  'exports',
  'recommendation_history.csv'
);

const readFileIfExists = async (filePath) => {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
};

const writeFileEnsuringDir = async (filePath, content) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
};

const removeFileIfExists = async (filePath) => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
};

const registerEvents = async ({ studentToken, sessionId, events }) => {
  for (const event of events) {
    const res = await request(app)
      .post(`/api/sesiones/${sessionId}/eventos`)
      .set(authHeader(studentToken))
      .send(event);

    expect(res.status).toBe(201);
  }
};

describe('IA CSV e integraciones secundarias', () => {
  let originalCsv;
  let originalHistory;

  beforeEach(async () => {
    originalCsv = await readFileIfExists(CSV_PATH);
    originalHistory = await readFileIfExists(HISTORY_PATH);
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    if (originalCsv === null) {
      await removeFileIfExists(CSV_PATH);
    } else {
      await writeFileEnsuringDir(CSV_PATH, originalCsv);
    }

    if (originalHistory === null) {
      await removeFileIfExists(HISTORY_PATH);
    } else {
      await writeFileEnsuringDir(HISTORY_PATH, originalHistory);
    }
  });

  it('lee el catalogo CSV local y agrupa estudiantes por grupo para el tutor', async () => {
    const fixture = await provisionPlayableStudent({ openClass: false });

    await writeFileEnsuringDir(
      CSV_PATH,
      [
        'grupo_id,nombre_grupo,estudiante_id,nombre_estudiante',
        '10,Grupo Arcoiris,100,Ana',
        '10,Grupo Arcoiris,101,Luis',
        '11,Grupo Cometas,102,Sara',
      ].join('\n')
    );

    const res = await request(app)
      .get('/api/ia/recomendaciones/catalogo-csv')
      .set(authHeader(fixture.tutorToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.grupos).toHaveLength(2);
    expect(res.body.data.grupos[0]).toMatchObject({
      id: '10',
      nombre: 'Grupo Arcoiris',
    });
    expect(res.body.data.grupos[0].estudiantes).toHaveLength(2);
    expect(res.body.data.estudiantes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: '100',
          grupo_id: '10',
          nombre_grupo: 'Grupo Arcoiris',
        }),
        expect.objectContaining({
          id: '102',
          grupo_id: '11',
          nombre_grupo: 'Grupo Cometas',
        }),
      ])
    );
  });

  it('lista y borra historial CSV filtrado sin tocar registros ajenos', async () => {
    const fixture = await provisionPlayableStudent({ openClass: false });

    await writeFileEnsuringDir(
      HISTORY_PATH,
      [
        'recomendacion_id,estudiante_id,nombre_estudiante,grupo_id,nombre_grupo,habilidad_id,habilidad,precision_momento,severidad,modelo_ia,mensaje_objetivo,generado_en,activo',
        'csv_1,201,Ana,10,Grupo A,1,Logica,45,baja,,Mensaje uno,2025-01-01T10:00:00.000Z,true',
        'csv_2,202,Luis,10,Grupo A,1,Logica,60,media,,Mensaje dos,2025-01-02T10:00:00.000Z,true',
        'csv_3,301,Sara,11,Grupo B,2,Memoria,85,baja,,Mensaje tres,2025-01-03T10:00:00.000Z,true',
      ].join('\n')
    );

    const listRes = await request(app)
      .get('/api/ia/recomendaciones/historial-csv?grupoId=10')
      .set(authHeader(fixture.tutorToken));

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.total).toBe(2);
    expect(listRes.body.data[0].recomendacion_id).toBe('csv_2');
    expect(listRes.body.data[1].recomendacion_id).toBe('csv_1');

    const deleteWithoutFilterRes = await request(app)
      .delete('/api/ia/recomendaciones/historial-csv')
      .set(authHeader(fixture.tutorToken))
      .send({});

    expect(deleteWithoutFilterRes.status).toBe(400);
    expect(deleteWithoutFilterRes.body.success).toBe(false);

    const deleteOneRes = await request(app)
      .delete('/api/ia/recomendaciones/historial-csv')
      .set(authHeader(fixture.tutorToken))
      .send({ recommendationId: 'csv_2' });

    expect(deleteOneRes.status).toBe(200);
    expect(deleteOneRes.body.success).toBe(true);
    expect(deleteOneRes.body.deleted).toBe(1);

    const listAfterDeleteRes = await request(app)
      .get('/api/ia/recomendaciones/historial-csv')
      .set(authHeader(fixture.tutorToken));

    expect(listAfterDeleteRes.status).toBe(200);
    expect(listAfterDeleteRes.body.total).toBe(2);
    expect(listAfterDeleteRes.body.data.map((row) => row.recomendacion_id)).toEqual(
      expect.arrayContaining(['csv_1', 'csv_3'])
    );
    expect(listAfterDeleteRes.body.data.map((row) => row.recomendacion_id)).not.toContain('csv_2');
  });

  it('genera recomendaciones desde archivo local, usa el servicio IA mockeado y actualiza el historial CSV', async () => {
    const fixture = await provisionPlayableStudent({ openClass: false });

    await writeFileEnsuringDir(
      CSV_PATH,
      [
        'grupo_id,nombre_grupo,estudiante_id,nombre_estudiante,habilidad_id,habilidad,precision_porcentaje',
        '10,Grupo A,201,Ana,1,Logica,42',
        '10,Grupo A,202,Luis,1,Logica,65',
        '11,Grupo B,301,Sara,2,Memoria,88',
      ].join('\n')
    );

    vi.spyOn(axios, 'post').mockResolvedValue({
      data: {
        success: true,
        recomendaciones: [
          {
            estudiante_id: '201',
            nombre: 'Ana',
            habilidad_critica: 'Logica',
            precision_actual: '42',
            severidad: 'alta',
            modelo_usado: 'mock-model',
            recomendacion: 'Hallazgo principal: reforzar comparaciones basicas.',
            fecha_generacion: '2025-06-01T10:00:00.000Z',
          },
          {
            estudiante_id: '202',
            nombre: 'Luis',
            habilidad_critica: 'Logica',
            precision_actual: '65',
            severidad: 'media',
            modelo_usado: 'mock-model',
            recomendacion: 'Hallazgo principal: consolidar antes de subir dificultad.',
            fecha_generacion: '2025-06-01T10:05:00.000Z',
          },
        ],
      },
    });

    const generateRes = await request(app)
      .post('/api/ia/recomendaciones/generar-desde-archivo')
      .set(authHeader(fixture.tutorToken))
      .send({ grupoId: '10' });

    expect(generateRes.status).toBe(200);
    expect(generateRes.body.success).toBe(true);
    expect(generateRes.body.recomendaciones).toHaveLength(2);
    expect(generateRes.body.historial_actualizado).toBe(2);

    const historyRes = await request(app)
      .get('/api/ia/recomendaciones/historial-csv?grupoId=10')
      .set(authHeader(fixture.tutorToken));

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.total).toBe(2);
    expect(historyRes.body.data[0].grupo_id).toBe('10');
    expect(historyRes.body.data[0].mensaje_objetivo).toContain('Hallazgo principal');
  });

  it('exporta estadisticas reales hacia el servicio IA mockeado y devuelve su respuesta', async () => {
    const minijuegoId = await resolveCodigoEstelarId();
    const fixture = await provisionPlayableStudent({ openClass: false });

    const openClassRes = await request(app)
      .patch(`/api/grupos/${fixture.groupId}/sesion`)
      .set(authHeader(fixture.tutorToken))
      .send({
        sesion_activa: true,
        modo: 'single',
        minijuego_id: minijuegoId,
        niveles: 1,
      });

    expect(openClassRes.status).toBe(200);

    const startRes = await request(app)
      .post('/api/sesiones/iniciar')
      .set(authHeader(fixture.studentToken))
      .send({ minijuego_id: minijuegoId, dificultad: 2 });

    expect(startRes.status).toBe(201);

    await registerEvents({
      studentToken: fixture.studentToken,
      sessionId: startRes.body.data.sesion.id,
      events: [
        { tipo_evento: 'acierto', habilidad: 'Lógica', tiempo_reaccion_ms: 900, puntos: 10, combo_en_evento: 1 },
        { tipo_evento: 'error', habilidad: 'Lógica', tiempo_reaccion_ms: 1300, puntos: 0, combo_en_evento: 0 },
      ],
    });

    const finishRes = await request(app)
      .post(`/api/sesiones/${startRes.body.data.sesion.id}/finalizar`)
      .set(authHeader(fixture.studentToken))
      .send({ estado: 'completado' });

    expect(finishRes.status).toBe(200);

    vi.spyOn(axios, 'post').mockResolvedValue({
      data: {
        success: true,
        recomendaciones: [
          {
            estudiante_id: fixture.studentId,
            recomendacion: 'Hallazgo principal: revisar rendimiento oficial exportado.',
          },
        ],
      },
    });

    const exportRes = await request(app)
      .post('/api/ia/recomendaciones/generar')
      .set(authHeader(fixture.tutorToken))
      .send({});

    expect(exportRes.status).toBe(200);
    expect(exportRes.body.success).toBe(true);
    expect(exportRes.body.recomendaciones).toHaveLength(1);
    expect(exportRes.body.recomendaciones[0].recomendacion).toContain('Hallazgo principal');
  });
});
