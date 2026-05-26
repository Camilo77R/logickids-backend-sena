# FLUJO APP DEL NINO Y CONTRATO DE CAMINO AR

## Objetivo

Dejar claro:

1. que papel cumple `mi-perfil` en la app del nino
2. como debe verse el flujo `login -> dashboard -> juego`
3. donde entran `single`, `path`, logros y ranking
4. que configuracion adaptable debe recibir `Camino AR`

---

## Regla de oro

La app del nino **no decide**:

- si hay clase activa o no
- que minijuego toca
- que paso de la ruta esta desbloqueado
- cual es la configuracion oficial del nivel

La app del nino **si decide**:

- como presentar el dashboard
- como visualizar la ruta o actividad actual
- como renderizar el minijuego
- como mostrar feedback, logros y transiciones

---

## Papel de `mi-perfil`

`GET /api/estudiantes/mi-perfil` es el **contrato central del dashboard infantil**.

Su trabajo es decirle a la app:

- si el estudiante puede jugar ahora mismo
- si la actividad es `single` o `path`
- en que juego va
- en que bloque va
- en que nivel del bloque va

### Lectura correcta de `sesion_activa`

`sesion_activa` no significa:

- "la clase general del grupo sigue abierta"

`sesion_activa` significa:

- "este estudiante todavia puede jugar ahora mismo"

Eso es importante porque una clase puede seguir abierta para otros ninos, pero este nino ya pudo haber:

- completado su actividad
- abandonado
- quedado cerrado

En ese caso, para este nino `sesion_activa` debe ser `false`.

---

## Flujo correcto de la app del nino

## 1. Login con QR

La app autentica con:

`POST /api/estudiantes/login`

El backend responde con:

- `token`
- datos basicos del estudiante

Ese token habilita el resto del flujo infantil.

## 2. Dashboard infantil

Despues del QR, la app consulta:

`GET /api/estudiantes/mi-perfil`

El dashboard no deberia inventar el estado. Debe basarse en estos campos:

- `sesion_activa`
- `sesion_modo`
- `sesion_ruta_nombre`
- `sesion_total_pasos`
- `sesion_paso_actual`
- `sesion_bloque_actual`
- `sesion_nivel_en_bloque`
- `sesion_minijuego_slug`
- `sesion_minijuego_titulo`

### Si `sesion_activa = false`

La UI debe mostrar algo como:

- actividad no disponible
- esperando apertura del tutor

Y el boton de jugar debe quedar bloqueado.

### Si `sesion_activa = true`

La UI debe mostrar:

- actividad actual
- juego actual
- progreso general
- boton `Jugar`

## 3. Entrada al juego

Cuando el nino toca `Jugar`, la app llama:

`POST /api/sesiones/iniciar`

Y recibe:

- `sesion`
- `realtime`
- `game_config`

`game_config` es la configuracion oficial que debe consumir el juego.

## 4. Juego

El minijuego:

- renderiza con `game_config`
- registra eventos
- finaliza la sesion

## 5. Finalizacion

Al cerrar el nivel, la app llama:

`POST /api/sesiones/:id/finalizar`

Y backend responde con:

- `resumen_oficial`
- `logros_desbloqueados`
- `progreso_ruta`

### Si hay siguiente paso

La app debe mostrar:

- feedback del nivel
- logros desbloqueados si existen
- boton `Continuar`

### Si no hay siguiente paso

La app debe mostrar:

- cierre final de la actividad
- logros ganados
- opcion de volver al dashboard

---

## Como debe verse `single`

`single` significa:

- un solo minijuego
- varios niveles secuenciales del mismo minijuego

Ejemplo:

- `Camino AR`
- nivel 1 base
- nivel 2 adaptado
- nivel 3 adaptado

Para el nino esto se ve como una sola actividad continua.

No como tres juegos distintos.

---

## Como debe verse `path`

`path` significa:

- una ruta oficial
- varios juegos en orden
- cada juego con los niveles que defina backend en la ruta

Hoy la ruta oficial actual tiene:

- 5 juegos
- 1 nivel por juego

Entonces el nino juega:

1. Camino AR
2. Tren de Figuras
3. Robot Logico
4. Mercado Inteligente
5. Objeto Perdido

Si en el futuro una ruta tiene 2 niveles en un bloque, la app no cambia.
Solo cambia la definicion de la ruta en backend.

