-- =============================================================
-- SEED DEMO: LogicKids — Datos masivos para demostración
-- Pobla: 10 instituciones, 10 admins, 50 tutores, 300+ estudiantes
--        grupos, sesiones de juego, estadísticas, logros, recomendaciones
-- Idempotente: usa INSERT ... ON CONFLICT DO NOTHING
-- Contraseña de todos los tutores: Tutor123!
-- Contraseña de todos los admins:  Admin123!
-- =============================================================

BEGIN;

-- =============================================
-- PASO 1: INSTITUCIONES (10)
-- =============================================
INSERT INTO public.instituciones (nombre, ciudad, direccion, telefono, activo) VALUES
  ('Colegio San José',           'Bogotá',       'Cra 7 #45-12',       '6011234001', true),
  ('Instituto Técnico Central',  'Medellín',     'Calle 50 #30-22',    '6044321002', true),
  ('Colegio Nuevo Horizonte',    'Cali',         'Av. 6N #28-15',      '6025678003', true),
  ('Escuela Primaria La Paz',    'Barranquilla', 'Calle 72 #42-09',    '6059871004', true),
  ('Liceo Moderno Simón Bolívar','Bucaramanga',  'Cra 27 #55-80',      '6076541005', true),
  ('Colegio Los Andes',          'Manizales',    'Calle 23 #15-44',    '6087651006', true),
  ('Instituto Pedagógico del Sur','Pasto',       'Cra 25 #18-30',      '6027341007', true),
  ('Colegio Santa Marta',        'Santa Marta',  'Calle 10C #5-22',    '6054329008', true),
  ('Colegio Distrital del Norte', 'Cartagena',   'Av. del Lago #3-45', '6056123009', true),
  ('Institución Educativa Arauca','Arauca',      'Calle 16 #20-11',    '6087001010', true)
ON CONFLICT (nombre) DO NOTHING;

-- =============================================
-- PASO 2: ADMINS (uno por institución)
-- Contraseña: Admin123!
-- hash bcrypt costo 10 de "Admin123!"
-- =============================================
INSERT INTO public.usuarios (nombre, email, contrasena_hash, rol_id, institucion_id, estado_id, es_admin_principal)
SELECT
  'Admin ' || i.nombre,
  'admin.' || LOWER(REGEXP_REPLACE(i.nombre, '\s+', '', 'g')) || '@logickids.dev',
  '$2b$10$XKHuHkHY9oekjMwZNVoV0.U5fWBDjjq5aGbfgAUKvHq7TiPgCqNqe',
  (SELECT id_rol FROM public.roles WHERE nombre = 'admin'),
  i.id_institucion,
  1,
  true
FROM public.instituciones i
WHERE i.nombre IN (
  'Colegio San José','Instituto Técnico Central','Colegio Nuevo Horizonte',
  'Escuela Primaria La Paz','Liceo Moderno Simón Bolívar','Colegio Los Andes',
  'Instituto Pedagógico del Sur','Colegio Santa Marta','Colegio Distrital del Norte',
  'Institución Educativa Arauca'
)
ON CONFLICT (email) DO NOTHING;

-- =============================================
-- PASO 3: TUTORES (5 por institución = 50 tutores)
-- Contraseña: Tutor123!
-- hash bcrypt costo 10 de "Tutor123!"
-- =============================================

-- Institución 1: Colegio San José
INSERT INTO public.usuarios (nombre, email, contrasena_hash, rol_id, institucion_id, estado_id)
SELECT nombre, email, hash, rol_id, inst_id, 1
FROM (VALUES
  ('María Torres',     'maria.torres@sanjose.edu.co'),
  ('Carlos Herrera',   'carlos.herrera@sanjose.edu.co'),
  ('Lucía Vargas',     'lucia.vargas@sanjose.edu.co'),
  ('Andrés Morales',   'andres.morales@sanjose.edu.co'),
  ('Daniela Ríos',     'daniela.rios@sanjose.edu.co')
) AS t(nombre, email)
CROSS JOIN (
  SELECT
    '$2b$10$GIQ02VOfuri1nFxYXn3iWe//jd6boLXKCIShI7EDHS38s0Tob6AO6' AS hash,
    (SELECT id_rol FROM public.roles WHERE nombre = 'tutor') AS rol_id,
    (SELECT id_institucion FROM public.instituciones WHERE nombre = 'Colegio San José') AS inst_id
) AS c
ON CONFLICT (email) DO NOTHING;

