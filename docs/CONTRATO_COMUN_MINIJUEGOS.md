# CONTRATO COMUN DE MINIJUEGOS

## Objetivo

Definir el contrato **real y vigente** que deben consumir todos los minijuegos del proyecto.

Este documento existe para evitar dos problemas:

1. que cada compañero invente su propio flujo de integración
2. que el frontend o el juego decidan cosas pedagógicas que le corresponden al backend

## Regla de oro

El juego **no decide**:

- el orden de la ruta
- qué minijuego toca
- cuántos niveles tiene una ruta `path`
- la configuración final oficial de la partida

El juego **sí decide**:

- cómo renderiza la experiencia visual
- qué `metadata` específica envía en sus eventos
- cómo muestra feedback, transición y logros

---

## Catálogo oficial de producto

Hoy el catálogo visible y oficial es:

1. `camino-ar` → `Camino AR` → `Memoria`
2. `tren-figuras` → `Tren de Figuras` → `Patrones`
3. `robot-logico` → `Robot Lógico` → `Lógica`
4. `mercado-inteligente` → `Mercado Inteligente` → `Razonamiento`
5. `objeto-perdido` → `Objeto Perdido` → `Atención`

Notas:

- `codigo-estelar` y `logica-secuencias` existen para soporte interno / pruebas
- no hacen parte del catálogo visible del producto

---

## Semántica oficial de actividades

### `single`

`single` significa:

- un solo minijuego
- varios niveles secuenciales de ese mismo minijuego

Ejemplo:

```json
{
  "sesion_activa": true,
  "modo": "single",
  "minijuego_id": 5,
  "niveles": 3
}
```

Eso NO significa “una sola partida aislada”.
Significa: el backend expandirá esa actividad a varios niveles internos del mismo juego.

### `path`

`path` significa:

- una ruta pedagógica oficial
- compuesta por bloques y niveles ya definidos en backend

Ejemplo:

```json
{
  "sesion_activa": true,
  "modo": "path",
  "ruta_id": 1
}
```

Importante:

- hoy el frontend **no envía** bloques manuales
- hoy el frontend **solo selecciona** una ruta oficial

### Ruta completa oficial actual

La ruta oficial actual es `ruta-completa-habilidades`.

Hoy está configurada con:

- 5 bloques
- 5 pasos totales
- 1 nivel por minijuego

Orden actual:

1. `camino-ar`
2. `tren-figuras`
3. `robot-logico`
4. `mercado-inteligente`
5. `objeto-perdido`

Entonces, **hoy un `path` juega un nivel por minijuego y luego pasa al siguiente**.

Si mañana una ruta debe tener 2 niveles en un bloque, eso se cambia en backend/DB, no en el juego.

---

## Lo que NO existe como contrato público hoy

Esto **NO está vigente hoy**:

```json
{
  "sesion_activa": true,
  "modo": "path",
  "bloques": [
    { "minijuego_id": 5, "niveles": 2 },
    { "minijuego_id": 7, "niveles": 1 }
  ]
}
```

Ese shape podría existir más adelante para `path` personalizado, pero **no es el contrato actual**.

---

## Flujo común para cualquier minijuego

Todos los juegos deben seguir este orden:

1. login del estudiante
2. consultar `mi-perfil`
3. iniciar sesión de juego
4. registrar eventos
5. finalizar
6. leer `progreso_ruta` para decidir si mostrar `Continuar` o cierre final

---

## Endpoints comunes

## 1. Login del estudiante

`POST /api/estudiantes/login`

### Request

```json
{
  "qr_token": "QR-XXXXXX-XXXXXX"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "token": "jwt_estudiante",
    "estudiante": {
      "id": 10,
      "nombre": "Ana Garcia",
      "grupo_id": 4,
      "sesion_activa": true
    }
  },
  "message": "Sesión de estudiante iniciada correctamente"
}
```

## 2. Perfil infantil

`GET /api/estudiantes/mi-perfil`

Header:

`Authorization: Bearer <jwt_estudiante>`

Campos importantes para todos los juegos:

- `sesion_activa`
- `sesion_clase_id`
- `sesion_modo`
- `sesion_ruta_id`
- `sesion_ruta_slug`
- `sesion_ruta_nombre`
- `sesion_total_pasos`
- `sesion_paso_actual`
- `sesion_bloque_actual`
- `sesion_nivel_en_bloque`
- `sesion_participante_estado`
- `sesion_minijuego_id`
- `sesion_minijuego_slug`
- `sesion_minijuego_titulo`
- `sesion_configuracion_base`

Uso:

- si `sesion_activa` es `false`, el estudiante no debe poder iniciar juego
- si es `true`, el dashboard puede habilitar el botón `Jugar`

## 3. Catálogo de minijuegos

`GET /api/minijuegos`

Público.

Sirve para:

- tutor web
- catálogo visible
- mapping de slugs/títulos/habilidades

## 4. Catálogo de rutas pedagógicas

