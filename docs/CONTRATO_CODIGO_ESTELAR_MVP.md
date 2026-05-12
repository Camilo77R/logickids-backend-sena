# Contrato MVP - Codigo Estelar

## 1. Que estamos construyendo

`Codigo Estelar` sera un minijuego multijugador por sala donde:

- cada estudiante juega desde su celular con su propio JWT de estudiante
- todos pertenecen a un grupo activo
- todos compiten sobre la misma partida de sala
- el servidor mantiene el ranking y decide el ganador
- al final cada estudiante guarda su propia `sesion_juego`

## 2. Idea clave

### Concepto: contrato

**Que es:** un acuerdo exacto entre movil, backend, sockets y DB.

**Analogia:** es como el plano de una casa. Si el electricista cree una cosa y el plomero otra, luego rompen la pared entre ellos.

**Cuando si:** siempre que frontend y backend trabajan en paralelo.

**Cuando no:** nunca debemos "improvisar" payloads en caliente en medio del desarrollo.

**Pareto:** si el contrato esta claro, los bugs dejan de ser "no se que paso" y pasan a ser "esta pieza incumplio esto".

## 3. Lo que ya dicta la verdad del sistema

La DB y el backend ya imponen varias reglas:

- `estudiantes.sesion_activa` debe estar en `true` para permitir jugar.
- el estudiante debe pertenecer a un `grupo` activo a traves de `estudiante_grupo_historial`.
- una partida individual se guarda en `sesiones_juego`.
- cada accion relevante se guarda en `eventos_sesion`.
- las estadisticas finales se consolidan en `estadisticas_habilidad`.
- el backend ya expone:
  - `POST /api/sesiones/iniciar`
  - `POST /api/sesiones/:id/eventos`
  - `POST /api/sesiones/:id/finalizar`

## 4. Decision de arquitectura para el viernes

Para el MVP del viernes vamos a hacer esto:

- una sola modalidad: `Codigo Estelar`
- un solo objetivo compartido por sala: `numeroObjetivo`
- una sola meta de victoria: `100 puntos`
- cada estudiante tiene su propia sesion individual en DB
- la sala compartida vive en memoria del servidor por ahora

No vamos a hacer todavia:

- persistencia de la sala multijugador
- reconexion compleja
- varios rounds con objetivos cambiantes
- anti-cheat perfecto

## 5. Regla de oro: que decide el cliente y que decide el servidor

### El cliente SI decide

- animaciones
- efectos visuales
- que meteoro toco el nino
- cuando mostrar explosion, brillo o corona local

### El cliente NO decide

- `estudianteId`
- `nombre`
- `grupoId` final
- `puntos`
- `esCorrecto`
- `comboOficial`
- `ranking`
- `ganador`

### El servidor decide

- quien es el estudiante autenticado
- si puede entrar a jugar
- a que sala pertenece
- si la clasificacion fue correcta
- cuantos puntos suma o resta
- cual es el combo oficial
- quien gano

## 6. Modelo mental correcto

- `sesion_juego` = partida individual del estudiante
- `room socket` = sala compartida del grupo

Analogia:

- `sesion_juego` es la libreta personal del estudiante
- `room socket` es el tablero del salon

No son la misma cosa.

## 7. Contrato HTTP

## 7.1 Iniciar sesion de juego

### Endpoint

`POST /api/sesiones/iniciar`

### Auth

`Authorization: Bearer <jwt_estudiante>`

### Request

```json
{
  "minijuego_id": 2
}
```

### Que valida el backend

- estudiante activo
- institucion activa
- grupo activo asignado
- `sesion_activa = true`
- minijuego activo

### Response deseada MVP

```json
{
  "success": true,
  "data": {
    "sesion": {
      "id": 145,
      "estado": "activo",
      "dificultad": 2,
      "minijuego_id": 2,
      "minijuego_slug": "codigo-estelar"
    },
    "realtime": {
      "room_key": "room:grupo_10:codigo_estelar",
      "socket_events": {
        "join": "codigo_estelar:join",
        "joined": "codigo_estelar:joined",
        "submit": "codigo_estelar:submit_answer",
        "leaderboard": "codigo_estelar:leaderboard_update",
        "game_over": "codigo_estelar:game_over",
        "error": "codigo_estelar:error"
      }
    },
    "game_config": {
      "numero_objetivo": 15,
      "meta_puntaje": 100,
      "permite_igual": true,
      "dificultad": 2,
      "rango_numeros": {
        "min": 0,
        "max": 50
      }
    }
  },
  "message": "Sesion de juego iniciada correctamente"
}
```