-- Institución 2: Instituto Técnico Central
INSERT INTO public.usuarios (nombre, email, contrasena_hash, rol_id, institucion_id, estado_id)
SELECT nombre, email, hash, rol_id, inst_id, 1
FROM (VALUES
  ('Jorge Peña',       'jorge.pena@itcentral.edu.co'),
  ('Sandra Gómez',     'sandra.gomez@itcentral.edu.co'),
  ('Felipe Álvarez',   'felipe.alvarez@itcentral.edu.co'),
  ('Patricia Luna',    'patricia.luna@itcentral.edu.co'),
  ('Mauricio Castro',  'mauricio.castro@itcentral.edu.co')
) AS t(nombre, email)
CROSS JOIN (
  SELECT
    '$2b$10$GIQ02VOfuri1nFxYXn3iWe//jd6boLXKCIShI7EDHS38s0Tob6AO6' AS hash,
    (SELECT id_rol FROM public.roles WHERE nombre = 'tutor') AS rol_id,
    (SELECT id_institucion FROM public.instituciones WHERE nombre = 'Instituto Técnico Central') AS inst_id
) AS c
ON CONFLICT (email) DO NOTHING;

-- Institución 3: Colegio Nuevo Horizonte
INSERT INTO public.usuarios (nombre, email, contrasena_hash, rol_id, institucion_id, estado_id)
SELECT nombre, email, hash, rol_id, inst_id, 1
FROM (VALUES
  ('Valentina Cruz',   'valentina.cruz@nhorizonte.edu.co'),
  ('Diego Ospina',     'diego.ospina@nhorizonte.edu.co'),
  ('Natalia Salcedo',  'natalia.salcedo@nhorizonte.edu.co'),
  ('Sebastián Rojas',  'sebastian.rojas@nhorizonte.edu.co'),
  ('Laura Bermúdez',   'laura.bermudez@nhorizonte.edu.co')
) AS t(nombre, email)
CROSS JOIN (
  SELECT
    '$2b$10$GIQ02VOfuri1nFxYXn3iWe//jd6boLXKCIShI7EDHS38s0Tob6AO6' AS hash,
    (SELECT id_rol FROM public.roles WHERE nombre = 'tutor') AS rol_id,
    (SELECT id_institucion FROM public.instituciones WHERE nombre = 'Colegio Nuevo Horizonte') AS inst_id
) AS c
ON CONFLICT (email) DO NOTHING;

-- Institución 4: Escuela Primaria La Paz
INSERT INTO public.usuarios (nombre, email, contrasena_hash, rol_id, institucion_id, estado_id)
SELECT nombre, email, hash, rol_id, inst_id, 1
FROM (VALUES
  ('Camila Mendoza',   'camila.mendoza@lapaz.edu.co'),
  ('Tomás Suárez',     'tomas.suarez@lapaz.edu.co'),
  ('Isabela Cortés',   'isabela.cortes@lapaz.edu.co'),
  ('Julián Reyes',     'julian.reyes@lapaz.edu.co'),
  ('Mariana Acosta',   'mariana.acosta@lapaz.edu.co')
) AS t(nombre, email)
CROSS JOIN (
  SELECT
    '$2b$10$GIQ02VOfuri1nFxYXn3iWe//jd6boLXKCIShI7EDHS38s0Tob6AO6' AS hash,
    (SELECT id_rol FROM public.roles WHERE nombre = 'tutor') AS rol_id,
    (SELECT id_institucion FROM public.instituciones WHERE nombre = 'Escuela Primaria La Paz') AS inst_id
) AS c
ON CONFLICT (email) DO NOTHING;

