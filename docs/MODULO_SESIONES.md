# 📊 Módulo de Sesiones - LogicKids Backend

## 🎯 ¿Qué se Cumple en el Módulo de Sesiones?

El módulo de sesiones está **100% implementado y funcional**, gestionando el ciclo completo de vida de las sesiones de juego educativo, desde el inicio hasta la finalización, con tracking granular de eventos en tiempo real.

### ✅ Funcionalidades Implementadas

#### 1. **Gestión del Ciclo de Vida de Sesiones**
- Inicio de sesiones de juego
- Registro de eventos durante la sesión
- Finalización con cálculo de estadísticas
- Estados: activo, completado, abandonado

#### 2. **Tracking Granular de Eventos**
- 4 tipos de eventos: acierto, error, combo, nivel_completado
- Captura de métricas detalladas: tiempo de reacción, puntos, combos
- Persistencia inmediata para análisis real-time

#### 3. **Integración con Analytics**
- Agregación automática de estadísticas por habilidad cognitiva
- Evaluación de logros desbloqueables
- Generación de recomendaciones IA pedagógicas

#### 4. **Historial y Auditoría**
- Historial completo de sesiones por estudiante
- Detalle granular de eventos para análisis de tutores
- Preservación de datos históricos

## 🔧 ¿Qué se Desarrolla en Este Módulo?

### Arquitectura Técnica
- **Controller**: `sesiones.controller.js` - Manejo de requests/responses
- **Service**: `sesiones.service.js` - Lógica de negocio y BD
- **Schema**: `sesiones.schema.js` - Validación Zod de inputs
- **Routes**: `sesiones.routes.js` - Definición de endpoints

### Componentes Principales
- **Sesiones de Juego**: Tabla `sesiones_juego` con estado y métricas
- **Eventos de Sesión**: Tabla `eventos_sesion` con tracking detallado
- **Integración con Estadísticas**: Actualización automática de `estadisticas_habilidad`
- **Integración con Logros**: Evaluación de reglas de desbloqueo
- **Integración con IA**: Disparo de recomendaciones pedagógicas

## 🎓 ¿Para Qué y Por Qué?

### Propósito Pedagógico
**Para qué**: Capturar datos detallados del rendimiento estudiantil durante actividades lúdicas para análisis pedagógico personalizado.

**Por qué**:
- **Evaluación Continua**: Los eventos en tiempo real permiten monitorear el progreso inmediato
- **Análisis de Patrones**: Los datos granulares revelan fortalezas/débilidades cognitivas
- **Recomendaciones Personalizadas**: La IA usa estos datos para sugerencias específicas
- **Gamificación Efectiva**: Los logros motivan el aprendizaje basado en logros reales

### Beneficios Técnicos
- **Escalabilidad**: Arquitectura preparada para múltiples sesiones simultáneas
- **Integridad de Datos**: Transacciones atómicas y validaciones estrictas
- **Auditoría Completa**: Historial preservado para compliance educativo
- **Performance**: Índices optimizados para consultas rápidas

## 🔄 Flujo del Módulo de Sesiones

```
1. Estudiante autenticado con QR
   ↓ (sesion_activa = true)
2. Inicio de Sesión
   POST /api/sesiones
   → Crea registro en sesiones_juego (estado: activo)
   ↓
3. Durante el Juego
   POST /api/sesiones/:id/evento (múltiples veces)
   → Registra cada acierto/error/combo en eventos_sesion
   ↓
4. Finalización
   POST /api/sesiones/:id/finalizar
   → Actualiza sesiones_juego con estadísticas finales
   ↓
5. Procesamiento Automático
   ├── Actualización de estadisticas_habilidad
   ├── Evaluación de logros desbloqueables
   └── Generación de recomendaciones IA (async)
   ↓
6. Consulta de Historial
   GET /api/sesiones/historial (estudiante)
   GET /api/sesiones/:id/eventos (tutor)
```

## 👥 Usuarios de Prueba Registrados

### 👑 Superadmin
- **Email**: `superadmin@logickids.dev`
- **Contraseña**: `SuperAdmin2025!`
- **Rol**: Administrador global
- **Permisos**: Gestiona instituciones, minijuegos, usuarios globales

### 👨‍🏫 Tutor de Prueba
- **Email**: `tutor@logickids.dev`
- **Contraseña**: `Tutor123!`
- **Rol**: Tutor docente
- **Institución**: Colegio Prueba (Bogotá)
- **Estado**: Activo
- **Permisos**: Gestiona grupos, estudiantes, sesiones, estadísticas de su institución