---

## Donde vive la vista de ruta

Hay dos opciones validas de UX:

1. la ruta se resume dentro del dashboard infantil
2. la ruta tiene una vista propia entre dashboard y juego

La regla importante no es la pantalla exacta.
La regla importante es esta:

- el nino debe ver que esta desbloqueado
- el nino no debe poder entrar a pasos futuros
- el progreso debe verse claro

Entonces la app puede mostrar:

- el camino completo
- el paso actual resaltado
- los pasos futuros bloqueados

---

## Logros

Los logros ya tienen contrato backend.

### Catalogo

`GET /api/logros/catalogo`

Sirve para conocer:

- que logros existen
- nombre
- descripcion
- icono

### Logros del estudiante

`GET /api/logros/mis-logros`

Requiere JWT de estudiante y devuelve:

- solo los logros que ya desbloqueo

### Logros inmediatos

Ademas, al finalizar una sesion backend ya devuelve:

- `logros_desbloqueados`

Entonces la app del nino debe manejar dos capas:

1. **Logro inmediato**
   - aparece al terminar un nivel o actividad
   - sale desde `logros_desbloqueados`

2. **Vista historica de logros**
   - una pantalla o seccion del dashboard
   - se alimenta con `mis-logros`

---

## Ranking

Hoy **no existe un contrato generico de ranking para todos los juegos**.

Lo que existe hoy es:

- ranking realtime especifico de `Codigo Estelar`

Eso significa:

- ranking no es bloqueo para integrar `Camino AR`
- ranking infantil general se puede modelar despues como feature aparte

Por ahora, la app del nino debe considerar ranking como:

- **no obligatorio**
- **no parte del contrato comun vigente**

---

## Contrato especifico de Camino AR

`Camino AR` evalua:

- `Memoria`

Su configuracion adaptable debe incluir como minimo:

- `longitud_patron`
- `duracion_destello_ms`
- `pausa_entre_destellos_ms`

Y opcionalmente despues:

- `cantidad_baldosas`
- `tiempo_limite_ms`
- `pistas_disponibles`
- `errores_permitidos`

### Que debe cambiar con adaptacion

Lo mas importante del requisito actual es:

- el patron cambia
- la velocidad cambia

Eso significa que el backend debe poder mandar, por ejemplo:

```json
{
  "longitud_patron": 5,
  "duracion_destello_ms": 550,
  "pausa_entre_destellos_ms": 180
}
```

La app no debe hardcodear esos valores como fuente final.

---

## Metadata sugerida para eventos de Camino AR

Ejemplos utiles:

```json
{
  "pattern_length": 4,
  "step_flash_ms": 700,
  "step_gap_ms": 180,
  "tile_index": 2,
  "expected_index": 2,
  "hint_used": false,
  "remaining_time_ms": 12000
}
```

No todos los eventos necesitan todos los campos.
La idea es dejar trazabilidad real de:

- que patron vio
- a que velocidad jugo
- que toco
- cuanto tiempo le quedaba

---

## Que sigue despues de este documento

## Paso 1

Cerrar la shell real de la app del nino:

- QR login
- guardar token
- consultar `mi-perfil`
- dashboard basado en backend real

## Paso 2

Integrar `Camino AR` al contrato nuevo:

- consumir `game_config`
- registrar eventos con metadata
- finalizar y leer `progreso_ruta`

## Paso 3

Agregar vista infantil de logros:

- logros recien desbloqueados
- historial de logros desbloqueados

## Paso 4

Disenar despues el ranking general si producto de verdad lo necesita

---

## Resumen ejecutivo

- `mi-perfil` es el contrato del dashboard infantil
- `single` se vive como un juego con varios niveles
- `path` se vive como una ruta oficial con varios juegos
- `Camino AR` debe consumir configuracion oficial del backend
- logros ya tienen base real en backend
- ranking general todavia no forma parte del contrato comun

---

## Referencia de estados

Para la matriz oficial de:

- actividad completada
- actividad abandonada
- actividad cerrada
- clase del grupo abierta vs jugabilidad del estudiante

ver:

- [MATRIZ_ESTADOS_SESIONES_Y_PARTICIPANTES.md](./MATRIZ_ESTADOS_SESIONES_Y_PARTICIPANTES.md)
