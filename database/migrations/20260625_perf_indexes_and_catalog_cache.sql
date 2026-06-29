-- Performance indexes to complement the catalog cache and reduce query cost
-- on the hot-path endpoints (registrarEvento, listarHistorialEstudiante).
--
-- WHY:
-- Even with the in-memory catalog cache eliminating most catalog SELECTs,
-- the idempotency check on eventos_sesion(sesion_id, client_sequence) still
-- hits the DB on every event registration.  A composite index on those two
-- columns makes that lookup O(log n) instead of a sequential scan.
--
-- The catalog-table indexes on `nombre` are a safety net for the graceful
-- fallback path in catalog-cache.service.js (used before the cache warms up
-- or if it is ever bypassed).  The tables already have UNIQUE constraints on
-- `nombre`, which PostgreSQL backs with a unique index, so these are
-- effectively no-ops on a fresh schema — but they are included here as
-- explicit documentation of the access pattern and to ensure the index exists
-- on any database that was created before the UNIQUE constraint was added.

BEGIN;

-- Composite index for the idempotency check inside registrarEvento.
-- The existing ux_eventos_sesion_client_sequence partial unique index covers
-- the uniqueness guarantee; this non-partial index covers the plain lookup
-- path (WHERE sesion_id = ? AND client_sequence = ?) without the IS NOT NULL
-- filter, ensuring the planner can use it regardless of the query form.
CREATE INDEX IF NOT EXISTS idx_eventos_sesion_idempotency
    ON public.eventos_sesion(sesion_id, client_sequence);

-- Catalog lookup fallback indexes (nombre columns).
-- These are already covered by the UNIQUE constraints in the schema, but we
-- name them explicitly so monitoring tools can identify them.
CREATE INDEX IF NOT EXISTS idx_estados_sesion_nombre
    ON public.estados_sesion(nombre);

CREATE INDEX IF NOT EXISTS idx_tipos_evento_nombre
    ON public.tipos_evento(nombre);

CREATE INDEX IF NOT EXISTS idx_habilidades_nombre
    ON public.habilidades(nombre);

-- Composite index for the step-count aggregation query in
-- listarHistorialEstudiante.  The query groups by sesion_clase_id and counts
-- rows, so an index on that column alone is sufficient for the planner to
-- choose an index scan + aggregate instead of a sequential scan.
-- (idx_sesion_clase_pasos_sesion already covers this — included here for
-- clarity and as a no-op guard.)
CREATE INDEX IF NOT EXISTS idx_sesion_clase_pasos_clase_count
    ON public.sesion_clase_pasos(sesion_clase_id);

COMMIT;
