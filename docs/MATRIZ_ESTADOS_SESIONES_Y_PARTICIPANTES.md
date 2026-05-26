# MATRIZ OFICIAL DE ESTADOS — SESION_JUEGO, PARTICIPANTE Y SESION_CLASE

## Objetivo

Cerrar de forma oficial las reglas de negocio sobre:

1. `sesion_juego`
2. `sesion_clase_participantes`
3. `sesion_clase`
4. casos borde como cierre manual, salida del estudiante o cierre abrupto de la app

Este documento existe para evitar que frontend, juegos o tutor web inventen semánticas distintas.

---

## Regla de oro

`sesion_juego` y `sesion_clase` no significan lo mismo.

- `sesion_juego`: la partida concreta de un estudiante en un minijuego
- `participante`: el avance de ese estudiante dentro de la clase
- `sesion_clase`: la actividad global abierta para el grupo

### Analogía

- `sesion_clase` = el salón de clase
- `participante` = la hoja de trabajo de cada niño dentro del salón
- `sesion_juego` = el intento puntual que ese niño está jugando

El salón puede seguir abierto aunque una hoja ya esté terminada.

---

## Significado oficial de estados

## 1. Estado de `sesion_juego`

- `activo`
  - el estudiante tiene una partida abierta y todavía no se ha cerrado oficialmente

- `completado`
  - la partida terminó de forma natural
  - esto incluye:
    - terminó y le fue bien
    - terminó y le fue mal

- `abandonado`
  - la partida se interrumpió antes de cerrarse normalmente
  - ejemplos:
    - el tutor cerró la clase mientras jugaba
    - el estudiante salió en mitad de la partida
    - se abrió una nueva sesión y la anterior seguía viva

## 2. Estado de `sesion_clase_participantes`

- `pendiente`
  - el estudiante todavía puede jugar el paso actual, pero no ha iniciado la partida

- `en_progreso`
  - el estudiante ya inició una partida del paso actual

- `completado`
  - el estudiante terminó toda su actividad dentro de esa `sesion_clase`
  - si era `single` de 1 nivel, ahí termina
  - si era `single` de varios niveles, esto pasa al cerrar el último
  - si era `path`, esto pasa al cerrar el último paso de la ruta

- `abandonado`
  - el estudiante ya no continúa esa actividad porque la interrumpió o fue interrumpida mientras jugaba

- `cerrado`
  - el estudiante nunca llegó a jugar ese paso, pero la clase fue cerrada desde afuera

## 3. Estado de `sesion_clase`

- `activa`
  - todavía existe al menos un participante `pendiente` o `en_progreso`

- `cerrada`
  - la clase se cerró manualmente o terminó naturalmente sin pendientes

- `cancelada`
  - se usó una clausura administrativa de mayor nivel
  - ejemplos:
    - archivado de grupo
    - reasignación de tutor

---

## Regla central: terminar mal no es abandonar

Si el estudiante jugó la ronda hasta el final, aunque falle el patrón o tenga errores, la `sesion_juego` debe cerrar como:

- `completado`

El mal desempeño vive en:

- `errores`
- `precision`
- `puntaje`
- `patronResuelto`

No vive en `abandonado`.

### Analogía

Perder un examen no significa abandonar el examen. Significa terminarlo con un mal resultado.

---

## Matriz oficial de casos

## Caso 1. El tutor abre una clase y el estudiante nunca entra

### Estado esperado

- `sesion_clase`: `activa`
- `participante`: `pendiente`
- `sesion_juego`: no existe

### Si luego el tutor cierra la clase

- `sesion_clase`: `cerrada`
- `participante`: `cerrado`
- `sesion_juego`: sigue sin existir

## Caso 2. El estudiante entra y comienza a jugar

### Estado esperado

- `sesion_clase`: `activa`
- `participante`: `en_progreso`
- `sesion_juego`: `activo`

## Caso 3. El estudiante termina un `single` de 1 nivel

### Estado esperado

- `sesion_juego`: `completado`
- `participante`: `completado`

### La `sesion_clase` depende del grupo

- si no quedan otros estudiantes `pendiente` o `en_progreso`:
  - `sesion_clase` debe cerrarse automáticamente

