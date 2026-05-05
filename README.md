# LogicKids - Backend API

> REST API para la plataforma educativa LogicKids. Gestion multitenant de instituciones, tutores, estudiantes y sesiones de juego con IA pedagogica integrada.

---

## Stack Tecnologico

| Herramienta | Uso |
|---|---|
| **Node.js + Express** | Servidor HTTP y rutas |
| **PostgreSQL + Knex** | Base de datos relacional + query builder |
| **Zod** | Validacion de esquemas y contratos de entrada |
| **JWT (jsonwebtoken)** | Autenticacion diferenciada: tutores y estudiantes |
| **bcrypt** | Hash seguro de contrasenas |
| **Gemini (Google AI)** | Motor de recomendaciones pedagogicas |

---

## Configuracion

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores reales

# 3. Crear el schema en PostgreSQL
psql -U postgres -d logickids -f database/schema.sql

# 4. Poblar catalogos base (roles, estados, habilidades, logros, etc.)
psql -U postgres -d logickids -f database/seed.sql

# 5. Arrancar en desarrollo
npm run dev
```

---

## Autenticacion

El sistema usa **dos tokens JWT distintos** con secrets separados:

| Token | Para | Secret env | Duracion |
|---|---|---|---|
| `Authorization: Bearer <token>` | Tutores, Admins, Superadmin | `JWT_SECRET` | 7 dias |
| `Authorization: Bearer <token>` | Estudiantes (QR) | `JWT_STUDENT_SECRET` | 4 horas |

### Jerarquia de roles

```
superadmin  ->  gestiona instituciones y minijuegos (acceso global)
   admin    ->  gestiona tutores de su institucion
   tutor    ->  gestiona grupos y estudiantes propios
 estudiante ->  accede via QR, solo ve sus propios datos
```

---

## Endpoints

### AUTH - /api/auth

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| GET | `/api/auth/instituciones` | Publica | Lista instituciones activas (para el desplegable de registro) |
| POST | `/api/auth/registro` | Publica | Registra tutor — queda inactivo hasta que admin lo active |
| POST | `/api/auth/login` | Publica | Login email + contrasena, devuelve JWT con rol |
| GET | `/api/auth/perfil` | JWT Tutor | Perfil del tutor autenticado |
| PUT | `/api/auth/perfil` | JWT Tutor | Actualiza nombre |
| PUT | `/api/auth/cambiar-contrasena` | JWT Tutor | Cambia contrasena verificando la actual |

**POST /api/auth/registro**
```json
// Request
{ "nombre": "Ana Gomez", "email": "ana@col.edu", "contrasena": "MiClave123", "institucion_id": 1 }

// Response 201
{ "success": true, "data": { "id_usuario": 5, "rol": "tutor" },
  "message": "Cuenta creada. Un administrador debe activarla antes de que puedas iniciar sesion." }
```

**POST /api/auth/login**
```json
// Request
{ "email": "tutor@col.edu", "contrasena": "MiClave123" }

// Response 200
{ "success": true, "data": { "token": "eyJ...", "usuario": { "id": 3, "rol": "tutor", "institucion_id": 1 } } }
```

---

### ADMIN - /api/admin

| Metodo | Ruta | Rol requerido | Descripcion |
|---|---|---|---|
| GET | `/api/admin/usuarios` | admin | Lista tutores de su institucion |
| GET | `/api/admin/usuarios/:id` | admin | Detalle de un tutor |
| PATCH | `/api/admin/usuarios/:id/estado` | admin | Activa o desactiva un tutor |
| GET | `/api/admin/instituciones` | superadmin | Lista todas las instituciones con conteo de tutores activos |
| POST | `/api/admin/instituciones` | superadmin | Crea institucion + admin automatico en transaccion atomica |
| DELETE | `/api/admin/instituciones/:id` | superadmin | Elimina institucion (solo si no tiene tutores) |
| GET | `/api/admin/minijuegos` | superadmin | Lista todos los minijuegos |
| PATCH | `/api/admin/minijuegos/:id/toggle` | superadmin | Activa o desactiva un minijuego globalmente |

**POST /api/admin/instituciones**
```json
// Request
{ "nombre": "Colegio San Marcos", "ciudad": "Bogota", "direccion": "Calle 10 #5-20", "telefono": "3001234567" }

// Response 201
{
  "success": true,
  "data": {
    "institucion": { "id": 3, "nombre": "Colegio San Marcos" },
    "admin": { "email": "admin.colegio.san.marcos@logickids.dev", "contrasena_temporal": "a3f8bc21" }
  }
}
```

**PATCH /api/admin/usuarios/:id/estado**
```json
// Request
{ "estado": "activo" }   // valores: "activo" | "inactivo" | "suspendido"

