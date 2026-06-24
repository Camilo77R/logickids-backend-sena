-- Endurecimiento de sesiones infantiles y escrituras reintentables.
--
-- POR QUE:
-- los clientes moviles pueden repetir requests por perdida de red. Las
-- invariantes viven en PostgreSQL para que sigan siendo ciertas con varias
-- instancias del backend y requests concurrentes.

BEGIN;

CREATE TABLE IF NOT EXISTS public.student_device_sessions
(
  id_student_device_session uuid PRIMARY KEY,
  estudiante_id integer NOT NULL
    REFERENCES public.estudiantes(id_estudiante) ON DELETE CASCADE,
  -- Digest SHA-256 del UUID local. Nunca se persiste el identificador original.
  installation_hash character(64) NOT NULL,
  app_version character varying(50),
  creada_en timestamptz NOT NULL DEFAULT now(),
  ultima_actividad_en timestamptz NOT NULL DEFAULT now(),
  expira_en timestamptz NOT NULL,
  revocada_en timestamptz,
  motivo_revocacion character varying(40),
  CONSTRAINT ck_student_device_session_expiration
    CHECK (expira_en > creada_en),
  CONSTRAINT ck_student_device_session_revocation
    CHECK (
      (revocada_en IS NULL AND motivo_revocacion IS NULL) OR
      (revocada_en IS NOT NULL AND motivo_revocacion IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_student_one_live_device_session
  ON public.student_device_sessions(estudiante_id)
  WHERE revocada_en IS NULL;

CREATE INDEX IF NOT EXISTS idx_student_device_session_expiration
  ON public.student_device_sessions(expira_en)
  WHERE revocada_en IS NULL;

CREATE TABLE IF NOT EXISTS public.student_device_session_audit
(
  id_student_device_session_audit bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  estudiante_id integer NOT NULL
    REFERENCES public.estudiantes(id_estudiante) ON DELETE CASCADE,
  institucion_id integer
    REFERENCES public.instituciones(id_institucion) ON DELETE SET NULL,
  actor_usuario_id integer
    REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
  accion character varying(40) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  creada_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_student_device_session_audit_action
    CHECK (accion IN ('tutor_recovery'))
);

CREATE INDEX IF NOT EXISTS idx_student_device_session_audit_student
  ON public.student_device_session_audit(estudiante_id, creada_en DESC);

CREATE TABLE IF NOT EXISTS public.student_login_rate_limits
(
  key_hash character(64) PRIMARY KEY,
  intentos integer NOT NULL DEFAULT 0,
  ventana_iniciada_en timestamptz NOT NULL DEFAULT now(),
  bloqueada_hasta timestamptz,
  ultimo_intento_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_student_login_rate_limit_attempts CHECK (intentos >= 0)
);

CREATE INDEX IF NOT EXISTS idx_student_login_rate_limit_cleanup
  ON public.student_login_rate_limits(ultimo_intento_en);

CREATE TABLE IF NOT EXISTS public.student_idempotency_keys
(
  id_student_idempotency_key bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  estudiante_id integer NOT NULL
    REFERENCES public.estudiantes(id_estudiante) ON DELETE CASCADE,
  operacion character varying(20) NOT NULL,
  idempotency_key character varying(128) NOT NULL,
  request_hash character(64) NOT NULL,
  response_json jsonb,
  creada_en timestamptz NOT NULL DEFAULT now(),
  completada_en timestamptz,
  CONSTRAINT ck_student_idempotency_operation
    CHECK (operacion IN ('attempt', 'event', 'finalization')),
  CONSTRAINT uq_student_idempotency_key
    UNIQUE (estudiante_id, operacion, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_student_idempotency_cleanup
  ON public.student_idempotency_keys(creada_en);

CREATE TABLE IF NOT EXISTS public.student_game_checkpoints
(
  sesion_id integer PRIMARY KEY
    REFERENCES public.sesiones_juego(id_sesion_juego) ON DELETE CASCADE,
  estudiante_id integer NOT NULL
    REFERENCES public.estudiantes(id_estudiante) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 0,
  estado jsonb NOT NULL DEFAULT '{}'::jsonb,
  actualizada_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_student_game_checkpoint_version CHECK (version >= 0)
);

CREATE INDEX IF NOT EXISTS idx_student_game_checkpoint_owner
  ON public.student_game_checkpoints(estudiante_id);

ALTER TABLE public.sesiones_juego
  ADD COLUMN IF NOT EXISTS recuperada_en timestamptz,
  ADD COLUMN IF NOT EXISTS recuperada_por_usuario_id integer;

ALTER TABLE public.sesiones_juego
  DROP CONSTRAINT IF EXISTS sesiones_juego_recuperada_por_usuario_id_fkey;

ALTER TABLE public.sesiones_juego
  ADD CONSTRAINT sesiones_juego_recuperada_por_usuario_id_fkey
  FOREIGN KEY (recuperada_por_usuario_id)
  REFERENCES public.usuarios(id_usuario)
  ON DELETE SET NULL;

ALTER TABLE public.eventos_sesion
  ADD COLUMN IF NOT EXISTS client_sequence integer;

ALTER TABLE public.eventos_sesion
  DROP CONSTRAINT IF EXISTS ck_eventos_sesion_client_sequence;

ALTER TABLE public.eventos_sesion
  ADD CONSTRAINT ck_eventos_sesion_client_sequence
  CHECK (client_sequence IS NULL OR client_sequence > 0);

CREATE UNIQUE INDEX IF NOT EXISTS ux_eventos_sesion_client_sequence
  ON public.eventos_sesion(sesion_id, client_sequence)
  WHERE client_sequence IS NOT NULL;

COMMIT;
