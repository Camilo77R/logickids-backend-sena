-- Logros globales por estudiante.
-- Reutiliza catalogo_logros/logros existentes y agrega la metadata que necesita mobile.

ALTER TABLE public.catalogo_logros
  ADD COLUMN IF NOT EXISTS tipo character varying(20) NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS modulo character varying(20),
  ADD COLUMN IF NOT EXISTS icon_key character varying(80),
  ADD COLUMN IF NOT EXISTS puntos integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS condicion_desbloqueo jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS orden integer NOT NULL DEFAULT 100;

ALTER TABLE public.catalogo_logros
  DROP CONSTRAINT IF EXISTS ck_catalogo_logros_tipo;

ALTER TABLE public.catalogo_logros
  ADD CONSTRAINT ck_catalogo_logros_tipo
  CHECK (tipo IN ('module', 'global', 'special'));

ALTER TABLE public.catalogo_logros
  DROP CONSTRAINT IF EXISTS ck_catalogo_logros_modulo;

ALTER TABLE public.catalogo_logros
  ADD CONSTRAINT ck_catalogo_logros_modulo
  CHECK (modulo IS NULL OR modulo IN ('memoria', 'patrones', 'logica', 'razonar', 'atencion'));

ALTER TABLE public.logros
  ADD COLUMN IF NOT EXISTS sesion_id integer,
  ADD COLUMN IF NOT EXISTS puntos_otorgados integer NOT NULL DEFAULT 0;

ALTER TABLE public.logros
  DROP CONSTRAINT IF EXISTS logros_sesion_id_fkey;

ALTER TABLE public.logros
  ADD CONSTRAINT logros_sesion_id_fkey FOREIGN KEY (sesion_id)
  REFERENCES public.sesiones_juego (id_sesion_juego) MATCH SIMPLE
  ON UPDATE NO ACTION
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_logros_sesion
  ON public.logros(sesion_id);

INSERT INTO public.catalogo_logros
  (clave, nombre, descripcion, icono, tipo, modulo, icon_key, puntos, condicion_desbloqueo, orden, activo)
VALUES
  ('logro_memoria', 'Maestro de la memoria', 'Completaste una actividad de memoria con buena precision.', 'memoria_main', 'module', 'memoria', 'memoria_main', 1, '{"accuracy_gte":70}'::jsonb, 10, true),
  ('logro_patrones', 'Constructor de patrones', 'Reconociste y completaste patrones correctamente.', 'patrones_main', 'module', 'patrones', 'patrones_main', 1, '{"accuracy_gte":70}'::jsonb, 20, true),
  ('logro_logica', 'Pensador logico', 'Resolviste un reto de logica con buen resultado.', 'logica_main', 'module', 'logica', 'logica_main', 1, '{"accuracy_gte":70}'::jsonb, 30, true),
  ('logro_razonar', 'Razonador experto', 'Tomaste buenas decisiones para resolver el reto.', 'razonar_main', 'module', 'razonar', 'razonar_main', 1, '{"accuracy_gte":70}'::jsonb, 40, true),
  ('logro_atencion', 'Ojo atento', 'Demostraste concentracion durante la actividad.', 'atencion_main', 'module', 'atencion', 'atencion_main', 1, '{"accuracy_gte":70}'::jsonb, 50, true),
  ('primer_logro', 'Primer logro', 'Desbloqueaste tu primer logro.', 'general_star', 'global', NULL, 'general_star', 1, '{}'::jsonb, 60, true),
  ('precision_perfecta', 'Precision perfecta', 'Lograste 100% de precision en una sesion.', 'precision_main', 'global', NULL, 'precision_main', 2, '{"accuracy_eq":100}'::jsonb, 70, true),
  ('explorador', 'Explorador de aventuras', 'Jugaste al menos una vez los 5 modulos.', 'explorador_main', 'global', NULL, 'explorador_main', 3, '{"modules_played":5}'::jsonb, 80, true),
  ('multitalento', 'Multitalento', 'Desbloqueaste los 5 logros principales.', 'multitalento_main', 'global', NULL, 'multitalento_main', 5, '{"main_achievements":5}'::jsonb, 90, true)
ON CONFLICT (clave) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  icono = EXCLUDED.icono,
  tipo = EXCLUDED.tipo,
  modulo = EXCLUDED.modulo,
  icon_key = EXCLUDED.icon_key,
  puntos = EXCLUDED.puntos,
  condicion_desbloqueo = EXCLUDED.condicion_desbloqueo,
  orden = EXCLUDED.orden,
  activo = EXCLUDED.activo;

UPDATE public.catalogo_logros
SET activo = false, orden = 900
WHERE clave IN ('primer_intento', 'combo_5', 'precision_90', 'maratonista');
