# Codigo Estelar - Version estable documentada (2026-05-11)

## 1. Estado actual

Esta version ya valida el vertical slice de `Codigo Estelar` de punta a punta:

- login del estudiante por `QR`
- apertura de sesion de juego por `HTTP`
- union a una sala compartida por `Socket.IO`
- ranking en vivo entre estudiantes del mismo grupo
- `game_over` autoritativo cuando alguien llega a la meta
- cierre oficial de cada `sesion_juego` en DB

### Resultado practico

Se probo con **2 celulares en la misma sala** y se confirmo:

- mismo `numeroObjetivo`
- mismo `room_key`
- ranking sincronizado
- ganador comun para todos
- bloqueo de nuevas respuestas cuando la partida ya cerro

---

## 2. Concepto clave

### Concepto: vertical slice

**Que es:** una funcionalidad completa que atraviesa UI, backend, realtime y base de datos.

**Analogia:** no es tener solo una puerta o solo una ventana; es tener una habitacion completa que ya se puede usar.

**Pareto:** aqui ya no hay solo maqueta. Hay flujo real jugable y persistido.

---

## 3. Repos y ramas

### Backend

- Repo: `C:\Users\Cristian\Escritorio\logickids-backend-sena`
- Rama: `feature/game-sockets`

### Mobile

- Repo: `D:\logickidsMobile`
- Rama: `feature/codigo-estelar-mobile`

---

## 4. Flow end-to-end oficial

Este es el flujo mas importante del sistema.

1. El estudiante entra con `qr_token`.
2. Mobile llama `POST /api/estudiantes/login`.
3. Backend devuelve `JWT de estudiante`.
4. Mobile resuelve el minijuego `codigo-estelar`.
5. Mobile llama `POST /api/sesiones/iniciar`.
6. Backend valida:
   - estudiante activo
   - institucion activa
   - grupo activo
   - clase abierta
   - minijuego existente
7. Backend crea `sesiones_juego` y devuelve:
   - `sesion`
   - `realtime`
   - `game_config`
8. Mobile abre `Socket.IO` con `auth.token`.
9. Mobile emite `codigo_estelar:join` con `sesionId`.
10. Backend verifica que esa sesion exista, pertenezca al estudiante y siga jugable.
11. Backend une al estudiante a `room:grupo_<id>:codigo_estelar`.
12. Al responder, mobile emite `codigo_estelar:submit_answer`.
13. Backend calcula puntaje oficial, combo y leaderboard.
14. Si alguien llega a la meta, backend emite `game_over`.
15. Backend auto-finaliza las sesiones de la sala.
16. Mobile muestra ganador/perdedor y permite revancha.

### Idea arquitectura

- `HTTP` abre la libreta del estudiante
- `Socket` mueve el tablero compartido de la sala
- `DB` deja evidencia historica

---

## 5. Backend - Que se agrego o cambio

### 5.1 Catalogo y datos base

- `database/seed.sql`
  - agrega `codigo-estelar` al catalogo de minijuegos
- `database/migrations/2026-05-11_add_codigo_estelar_minijuego.sql`
  - migracion idempotente para bases ya creadas
- `scripts/provision-codigo-estelar-demo.mjs`
  - crea escenarios demo reproducibles con tutor, grupo y estudiantes

### 5.2 Contrato y sesiones

- `docs/CONTRATO_CODIGO_ESTELAR_MVP.md`
  - contrato funcional del MVP
- `src/services/sesiones.service.js`
  - inicia sesion con `sesion + realtime + game_config`
  - calcula resumen oficial desde `eventos_sesion`
  - finaliza sesiones de forma autoritativa
  - soporta cierre idempotente
- `src/schemas/sesiones.schema.js`
  - schema compatible con el nuevo cierre autoritativo

### 5.3 Auth viva y multitenancy

- `src/services/auth-session.service.js`
  - resuelve contexto real del estudiante desde JWT
- `src/services/grupos.service.js`
- `src/controllers/grupos.controller.js`
  - correcciones de alcance por institucion/grupo
- `src/middlewares/auth.js`
  - alineado con la validacion viva del sistema

### 5.4 Realtime

- `src/games/codigoEstelar/codigoEstelar.config.js`
  - reglas del juego, room key, eventos y evaluacion
- `src/sockets/socket.manager.js`
  - handshake con JWT de estudiante
- `src/sockets/handlers/codigoEstelar.handler.js`
  - join, submit y disconnect
- `src/sockets/games/codigoEstelar/codigoEstelar.service.js`
  - cerebro realtime autoritativo
- `src/sockets/games/codigoEstelar/codigoEstelar.store.js`
  - estado en memoria por sala
- `src/sockets/socketError.utils.js`
  - adaptacion de errores de socket

### 5.5 CORS y diagnostico

- `src/config/cors.js`
  - politica centralizada de CORS para web local, LAN y Expo
- `src/app.js`
  - usa CORS centralizado
  - expone pagina debug en desarrollo
- `src/debug/codigoEstelarMobilePage.js`
  - pagina de diagnostico para:
    - `health`
    - `minijuegos`
    - `login QR`
    - `sesion HTTP`
    - `socket join`
- `src/middlewares/errorHandler.js`
  - errores CORS mas claros

### 5.6 Estadisticas y logros

- `src/services/estadisticas.service.js`
- `src/services/logros.service.js`
  - compatibles con transaccion de finalizacion autoritativa

### 5.7 Tests

