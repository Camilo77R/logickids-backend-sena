-- =============================================================
-- SEED: LogicKids — Datos catálogo base
-- Ejecutar DESPUÉS de crear el schema (DDL).
-- Idempotente: usa INSERT ... ON CONFLICT DO NOTHING
-- =============================================================

BEGIN;

-- 1. ROLES
INSERT INTO public.roles (nombre, descripcion) VALUES
  ('superadmin', 'Administrador global de la plataforma. Gestiona instituciones y minijuegos.'),
  ('admin',      'Administrador de una institución. Gestiona admins, tutores, grupos y estudiantes de su institución.'),
  ('tutor',      'Docente que opera las sesiones y el juego de los grupos que tiene asignados.')
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
  ('Patrones',       'Capacidad de reconocer regularidades y completar secuencias visuales o lógicas.'),
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

-- 10. MINIJUEGO DE EJEMPLO INTERNO
-- Se conserva para pruebas internas, pero no se expone en el catálogo pedagógico.
INSERT INTO public.minijuegos (
  slug, titulo, descripcion, habilidad_id, dificultad_maxima, activo, visible_en_catalogo, orden_catalogo
)
SELECT
  'logica-secuencias',
  'Secuencias Lógicas',
  'Completa la secuencia de figuras eligiendo el elemento que falta.',
  id_habilidad,
  4,
  true,
  false,
  900
FROM public.habilidades WHERE nombre = 'Lógica'
ON CONFLICT (slug) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  descripcion = EXCLUDED.descripcion,
  habilidad_id = EXCLUDED.habilidad_id,
  dificultad_maxima = EXCLUDED.dificultad_maxima,
  activo = EXCLUDED.activo,
  visible_en_catalogo = EXCLUDED.visible_en_catalogo,
  orden_catalogo = EXCLUDED.orden_catalogo;

-- 10.1 MINIJUEGO INTERNO: CODIGO ESTELAR
-- Se conserva para sockets y pruebas de realtime, no como juego oficial visible.
INSERT INTO public.minijuegos (
  slug, titulo, descripcion, habilidad_id, dificultad_maxima, activo, visible_en_catalogo, orden_catalogo
)
SELECT
  'codigo-estelar',
  'Código Estelar',
  'Clasifica meteoritos comparando números con un objetivo central en una sala competitiva en tiempo real.',
  id_habilidad,
  4,
  true,
  false,
  910
FROM public.habilidades WHERE nombre = 'Lógica'
ON CONFLICT (slug) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  descripcion = EXCLUDED.descripcion,
  habilidad_id = EXCLUDED.habilidad_id,
  dificultad_maxima = EXCLUDED.dificultad_maxima,
  activo = EXCLUDED.activo,
  visible_en_catalogo = EXCLUDED.visible_en_catalogo,
  orden_catalogo = EXCLUDED.orden_catalogo;

-- 10.2 CATÁLOGO OFICIAL DE MINIJUEGOS
INSERT INTO public.minijuegos (
  slug, titulo, descripcion, habilidad_id, dificultad_maxima, activo, visible_en_catalogo, orden_catalogo
)
SELECT
  'camino-ar',
  'Camino AR',
  'Memoriza un recorrido iluminado y repitelo tocando las baldosas en el mismo orden.',
  id_habilidad,
  4,
  true,
  true,
  1
FROM public.habilidades WHERE nombre = 'Memoria'
ON CONFLICT (slug) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  descripcion = EXCLUDED.descripcion,
  habilidad_id = EXCLUDED.habilidad_id,
  dificultad_maxima = EXCLUDED.dificultad_maxima,
  activo = EXCLUDED.activo,
  visible_en_catalogo = EXCLUDED.visible_en_catalogo,
  orden_catalogo = EXCLUDED.orden_catalogo;

INSERT INTO public.minijuegos (
  slug, titulo, descripcion, habilidad_id, dificultad_maxima, activo, visible_en_catalogo, orden_catalogo
)
SELECT
  'tren-figuras',
  'Tren de Figuras',
  'Completa el patrón del tren arrastrando la figura correcta al vagón vacío.',
  id_habilidad,
  4,
  true,
  true,
  2
FROM public.habilidades WHERE nombre = 'Patrones'
ON CONFLICT (slug) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  descripcion = EXCLUDED.descripcion,
  habilidad_id = EXCLUDED.habilidad_id,
  dificultad_maxima = EXCLUDED.dificultad_maxima,
  activo = EXCLUDED.activo,
  visible_en_catalogo = EXCLUDED.visible_en_catalogo,
  orden_catalogo = EXCLUDED.orden_catalogo;

