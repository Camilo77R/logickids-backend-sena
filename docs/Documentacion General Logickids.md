# LogicKids

## Plataforma Educativa Multitenant para el Desarrollo Cognitivo Infantil

---

# 1. Introducción

LogicKids es una plataforma educativa diseñada para apoyar el desarrollo cognitivo infantil mediante minijuegos interactivos, análisis estadístico y recomendaciones pedagógicas inteligentes.

El sistema fue construido bajo una arquitectura multitenant, permitiendo que múltiples instituciones educativas utilicen la misma plataforma de manera segura, manteniendo completamente separados sus datos y usuarios.

La plataforma está orientada a:

* Instituciones educativas
* Tutores
* Niños en etapa de aprendizaje
* Seguimiento pedagógico
* Gamificación educativa
* Analítica de desempeño cognitivo

---

# 2. Problema que resuelve

En muchos entornos educativos:

* No existe seguimiento personalizado del progreso cognitivo infantil.
* Los resultados de actividades suelen perderse.
* Los docentes no tienen métricas claras sobre habilidades cognitivas.
* Las instituciones necesitan controlar quién accede a la plataforma.
* No existe separación clara entre gestión institucional y gestión pedagógica.

LogicKids busca solucionar esto mediante:

* Gestión institucional centralizada
* Seguimiento individual de estudiantes
* Minijuegos educativos
* Estadísticas automáticas
* Recomendaciones pedagógicas inteligentes
* Arquitectura segura multitenant

---

# 3. Objetivo General

Desarrollar una plataforma educativa multitenant que permita gestionar instituciones, tutores y estudiantes, integrando minijuegos cognitivos, analítica de rendimiento y recomendaciones pedagógicas inteligentes.

---

# 4. Arquitectura Conceptual

## Separación de responsabilidades

Uno de los principales enfoques del proyecto fue separar claramente las responsabilidades del sistema.

### Superadmin

Responsabilidad:

* Crear instituciones
* Supervisión global
* Gestión multitenant
* Administración general de la plataforma

El superadmin tiene acceso global a todas las instituciones.

---

### Admin Institucional

Responsabilidad:

* Aprobar tutores
* Activar/desactivar usuarios
* Validar pertenencia institucional
* Controlar acceso dentro de la institución

El administrador institucional NO participa en procesos pedagógicos.

Su función es garantizar el control y seguridad institucional.

---

### Tutor

Responsabilidad:

* Crear grupos
* Registrar estudiantes
* Abrir y cerrar sesiones
* Ejecutar actividades
* Consultar estadísticas
* Analizar recomendaciones pedagógicas

El tutor administra toda la experiencia educativa.

---

### Estudiante

Responsabilidad:

* Ingresar mediante QR
* Participar en minijuegos
* Generar eventos de aprendizaje
* Consultar progreso personal

---

# 5. Flujo General del Sistema

```text
1. El superadmin crea una institución.
2. El sistema genera automáticamente un administrador institucional.
3. Un tutor se registra.
4. El tutor queda pendiente de aprobación.
5. El administrador valida que pertenezca realmente a la institución.
6. El tutor ingresa a la plataforma.
7. El tutor crea grupos.
8. El tutor registra estudiantes.
9. El tutor abre una sesión de juego.
10. Los estudiantes ingresan desde dispositivos móviles mediante QR.
11. Los minijuegos generan eventos.
12. Los eventos alimentan estadísticas y recomendaciones pedagógicas.
```

---

# 6. Arquitectura Técnica

## Backend

Tecnologías utilizadas:

* Node.js
* Express.js
* PostgreSQL
* Knex.js
* JWT
* Zod
* Google Gemini API

Arquitectura por capas:

```text
Routes
→ Controllers
→ Services
→ PostgreSQL
```

La lógica de negocio se encuentra centralizada en los servicios.

---

## Frontend

Tecnologías utilizadas:

* React
* Vite
* React Router DOM
* React Bootstrap
* Chart.js
* Framer Motion
* Lucide React

El frontend utiliza:

* Context API para autenticación
* Rutas protegidas por rol
* Dashboards dinámicos
* Servicios HTTP desacoplados

---

# 7. Arquitectura Multitenant

LogicKids implementa una arquitectura multitenant para garantizar que cada institución tenga aislamiento total de datos.