- `tests/helpers/codigoEstelar.helper.js`
- `tests/sesiones-codigo-estelar.test.js`
- `tests/codigo-estelar-sockets.test.js`
- `test-sockets.js`

---

## 6. Mobile - Que se agrego o cambio

> Estas rutas son relativas al repo `D:\logickidsMobile`

### 6.1 Nueva feature Codigo Estelar

- `src/features/games/codigo-estelar/codigoEstelar.constants.js`
- `src/features/games/codigo-estelar/services/codigoEstelarApi.js`
- `src/features/games/codigo-estelar/services/codigoEstelarSocket.js`
- `src/features/games/codigo-estelar/useCodigoEstelarController.js`
- `src/features/games/codigo-estelar/CodigoEstelarScreen.jsx`

### 6.2 Integracion de pantalla

- `src/screens/DashboardScreen.jsx`
  - agrega entrada a `Codigo Estelar`
  - mantiene `Cazador de Estrellas`

### 6.3 Configuracion mobile

- `app.json`
  - `android.usesCleartextTraffic = true`
- `package.json`
- `package-lock.json`
  - agrega `socket.io-client`
- `.gitignore`
  - ignora `.expo-check-android/`

### 6.4 Nota importante sobre archivos existentes

El dashboard actual tambien importa:

- `src/features/games/cazador-estrellas/*`
- `src/services/sesiones.service.js`

Esos archivos aparecen como nuevos en Git y **si el dashboard los sigue usando, deben subirse tambien**. Si no se suben, el proyecto mobile puede quedar roto al instalarlo en otro equipo.

---

## 7. Data demo valida

### Grupo comun para jugar juntos

Estos QR pertenecen al mismo `grupo 99`, por eso si se usan entre si entran a la misma sala:

1. `QR-FEEZMU-ASD94J`
2. `QR-PPV822-XXWJN7`
3. `QR-HZL7VN-XHXWYD`
4. `QR-HLBWRS-RPAENH`
5. `QR-GLW999-RBG6D7`
6. `QR-XL2BCJ-64JNP9`

### QR de otro grupo

- `QR-DYQG3A-D6AN3F`

Ese pertenece a `grupo 98`, por eso no comparte sala con los de arriba.

---

## 8. Como correr esta version

### Backend

```bash
cd C:\Users\Cristian\Escritorio\logickids-backend-sena
npm install
npm run dev
```

### Tests backend

```bash
npm test
```

Estado al documentar esta version:

- `34 passed`

### Mobile - development build

```bash
cd D:\logickidsMobile
npx expo start --dev-client -c
```

### Mobile - preview build

```bash
cd D:\logickidsMobile
npx eas-cli build --platform android --profile preview
```

### API base sugerida en la red local

```text
http://192.168.31.80:3000/api
```

---

## 9. Verificaciones hechas

### Backend

- `npm test` -> `34 passed`
- login por QR
- apertura de sesion
- handshake socket con JWT
- join por `sesionId`
- score autoritativo
- cierre idempotente
- multitenancy y bloqueo por institucion/grupo/estudiante

### Mobile

- export Android exitosa con:

```bash
npx expo export --platform android --output-dir .expo-check-android
```

- prueba browser debug desde celular:
  - `health` ✅
  - `minijuegos` ✅
  - `login QR` ✅
  - `sesion HTTP` ✅
  - `socket join` ✅

### Demo real

- 2 celulares conectados a la misma sala
- ranking compartido
- ganador comun
- perdedor bloqueado despues de `game_over`

---

## 10. Riesgo de haber roto cosas anteriores

### Respuesta corta

El riesgo bajo mucho porque no dependemos solo de intuicion.

### Evidencia

- la suite completa de backend sigue pasando
- auth basica sigue pasando
- reglas de ciclo de vida siguen pasando
- seguridad tenant sigue pasando
- nuevo flujo de Codigo Estelar pasa

### Conclusion

No parece que los cambios de backend hayan roto lo existente de forma obvia.

Lo que si cambio de manera transversal fue:

- CORS
- manejo de sesiones de juego
- sockets

Por eso las pruebas y esta documentacion son parte del "seguro" tecnico antes de subir.

---

## 11. Que NO subir

### Backend

No subir:

- `lk-login-debug.err.log`
- `lk-login-debug.out.log`

Ya quedaron cubiertos por `.gitignore`.

### Mobile

No subir:

- `.expo-check-android/`

Ya quedo agregado al `.gitignore` del repo mobile.

---

## 12. Orden recomendado para subir a GitHub

### Backend

1. Revisar `git status`
2. Confirmar que no aparezcan logs basura
3. Commit de la rama `feature/game-sockets`
4. Push a GitHub

### Mobile

1. Revisar `git status`
2. Confirmar que no aparezca `.expo-check-android/`
3. Incluir:
   - `app.json`
   - `package.json`
   - `package-lock.json`
   - `src/screens/DashboardScreen.jsx`
   - `src/features/games/codigo-estelar/*`
   - archivos requeridos de `cazador-estrellas`
   - `src/services/sesiones.service.js`
   - `.gitignore`
4. Commit de la rama `feature/codigo-estelar-mobile`
5. Push a GitHub

---

## 13. Que sigue despues de subir esta version

1. Documentacion corta para exposicion
2. Guion de demo
3. Solo despues:
   - salto visual
   - low poly
   - Babylon/WebView si se decide

### Regla de oro

Primero se congela la version que funciona.
Despues se embellece.