-- Institución 5: Liceo Moderno Simón Bolívar
INSERT INTO public.usuarios (nombre, email, contrasena_hash, rol_id, institucion_id, estado_id)
SELECT nombre, email, hash, rol_id, inst_id, 1
FROM (VALUES
  ('Alejandro Nieto',  'alejandro.nieto@lmsb.edu.co'),
  ('Sofía Ramírez',    'sofia.ramirez@lmsb.edu.co'),
  ('Esteban Lozano',   'esteban.lozano@lmsb.edu.co'),
  ('Gabriela Pineda',  'gabriela.pineda@lmsb.edu.co'),
  ('Nicolás Soto',     'nicolas.soto@lmsb.edu.co')
) AS t(nombre, email)
CROSS JOIN (
  SELECT
    '$2b$10$GIQ02VOfuri1nFxYXn3iWe//jd6boLXKCIShI7EDHS38s0Tob6AO6' AS hash,
    (SELECT id_rol FROM public.roles WHERE nombre = 'tutor') AS rol_id,
    (SELECT id_institucion FROM public.instituciones WHERE nombre = 'Liceo Moderno Simón Bolívar') AS inst_id
) AS c
ON CONFLICT (email) DO NOTHING;

-- Institución 6: Colegio Los Andes
INSERT INTO public.usuarios (nombre, email, contrasena_hash, rol_id, institucion_id, estado_id)
SELECT nombre, email, hash, rol_id, inst_id, 1
FROM (VALUES
  ('Ricardo Pardo',    'ricardo.pardo@losandes.edu.co'),
  ('Tatiana Vega',     'tatiana.vega@losandes.edu.co'),
  ('Cristian Muñoz',   'cristian.munoz@losandes.edu.co'),
  ('Paula Jiménez',    'paula.jimenez@losandes.edu.co'),
  ('Rodrigo Cárdenas', 'rodrigo.cardenas@losandes.edu.co')
) AS t(nombre, email)
CROSS JOIN (
  SELECT
    '$2b$10$GIQ02VOfuri1nFxYXn3iWe//jd6boLXKCIShI7EDHS38s0Tob6AO6' AS hash,
    (SELECT id_rol FROM public.roles WHERE nombre = 'tutor') AS rol_id,
    (SELECT id_institucion FROM public.instituciones WHERE nombre = 'Colegio Los Andes') AS inst_id
) AS c
ON CONFLICT (email) DO NOTHING;

-- Institución 7: Instituto Pedagógico del Sur
INSERT INTO public.usuarios (nombre, email, contrasena_hash, rol_id, institucion_id, estado_id)
SELECT nombre, email, hash, rol_id, inst_id, 1
FROM (VALUES
  ('Ximena Arango',    'ximena.arango@ipsur.edu.co'),
  ('David Ochoa',      'david.ochoa@ipsur.edu.co'),
  ('Manuela Duque',    'manuela.duque@ipsur.edu.co'),
  ('Simón Figueroa',   'simon.figueroa@ipsur.edu.co'),
  ('Alejandra Trujillo','alejandra.trujillo@ipsur.edu.co')
) AS t(nombre, email)
CROSS JOIN (
  SELECT
    '$2b$10$GIQ02VOfuri1nFxYXn3iWe//jd6boLXKCIShI7EDHS38s0Tob6AO6' AS hash,
    (SELECT id_rol FROM public.roles WHERE nombre = 'tutor') AS rol_id,
    (SELECT id_institucion FROM public.instituciones WHERE nombre = 'Instituto Pedagógico del Sur') AS inst_id
) AS c
ON CONFLICT (email) DO NOTHING;

