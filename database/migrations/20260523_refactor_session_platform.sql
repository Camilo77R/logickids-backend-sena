-- =============================================================
-- MIGRACIÓN: 20260523_refactor_session_platform
-- Objetivo:
-- - introducir una sesión de clase explícita como entidad padre
-- - soportar single y path sin una tabla por minijuego
-- - persistir configuración aplicada y metadata de eventos
-- - eliminar flags legacy de sesión en estudiantes y grupos
-- =============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.sesiones_clase
(
  id_sesion_clase integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  grupo_id integer NOT NULL REFERENCES public.grupos(id_grupo) ON DELETE CASCADE,
  tutor_responsable_id integer NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE NO ACTION,
  abierta_por_usuario_id integer NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE NO ACTION,
  modo character varying(20) NOT NULL,
  estado character varying(20) NOT NULL DEFAULT 'activa',
  abierta_en timestamptz NOT NULL DEFAULT now(),
  cerrada_en timestamptz,
  cierre_motivo character varying(30),
  actualizada_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_sesiones_clase_modo CHECK (modo IN ('single', 'path')),
  CONSTRAINT ck_sesiones_clase_estado CHECK (estado IN ('activa', 'cerrada', 'cancelada')),
  CONSTRAINT ck_sesiones_clase_consistente CHECK (
    (estado = 'activa' AND cerrada_en IS NULL AND cierre_motivo IS NULL) OR
    (estado IN ('cerrada', 'cancelada') AND cerrada_en IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_grupo_una_sesion_clase_activa
  ON public.sesiones_clase(grupo_id)
  WHERE estado = 'activa';

CREATE INDEX IF NOT EXISTS idx_sesiones_clase_tutor
  ON public.sesiones_clase(tutor_responsable_id);

CREATE INDEX IF NOT EXISTS idx_sesiones_clase_abierta_por
  ON public.sesiones_clase(abierta_por_usuario_id);

CREATE TABLE IF NOT EXISTS public.sesion_clase_pasos
(
  id_sesion_clase_paso integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sesion_clase_id integer NOT NULL REFERENCES public.sesiones_clase(id_sesion_clase) ON DELETE CASCADE,
  orden integer NOT NULL,
  minijuego_id integer NOT NULL REFERENCES public.minijuegos(id_minijuego) ON DELETE NO ACTION,
  configuracion_base jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ck_sesion_clase_pasos_orden CHECK (orden > 0),
  CONSTRAINT uq_sesion_clase_pasos_orden UNIQUE (sesion_clase_id, orden)
);

CREATE INDEX IF NOT EXISTS idx_sesion_clase_pasos_minijuego
  ON public.sesion_clase_pasos(minijuego_id);

CREATE INDEX IF NOT EXISTS idx_sesion_clase_pasos_sesion
  ON public.sesion_clase_pasos(sesion_clase_id);

CREATE TABLE IF NOT EXISTS public.sesion_clase_participantes
(
  id_sesion_clase_participante integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sesion_clase_id integer NOT NULL REFERENCES public.sesiones_clase(id_sesion_clase) ON DELETE CASCADE,
  estudiante_id integer NOT NULL REFERENCES public.estudiantes(id_estudiante) ON DELETE CASCADE,
  estado character varying(20) NOT NULL DEFAULT 'pendiente',
  paso_actual integer NOT NULL DEFAULT 1,
  iniciada_en timestamptz,
  finalizada_en timestamptz,
  CONSTRAINT ck_sesion_clase_participantes_estado CHECK (
    estado IN ('pendiente', 'en_progreso', 'completado', 'abandonado', 'cerrado')
  ),
  CONSTRAINT ck_sesion_clase_participantes_paso CHECK (paso_actual > 0),
  CONSTRAINT uq_sesion_clase_participante UNIQUE (sesion_clase_id, estudiante_id)
);

CREATE INDEX IF NOT EXISTS idx_sesion_clase_participantes_estudiante
  ON public.sesion_clase_participantes(estudiante_id);

CREATE INDEX IF NOT EXISTS idx_sesion_clase_participantes_sesion
  ON public.sesion_clase_participantes(sesion_clase_id);

ALTER TABLE public.sesiones_juego
  ADD COLUMN IF NOT EXISTS sesion_clase_id integer,
  ADD COLUMN IF NOT EXISTS orden_en_ruta integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS configuracion_aplicada jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fuente_adaptacion character varying(20) NOT NULL DEFAULT 'base',
  ADD COLUMN IF NOT EXISTS modelo_ia_id integer;

ALTER TABLE public.sesiones_juego
  DROP CONSTRAINT IF EXISTS ck_sesiones_juego_orden_en_ruta,
  DROP CONSTRAINT IF EXISTS ck_sesiones_juego_fuente_adaptacion,
  DROP CONSTRAINT IF EXISTS sesiones_juego_sesion_clase_id_fkey,
  DROP CONSTRAINT IF EXISTS sesiones_juego_modelo_ia_id_fkey,
  DROP CONSTRAINT IF EXISTS sesiones_juego_participante_fkey,
  DROP CONSTRAINT IF EXISTS sesiones_juego_paso_fkey,
  ADD CONSTRAINT ck_sesiones_juego_orden_en_ruta CHECK (orden_en_ruta > 0);

ALTER TABLE public.sesiones_juego
  ADD CONSTRAINT ck_sesiones_juego_fuente_adaptacion CHECK (
    fuente_adaptacion IN ('base', 'reglas', 'ia')
  );

ALTER TABLE public.sesiones_juego
  ADD CONSTRAINT sesiones_juego_sesion_clase_id_fkey
  FOREIGN KEY (sesion_clase_id)
  REFERENCES public.sesiones_clase(id_sesion_clase)
  ON DELETE NO ACTION;

ALTER TABLE public.sesiones_juego
  ADD CONSTRAINT sesiones_juego_modelo_ia_id_fkey
  FOREIGN KEY (modelo_ia_id)
  REFERENCES public.modelos_ia(id_modelo_ia)
  ON DELETE SET NULL;

ALTER TABLE public.sesiones_juego
  ADD CONSTRAINT sesiones_juego_participante_fkey
  FOREIGN KEY (sesion_clase_id, estudiante_id)
  REFERENCES public.sesion_clase_participantes(sesion_clase_id, estudiante_id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.sesiones_juego
  ADD CONSTRAINT sesiones_juego_paso_fkey
  FOREIGN KEY (sesion_clase_id, orden_en_ruta)
  REFERENCES public.sesion_clase_pasos(sesion_clase_id, orden)
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS idx_sesiones_juego_sesion_clase
  ON public.sesiones_juego(sesion_clase_id);

CREATE INDEX IF NOT EXISTS idx_sesiones_juego_modelo_ia
  ON public.sesiones_juego(modelo_ia_id);

ALTER TABLE public.eventos_sesion
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.grupos
  DROP CONSTRAINT IF EXISTS grupos_sesion_minijuego_id_fkey;

DROP INDEX IF EXISTS idx_grupos_sesion_minijuego;

ALTER TABLE public.grupos
  DROP COLUMN IF EXISTS sesion_minijuego_id;

ALTER TABLE public.estudiantes
  DROP COLUMN IF EXISTS sesion_activa;

COMMIT;