## 📡 Endpoints Implementados

| Método | Endpoint | Autenticación | Descripción |
|--------|----------|---------------|-------------|
| `POST` | `/api/sesiones` | Estudiante (JWT) | Inicia nueva sesión de juego |
| `POST` | `/api/sesiones/:id/evento` | Estudiante (JWT) | Registra evento durante sesión |
| `POST` | `/api/sesiones/:id/finalizar` | Estudiante (JWT) | Cierra sesión + calcula stats |
| `GET` | `/api/sesiones/historial` | Estudiante (JWT) | Lista sesiones completadas |
| `GET` | `/api/sesiones/:id/eventos` | Tutor (JWT) | Detalle eventos de una sesión |

### Validaciones Implementadas
- **Inicio**: Estudiante debe tener `sesion_activa = true`
- **Eventos**: Sesión debe existir y estar activa
- **Finalización**: Sesión debe estar en estado activo
- **Historial**: Solo sesiones del estudiante autenticado
- **Eventos Detallados**: Solo tutores pueden ver eventos de sus estudiantes

## 📈 Análisis del Módulo

### ✅ Fortalezas
- **Completitud**: Todas las funcionalidades críticas implementadas
- **Integración**: Conexión perfecta con estadísticas, logros e IA
- **Seguridad**: Validaciones estrictas y aislamiento por estudiante
- **Escalabilidad**: Diseño preparado para alto volumen de eventos
- **Auditoría**: Historial completo preservado

### ⚠️ Consideraciones Técnicas
- **Volumen de Datos**: Eventos granulares pueden generar mucho data
- **Performance**: Consultas optimizadas con índices en BD
- **Tiempo Real**: Eventos se persisten inmediatamente (no batch)
- **Integridad**: Transacciones aseguran consistencia

### 🔄 Ciclo de Vida de Datos
1. **Sesión Activa**: Eventos se acumulan en memoria + BD
2. **Finalización**: Cálculo de métricas agregadas
3. **Post-Procesamiento**: IA analiza patrones para recomendaciones
4. **Historial**: Datos preservados para análisis futuro

### 🎯 Impacto Pedagógico
Este módulo es el **corazón del sistema educativo**, permitiendo:
- Monitoreo continuo del aprendizaje
- Intervención temprana en dificultades
- Personalización de actividades
- Motivación mediante logros
- Análisis longitudinal del progreso

**Estado**: ✅ **Completamente Funcional** - Listo para producción con datos reales.


**Datos Tests**

-- =============================================================
-- DATOS SEMILLA - SESIONES DE JUEGO
-- =============================================================

BEGIN;

-- =============================================================
-- SESION 1
-- =============================================================

INSERT INTO public.sesiones_juego (
    estudiante_id,
    minijuego_id,
    dificultad,
    puntaje,
    aciertos,
    errores,
    combo_maximo,
    estado_id,
    iniciada_en,
    finalizada_en
)
SELECT
    e.id_estudiante,
    m.id_minijuego,
    1,
    450,
    8,
    2,
    3,
    es.id_estado_sesion,
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '15 minutes'
FROM public.estudiantes e
JOIN public.minijuegos m
    ON m.slug = 'logica-secuencias'
JOIN public.estados_sesion es
    ON es.nombre = 'completado'
WHERE e.qr_token = 'qr_ana_garcia_001';

-- =============================================================
-- SESION 2
-- =============================================================

INSERT INTO public.sesiones_juego (
    estudiante_id,
    minijuego_id,
    dificultad,
    puntaje,
    aciertos,
    errores,
    combo_maximo,
    estado_id,
    iniciada_en,
    finalizada_en
)
SELECT
    e.id_estudiante,
    m.id_minijuego,
    2,
    720,
    12,
    4,
    6,
    es.id_estado_sesion,
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP - INTERVAL '1 day' + INTERVAL '20 minutes'
FROM public.estudiantes e
JOIN public.minijuegos m
    ON m.slug = 'logica-secuencias'
JOIN public.estados_sesion es
    ON es.nombre = 'completado'
WHERE e.qr_token = 'qr_ana_garcia_001';

-- =============================================================
-- SESION 3
-- =============================================================

