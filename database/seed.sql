-- =============================================================
-- SEED: LogicKids — Datos catálogo base
-- Ejecutar DESPUÉS de crear el schema (DDL).
-- Idempotente: usa INSERT ... ON CONFLICT DO NOTHING
-- =============================================================

BEGIN;

-- 1. ROLES
INSERT INTO public.roles (nombre, descripcion) VALUES
  ('superadmin', 'Administrador global de la plataforma. Gestiona instituciones y minijuegos.'),
  ('admin',      'Administrador de una institución. Gestiona tutores de su institución.'),
  ('tutor',      'Docente que gestiona grupos y estudiantes.')
ON CONFLICT (nombre) DO NOTHING;

-- 2. ESTADOS DE USUARIO
INSERT INTO public.estados_usuario (nombre) VALUES
  ('activo'),
  ('inactivo'),
  ('suspendido')
ON CONFLICT (nombre) DO NOTHING;

-- 3. ESTADOS DE ESTUDIANTE
INSERT INTO public.estados_estudiante (nombre) VALUES
  ('activo'),
  ('inactivo')
ON CONFLICT (nombre) DO NOTHING;

-- 4. ESTADOS DE SESIÓN DE JUEGO
INSERT INTO public.estados_sesion (nombre) VALUES
  ('activo'),
  ('completado'),
  ('abandonado')
ON CONFLICT (nombre) DO NOTHING;

-- 5. TIPOS DE EVENTO (para eventos_sesion)
INSERT INTO public.tipos_evento (nombre) VALUES
  ('acierto'),
  ('error'),
  ('combo'),
  ('nivel_completado')
ON CONFLICT (nombre) DO NOTHING;

-- 6. NIVELES DE SEVERIDAD (para recomendaciones IA)
INSERT INTO public.niveles_severidad (nombre) VALUES
  ('baja'),
  ('media'),
  ('alta')
ON CONFLICT (nombre) DO NOTHING;

-- 7. HABILIDADES COGNITIVAS
INSERT INTO public.habilidades (nombre, descripcion) VALUES
  ('Lógica',         'Capacidad de razonamiento lógico y resolución de problemas estructurados.'),
  ('Memoria',        'Capacidad de retención y recuperación de información a corto y largo plazo.'),
  ('Atención',       'Capacidad de mantener el foco en una tarea durante un periodo de tiempo.'),
  ('Razonamiento',   'Capacidad de inferir conclusiones a partir de información dada.'),
  ('Velocidad',      'Rapidez de procesamiento cognitivo ante estímulos o problemas.')
ON CONFLICT (nombre) DO NOTHING;

-- 8. MODELOS DE IA
INSERT INTO public.modelos_ia (nombre, proveedor, activo) VALUES
  ('gemini-1.5-flash', 'Google', true),
  ('gemini-1.5-pro',   'Google', false)
ON CONFLICT (nombre) DO NOTHING;

-- 9. CATÁLOGO DE LOGROS
INSERT INTO public.catalogo_logros (clave, nombre, descripcion, icono, activo) VALUES
  ('primer_intento',  'Primer Paso',         'Completaste tu primera partida.',                        '🎯', true),
  ('combo_5',         'Combo x5',            'Alcanzaste un combo de 5 aciertos seguidos en una partida.', '🔥', true),
  ('precision_90',    'Precisión Élite',     'Lograste una precisión de 90% o más en una partida.',    '⭐', true),
  ('maratonista',     'Maratonista',         'Completaste 10 partidas en la plataforma.',               '🏅', true)
ON CONFLICT (clave) DO NOTHING;

-- 10. MINIJUEGO DE EJEMPLO
-- Requiere que la habilidad 'Lógica' ya exista (insertada arriba).
INSERT INTO public.minijuegos (slug, titulo, descripcion, habilidad_id, dificultad_maxima, activo)
SELECT
  'logica-secuencias',
  'Secuencias Lógicas',
  'Completa la secuencia de figuras eligiendo el elemento que falta.',
  id_habilidad,
  4,
  true
FROM public.habilidades WHERE nombre = 'Lógica'
ON CONFLICT (slug) DO NOTHING;

-- 11. SUPERADMIN INICIAL
-- Contraseña: SuperAdmin2025! (cambiar en producción)
-- Hash generado con bcrypt, costo 10.
-- Para generar uno nuevo: node -e "const b=require('bcrypt'); b.hash('TuContrasena',10).then(console.log)"
INSERT INTO public.usuarios (nombre, email, contrasena_hash, rol_id, institucion_id, estado_id)
SELECT
  'Super Administrador',
  'superadmin@logickids.dev',
  '$2b$10$utkXMb7eSUuQEXuVXGJhSu1PV1X6rJZ5akly9Qk5wX1k9bCYQ/yNC', -- contraseña: SuperAdmin2025! — CAMBIAR en producción
  id_rol,
  NULL,
  1
FROM public.roles WHERE nombre = 'superadmin'
ON CONFLICT (email) DO NOTHING;

COMMIT;
