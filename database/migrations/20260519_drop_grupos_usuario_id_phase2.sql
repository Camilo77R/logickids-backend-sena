-- =============================================================
-- MIGRACIÓN: 20260519_drop_grupos_usuario_id_phase2
-- Objetivo:
-- - eliminar el campo legacy grupos.usuario_id
-- - dejar creado_por_usuario_id como única referencia de creador
-- =============================================================

BEGIN;

ALTER TABLE public.grupos
  DROP CONSTRAINT IF EXISTS grupos_usuario_id_fkey;

DROP INDEX IF EXISTS idx_grupos_usuario;

ALTER TABLE public.grupos
  DROP COLUMN IF EXISTS usuario_id;

COMMIT;