INSERT INTO public.sesiones_juego (
    estudiante_id,
    minijuego_id,
    dificultad,
    puntaje,
    aciertos,
    errores,
    combo_maximo,
    estado_id,
    iniciada_en,
    finalizada_en
)
SELECT
    e.id_estudiante,
    m.id_minijuego,
    3,
    950,
    18,
    2,
    10,
    es.id_estado_sesion,
    CURRENT_TIMESTAMP - INTERVAL '5 hours',
    CURRENT_TIMESTAMP - INTERVAL '4 hours 35 minutes'
FROM public.estudiantes e
JOIN public.minijuegos m
    ON m.slug = 'logica-secuencias'
JOIN public.estados_sesion es
    ON es.nombre = 'completado'
WHERE e.qr_token = 'qr_ana_garcia_001';

-- =============================================================
-- SESION 4 - ABANDONADA
-- =============================================================

INSERT INTO public.sesiones_juego (
    estudiante_id,
    minijuego_id,
    dificultad,
    puntaje,
    aciertos,
    errores,
    combo_maximo,
    estado_id,
    iniciada_en,
    finalizada_en
)
SELECT
    e.id_estudiante,
    m.id_minijuego,
    4,
    300,
    5,
    7,
    2,
    es.id_estado_sesion,
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    CURRENT_TIMESTAMP - INTERVAL '1 hour 50 minutes'
FROM public.estudiantes e
JOIN public.minijuegos m
    ON m.slug = 'logica-secuencias'
JOIN public.estados_sesion es
    ON es.nombre = 'abandonado'
WHERE e.qr_token = 'qr_ana_garcia_001';

-- =============================================================
-- SESION 5 - ACTIVA
-- =============================================================

INSERT INTO public.sesiones_juego (
    estudiante_id,
    minijuego_id,
    dificultad,
    puntaje,
    aciertos,
    errores,
    combo_maximo,
    estado_id,
    iniciada_en
)
SELECT
    e.id_estudiante,
    m.id_minijuego,
    2,
    180,
    4,
    1,
    2,
    es.id_estado_sesion,
    CURRENT_TIMESTAMP - INTERVAL '10 minutes'
FROM public.estudiantes e
JOIN public.minijuegos m
    ON m.slug = 'logica-secuencias'
JOIN public.estados_sesion es
    ON es.nombre = 'activo'
WHERE e.qr_token = 'qr_ana_garcia_001';

COMMIT;

-- =============================================================
-- DATOS SEMILLA - EVENTOS DE SESION
-- =============================================================

BEGIN;

-- =============================================================
-- EVENTOS PARA SESION CON PUNTAJE 950
-- =============================================================

-- ACIERTO
INSERT INTO public.eventos_sesion (
    sesion_id,
    tipo_evento_id,
    habilidad_id,
    tiempo_reaccion_ms,
    puntos,
    combo_en_evento,
    ocurrido_en
)
SELECT
    sj.id_sesion_juego,
    te.id_tipo_evento,
    h.id_habilidad,
    850,
    50,
    1,
    sj.iniciada_en + INTERVAL '2 minutes'
FROM public.sesiones_juego sj
JOIN public.estudiantes e
    ON e.id_estudiante = sj.estudiante_id
JOIN public.tipos_evento te
    ON te.nombre = 'acierto'
JOIN public.habilidades h
    ON h.nombre = 'Lógica'
WHERE e.qr_token = 'qr_ana_garcia_001'
AND sj.puntaje = 950;

-- COMBO
INSERT INTO public.eventos_sesion (
    sesion_id,
    tipo_evento_id,
    habilidad_id,
    tiempo_reaccion_ms,
    puntos,
    combo_en_evento,
    ocurrido_en
)
SELECT
    sj.id_sesion_juego,
    te.id_tipo_evento,
    h.id_habilidad,
    620,
    120,
    5,
    sj.iniciada_en + INTERVAL '5 minutes'
FROM public.sesiones_juego sj
JOIN public.estudiantes e
    ON e.id_estudiante = sj.estudiante_id
JOIN public.tipos_evento te
    ON te.nombre = 'combo'
JOIN public.habilidades h
    ON h.nombre = 'Lógica'
WHERE e.qr_token = 'qr_ana_garcia_001'
AND sj.puntaje = 950;

-- ERROR
INSERT INTO public.eventos_sesion (
    sesion_id,
    tipo_evento_id,
    habilidad_id,
    tiempo_reaccion_ms,
    puntos,
    combo_en_evento,
    ocurrido_en
)
SELECT
    sj.id_sesion_juego,
    te.id_tipo_evento,
    h.id_habilidad,
    1800,
    0,
    0,
    sj.iniciada_en + INTERVAL '8 minutes'