// Response 200
{ "success": true, "data": { "id": 7, "estado": "activo" } }
```

---

### GRUPOS - /api/grupos

> Requiere JWT de tutor. Cada tutor solo ve y modifica sus propios grupos.

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/grupos` | Lista grupos del tutor con indicador de sesion activa |
| POST | `/api/grupos` | Crea un grupo |
| GET | `/api/grupos/:id` | Detalle del grupo con lista de estudiantes activos |
| PUT | `/api/grupos/:id` | Edita nombre y descripcion |
| DELETE | `/api/grupos/:id` | Elimina (bloquea si tiene estudiantes activos) |
| PATCH | `/api/grupos/:id/sesion` | Abre o cierra la clase del grupo completo |

**POST /api/grupos**
```json
// Request
{ "nombre": "Grupo A", "descripcion": "Primer grado manana", "predeterminado": false }

// Response 201
{ "success": true, "data": { "id": 12, "nombre": "Grupo A", "predeterminado": false } }
```

**PATCH /api/grupos/:id/sesion**
```json
// Request
{ "sesion_activa": true }

// Response 200 - con estudiantes
{ "success": true, "data": { "actualizados": 5, "sesion_activa": true } }

// Response 422 - sin estudiantes activos
{ "success": false, "message": "No hay estudiantes activos en este grupo. Agrega estudiantes antes de abrir la clase." }
```

---

### ESTUDIANTES - /api/estudiantes

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| POST | `/api/estudiantes/login` | Publica | Login por QR token - devuelve JWT de estudiante |
| GET | `/api/estudiantes/mi-perfil` | JWT Estudiante | Dashboard personal del nino |
| GET | `/api/estudiantes` | JWT Tutor | Lista estudiantes activos (filtrar con ?grupo_id=) |
| POST | `/api/estudiantes` | JWT Tutor | Crea estudiante y lo asigna a un grupo |
| GET | `/api/estudiantes/:id` | JWT Tutor | Detalle de un estudiante |
| PUT | `/api/estudiantes/:id` | JWT Tutor | Edita nombre, edad y color de avatar |
| DELETE | `/api/estudiantes/:id` | JWT Tutor | Desactiva estudiante |
| PATCH | `/api/estudiantes/:id/reactivar` | JWT Tutor | Reactiva estudiante inactivo |
| GET | `/api/estudiantes/:id/qr` | JWT Tutor | Obtiene el QR token para imprimir |
| PATCH | `/api/estudiantes/:id/grupo` | JWT Tutor | Traslada a otro grupo (guarda historial con fecha_fin) |

**POST /api/estudiantes**
```json
// Request
{ "grupo_id": 3, "nombre": "Juanito Perez", "edad": 8, "color_avatar": "#F59E0B" }

// Response 201
{ "success": true, "data": { "id": 22, "nombre": "Juanito Perez", "sesion_activa": false, "grupo_id": 3 } }
```

**POST /api/estudiantes/login**
```json
// Request
{ "qr_token": "QR-ABC123-DEF456" }

// Response 200
{ "success": true, "data": { "token": "eyJ...", "estudiante": { "id": 22, "nombre": "Juanito", "sesion_activa": false } } }
```

---

### SESIONES DE JUEGO - /api/sesiones

> Iniciar y finalizar requieren JWT de estudiante. Historial y eventos requieren JWT de tutor.

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| POST | `/api/sesiones/iniciar` | JWT Estudiante | Inicia partida (verifica clase abierta, calcula dificultad IA) |
| POST | `/api/sesiones/:id/finalizar` | JWT Estudiante | Finaliza partida, actualiza stats y evalua logros |
| POST | `/api/sesiones/:id/eventos` | JWT Estudiante | Registra evento individual (acierto, error, combo) |
| GET | `/api/sesiones/estudiante/:id` | JWT Tutor | Historial de partidas de un estudiante |
| GET | `/api/sesiones/:id/eventos` | JWT Tutor | Detalle evento a evento de una partida |

**POST /api/sesiones/iniciar**
```json
// Request
{ "minijuego_id": 1 }

// Response 201
{ "success": true, "data": { "id_sesion_juego": 88, "dificultad": 2, "iniciada_en": "2025-05-05T03:00:00Z" } }

// Error 403 - clase no abierta
{ "success": false, "message": "Sesion no activa. El tutor debe abrir la clase primero." }
```

**POST /api/sesiones/:id/finalizar**
```json
// Request
{ "puntaje": 1200, "aciertos": 8, "errores": 2, "combo_maximo": 5, "dificultad": 2, "estado": "completado" }

// Response 200 - incluye logros desbloqueados para pantalla de resultados
{
  "success": true,
  "data": {
    "id_sesion_juego": 88,
    "puntaje": 1200,
    "aciertos": 8,
    "errores": 2,
    "combo_maximo": 5,
    "logros_desbloqueados": [
      { "clave_logro": "combo_5", "nombre_logro": "Combo x5", "icono": "fuego" }
    ]
  }
}
```

**POST /api/sesiones/:id/eventos**
```json
// Request
{ "tipo_evento": "acierto", "habilidad": "Logica", "tiempo_reaccion_ms": 820, "puntos": 100, "combo_en_evento": 3 }

// Response 201
{ "success": true, "data": { "id_evento_sesion": 441 } }
```

---

