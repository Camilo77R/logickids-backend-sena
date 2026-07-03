-- Trazabilidad minima del motor hibrido de recomendaciones.
-- PostgreSQL sigue siendo la fuente oficial; el CSV es solo una exportacion.
BEGIN;

ALTER TABLE public.recomendaciones
  ADD COLUMN IF NOT EXISTS origen_generacion character varying(20) NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS version_reglas character varying(30),
  ADD COLUMN IF NOT EXISTS input_snapshot_json jsonb;

ALTER TABLE public.recomendaciones
  DROP CONSTRAINT IF EXISTS ck_recomendaciones_origen,
  DROP CONSTRAINT IF EXISTS ck_recomendaciones_destino;

ALTER TABLE public.recomendaciones
  ADD CONSTRAINT ck_recomendaciones_origen
    CHECK (origen_generacion IN ('legacy', 'plantilla', 'dataset', 'gemini', 'fallback')),
  ADD CONSTRAINT ck_recomendaciones_destino
    CHECK ((estudiante_id IS NULL) <> (grupo_id IS NULL)) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_recomendaciones_origen_fecha
  ON public.recomendaciones(origen_generacion, generado_en DESC);

COMMIT;
