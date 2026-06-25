BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.habilidades WHERE nombre = 'Patrones') THEN
    RAISE EXCEPTION 'No existe la habilidad Patrones. Ejecute primero la migracion del catalogo pedagogico.';
  END IF;
END $$;

UPDATE public.minijuegos
SET habilidad_id = (
  SELECT id_habilidad
  FROM public.habilidades
  WHERE nombre = 'Patrones'
)
WHERE slug = 'tren-figuras'
  AND habilidad_id IS DISTINCT FROM (
    SELECT id_habilidad
    FROM public.habilidades
    WHERE nombre = 'Patrones'
  );

COMMIT;
