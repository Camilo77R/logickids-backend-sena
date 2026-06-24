# Estado de Capas Backend - Vitest LogicKids

## Resumen

El backend queda cerrado en seis capas de criticidad. La suite completa fue
verificada localmente el `2026-06-24` con:

```powershell
npm run test:backend:full
```

Resultado:

1. `15/15` archivos de prueba pasando
2. `99/99` pruebas pasando
3. `6/6` capas cerradas

## Capa 1 - Seguridad, autenticacion y multitenant

Comando:

```powershell
npm run test:capa1
```

Suites:

1. `tests/auth.test.js`
2. `tests/tenant-security.test.js`

Cubre:

1. login, perfil y cambio de contrasena
2. registro y listado publico de instituciones
3. endpoints protegidos sin token
4. roles `superadmin`, `admin`, `tutor` y estudiante
5. aislamiento real entre instituciones

## Capa 2 - Ciclo de vida institucional y administrativo

Comando:

```powershell
npm run test:capa2
```

Suites:

1. `tests/lifecycle-rules.test.js`
2. `tests/solicitudes-reactivacion.test.js`
3. `tests/institution-centric-model.test.js`

Cubre:

1. activacion y desactivacion de instituciones
2. bloqueo de tokens antiguos cuando cambia el estado
3. solicitudes de reactivacion
4. creacion de admins, tutores, grupos y asignaciones
5. reglas de suspension/reactivacion

## Capa 3 - Operacion academica base

Comando:

```powershell
npm run test:capa3
```

Suites:

1. `tests/student-dashboard.test.js`
2. `tests/student-access-operations.test.js`
3. `tests/sesiones-codigo-estelar.test.js`

Cubre:

1. acceso infantil por QR
2. dashboard del estudiante
3. bloqueo por estudiante, grupo o institucion inactiva
4. inicio y cierre de sesiones de juego
5. calculo oficial de resumen desde eventos del backend

## Capa 4 - Sesiones, matriz de estados, ranking y realtime

Comando:

```powershell
npm run test:capa4
```

Suites:

1. `tests/matriz-estados-sesiones.test.js`
2. `tests/realtime-ranking.test.js`
3. `tests/codigo-estelar-sockets.test.js`

Cubre:

1. cierre automatico y manual de clases
2. participantes completados, pendientes y abandonados
3. ranking oficial por sesion
4. desempates y posicion del estudiante
5. eventos por socket y bloqueo cuando cambia el estado real

## Capa 5 - Analitica, logros y recomendaciones

Comando:

```powershell
npm run test:capa5
```

Suites:

1. `tests/analytics-achievements-recommendations.test.js`

Cubre:

1. estadisticas oficiales de estudiante y grupo
2. acumulados por habilidad
3. media ponderada de reaccion
4. desbloqueo de logros oficiales
5. recomendaciones de estudiante y grupo
6. archivado de recomendaciones

## Capa 6 - Integraciones secundarias e IA CSV

Comando:

```powershell
npm run test:capa6
```

Suites:

1. `tests/ia-csv-integration.test.js`

Cubre:

1. lectura de catalogo CSV local
2. historial CSV filtrado
3. borrado sin tocar registros ajenos
4. recomendaciones usando servicio IA mockeado
5. exportacion de estadisticas reales hacia IA

## Criterio de cierre

Una capa se considera cerrada solo si:

1. su comando individual pasa
2. la suite completa sigue pasando
3. la documentacion se actualiza
4. no quedan huecos criticos conocidos en esa capa
