-- =============================================================
-- MIGRACIÓN: 20260518_institution_centric_model
-- Objetivo:
-- - mover grupos a un modelo institución-céntrico
-- - agregar admin principal institucional
-- - registrar historial real de asignación tutor <-> grupo
-- =============================================================

BEGIN;

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS es_admin_principal boolean NOT NULL DEFAULT false;

UPDATE public.usuarios
SET es_admin_principal = true
WHERE rol_id = (SELECT id_rol FROM public.roles WHERE nombre = 'admin');

ALTER TABLE public.grupos
  ADD COLUMN IF NOT EXISTS tutor_asignado_id integer;

ALTER TABLE public.grupos
  ADD COLUMN IF NOT EXISTS sesion_minijuego_id integer;

UPDATE public.grupos
SET tutor_asignado_id = usuario_id
WHERE tutor_asignado_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'grupos'
      AND constraint_name = 'grupos_usuario_id_nombre_key'
  ) THEN
    ALTER TABLE public.grupos
      DROP CONSTRAINT grupos_usuario_id_nombre_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'grupos'
      AND constraint_name = 'grupos_institucion_id_nombre_key'
  ) THEN
    ALTER TABLE public.grupos
      ADD CONSTRAINT grupos_institucion_id_nombre_key UNIQUE (institucion_id, nombre);
  END IF;
END $$;

ALTER TABLE public.grupos
  DROP CONSTRAINT IF EXISTS grupos_tutor_asignado_id_fkey;

ALTER TABLE public.grupos
  ADD CONSTRAINT grupos_tutor_asignado_id_fkey
  FOREIGN KEY (tutor_asignado_id)
  REFERENCES public.usuarios (id_usuario)
  ON DELETE SET NULL;

ALTER TABLE public.grupos
  DROP CONSTRAINT IF EXISTS grupos_sesion_minijuego_id_fkey;

ALTER TABLE public.grupos
  ADD CONSTRAINT grupos_sesion_minijuego_id_fkey
  FOREIGN KEY (sesion_minijuego_id)
  REFERENCES public.minijuegos (id_minijuego)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_grupos_tutor_asignado
  ON public.grupos(tutor_asignado_id);

CREATE TABLE IF NOT EXISTS public.grupo_tutor_historial
(
  id_grupo_tutor integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  grupo_id integer NOT NULL REFERENCES public.grupos(id_grupo) ON DELETE CASCADE,
  tutor_id integer NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
  asignado_por integer NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
  fecha_inicio timestamptz NOT NULL DEFAULT now(),
  fecha_fin timestamptz,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT grupo_tutor_historial_grupo_id_tutor_id_fecha_ini_key UNIQUE (grupo_id, tutor_id, fecha_inicio)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_grupo_un_tutor_activo
  ON public.grupo_tutor_historial(grupo_id)
  WHERE activo = true AND fecha_fin IS NULL;

CREATE INDEX IF NOT EXISTS idx_gth_tutor
  ON public.grupo_tutor_historial(tutor_id);

CREATE INDEX IF NOT EXISTS idx_gth_asignado_por
  ON public.grupo_tutor_historial(asignado_por);

INSERT INTO public.grupo_tutor_historial (grupo_id, tutor_id, asignado_por, fecha_inicio, activo)
SELECT
  g.id_grupo,
  g.tutor_asignado_id,
  COALESCE(
    (
      SELECT admin.id_usuario
      FROM public.usuarios admin
      JOIN public.roles rol ON rol.id_rol = admin.rol_id
      WHERE admin.institucion_id = g.institucion_id
        AND rol.nombre = 'admin'
        AND admin.es_admin_principal = true
      ORDER BY admin.id_usuario ASC
      LIMIT 1
    ),
    g.usuario_id
  ) AS asignado_por,
  COALESCE(g.creado_en, now()),
  true
FROM public.grupos g
WHERE g.tutor_asignado_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.grupo_tutor_historial gth
    WHERE gth.grupo_id = g.id_grupo
      AND gth.activo = true
      AND gth.fecha_fin IS NULL
  );

COMMIT;