## Objetivo del multitenant

Evitar que usuarios de una institución puedan acceder a información de otra institución.

---

## Jerarquía

```text
Superadmin
    │
    ├── Institución A
    │       ├── Admin Institucional
    │       ├── Tutor
    │       └── Estudiantes
    │
    └── Institución B
            ├── Admin Institucional
            ├── Tutor
            └── Estudiantes
```

---

## Seguridad de acceso

La seguridad está centralizada en:

```text
access.service.js
```

Este servicio aplica automáticamente:

* filtros por institución
* validación de ownership
* restricciones por rol
* protección de recursos

---

# 8. Módulos del Sistema

## 8.1 Autenticación

Funciones:

* Login
* Registro de tutores
* JWT
* Cambio de contraseña
* Gestión de perfiles

---

## 8.2 Administración

Funciones:

* Gestión de instituciones
* Gestión de tutores
* Activación y suspensión de usuarios

---

## 8.3 Grupos

Funciones:

* CRUD de grupos
* Apertura y cierre de sesiones
* Organización pedagógica

---

## 8.4 Estudiantes

Funciones:

* Registro de niños
* Login mediante QR
* Gestión de sesiones activas
* Traslado entre grupos

---

## 8.5 Sesiones de Juego

Funciones:

* Inicio de partidas
* Registro de eventos
* Finalización de sesiones
* Historial de actividades

---

## 8.6 Logros

Funciones:

* Gamificación
* Desbloqueo automático
* Motivación del estudiante

---

## 8.7 Estadísticas

Funciones:

* Métricas por habilidad cognitiva
* Precisión
* Rendimiento histórico
* Media ponderada

---

## 8.8 Recomendaciones IA

Funciones:

* Análisis pedagógico
* Recomendaciones automáticas
* Integración con Gemini

---

## 8.9 Minijuegos

Funciones:

* Gestión de catálogo
* Asociación por habilidad cognitiva
* Activación/desactivación

---

# 9. Adaptación Inteligente

El sistema ajusta automáticamente la dificultad de los minijuegos según el desempeño histórico del estudiante.

## Niveles de dificultad

```text
Precisión ≥ 85% → Nivel 4
Precisión ≥ 65% → Nivel 3
Precisión ≥ 40% → Nivel 2
Precisión < 40% → Nivel 1
```

Esto permite personalizar la experiencia de aprendizaje.

---

# 10. Base de Datos

El sistema utiliza PostgreSQL con una estructura relacional normalizada.

Principales entidades:

* instituciones
* usuarios
* grupos
* estudiantes
* sesiones_juego
* eventos_sesion
* estadísticas_habilidad
* logros
* recomendaciones
* minijuegos

Actualmente el sistema cuenta con 16 tablas principales.

---

# 11. Características Destacadas

## Seguridad Multitenant

Separación total de datos entre instituciones.

---

## Arquitectura Escalable

Separación por capas y módulos desacoplados.

---

## Analítica Cognitiva

Seguimiento estadístico del desempeño infantil.

---

## Gamificación

Sistema de logros y recompensas.

---

## Inteligencia Artificial

Recomendaciones pedagógicas automáticas.

---

## Adaptación Dinámica

Dificultad ajustada según desempeño.

---

# 12. Estado Actual del Proyecto

## Implementado

* Backend modular completo
* Sistema multitenant
* Gestión institucional
* Gestión pedagógica
* Estadísticas
* Logros
* Recomendaciones IA
* Dashboards de tutor y administración

---

## Pendiente

* Interfaz completa del estudiante
* Escaneo QR desde frontend
* Tests automatizados
* Swagger completo
* Recuperación de contraseña
* Paginación avanzada

---

# 13. Conclusión

LogicKids es una plataforma educativa diseñada bajo principios de arquitectura moderna, separación de responsabilidades y seguridad multitenant.

El sistema permite integrar:

* gestión institucional,
* experiencias educativas gamificadas,
* análisis estadístico,
* y recomendaciones inteligentes,

todo dentro de una única plataforma escalable y segura.

La separación entre administración institucional y gestión pedagógica fortalece la arquitectura del sistema y mejora la organización funcional de la plataforma.

Además, el enfoque en analítica cognitiva y adaptación dinámica convierte a LogicKids en una solución tecnológica orientada al seguimiento educativo personalizado.
