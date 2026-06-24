-- Compatibilidad para entornos que ejecutaron la primera version del hardening.
-- Las sesiones previas se revocan porque no podemos reconstruir el SHA-256 del
-- UUID original sin volver a recibirlo desde la instalacion autorizada.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'student_device_sessions'
      AND column_name = 'installation_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'student_device_sessions'
      AND column_name = 'installation_hash'
  ) THEN
    ALTER TABLE public.student_device_sessions
      ADD COLUMN installation_hash character(64);

    UPDATE public.student_device_sessions
    SET
      revocada_en = COALESCE(revocada_en, now()),
      motivo_revocacion = COALESCE(motivo_revocacion, 'security_upgrade'),
      installation_hash =
        md5(id_student_device_session::text || installation_id) ||
        md5(installation_id || id_student_device_session::text);

    ALTER TABLE public.student_device_sessions
      ALTER COLUMN installation_hash SET NOT NULL;

    DROP INDEX IF EXISTS public.idx_student_device_session_installation;
    DROP INDEX IF EXISTS public.ux_student_one_live_installation;

    ALTER TABLE public.student_device_sessions
      DROP COLUMN installation_id;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_student_one_live_installation
  ON public.student_device_sessions(installation_hash)
  WHERE revocada_en IS NULL;

CREATE INDEX IF NOT EXISTS idx_student_device_session_installation
  ON public.student_device_sessions(estudiante_id, installation_hash);

COMMIT;
