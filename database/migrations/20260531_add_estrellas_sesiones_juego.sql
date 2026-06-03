-- Persistencia oficial de estrellas por sesion de juego.
--
-- POR QUE:
-- las estrellas hacen parte del progreso pedagogico y del feedback visible al
-- estudiante. No deben calcularse solo en mobile, porque tutor, historial,
-- ranking y futuros minijuegos necesitan leer la misma verdad desde la DB.

ALTER TABLE public.sesiones_juego
  ADD COLUMN IF NOT EXISTS estrellas_obtenidas integer NOT NULL DEFAULT 0;

ALTER TABLE public.sesiones_juego
  DROP CONSTRAINT IF EXISTS ck_sesiones_juego_estrellas_obtenidas;

ALTER TABLE public.sesiones_juego
  ADD CONSTRAINT ck_sesiones_juego_estrellas_obtenidas
  CHECK (estrellas_obtenidas >= 0 AND estrellas_obtenidas <= 3);

COMMENT ON COLUMN public.sesiones_juego.estrellas_obtenidas IS
  'Estrellas oficiales obtenidas en la ronda/nivel. Rango cerrado 0..3.';
