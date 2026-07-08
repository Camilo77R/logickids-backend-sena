BEGIN;

/**
 * Registra el minijuego oficial del MVP.
 *
 * POR QUÉ:
 * - el contrato de Codigo Estelar necesita un `minijuego_id` real
 * - no basta con actualizar el seed, porque las bases ya existentes no se
 *   vuelven a sembrar solas
 */
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.habilidades
    WHERE nombre = 'Lógica'
  ) THEN
    RAISE EXCEPTION 'No existe la habilidad Lógica. Ejecute primero el seed base.';
  END IF;
END $$;

INSERT INTO public.minijuegos (slug, titulo, descripcion, habilidad_id, dificultad_maxima, activo)
SELECT
  'codigo-estelar',
  'Código Estelar',
  'Clasifica meteoritos comparando números con un objetivo central en una sala competitiva en tiempo real.',
  id_habilidad,
  4,
  true
FROM public.habilidades
WHERE nombre = 'Lógica'
ON CONFLICT (slug) DO UPDATE
SET titulo = EXCLUDED.titulo,
    descripcion = EXCLUDED.descripcion,
    habilidad_id = EXCLUDED.habilidad_id,
    dificultad_maxima = EXCLUDED.dificultad_maxima,
    activo = EXCLUDED.activo;

COMMIT;