INSERT INTO public.minijuegos (
  slug, titulo, descripcion, habilidad_id, dificultad_maxima, activo, visible_en_catalogo, orden_catalogo
)
SELECT
  'robot-logico',
  'Robot Lógico',
  'Resuelve retos de lógica para ensamblar correctamente las piezas del robot.',
  id_habilidad,
  4,
  true,
  true,
  3
FROM public.habilidades WHERE nombre = 'Lógica'
ON CONFLICT (slug) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  descripcion = EXCLUDED.descripcion,
  habilidad_id = EXCLUDED.habilidad_id,
  dificultad_maxima = EXCLUDED.dificultad_maxima,
  activo = EXCLUDED.activo,
  visible_en_catalogo = EXCLUDED.visible_en_catalogo,
  orden_catalogo = EXCLUDED.orden_catalogo;

INSERT INTO public.minijuegos (
  slug, titulo, descripcion, habilidad_id, dificultad_maxima, activo, visible_en_catalogo, orden_catalogo
)
SELECT
  'mercado-inteligente',
  'Mercado Inteligente',
  'Administra monedas limitadas para comprar productos sin pasarte del presupuesto.',
  id_habilidad,
  4,
  true,
  true,
  4
FROM public.habilidades WHERE nombre = 'Razonamiento'
ON CONFLICT (slug) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  descripcion = EXCLUDED.descripcion,
  habilidad_id = EXCLUDED.habilidad_id,
  dificultad_maxima = EXCLUDED.dificultad_maxima,
  activo = EXCLUDED.activo,
  visible_en_catalogo = EXCLUDED.visible_en_catalogo,
  orden_catalogo = EXCLUDED.orden_catalogo;

INSERT INTO public.minijuegos (
  slug, titulo, descripcion, habilidad_id, dificultad_maxima, activo, visible_en_catalogo, orden_catalogo
)
SELECT
  'objeto-perdido-ar',
  'Encuentra el Objeto Perdido AR',
  'Busca objetos 3D simples dentro de un tablero delimitado en realidad aumentada.',
  id_habilidad,
  4,
  true,
  true,
  5
FROM public.habilidades WHERE nombre = 'Atención'
ON CONFLICT (slug) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  descripcion = EXCLUDED.descripcion,
  habilidad_id = EXCLUDED.habilidad_id,
  dificultad_maxima = EXCLUDED.dificultad_maxima,
  activo = EXCLUDED.activo,
  visible_en_catalogo = EXCLUDED.visible_en_catalogo,
  orden_catalogo = EXCLUDED.orden_catalogo;

-- 10.3 RUTA PEDAGÓGICA OFICIAL
INSERT INTO public.rutas_pedagogicas (
  slug, nombre, descripcion, activo, visible_en_catalogo, orden_catalogo
)
VALUES (
  'ruta-completa-habilidades',
  'Ruta Completa de Habilidades',
  'Recorre los cinco minijuegos oficiales en el orden pedagógico definido por LogicKids.',
  true,
  true,
  1
)
ON CONFLICT (slug) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  activo = EXCLUDED.activo,
  visible_en_catalogo = EXCLUDED.visible_en_catalogo,
  orden_catalogo = EXCLUDED.orden_catalogo;

DELETE FROM public.ruta_pedagogica_bloques
WHERE ruta_pedagogica_id = (
  SELECT id_ruta_pedagogica
  FROM public.rutas_pedagogicas
  WHERE slug = 'ruta-completa-habilidades'
);

INSERT INTO public.ruta_pedagogica_bloques (ruta_pedagogica_id, orden, minijuego_id, niveles)
SELECT
  ruta.id_ruta_pedagogica,
  bloque.orden,
  juego.id_minijuego,
  bloque.niveles
FROM public.rutas_pedagogicas ruta
JOIN (
  VALUES
    (1, 'camino-ar', 1),
    (2, 'tren-figuras', 1),
    (3, 'robot-logico', 1),
    (4, 'mercado-inteligente', 1),
    (5, 'objeto-perdido', 1)
) AS bloque(orden, slug, niveles)
  ON TRUE
JOIN public.minijuegos juego
  ON juego.slug = bloque.slug
WHERE ruta.slug = 'ruta-completa-habilidades';

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

-- 12. INSTITUCION DE PRUEBA
INSERT INTO public.instituciones (nombre, ciudad, direccion, telefono, activo)
VALUES
  ('Colegio Prueba', 'Bogotá', 'Calle 123 #45-67', '3001234567', true)