-- Institución 8: Colegio Santa Marta
INSERT INTO public.usuarios (nombre, email, contrasena_hash, rol_id, institucion_id, estado_id)
SELECT nombre, email, hash, rol_id, inst_id, 1
FROM (VALUES
  ('Paola Guerrero',   'paola.guerrero@smarta.edu.co'),
  ('Roberto Navarro',  'roberto.navarro@smarta.edu.co'),
  ('Verónica Arias',   'veronica.arias@smarta.edu.co'),
  ('Iván Zapata',      'ivan.zapata@smarta.edu.co'),
  ('Diana Castaño',    'diana.castano@smarta.edu.co')
) AS t(nombre, email)
CROSS JOIN (
  SELECT
    '$2b$10$GIQ02VOfuri1nFxYXn3iWe//jd6boLXKCIShI7EDHS38s0Tob6AO6' AS hash,
    (SELECT id_rol FROM public.roles WHERE nombre = 'tutor') AS rol_id,
    (SELECT id_institucion FROM public.instituciones WHERE nombre = 'Colegio Santa Marta') AS inst_id
) AS c
ON CONFLICT (email) DO NOTHING;

-- Institución 9: Colegio Distrital del Norte
INSERT INTO public.usuarios (nombre, email, contrasena_hash, rol_id, institucion_id, estado_id)
SELECT nombre, email, hash, rol_id, inst_id, 1
FROM (VALUES
  ('Hernán Romero',    'hernan.romero@cdnorte.edu.co'),
  ('Claudia Serrano',  'claudia.serrano@cdnorte.edu.co'),
  ('Orlando Medina',   'orlando.medina@cdnorte.edu.co'),
  ('Martha Aguilar',   'martha.aguilar@cdnorte.edu.co'),
  ('Rubén Barrera',    'ruben.barrera@cdnorte.edu.co')
) AS t(nombre, email)
CROSS JOIN (
  SELECT
    '$2b$10$GIQ02VOfuri1nFxYXn3iWe//jd6boLXKCIShI7EDHS38s0Tob6AO6' AS hash,
    (SELECT id_rol FROM public.roles WHERE nombre = 'tutor') AS rol_id,
    (SELECT id_institucion FROM public.instituciones WHERE nombre = 'Colegio Distrital del Norte') AS inst_id
) AS c
ON CONFLICT (email) DO NOTHING;

-- Institución 10: Institución Educativa Arauca
INSERT INTO public.usuarios (nombre, email, contrasena_hash, rol_id, institucion_id, estado_id)
SELECT nombre, email, hash, rol_id, inst_id, 1
FROM (VALUES
  ('Liliana Contreras','liliana.contreras@ieara.edu.co'),
  ('Ernesto Villalba', 'ernesto.villalba@ieara.edu.co'),
  ('Yolanda Escobar',  'yolanda.escobar@ieara.edu.co'),
  ('Fernando Ríos',    'fernando.rios@ieara.edu.co'),
  ('Consuelo Patiño',  'consuelo.patino@ieara.edu.co')
) AS t(nombre, email)
CROSS JOIN (
  SELECT
    '$2b$10$GIQ02VOfuri1nFxYXn3iWe//jd6boLXKCIShI7EDHS38s0Tob6AO6' AS hash,
    (SELECT id_rol FROM public.roles WHERE nombre = 'tutor') AS rol_id,
    (SELECT id_institucion FROM public.instituciones WHERE nombre = 'Institución Educativa Arauca') AS inst_id
) AS c
ON CONFLICT (email) DO NOTHING;

-- =============================================
-- PASO 4: GRUPOS (2 por tutor = ~100 grupos)
-- =============================================
INSERT INTO public.grupos (creado_por_usuario_id, tutor_asignado_id, institucion_id, nombre, descripcion, activo)
SELECT
  admin.id_usuario,
  u.id_usuario,
  u.institucion_id,
  'Grupo ' || nombre_grupo || ' - ' || SPLIT_PART(u.nombre, ' ', 1),
  'Grupo de matemáticas y lógica',
  true