### Por que esta respuesta tiene sentido

- `sesion.id` conecta la partida individual con DB
- `room_key` conecta la partida con la sala compartida
- `game_config` le dice al movil como renderizar la ronda sin inventar valores

## 7.2 Registrar evento individual

### Endpoint

`POST /api/sesiones/:id/eventos`

### Auth

`Authorization: Bearer <jwt_estudiante>`

### Request

Este endpoint guarda eventos analiticos, no decide el ranking en tiempo real.

```json
{
  "tipo_evento": "acierto",
  "habilidad": "Logica",
  "tiempo_reaccion_ms": 1420,
  "puntos": 10,
  "combo_en_evento": 3
}
```

### Uso recomendado en MVP

- guardar `acierto`
- guardar `error`
- opcionalmente guardar `combo`

### Nota importante

El movil no deberia llamar este endpoint por cada frame o por cada animacion. Solo por eventos de negocio.

## 7.3 Finalizar sesion individual

### Endpoint

`POST /api/sesiones/:id/finalizar`

### Auth

`Authorization: Bearer <jwt_estudiante>`

### Request

```json
{
  "estado": "completado"
}
```

### Regla oficial

El cliente ya no decide:

- `puntaje`
- `aciertos`
- `errores`
- `combo_maximo`
- `dificultad`

El servidor calcula el resumen oficial leyendo `eventos_sesion` y conserva la
`dificultad` original con la que nacio la sesion.

Si un cliente viejo todavia manda esos campos, el backend los ignora.

### Response

```json
{
  "success": true,
  "data": {
    "id_sesion_juego": 145,
    "puntaje": 25,
    "aciertos": 2,
    "errores": 1,
    "combo_maximo": 2,
    "resumen_oficial": {
      "puntaje": 25,
      "aciertos": 2,
      "errores": 1,
      "combo_maximo": 2
    },
    "logros_desbloqueados": []
  },
  "message": "Sesion de juego finalizada correctamente"
}
```

## 8. Contrato Socket.IO

## 8.1 Handshake

### Cliente envia

```json
{
  "auth": {
    "token": "jwt_estudiante"
  }
}
```

### El servidor extrae y valida

- identidad del estudiante
- estado del estudiante
- institucion activa

### Regla

No usar `estudianteId` en `query` como verdad de negocio.

## 8.2 Unirse a la sala

### Evento cliente -> servidor

`codigo_estelar:join`

```json
{
  "sesionId": 145
}
```

### Que resuelve el servidor

- quien es el estudiante por JWT
- si esa `sesionId` le pertenece
- cual es su grupo activo
- cual es el `room_key`
- si la partida ya esta cerrada o no

### Evento servidor -> cliente

`codigo_estelar:joined`

```json
{
  "sesionId": 145,
  "player": {
    "id": 33,
    "nombre": "Samuel"
  },
  "room": {
    "key": "room:grupo_10:codigo_estelar",
    "grupoId": 10
  },
  "gameState": {
    "numeroObjetivo": 15,
    "metaPuntaje": 100,
    "estado": "playing",
    "leaderboard": [
      { "estudianteId": 33, "nombre": "Samuel", "puntaje": 0, "combo": 0 }
    ]
  }
}
```

## 8.3 Enviar clasificacion

### Evento cliente -> servidor

`codigo_estelar:submit_answer`

```json
{
  "sesionId": 145,
  "numeroMeteorito": 23,
  "clasificacionElegida": "mayor",
  "tiempoReaccionMs": 980
}
```

### Por que asi y no con `puntos`

Porque el cliente reporta lo que hizo, pero el servidor calcula el resultado oficial.

### Logica oficial del servidor

Con `numeroObjetivo = 15`:

- `23` + `mayor` => acierto
- `8` + `mayor` => error
- `15` + `igual` => acierto

### Evento servidor -> cliente

`codigo_estelar:leaderboard_update`

```json
{
  "sesionId": 145,
  "resultadoJugador": {
    "estudianteId": 33,
    "esCorrecto": true,
    "deltaPuntos": 10,
    "puntajeActual": 40,
    "comboActual": 3
  },
  "leaderboard": [
    { "estudianteId": 33, "nombre": "Samuel", "puntaje": 40, "combo": 3 },
    { "estudianteId": 34, "nombre": "Laura", "puntaje": 30, "combo": 1 }
  ]
}
```

