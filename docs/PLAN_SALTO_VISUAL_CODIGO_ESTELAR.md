# Plan de salto visual - Codigo Estelar

## 1. Objetivo

Dar el salto de:

- `MVP funcional`

a:

- `experiencia visual memorable para exposicion`

sin romper la base ya estable.

---

## 2. Idea clave

### Concepto: evolucion controlada

**Que es:** mejorar la presentacion sin volver a abrir los cimientos.

**Analogia:** primero se asegura la estructura del edificio; luego se trabaja la fachada, la iluminacion y el lobby.

**Pareto:** si mezclamos "hacerlo bonito" con "volver a tocar reglas", rompemos lo que ya sirve.

---

## 3. Lo que NO se debe tocar ahora

No conviene reabrir:

- contrato HTTP
- reglas del puntaje
- auth JWT
- sockets autoritativos
- cierre oficial de sesiones

Esos pilares ya estan validados.

---

## 4. Meta visual deseada

La direccion correcta para `Codigo Estelar` es:

- low poly
- atmosferico
- espacial
- claro de leer en celular
- visualmente "wow" en demo

### Traduccion a diseño

- meteoritos low poly
- numero objetivo flotando en centro
- zonas menor / igual / mayor con presencia visual fuerte
- fondo espacial con profundidad
- feedback de impacto al acertar o fallar
- ranking como HUD

---

## 5. Camino recomendado

### Fase 1 - Pulido sobre cliente actual

Objetivo:

- mejorar copy
- mejorar jerarquia visual
- pulir ganador/perdedor
- limpiar la vista de acceso

Riesgo:

- bajo

Valor:

- medio

### Fase 2 - Integracion visual seria con WebView/Babylon

Objetivo:

- usar un canvas/control visual mas expresivo
- preparar el camino al 3D real

Por que tiene sentido:

- su vision final ya apunta a Babylon
- parte del proyecto anterior ya exploro WebView
- el navegador/capa web ya demostro ser fuerte en red

Riesgo:

- medio

Valor:

- alto

### Fase 3 - Low poly espectacular para exposicion

Objetivo:

- dejar el minijuego con presencia visual potente

Componentes ideales:

1. `numero objetivo` como totem 3D central
2. `meteoritos` con formas simples y colores limpios
3. `plataformas/zonas` menor, igual, mayor
4. `particulas`
5. `explosion roja` al fallo
6. `brillo/halo` al acierto
7. `corona o sello` para el ganador

---

## 6. Arquitectura visual sugerida

### Opcion recomendada

`React Native shell + WebView + experiencia visual HTML/CSS/JS/Babylon`

### Por que

- separa UI nativa de experiencia 3D
- facilita animacion
- encaja con la direccion de Babylon que usted quiere
- reduce pelea con componentes nativos para la parte visual rica

### Regla

El `controller` sigue mandando:

- auth
- session start
- socket events
- game over

La capa visual recibe:

- `numeroObjetivo`
- `meteoritoActual`
- `feedback`
- `leaderboard`
- `estado del juego`

---

## 7. Backlog sugerido de salto visual

### BLOQ A - Congelar base

1. version estable subida
2. documentacion cerrada
3. demo reproducible

### BLOQ B - Refactor visual

1. extraer estado visual del cliente
2. definir contrato RN -> WebView
3. crear escena placeholder web

### BLOQ C - Low poly MVP

1. fondo espacial
2. objetivo central
3. meteorito actual
4. zonas menor / igual / mayor
5. feedback visual de acierto/error

### BLOQ D - Pulido expo

1. pantalla inicio mas limpia
2. pantalla final mas heroica
3. pequeno guion visual para presentar

---

## 8. Decisiones de calidad

### Que si

- pocos elementos pero intencionales
- tipografia fuerte
- contraste alto
- animaciones cortas pero significativas
- low poly limpio, no realismo pesado

### Que no

- meter 3D caotico
- demasiados textos al mismo tiempo
- sobrecargar con HUD confuso
- romper legibilidad por querer "verse gamer"

---

## 9. Criterio de exito

El salto visual valio la pena si:

1. el juego sigue funcionando igual de estable
2. un profesor entiende que pasa en 5 segundos
3. un companero dice "esto ya se siente como juego real"
4. el ranking y el ganador siguen siendo claros

---

## 10. Orden recomendado despues de esta fase

1. subir version estable
2. probar en otra PC
3. cerrar guia de demo
4. recien ahi abrir rama o fase de salto visual

### Regla de oro

Primero portabilidad.
Despues espectacularidad.

