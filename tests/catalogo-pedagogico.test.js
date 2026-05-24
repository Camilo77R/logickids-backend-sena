import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import {
  authHeader,
  provisionPlayableStudent,
} from './helpers/codigoEstelar.helper.js';

describe('🧭 Catálogo pedagógico oficial', () => {
  it('✅ expone solo los minijuegos visibles del producto en el orden pedagógico definido', async () => {
    const res = await request(app).get('/api/minijuegos');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const slugs = res.body.data.map((game) => game.slug);
    expect(slugs).toEqual([
      'camino-ar',
      'tren-figuras',
      'robot-logico',
      'mercado-inteligente',
      'objeto-perdido',
    ]);

    expect(slugs).not.toContain('codigo-estelar');
    expect(slugs).not.toContain('logica-secuencias');
  });

  it('✅ permite que el tutor consulte la ruta pedagógica oficial con sus bloques y niveles', async () => {
    const fixture = await provisionPlayableStudent({ openClass: false });

    const res = await request(app)
      .get('/api/rutas-pedagogicas')
      .set(authHeader(fixture.tutorToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const officialRoute = res.body.data.find(
      (route) => route.slug === 'ruta-completa-habilidades'
    );

    expect(officialRoute).toBeDefined();
    expect(officialRoute.total_bloques).toBe(5);
    expect(officialRoute.total_pasos).toBe(5);
    expect(officialRoute.bloques.map((block) => block.minijuego_slug)).toEqual([
      'camino-ar',
      'tren-figuras',
      'robot-logico',
      'mercado-inteligente',
      'objeto-perdido',
    ]);
    expect(officialRoute.bloques.every((block) => block.niveles === 1)).toBe(true);
  });
});
