import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { authHeader, provisionPlayableStudent } from './helpers/codigoEstelar.helper.js';

describe('📱 Dashboard del estudiante', () => {
  it('✅ devuelve el perfil infantil con datos utiles para el dashboard', async () => {
    const fixture = await provisionPlayableStudent();

    const res = await request(app)
      .get('/api/estudiantes/mi-perfil')
      .set(authHeader(fixture.studentToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.grupo_id).toBe(fixture.groupId);
    expect(res.body.data.grupo_activo).toBe(true);
    expect(res.body.data.grupo_nombre).toContain('Grupo');
    expect(res.body.data.color_avatar).toBeTruthy();
  });

  it('✅ sigue permitiendo cargar el dashboard aunque archivar el grupo deje al estudiante sin grupo activo', async () => {
    const fixture = await provisionPlayableStudent();

    const archiveGroupRes = await request(app)
      .patch(`/api/grupos/${fixture.groupId}/archivar`)
      .set(authHeader(fixture.tutorToken));

    expect(archiveGroupRes.status).toBe(200);

    const res = await request(app)
      .get('/api/estudiantes/mi-perfil')
      .set(authHeader(fixture.studentToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.grupo_id).toBeNull();
    expect(res.body.data.grupo_activo).toBeNull();
    expect(res.body.data.sesion_activa).toBe(false);
  });
});