FROM public.usuarios u
JOIN public.usuarios admin
  ON admin.institucion_id = u.institucion_id
 AND admin.es_admin_principal = true
 AND admin.rol_id = (SELECT id_rol FROM public.roles WHERE nombre = 'admin')
CROSS JOIN (VALUES ('Mañana 5A'), ('Tarde 6B')) AS g(nombre_grupo)
WHERE u.rol_id = (SELECT id_rol FROM public.roles WHERE nombre = 'tutor')
  AND u.email LIKE '%@%'
  AND u.email NOT LIKE '%logickids.dev%'
ON CONFLICT DO NOTHING;

-- =============================================
-- PASO 4.1: HISTORIAL DE ASIGNACIÓN TUTOR -> GRUPO
-- =============================================
INSERT INTO public.grupo_tutor_historial (grupo_id, tutor_id, asignado_por, fecha_inicio, activo)
SELECT
  g.id_grupo,
  g.tutor_asignado_id,
  admin.id_usuario,
  g.creado_en,
  true
FROM public.grupos g
JOIN public.usuarios tutor ON tutor.id_usuario = g.tutor_asignado_id
JOIN public.usuarios admin
  ON admin.institucion_id = g.institucion_id
 AND admin.es_admin_principal = true
 AND admin.rol_id = (SELECT id_rol FROM public.roles WHERE nombre = 'admin')
WHERE g.tutor_asignado_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- =============================================
-- PASO 5: ESTUDIANTES (~30 por institución = 300 estudiantes)
-- =============================================
DO $$
DECLARE
  inst    RECORD;
  nombres TEXT[] := ARRAY[
    'Sofía','Valentina','Daniela','Camila','Isabella','Mariana','Sara','Laura','Alejandra','Paula',
    'Santiago','Mateo','Samuel','Sebastián','Nicolás','David','Andrés','Julián','Felipe','Miguel',
    'Lucía','Emma','Victoria','Manuela','Salomé','Juan','Diego','Carlos','Alejandro','Tomás'
  ];
  colores TEXT[] := ARRAY[
    '#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98FB98','#F0E68C',
    '#87CEEB','#FFA07A','#20B2AA','#778899','#B0C4DE','#FFD700','#DA70D6'
  ];
  i       INT;
  n       TEXT;
  token   TEXT;
BEGIN
  FOR inst IN
    SELECT id_institucion FROM public.instituciones
    WHERE nombre IN (
      'Colegio San José','Instituto Técnico Central','Colegio Nuevo Horizonte',
      'Escuela Primaria La Paz','Liceo Moderno Simón Bolívar','Colegio Los Andes',
      'Instituto Pedagógico del Sur','Colegio Santa Marta','Colegio Distrital del Norte',
      'Institución Educativa Arauca'
    )
  LOOP
    FOR i IN 1..30 LOOP
      n     := nombres[((i - 1) % 30) + 1];
      token := 'qr_inst' || inst.id_institucion || '_est' || i || '_' || MD5(inst.id_institucion::text || i::text);
      INSERT INTO public.estudiantes (institucion_id, nombre, edad, color_avatar, qr_token, estado_id)
      VALUES (
        inst.id_institucion,
        n || ' ' || 'Estudiante' || i,
        6 + (i % 7),
        colores[((i - 1) % 15) + 1],
        token,
        1
      )
      ON CONFLICT (qr_token) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- =============================================
-- PASO 6: ASIGNAR ESTUDIANTES A GRUPOS
-- Cada grupo recibe ~8 estudiantes de su institución
-- =============================================
INSERT INTO public.estudiante_grupo_historial (estudiante_id, grupo_id, fecha_inicio, activo)
SELECT DISTINCT ON (e.id_estudiante, g.id_grupo)
  e.id_estudiante,
  g.id_grupo,
  CURRENT_DATE - (FLOOR(RANDOM() * 60)::int || ' days')::INTERVAL,
  true