`GET /api/rutas-pedagogicas`

Requiere JWT de adulto (`tutor`, `admin`, `superadmin`).

Sirve para:

- que el tutor seleccione una ruta oficial
- que el frontend muestre preview de bloques y niveles

## 5. Abrir actividad desde tutor

`PATCH /api/grupos/:id/sesion`

### Caso `single`

```json
{
  "sesion_activa": true,
  "modo": "single",
  "minijuego_id": 1,
  "niveles": 3
}
```

### Caso `path`

```json
{
  "sesion_activa": true,
  "modo": "path",
  "ruta_id": 1
}
```

## 6. Iniciar una sesión de juego

`POST /api/sesiones/iniciar`

Requiere JWT de estudiante.

### Request

```json
{
  "minijuego_id": 1
}
```

Notas:

- `minijuego_id` es opcional si el contexto del estudiante ya define el paso actual
- el backend valida que coincida con el minijuego habilitado para ese paso

### Response común para todos los juegos

```json
{
  "success": true,
  "data": {
    "sesion": {
      "id": 123,
      "sesion_clase_id": 10,
      "estado": "activo",
      "dificultad": 2,
      "minijuego_id": 1,
      "minijuego_slug": "camino-ar",
      "modo": "single",
      "ruta_pedagogica_id": null,
      "orden_en_ruta": 1,
      "bloque_orden": 1,
      "nivel_en_bloque": 1
    },
    "realtime": {
      "room_key": null,
      "socket_events": {}
    },
    "game_config": {}
  },
  "message": "Sesión de juego iniciada correctamente"
}
```

### Significado

- `sesion`: contexto común y oficial del nivel actual
- `realtime`: room y eventos socket si el juego los necesita
- `game_config`: configuración final que el juego debe obedecer

## 7. Registrar eventos

`POST /api/sesiones/:id/eventos`

Requiere JWT de estudiante.

### Request base

```json
{
  "tipo_evento": "acierto",
  "habilidad": "Memoria",
  "tiempo_reaccion_ms": 850,
  "puntos": 10,
  "combo_en_evento": 2,
  "metadata": {}
}
```

### Qué cambia por juego

Solo `metadata`.

Ejemplos:

- `Camino AR`:
  - `tile_index`
  - `pattern_length`
  - `step_flash_ms`
- `Tren de Figuras`:
  - `pattern_type`
  - `selected_shape`
  - `expected_shape`
- `Objeto Perdido`:
  - `target_object`
  - `scan_time_ms`
  - `hint_used`

Regla:

- el shape base del evento es común
- la parte específica del juego vive dentro de `metadata`

## 8. Finalizar sesión

`POST /api/sesiones/:id/finalizar`

Requiere JWT de estudiante.

### Request

```json
{
  "estado": "completado"
}
```

o

```json
{
  "estado": "abandonado"
}
```

### Response importante

El backend devuelve:

- `resumen_oficial`
- `logros_desbloqueados`
- `progreso_ruta`

`progreso_ruta` es la pieza clave para navegación:

- si `haySiguientePaso = true`, el juego debe permitir `Continuar`
- si `haySiguientePaso = false`, el juego debe mostrar cierre final

---

## Qué deben asumir todos los compañeros

1. El juego no construye la ruta ni el orden.
2. El juego no decide cuál minijuego sigue.
3. El juego debe usar `game_config` como verdad.
4. El juego puede tener lógica propia de render/UI, pero no de orquestación pedagógica.
5. El juego puede enviar `metadata` propia, pero sin romper el shape base de eventos.
6. El juego debe finalizar y leer `progreso_ruta`.

---

## Contrato mínimo que necesita cada compañero

Cada compañero que implemente un minijuego necesita saber:

1. cuál es su `slug`
2. qué `habilidad` evalúa
3. cómo interpretar `game_config`
4. qué `metadata` enviará en eventos
5. cómo consumir `progreso_ruta`

Eso es suficiente para empezar a construir sin romper el flujo común.

---

## Qué sigue para Camino AR

Para `Camino AR`, el siguiente paso natural es:

1. consumir `mi-perfil`
2. iniciar con `POST /api/sesiones/iniciar`
3. usar `game_config`
4. registrar eventos con `metadata` propia de memoria/patrón
5. finalizar
6. mostrar `Continuar` o cierre según `progreso_ruta`

---

## Decisión vigente

La decisión oficial actual es:

- `single` -> `minijuego_id + niveles`
- `path` -> `ruta_id`

No estamos usando `path` personalizado todavía.

---

## Referencia de estados

Para la semántica oficial de:

- `sesion_juego`
- `participante`
- `sesion_clase`
- `completado` vs `abandonado` vs `cerrado`

ver:

- [MATRIZ_ESTADOS_SESIONES_Y_PARTICIPANTES.md](./MATRIZ_ESTADOS_SESIONES_Y_PARTICIPANTES.md)

Si eso se implementa después, será una evolución formal del contrato, no una improvisación desde frontend.