ON CONFLICT (nombre) DO NOTHING;

-- 13. TUTOR DE PRUEBA ACTIVO
-- Contraseña: Tutor123!
-- Hash generado con bcrypt, costo 10.
INSERT INTO public.usuarios (nombre, email, contrasena_hash, rol_id, institucion_id, estado_id)
SELECT
  'Tutor de Prueba',
  'tutor@logickids.dev',
  '$2b$10$GIQ02VOfuri1nFxYXn3iWe//jd6boLXKCIShI7EDHS38s0Tob6AO6', -- contraseña: Tutor123! — CAMBIAR en producción
  id_rol,
  id_institucion,
  1
FROM public.roles, public.instituciones
WHERE roles.nombre = 'tutor' AND instituciones.nombre = 'Colegio Prueba'
ON CONFLICT (email) DO NOTHING;

-- 14. ADMIN PRINCIPAL DE PRUEBA
-- Contraseña: Admin123!
INSERT INTO public.usuarios (nombre, email, contrasena_hash, rol_id, institucion_id, estado_id, es_admin_principal)
SELECT
  'Admin Principal Colegio Prueba',
  'admin.colegioprueba@logickids.dev',
  '$2b$10$XKHuHkHY9oekjMwZNVoV0.U5fWBDjjq5aGbfgAUKvHq7TiPgCqNqe',
  id_rol,
  id_institucion,
  1,
  true
FROM public.roles, public.instituciones
WHERE roles.nombre = 'admin' AND instituciones.nombre = 'Colegio Prueba'
ON CONFLICT (email) DO NOTHING;

-- 15. GRUPO DE PRUEBA PARA EL TUTOR
INSERT INTO public.grupos (creado_por_usuario_id, tutor_asignado_id, institucion_id, nombre, descripcion, activo)
SELECT
  admin.id_usuario,
  tutor.id_usuario,
  i.id_institucion,
  'Grupo Matemáticas 5A',
  'Grupo de matemáticas para quinto grado',
  true
FROM public.usuarios tutor
JOIN public.instituciones i
  ON i.nombre = 'Colegio Prueba'
JOIN public.usuarios admin
  ON admin.email = 'admin.colegioprueba@logickids.dev'
 AND admin.institucion_id = i.id_institucion
WHERE tutor.email = 'tutor@logickids.dev'
ON CONFLICT DO NOTHING;

-- 16. HISTORIAL DE ASIGNACIÓN TUTOR -> GRUPO
INSERT INTO public.grupo_tutor_historial (grupo_id, tutor_id, asignado_por, fecha_inicio, activo)
SELECT
  g.id_grupo,
  tutor.id_usuario,
  admin.id_usuario,
  NOW(),
  true
FROM public.grupos g
JOIN public.usuarios tutor ON tutor.id_usuario = g.tutor_asignado_id
JOIN public.usuarios admin ON admin.email = 'admin.colegioprueba@logickids.dev'
WHERE g.nombre = 'Grupo Matemáticas 5A'
ON CONFLICT DO NOTHING;