FROM public.grupos g
JOIN public.estudiantes e ON e.institucion_id = g.institucion_id
WHERE g.activo = true
  AND (SELECT COUNT(*) FROM public.estudiante_grupo_historial egh WHERE egh.grupo_id = g.id_grupo) < 8
  AND e.id_estudiante % 3 = g.id_grupo % 3
ON CONFLICT DO NOTHING;

-- =============================================
-- PASO 7: SESIONES DE JUEGO (múltiples por estudiante)
-- =============================================
INSERT INTO public.sesiones_juego
  (estudiante_id, minijuego_id, dificultad, puntaje, aciertos, errores, combo_maximo, estado_id, iniciada_en, finalizada_en)
SELECT
  e.id_estudiante,
  m.id_minijuego,
  1 + (e.id_estudiante % 4),
  400 + (e.id_estudiante * 7 % 600),
  8  + (e.id_estudiante % 12),
  1  + (e.id_estudiante % 5),
  3  + (e.id_estudiante % 8),
  2,
  NOW() - ((e.id_estudiante % 30 + 1) || ' days')::INTERVAL,
  NOW() - ((e.id_estudiante % 30 + 1) || ' days')::INTERVAL + '20 minutes'::INTERVAL
FROM public.estudiantes e
CROSS JOIN public.minijuegos m
WHERE m.slug IN ('logica-secuencias', 'codigo-estelar')
ON CONFLICT DO NOTHING;

-- Segunda ronda de sesiones con fechas diferentes
INSERT INTO public.sesiones_juego
  (estudiante_id, minijuego_id, dificultad, puntaje, aciertos, errores, combo_maximo, estado_id, iniciada_en, finalizada_en)
SELECT
  e.id_estudiante,
  m.id_minijuego,
  2 + (e.id_estudiante % 3),
  600 + (e.id_estudiante * 11 % 400),
  10 + (e.id_estudiante % 10),
  0  + (e.id_estudiante % 4),
  5  + (e.id_estudiante % 7),
  2,
  NOW() - ((e.id_estudiante % 15 + 1) || ' days')::INTERVAL + '3 hours'::INTERVAL,
  NOW() - ((e.id_estudiante % 15 + 1) || ' days')::INTERVAL + '3 hours 25 minutes'::INTERVAL
FROM public.estudiantes e
CROSS JOIN public.minijuegos m
WHERE m.slug IN ('logica-secuencias', 'codigo-estelar')
ON CONFLICT DO NOTHING;

-- =============================================
-- PASO 8: ESTADÍSTICAS DE HABILIDAD
-- =============================================
INSERT INTO public.estadisticas_habilidad
  (estudiante_id, habilidad_id, total_intentos, aciertos, errores, precision_pct, promedio_reaccion_ms, actualizado_en)
SELECT
  e.id_estudiante,
  h.id_habilidad,
  20 + (e.id_estudiante % 40),
  15 + (e.id_estudiante % 30),
  2  + (e.id_estudiante % 8),
  ROUND(CAST((65.0 + (e.id_estudiante % 35)) AS NUMERIC), 2),
  800 + (e.id_estudiante * 13 % 1200),
  NOW() - ((e.id_estudiante % 10) || ' days')::INTERVAL
FROM public.estudiantes e
CROSS JOIN public.habilidades h
ON CONFLICT (estudiante_id, habilidad_id) DO UPDATE SET
  total_intentos      = EXCLUDED.total_intentos,
  aciertos            = EXCLUDED.aciertos,
  errores             = EXCLUDED.errores,
  precision_pct       = EXCLUDED.precision_pct,
  promedio_reaccion_ms= EXCLUDED.promedio_reaccion_ms,
  actualizado_en      = EXCLUDED.actualizado_en;

