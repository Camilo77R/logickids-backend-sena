BEGIN;

/**
 * Registra Camino AR como minijuego oficial del nuevo frente movil.
 *
 * POR QUE:
 * - el movil necesita un slug real en el catalogo para iniciar sesiones
 * - la base actual ya soporta minijuegos individuales por grupo
 * - no queremos esperar a la futura ruta multi-juego para empezar a trabajar
 */
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.habilidades
    WHERE nombre = 'Memoria'
  ) THEN
    RAISE EXCEPTION 'No existe la habilidad Memoria. Ejecute primero el seed base.';
  END IF;
END $$;

INSERT INTO public.minijuegos (slug, titulo, descripcion, habilidad_id, dificultad_maxima, activo)
SELECT
  'camino-ar',
  'Camino AR',
  'Memoriza un recorrido iluminado y repitelo tocando las baldosas en el mismo orden.',
  id_habilidad,
  4,
  true
FROM public.habilidades
WHERE nombre = 'Memoria'
ON CONFLICT (slug) DO UPDATE
SET titulo = EXCLUDED.titulo,
    descripcion = EXCLUDED.descripcion,
    habilidad_id = EXCLUDED.habilidad_id,
    dificultad_maxima = EXCLUDED.dificultad_maxima,
    activo = EXCLUDED.activo;

COMMIT;
