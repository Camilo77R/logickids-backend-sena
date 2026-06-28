import { describe, expect, it } from 'vitest';
import { selectLatestOpenedGroup } from '../logickids-frontend-sena/src/components/tutor/dashboard/tutorDashboard.selectors.js';

describe('grupo sostenido en el inicio del tutor', () => {
  it('prioriza la actividad activa que se abrio mas recientemente', () => {
    const selected = selectLatestOpenedGroup([
      { id: 1, sesion_activa: true, sesion_abierta_en: '2026-06-28T10:00:00Z' },
      { id: 2, sesion_activa: true, sesion_abierta_en: '2026-06-28T11:00:00Z' },
      { id: 3, sesion_activa: false, ultima_sesion_abierta_en: '2026-06-28T12:00:00Z' },
    ]);

    expect(selected.id).toBe(2);
  });

  it('conserva el ultimo grupo utilizado cuando ya no hay actividad activa', () => {
    const selected = selectLatestOpenedGroup([
      { id: 1, sesion_activa: false, ultima_sesion_abierta_en: '2026-06-28T10:00:00Z' },
      { id: 2, sesion_activa: false, ultima_sesion_abierta_en: '2026-06-28T12:00:00Z' },
    ]);

    expect(selected.id).toBe(2);
  });
});