FROM public.sesiones_juego sj
JOIN public.estudiantes e
    ON e.id_estudiante = sj.estudiante_id
JOIN public.tipos_evento te
    ON te.nombre = 'error'
JOIN public.habilidades h
    ON h.nombre = 'Lógica'
WHERE e.qr_token = 'qr_ana_garcia_001'
AND sj.puntaje = 950;

-- NIVEL COMPLETADO
INSERT INTO public.eventos_sesion (
    sesion_id,
    tipo_evento_id,
    habilidad_id,
    tiempo_reaccion_ms,
    puntos,
    combo_en_evento,
    ocurrido_en
)
SELECT
    sj.id_sesion_juego,
    te.id_tipo_evento,
    h.id_habilidad,
    500,
    300,
    10,
    sj.finalizada_en
FROM public.sesiones_juego sj
JOIN public.estudiantes e
    ON e.id_estudiante = sj.estudiante_id
JOIN public.tipos_evento te
    ON te.nombre = 'nivel_completado'
JOIN public.habilidades h
    ON h.nombre = 'Lógica'
WHERE e.qr_token = 'qr_ana_garcia_001'
AND sj.puntaje = 950;

-- =============================================================
-- EVENTOS PARA SESION CON PUNTAJE 720
-- =============================================================

INSERT INTO public.eventos_sesion (
    sesion_id,
    tipo_evento_id,
    habilidad_id,
    tiempo_reaccion_ms,
    puntos,
    combo_en_evento,
    ocurrido_en
)
SELECT
    sj.id_sesion_juego,
    te.id_tipo_evento,
    h.id_habilidad,
    1100,
    40,
    2,
    sj.iniciada_en + INTERVAL '3 minutes'
FROM public.sesiones_juego sj
JOIN public.estudiantes e
    ON e.id_estudiante = sj.estudiante_id
JOIN public.tipos_evento te
    ON te.nombre = 'acierto'
JOIN public.habilidades h
    ON h.nombre = 'Lógica'
WHERE e.qr_token = 'qr_ana_garcia_001'
AND sj.puntaje = 720;

INSERT INTO public.eventos_sesion (
    sesion_id,
    tipo_evento_id,
    habilidad_id,
    tiempo_reaccion_ms,
    puntos,
    combo_en_evento,
    ocurrido_en
)
SELECT
    sj.id_sesion_juego,
    te.id_tipo_evento,
    h.id_habilidad,
    1700,
    0,
    0,
    sj.iniciada_en + INTERVAL '7 minutes'
FROM public.sesiones_juego sj
JOIN public.estudiantes e
    ON e.id_estudiante = sj.estudiante_id
JOIN public.tipos_evento te
    ON te.nombre = 'error'
JOIN public.habilidades h
    ON h.nombre = 'Lógica'
WHERE e.qr_token = 'qr_ana_garcia_001'
AND sj.puntaje = 720;

-- =============================================================
-- EVENTOS PARA SESION CON PUNTAJE 300
-- =============================================================

INSERT INTO public.eventos_sesion (
    sesion_id,
    tipo_evento_id,
    habilidad_id,
    tiempo_reaccion_ms,
    puntos,
    combo_en_evento,
    ocurrido_en
)
SELECT
    sj.id_sesion_juego,
    te.id_tipo_evento,
    h.id_habilidad,
    2100,
    0,
    0,
    sj.iniciada_en + INTERVAL '4 minutes'
FROM public.sesiones_juego sj
JOIN public.estudiantes e
    ON e.id_estudiante = sj.estudiante_id
JOIN public.tipos_evento te
    ON te.nombre = 'error'
JOIN public.habilidades h
    ON h.nombre = 'Lógica'
WHERE e.qr_token = 'qr_ana_garcia_001'
AND sj.puntaje = 300;

COMMIT;

-- =============================================================
-- DATOS COMPLETOS RELACIONADOS CON EL TUTOR
-- =============================================================

BEGIN;

-- =============================================================
-- CREAR GRUPO DEL TUTOR
-- =============================================================

INSERT INTO public.grupos (
    usuario_id,
    nombre,
    descripcion,
    activo,
    institucion_id
)
SELECT
    u.id_usuario,
    'Grupo Matemáticas 5A',
    'Grupo de pruebas estadísticas',
    true,
    u.institucion_id
FROM public.usuarios u
WHERE u.email = 'tutor@logickids.dev'
ON CONFLICT (usuario_id, nombre) DO NOTHING;

-- =============================================================
-- CREAR ESTUDIANTE
-- =============================================================

