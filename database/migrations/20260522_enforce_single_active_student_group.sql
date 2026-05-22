-- =============================================================
-- MIGRACIÓN: 20260522_enforce_single_active_student_group
-- Objetivo:
-- - cerrar afiliaciones activas sobrantes en estudiante_grupo_historial
-- - blindar la regla: un estudiante solo puede tener un grupo activo a la vez
-- =============================================================

BEGIN;

WITH ranked AS (
  SELECT
    id_est_grupo,
    estudiante_id,
    ROW_NUMBER() OVER (
      PARTITION BY estudiante_id
      ORDER BY fecha_inicio DESC, id_est_grupo DESC
    ) AS rn
  FROM public.estudiante_grupo_historial
  WHERE activo = true
    AND fecha_fin IS NULL
)
UPDATE public.estudiante_grupo_historial egh
SET
  activo = false,
  fecha_fin = CURRENT_DATE
FROM ranked r
WHERE egh.id_est_grupo = r.id_est_grupo
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_estudiante_un_solo_grupo_activo
  ON public.estudiante_grupo_historial(estudiante_id)
  WHERE activo = true AND fecha_fin IS NULL;

COMMIT;