-- =============================================
-- PASO 9: LOGROS DESBLOQUEADOS
-- =============================================
INSERT INTO public.logros (estudiante_id, catalogo_logro_id, desbloqueado_en)
SELECT
  e.id_estudiante,
  cl.id_catalogo_logro,
  NOW() - ((e.id_estudiante % 20 + 1) || ' days')::INTERVAL
FROM public.estudiantes e
CROSS JOIN public.catalogo_logros cl
WHERE (e.id_estudiante + cl.id_catalogo_logro) % 3 = 0
ON CONFLICT (estudiante_id, catalogo_logro_id) DO NOTHING;

-- =============================================
-- PASO 10: RECOMENDACIONES IA
-- =============================================
INSERT INTO public.recomendaciones
  (estudiante_id, grupo_id, habilidad_id, severidad_id, modelo_ia_id, mensaje, precision_momento, generado_en, activo)
SELECT
  e.id_estudiante,
  g.id_grupo,
  h.id_habilidad,
  1 + (e.id_estudiante % 3),
  (SELECT id_modelo_ia FROM public.modelos_ia WHERE nombre = 'gemini-1.5-flash'),
  CASE (e.id_estudiante % 5)
    WHEN 0 THEN 'El estudiante muestra un progreso notable en lógica. Se recomienda incrementar la dificultad de los ejercicios para mantener el desafío cognitivo.'
    WHEN 1 THEN 'Se detectaron patrones de error recurrentes en secuencias. Reforzar ejercicios de memoria visual con imágenes y repetición espaciada.'
    WHEN 2 THEN 'Excelente tiempo de reacción. El estudiante está listo para niveles avanzados de razonamiento matemático.'
    WHEN 3 THEN 'La precisión del 70% sugiere dificultades con la atención sostenida. Recomendamos sesiones más cortas y con mayor frecuencia semanal.'
    ELSE        'El combo máximo alcanzado indica buena concentración. Se sugiere introducir variantes de juego para diversificar la estimulación cognitiva.'
  END,
  ROUND(CAST((60.0 + (e.id_estudiante % 38)) AS NUMERIC), 2),
  NOW() - ((e.id_estudiante % 7 + 1) || ' days')::INTERVAL,
  true
FROM public.estudiantes e
JOIN public.estudiante_grupo_historial egh ON egh.estudiante_id = e.id_estudiante AND egh.activo = true
JOIN public.grupos g ON g.id_grupo = egh.grupo_id
CROSS JOIN public.habilidades h
WHERE h.nombre IN ('Lógica', 'Memoria', 'Atención')
ON CONFLICT DO NOTHING;

-- =============================================
-- PASO 11: SOLICITUDES DE REACTIVACIÓN (demo)
-- =============================================
INSERT INTO public.solicitudes_reactivacion
  (usuario_id, correo_contacto, motivo, descripcion, estado_solicitud, leida_admin, fecha_solicitud)
SELECT
  u.id_usuario,
  u.email,
  CASE (u.id_usuario % 3)
    WHEN 0 THEN 'error_tecnico'
    WHEN 1 THEN 'cuenta_bloqueada'
    ELSE        'otro'
  END,
  'Solicitud de reactivación generada en datos de demostración para revisión administrativa.',
  'pendiente',
  false,
  NOW() - ((u.id_usuario % 5 + 1) || ' days')::INTERVAL
FROM public.usuarios u
WHERE u.rol_id = (SELECT id_rol FROM public.roles WHERE nombre = 'tutor')
  AND u.id_usuario % 7 = 0;

COMMIT;

-- =============================================================
-- RESUMEN DE CREDENCIALES
-- =============================================================
-- SUPERADMIN : superadmin@logickids.dev       / SuperAdmin2025!
-- ADMINS     : admin.[nombre_inst]@logickids.dev / Admin123!
-- TUTORES    : [nombre].[apellido]@[inst].edu.co / Tutor123!
-- =============================================================