### Decision clean

El servidor puede devolver `resultadoJugador` al que respondio y el mismo `leaderboard` a todos.

## 8.4 Termino de la partida

### Evento servidor -> sala

`codigo_estelar:game_over`

```json
{
  "motivo": "meta_alcanzada",
  "ganador": {
    "estudianteId": 33,
    "nombre": "Samuel",
    "puntaje": 100
  },
  "rankingFinal": [
    { "estudianteId": 33, "nombre": "Samuel", "puntaje": 100, "combo": 4 },
    { "estudianteId": 34, "nombre": "Laura", "puntaje": 85, "combo": 2 }
  ]
}
```

### Lo que hace el movil cuando recibe esto

- bloquea nuevas respuestas
- muestra victoria o derrota
- idealmente ya no necesita cerrar la sesion manualmente, porque el servidor la
  auto-finaliza al declarar `game_over`
- si por compatibilidad un cliente viejo todavia llama `POST /api/sesiones/:id/finalizar`,
  el endpoint responde de forma idempotente sin duplicar estadisticas

## 8.5 Error de negocio

### Evento servidor -> cliente

`codigo_estelar:error`

```json
{
  "code": "SESSION_NOT_ACTIVE",
  "message": "La sesion ya no esta activa"
}
```

## 9. Mapeo exacto con la DB

## 9.1 `minijuegos`

Sirve para identificar el juego y su habilidad principal.

Para este MVP necesitamos un registro como:

```json
{
  "slug": "codigo-estelar",
  "titulo": "Codigo Estelar",
  "habilidad": "Logica"
}
```

## 9.2 `sesiones_juego`

Una fila por estudiante por partida.

Campos clave:

- `estudiante_id`
- `minijuego_id`
- `dificultad`
- `puntaje`
- `aciertos`
- `errores`
- `combo_maximo`
- `estado_id`

## 9.3 `eventos_sesion`

Una fila por evento relevante.

Campos clave:

- `sesion_id`
- `tipo_evento_id`
- `habilidad_id`
- `tiempo_reaccion_ms`
- `puntos`
- `combo_en_evento`

## 9.4 `estadisticas_habilidad`

No la escribe el movil directamente.

Se actualiza cuando finaliza la sesion:

- `total_intentos`
- `aciertos`
- `errores`
- `precision_pct`
- `promedio_reaccion_ms`

## 9.5 `estudiante_grupo_historial`

Sirve para resolver a que sala pertenece el estudiante.

No hay que mandar eso manualmente desde el cliente como verdad final.

## 10. Campos que hoy faltan o hay que decidir

## 10.1 Catalogo `minijuegos`

Hoy el seed trae solo `logica-secuencias`.

Entonces para este contrato hace falta crear el minijuego:

- `slug = codigo-estelar`
- `titulo = Codigo Estelar`
- `habilidad_id = Logica` o la habilidad que ustedes definan oficialmente

## 10.2 Catalogo `tipos_evento`

Hoy existen:

- `acierto`
- `error`
- `combo`
- `nivel_completado`

Para el MVP nos alcanzan `acierto`, `error` y opcional `combo`.

Si luego quieren analitica mas rica, pueden agregar:

- `omision`
- `conexion`
- `victoria`
- `derrota`

## 11. Reglas de clean architecture para esta feature

## En movil

- `Screen`: solo UI nativa
- `Controller hook`: orquesta estado
- `WebView scene runtime`: solo juego y render
- `Socket client`: solo eventos realtime
- `HTTP service`: solo API REST

## En backend

- `socket.manager`: solo inicializa socket y middleware
- `codigoEstelar.handler`: traduce eventos socket
- `codigoEstelar.service`: logica del juego
- `memoryStore` o store: estado temporal de la sala

## 12. Resumen ejecutivo

Si quiere que esto quede solido:

1. el estudiante abre la partida por HTTP
2. el servidor crea `sesion_juego`
3. el cliente entra por socket solo con `sesionId`
4. el servidor resuelve grupo, sala y ranking
5. el cliente manda respuestas
6. el servidor calcula puntos y ganador
7. el servidor auto-finaliza las sesiones al cerrar la sala
8. el backend actualiza estadisticas y logros

Ese es el contrato correcto para que movil, backend, DB y sockets hablen el mismo idioma.
