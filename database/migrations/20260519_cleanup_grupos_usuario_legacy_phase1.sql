-- =============================================================
-- MIGRACIÓN: 20260519_cleanup_grupos_usuario_legacy_phase1
-- Objetivo:
-- - introducir creado_por_usuario_id como nombre honesto
-- - dejar usuario_id solo como legacy pasivo
-- - evitar cascadas peligrosas desde la FK legacy
-- =============================================================

BEGIN;

ALTER TABLE public.grupos
  ADD COLUMN IF NOT EXISTS creado_por_usuario_id integer;

UPDATE public.grupos
SET creado_por_usuario_id = usuario_id
WHERE creado_por_usuario_id IS NULL;

ALTER TABLE public.grupos
  ALTER COLUMN creado_por_usuario_id SET NOT NULL;

ALTER TABLE public.grupos
  ALTER COLUMN usuario_id DROP NOT NULL;

ALTER TABLE public.grupos
  DROP CONSTRAINT IF EXISTS grupos_usuario_id_fkey;

ALTER TABLE public.grupos
  ADD CONSTRAINT grupos_usuario_id_fkey
  FOREIGN KEY (usuario_id)
  REFERENCES public.usuarios (id_usuario)
  ON DELETE SET NULL;

ALTER TABLE public.grupos
  DROP CONSTRAINT IF EXISTS grupos_creado_por_usuario_id_fkey;

ALTER TABLE public.grupos
  ADD CONSTRAINT grupos_creado_por_usuario_id_fkey
  FOREIGN KEY (creado_por_usuario_id)
  REFERENCES public.usuarios (id_usuario)
  ON DELETE NO ACTION;

CREATE INDEX IF NOT EXISTS idx_grupos_creado_por_usuario
  ON public.grupos(creado_por_usuario_id);

COMMIT;