### LOGROS - /api/logros

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| GET | `/api/logros/catalogo` | Publica | Catalogo de logros activos. Con ?estudiante_id= marca cuales tiene |
| GET | `/api/logros/mis-logros` | JWT Estudiante | Logros desbloqueados del estudiante autenticado |
| GET | `/api/logros/estudiante/:id` | JWT Tutor | Logros de un estudiante especifico |

**GET /api/logros/catalogo?estudiante_id=22**
```json
{
  "success": true,
  "data": [
    { "clave": "primer_intento", "nombre": "Primer Paso", "icono": "objetivo", "desbloqueado": true },
    { "clave": "combo_5",        "nombre": "Combo x5",    "icono": "fuego",    "desbloqueado": false }
  ]
}
```

---

### ESTADISTICAS - /api/estadisticas

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| GET | `/api/estadisticas/mis-estadisticas` | JWT Estudiante | Precision y velocidad por habilidad del propio estudiante |
| GET | `/api/estadisticas/estudiante/:id` | JWT Tutor | Estadisticas de un estudiante especifico |
| GET | `/api/estadisticas/grupo/:id` | JWT Tutor | Promedios consolidados del grupo por habilidad |

**GET /api/estadisticas/estudiante/:id**
```json
{
  "success": true,
  "data": [
    { "habilidad": "Logica",  "precision_pct": "78.50", "total_intentos": 40, "aciertos": 31, "errores": 9,  "promedio_reaccion_ms": 640 },
    { "habilidad": "Memoria", "precision_pct": "55.00", "total_intentos": 20, "aciertos": 11, "errores": 9,  "promedio_reaccion_ms": null }
  ]
}
```

---

### RECOMENDACIONES IA - /api/recomendaciones

> Integra Google Gemini. Sin API key configurada usa respuesta simulada automaticamente.

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| POST | `/api/recomendaciones/generar/estudiante/:id` | JWT Tutor | Genera recomendacion personalizada para un estudiante |
| POST | `/api/recomendaciones/generar/grupo/:id` | JWT Tutor | Genera recomendacion consolidada para el grupo |
| GET | `/api/recomendaciones/estudiante/:id` | JWT Tutor | Historial de recomendaciones del estudiante |
| GET | `/api/recomendaciones/grupo/:id` | JWT Tutor | Historial de recomendaciones del grupo |

**POST /api/recomendaciones/generar/estudiante/:id**
```json
// Response 201
{
  "success": true,
  "data": {
    "id": 14,
    "mensaje": "El estudiante muestra dificultades en Memoria (55% de precision). Se recomienda...",
    "habilidad": "Memoria",
    "severidad": "media",
    "generado_en": "2025-05-05T03:00:00Z"
  }
}
```

---

### MINIJUEGOS - /api/minijuegos

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| GET | `/api/minijuegos` | Publica | Lista minijuegos activos |
| GET | `/api/minijuegos/:id` | Publica | Detalle de un minijuego |
| POST | `/api/minijuegos` | JWT Admin | Crea un minijuego |
| PATCH | `/api/minijuegos/:id/estado` | JWT Admin | Activa o desactiva minijuego |

---

## Arquitectura de carpetas

```
src/
  config/        -> db.js (Knex), env.js (variables validadas con Zod al arranque)
  middlewares/   -> auth.js, validate.js, errorHandler.js
  routes/        -> enrutadores por dominio
  controllers/   -> reciben req/res y delegan logica a services
  services/      -> logica de negocio y queries a la DB
    access.service.js  -> ownership checks centralizados (unico punto de verdad)
  schemas/       -> contratos de entrada con Zod por dominio
  utils/         -> response.js (contrato unificado), codes.js

database/
  schema.sql     -> DDL completo del schema
  seed.sql       -> datos catalogo base (idempotente con ON CONFLICT DO NOTHING)
```

---

## Seguridad multitenant

| Nivel | Como se implementa |
|---|---|
| Tutor solo ve sus grupos | assertGroupBelongsToUser() filtra por usuario_id |
| Admin solo ve su institucion | applyOwnershipFilter() filtra por institucion_id |
| Superadmin accede a todo | Sin filtro de ownership |
| Estudiante solo ve sus datos | JWT firmado con JWT_STUDENT_SECRET diferente al de tutores |
| Clase bloqueada | iniciar() verifica sesion_activa antes de crear partida |

---

## Contrato de respuesta estandar

Todos los endpoints usan el mismo formato:

```json
// Exito
{ "success": true, "data": { ... }, "message": "Descripcion del resultado" }

// Error controlado
{ "success": false, "message": "Descripcion del error" }

// Error de validacion Zod
{ "success": false, "message": "Datos de entrada invalidos", "errors": [{ "field": "email", "message": "..." }] }
```

---

## Credenciales iniciales (seed.sql)

| Usuario | Email | Contrasena |
|---|---|---|
| Superadmin | superadmin@logickids.dev | SuperAdmin2025! |

> IMPORTANTE: Cambiar la contrasena del superadmin antes de desplegar a produccion.