INSERT INTO public.estudiantes (
    nombre,
    edad,
    color_avatar,
    qr_token,
    estado_id,
    institucion_id
)
SELECT
    'Ana García',
    10,
    '#FF6B6B',
    'qr_ana_garcia_001',
    1,
    u.institucion_id
FROM public.usuarios u
WHERE u.email = 'tutor@logickids.dev'
ON CONFLICT (qr_token) DO NOTHING;

-- =============================================================
-- RELACIONAR ESTUDIANTE CON EL GRUPO DEL TUTOR
-- =============================================================

INSERT INTO public.estudiante_grupo_historial (
    estudiante_id,
    grupo_id,
    fecha_inicio,
    activo
)
SELECT
    e.id_estudiante,
    g.id_grupo,
    CURRENT_DATE,
    true
FROM public.estudiantes e
JOIN public.grupos g
    ON g.nombre = 'Grupo Matemáticas 5A'
JOIN public.usuarios u
    ON u.id_usuario = g.usuario_id
WHERE e.qr_token = 'qr_ana_garcia_001'
AND u.email = 'tutor@logickids.dev'
ON CONFLICT (
    estudiante_id,
    grupo_id,
    fecha_inicio
) DO NOTHING;

-- =============================================================
-- ESTADISTICAS - LOGICA
-- =============================================================

INSERT INTO public.estadisticas_habilidad (
    estudiante_id,
    habilidad_id,
    total_intentos,
    aciertos,
    errores,
    precision_pct,
    promedio_reaccion_ms,
    actualizado_en
)
SELECT
    e.id_estudiante,
    h.id_habilidad,
    40,
    34,
    6,
    85.00,
    1100,
    CURRENT_TIMESTAMP
FROM public.estudiantes e
JOIN public.habilidades h
    ON h.nombre = 'Lógica'
WHERE e.qr_token = 'qr_ana_garcia_001'

ON CONFLICT (estudiante_id, habilidad_id)
DO UPDATE SET
    total_intentos = EXCLUDED.total_intentos,
    aciertos = EXCLUDED.aciertos,
    errores = EXCLUDED.errores,
    precision_pct = EXCLUDED.precision_pct,
    promedio_reaccion_ms = EXCLUDED.promedio_reaccion_ms,
    actualizado_en = CURRENT_TIMESTAMP;

-- =============================================================
-- ESTADISTICAS - MEMORIA
-- =============================================================

INSERT INTO public.estadisticas_habilidad (
    estudiante_id,
    habilidad_id,
    total_intentos,
    aciertos,
    errores,
    precision_pct,
    promedio_reaccion_ms,
    actualizado_en
)
SELECT
    e.id_estudiante,
    h.id_habilidad,
    30,
    20,
    10,
    66.67,
    1400,
    CURRENT_TIMESTAMP
FROM public.estudiantes e
JOIN public.habilidades h
    ON h.nombre = 'Memoria'
WHERE e.qr_token = 'qr_ana_garcia_001'

ON CONFLICT (estudiante_id, habilidad_id)
DO UPDATE SET
    total_intentos = EXCLUDED.total_intentos,
    aciertos = EXCLUDED.aciertos,
    errores = EXCLUDED.errores,
    precision_pct = EXCLUDED.precision_pct,
    promedio_reaccion_ms = EXCLUDED.promedio_reaccion_ms,
    actualizado_en = CURRENT_TIMESTAMP;

-- =============================================================
-- ESTADISTICAS - ATENCION
-- =============================================================

INSERT INTO public.estadisticas_habilidad (
    estudiante_id,
    habilidad_id,
    total_intentos,
    aciertos,
    errores,
    precision_pct,
    promedio_reaccion_ms,
    actualizado_en
)
SELECT
    e.id_estudiante,
    h.id_habilidad,
    50,
    45,
    5,
    90.00,
    950,
    CURRENT_TIMESTAMP
FROM public.estudiantes e
JOIN public.habilidades h
    ON h.nombre = 'Atención'
WHERE e.qr_token = 'qr_ana_garcia_001'

ON CONFLICT (estudiante_id, habilidad_id)
DO UPDATE SET
    total_intentos = EXCLUDED.total_intentos,
    aciertos = EXCLUDED.aciertos,
    errores = EXCLUDED.errores,
    precision_pct = EXCLUDED.precision_pct,
    promedio_reaccion_ms = EXCLUDED.promedio_reaccion_ms,
    actualizado_en = CURRENT_TIMESTAMP;

COMMIT;