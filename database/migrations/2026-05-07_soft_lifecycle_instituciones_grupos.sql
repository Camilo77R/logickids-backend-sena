BEGIN;

ALTER TABLE public.instituciones
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS desactivado_en timestamptz;

ALTER TABLE public.grupos
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archivado_en timestamptz;

-- Normaliza datos existentes antes de reforzar las reglas.
UPDATE public.instituciones
SET desactivado_en = CASE
  WHEN activo = false AND desactivado_en IS NULL THEN now()
  WHEN activo = true THEN NULL
  ELSE desactivado_en
END
WHERE (activo = false AND desactivado_en IS NULL)
   OR (activo = true AND desactivado_en IS NOT NULL);

UPDATE public.grupos
SET archivado_en = CASE
  WHEN activo = false AND archivado_en IS NULL THEN now()
  WHEN activo = true THEN NULL
  ELSE archivado_en
END
WHERE (activo = false AND archivado_en IS NULL)
   OR (activo = true AND archivado_en IS NOT NULL);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_instituciones_estado_consistente'
  ) THEN
    ALTER TABLE public.instituciones
      ADD CONSTRAINT ck_instituciones_estado_consistente
      CHECK (
        (activo = true AND desactivado_en IS NULL) OR
        (activo = false AND desactivado_en IS NOT NULL)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_grupos_estado_consistente'
  ) THEN
    ALTER TABLE public.grupos
      ADD CONSTRAINT ck_grupos_estado_consistente
      CHECK (
        (activo = true AND archivado_en IS NULL) OR
        (activo = false AND archivado_en IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_instituciones_activo
  ON public.instituciones (activo);

CREATE INDEX IF NOT EXISTS idx_grupos_activo
  ON public.grupos (activo);

COMMIT;
