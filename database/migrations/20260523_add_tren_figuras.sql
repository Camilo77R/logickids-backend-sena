BEGIN;

/**
 * Registra el minijuego Tren de Figuras en el catalogo.
 *
 * POR QUE:
 * - la app movil necesita un minijuego_id real para iniciar sesiones remotas
 * - no basta con modificar el seed, porque las bases existentes no se vuelven
 *   a sembrar automaticamente
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
  'tren-figuras',
  'Tren de Figuras',
  'Completa patrones de figuras y colores en los vagones de un tren virtual.',
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