-- 17. ESTUDIANTE DE PRUEBA
INSERT INTO public.estudiantes (institucion_id, nombre, edad, color_avatar, qr_token, estado_id)
VALUES
  (1, 'Ana García', 10, '#FF6B6B', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test_qr_token', 1)
ON CONFLICT (qr_token) DO NOTHING;

-- 18. ASIGNAR ESTUDIANTE AL GRUPO
INSERT INTO public.estudiante_grupo_historial (estudiante_id, grupo_id, fecha_inicio, activo)
SELECT
  e.id_estudiante,
  g.id_grupo,
  CURRENT_DATE,
  true
FROM public.estudiantes e, public.grupos g
WHERE e.nombre = 'Ana García' AND g.nombre = 'Grupo Matemáticas 5A'
ON CONFLICT DO NOTHING;

-- 19. SESIÓN DE JUEGO COMPLETADA (EJEMPLO)
INSERT INTO public.sesiones_juego (estudiante_id, minijuego_id, dificultad, puntaje, aciertos, errores, combo_maximo, estado_id, iniciada_en, finalizada_en)
SELECT
  e.id_estudiante,
  m.id_minijuego,
  2,
  850,
  15,
  3,
  8,
  2, -- completado
  CURRENT_TIMESTAMP - INTERVAL '30 minutes',
  CURRENT_TIMESTAMP - INTERVAL '25 minutes'
FROM public.estudiantes e, public.minijuegos m
WHERE e.nombre = 'Ana García' AND m.slug = 'logica-secuencias'
ON CONFLICT DO NOTHING;

-- 20. EVENTOS DE LA SESIÓN (EJEMPLOS)
-- Obtener el ID de la sesión insertada
INSERT INTO public.eventos_sesion (sesion_id, tipo_evento_id, habilidad_id, tiempo_reaccion_ms, puntos, combo_en_evento, ocurrido_en)
SELECT
  sj.id_sesion_juego,
  te.id_tipo_evento,
  h.id_habilidad,
  1200,
  10,
  0,
  sj.iniciada_en + INTERVAL '2 minutes'
FROM public.sesiones_juego sj
JOIN public.estudiantes e ON sj.estudiante_id = e.id_estudiante
JOIN public.tipos_evento te ON te.nombre = 'acierto'
JOIN public.habilidades h ON h.nombre = 'Lógica'
WHERE e.nombre = 'Ana García' AND sj.puntaje = 850
UNION ALL
SELECT
  sj.id_sesion_juego,
  te.id_tipo_evento,
  h.id_habilidad,
  800,
  15,
  1,
  sj.iniciada_en + INTERVAL '5 minutes'
FROM public.sesiones_juego sj
JOIN public.estudiantes e ON sj.estudiante_id = e.id_estudiante
JOIN public.tipos_evento te ON te.nombre = 'combo'
JOIN public.habilidades h ON h.nombre = 'Lógica'
WHERE e.nombre = 'Ana García' AND sj.puntaje = 850
UNION ALL
SELECT
  sj.id_sesion_juego,
  te.id_tipo_evento,
  h.id_habilidad,
  1500,
  0,
  0,
  sj.iniciada_en + INTERVAL '10 minutes'
FROM public.sesiones_juego sj
JOIN public.estudiantes e ON sj.estudiante_id = e.id_estudiante
JOIN public.tipos_evento te ON te.nombre = 'error'
JOIN public.habilidades h ON h.nombre = 'Lógica'
WHERE e.nombre = 'Ana García' AND sj.puntaje = 850
ON CONFLICT DO NOTHING;

-- 21. ESTADÍSTICAS GENERADAS
INSERT INTO public.estadisticas_habilidad (estudiante_id, habilidad_id, total_intentos, aciertos, errores, precision_pct, promedio_reaccion_ms, actualizado_en)
SELECT
  e.id_estudiante,
  h.id_habilidad,
  18,
  15,
  3,
  83.33,
  1167,
  CURRENT_TIMESTAMP
FROM public.estudiantes e, public.habilidades h
WHERE e.nombre = 'Ana García' AND h.nombre = 'Lógica'
ON CONFLICT (estudiante_id, habilidad_id) DO UPDATE SET
  total_intentos = EXCLUDED.total_intentos,
  aciertos = EXCLUDED.aciertos,
  errores = EXCLUDED.errores,
  precision_pct = EXCLUDED.precision_pct,
  promedio_reaccion_ms = EXCLUDED.promedio_reaccion_ms,
  actualizado_en = EXCLUDED.actualizado_en;

-- 22. LOGRO DESBLOQUEADO
INSERT INTO public.logros (estudiante_id, catalogo_logro_id, desbloqueado_en)
SELECT
  e.id_estudiante,
  cl.id_catalogo_logro,
  CURRENT_TIMESTAMP - INTERVAL '1 hour'
FROM public.estudiantes e, public.catalogo_logros cl
WHERE e.nombre = 'Ana García' AND cl.clave = 'precision_90'
ON CONFLICT (estudiante_id, catalogo_logro_id) DO NOTHING;

-- 23. RECOMENDACIÓN GENERADA POR IA
INSERT INTO public.recomendaciones (estudiante_id, habilidad_id, severidad_id, modelo_ia_id, mensaje, precision_momento, generado_en, activo)
SELECT
  e.id_estudiante,
  h.id_habilidad,
  ns.id_nivel_severidad,
  mia.id_modelo_ia,
  'Ana muestra buena comprensión de secuencias lógicas con una precisión del 83%. Recomiendo continuar practicando con niveles de dificultad media para mantener el engagement.',
  83.33,
  CURRENT_TIMESTAMP,
  true
FROM public.estudiantes e, public.habilidades h, public.niveles_severidad ns, public.modelos_ia mia
WHERE e.nombre = 'Ana García' AND h.nombre = 'Lógica' AND ns.nombre = 'media' AND mia.nombre = 'gemini-1.5-flash'
ON CONFLICT DO NOTHING;

COMMIT;
