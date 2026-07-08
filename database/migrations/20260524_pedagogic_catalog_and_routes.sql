-- =============================================================
-- MIGRACIÓN: 20260524_pedagogic_catalog_and_routes
-- Objetivo:
-- - normalizar el catálogo oficial de minijuegos visible para el producto
-- - introducir rutas pedagógicas reutilizables para sesiones path
-- - permitir que una sesión single represente varios niveles del mismo juego
-- - enriquecer los pasos con bloque y nivel para progreso pedagógico
-- =============================================================

BEGIN;

INSERT INTO public.habilidades (nombre, descripcion)
VALUES ('Patrones', 'Capacidad de reconocer regularidades y completar secuencias visuales o lógicas.')
ON CONFLICT (nombre) DO NOTHING;

ALTER TABLE public.minijuegos
  ADD COLUMN IF NOT EXISTS visible_en_catalogo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS orden_catalogo integer NOT NULL DEFAULT 100;

ALTER TABLE public.minijuegos
  DROP CONSTRAINT IF EXISTS ck_minijuegos_orden_catalogo;

ALTER TABLE public.minijuegos
  ADD CONSTRAINT ck_minijuegos_orden_catalogo CHECK (orden_catalogo > 0);

CREATE INDEX IF NOT EXISTS idx_minijuegos_catalogo_visible
  ON public.minijuegos(visible_en_catalogo, orden_catalogo);

CREATE TABLE IF NOT EXISTS public.rutas_pedagogicas
(
  id_ruta_pedagogica integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug character varying(60) NOT NULL,
  nombre character varying(120) NOT NULL,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  visible_en_catalogo boolean NOT NULL DEFAULT true,
  orden_catalogo integer NOT NULL DEFAULT 100,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rutas_pedagogicas_slug_key UNIQUE (slug),
  CONSTRAINT ck_rutas_pedagogicas_orden_catalogo CHECK (orden_catalogo > 0)
);

CREATE TABLE IF NOT EXISTS public.ruta_pedagogica_bloques
(
  id_ruta_pedagogica_bloque integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ruta_pedagogica_id integer NOT NULL REFERENCES public.rutas_pedagogicas(id_ruta_pedagogica) ON DELETE CASCADE,
  orden integer NOT NULL,
  minijuego_id integer NOT NULL REFERENCES public.minijuegos(id_minijuego) ON DELETE NO ACTION,
  niveles integer NOT NULL DEFAULT 1,
  configuracion_base jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ck_ruta_pedagogica_bloques_orden CHECK (orden > 0),
  CONSTRAINT ck_ruta_pedagogica_bloques_niveles CHECK (niveles > 0),
  CONSTRAINT uq_ruta_pedagogica_bloques_orden UNIQUE (ruta_pedagogica_id, orden)
);

CREATE INDEX IF NOT EXISTS idx_rutas_pedagogicas_catalogo
  ON public.rutas_pedagogicas(visible_en_catalogo, orden_catalogo);

CREATE INDEX IF NOT EXISTS idx_ruta_pedagogica_bloques_ruta
  ON public.ruta_pedagogica_bloques(ruta_pedagogica_id);

CREATE INDEX IF NOT EXISTS idx_ruta_pedagogica_bloques_minijuego
  ON public.ruta_pedagogica_bloques(minijuego_id);

ALTER TABLE public.sesiones_clase
  ADD COLUMN IF NOT EXISTS ruta_pedagogica_id integer;

ALTER TABLE public.sesiones_clase
  DROP CONSTRAINT IF EXISTS sesiones_clase_ruta_pedagogica_id_fkey;

ALTER TABLE public.sesiones_clase
  ADD CONSTRAINT sesiones_clase_ruta_pedagogica_id_fkey
  FOREIGN KEY (ruta_pedagogica_id)
  REFERENCES public.rutas_pedagogicas(id_ruta_pedagogica)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sesiones_clase_ruta_pedagogica
  ON public.sesiones_clase(ruta_pedagogica_id);

ALTER TABLE public.sesion_clase_pasos
  ADD COLUMN IF NOT EXISTS bloque_orden integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nivel_en_bloque integer NOT NULL DEFAULT 1;

ALTER TABLE public.sesion_clase_pasos
  DROP CONSTRAINT IF EXISTS ck_sesion_clase_pasos_bloque_orden,
  DROP CONSTRAINT IF EXISTS ck_sesion_clase_pasos_nivel_en_bloque;

ALTER TABLE public.sesion_clase_pasos
  ADD CONSTRAINT ck_sesion_clase_pasos_bloque_orden CHECK (bloque_orden > 0),
  ADD CONSTRAINT ck_sesion_clase_pasos_nivel_en_bloque CHECK (nivel_en_bloque > 0);

CREATE INDEX IF NOT EXISTS idx_sesion_clase_pasos_bloque
  ON public.sesion_clase_pasos(sesion_clase_id, bloque_orden, nivel_en_bloque);

COMMIT;