- si sí quedan otros:
  - `sesion_clase` sigue `activa`
  - pero este estudiante ya no debe aparecer jugable

## Caso 4. El estudiante termina un `single` de varios niveles

### Si termina un nivel intermedio

- `sesion_juego`: `completado`
- `participante`: vuelve a `pendiente`
- `paso_actual`: avanza al siguiente nivel
- `sesion_clase`: sigue `activa`

### Si termina el último nivel

- `sesion_juego`: `completado`
- `participante`: `completado`
- `sesion_clase`: se cierra solo si ya no quedan otros estudiantes pendientes

## Caso 5. El tutor cierra la clase mientras el estudiante está jugando

### Estado esperado

- `sesion_juego`: `abandonado`
- `participante`: `abandonado`
- `sesion_clase`: `cerrada` o `cancelada` según el motivo

## Caso 6. El tutor cierra la clase y el estudiante nunca había entrado

### Estado esperado

- `sesion_juego`: no existe
- `participante`: `cerrado`
- `sesion_clase`: `cerrada` o `cancelada`

## Caso 7. El estudiante sale explícitamente en mitad de la partida

### Estado esperado

- `sesion_juego`: `abandonado`
- `participante`: `abandonado`
- `sesion_clase`: puede seguir `activa` para otros

Nota:

si el producto deja un botón de salida en mitad de la partida, debe mapearse a esta semántica.

## Caso 8. La app se cierra de golpe o el proceso muere

### Política actual soportada

Hoy el backend no sabe instantáneamente que la app murió.

Entonces puede quedar temporalmente así:

- `sesion_juego`: `activo`
- `participante`: `en_progreso`
- `sesion_clase`: `activa`

Eso NO es un bug de semántica. Es una falta de política de recuperación en tiempo real.

### Qué pasa hoy si el estudiante reingresa

La política actual es:

- si vuelve a iniciar, la sesión activa anterior se abandona
- se abre una nueva `sesion_juego`
- el participante sigue desde el mismo paso si todavía era jugable

### Qué NO existe todavía

No existe aún:

- heartbeat de sesión
- timeout automático
- reanudación exacta de la misma `sesion_juego`

Eso sería una mejora formal posterior.

---

## Qué soporta el backend hoy sin forzar nada

Estas reglas YA están soportadas por el contrato y la lógica actual:

- `finalizar` acepta `completado` y `abandonado`
- `avanzarParticipacionSesionClase` marca:
  - `completado` si la actividad terminó naturalmente
  - `abandonado` si la finalización no fue `completado`
- `cerrarSesionClaseSiTermino` cierra la clase cuando no quedan participantes en:
  - `pendiente`
  - `en_progreso`

Entonces esta matriz no inventa estados nuevos.
Solo fija cómo deben usarse los existentes.

---

## Regla de lectura para frontend

## Dashboard infantil

`sesion_activa` debe leerse como:

- “este estudiante todavía puede jugar ahora mismo”

No como:

- “la clase del grupo sigue abierta en general”

## Tutor web

El tutor debe distinguir entre:

- clase del grupo abierta o cerrada
- estudiante todavía jugable o ya terminado

Un grupo puede verse con clase abierta y, al mismo tiempo, un estudiante puede verse:

- `completado`
- `abandonado`
- `cerrado`

Eso es correcto.

---

## Mejora futura recomendada

Cuando el flujo base ya esté sólido, la mejora sana es una política de recuperación:

1. heartbeat periódico desde el juego
2. timeout de sesiones atascadas
3. cierre automático de `sesion_juego` huérfanas
4. actualización realtime para tutor/dashboard

Eso sí puede apoyarse luego en sockets o eventos en vivo.

Pero no debe entrar antes de cerrar esta matriz base.

---

## Decisión oficial vigente

Para este proyecto, desde hoy:

- terminar la ronda normalmente = `completado`
- salir o interrumpirse antes del cierre normal = `abandonado`
- no haber alcanzado a entrar cuando la clase se cierra = `cerrado`

Si el producto quiere una categoría futura como:

- `completado con éxito`
- `completado con dificultad`
- `reprobado`

eso ya requerirá una evolución formal de dominio y no debe improvisarse desde frontend.
