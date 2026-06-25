# Guia para el Equipo - Testing por Capas en LogicKids

## Para que sirve esta guia

Esta guia es para que cualquier integrante del equipo pueda usar como referencia
el metodo que se aplico para cerrar las pruebas del backend. No significa que
todos deban volver a hacer backend. Backend ya quedo cerrado en esta rama y se
usa aqui como ejemplo real.

Si a un companero le toca frontend o movil, debe adaptar esta misma forma de
trabajo a su area: cambia la herramienta, cambian los archivos y cambian algunos
tipos de prueba, pero se conserva el metodo por capas.

## Idea principal

No se empieza escribiendo pruebas por escribir. Primero se responde:

1. que modulo voy a probar
2. que casos de uso tiene
3. que reglas debe cumplir
4. que puede romperse y afectar al usuario
5. que pruebas ya existen
6. que falta cubrir
7. que capa debo cerrar primero

Cuando eso esta claro, se escriben pruebas pequenas, repetibles y faciles de
ejecutar.

## Metodo que ya se uso para cerrar backend

Backend ya fue trabajado en esta rama con `Vitest`, `Supertest` y
`socket.io-client`. Esta seccion no es una orden para repetir backend desde cero;
es el ejemplo que deben mirar para entender como organizar cualquier area por
capas.

Flujo aplicado:

1. correr la suite actual
2. identificar fallos y huecos
3. listar modulos reales del backend
4. sacar casos de uso por modulo
5. escribir reglas de negocio por modulo
6. ordenar por criticidad
7. cerrar seguridad primero
8. avanzar capa por capa
9. correr la capa afectada
10. correr la suite completa
11. actualizar documentacion solo si todo queda verde

Regla:

```text
Una capa no esta cerrada porque tenga pruebas. Esta cerrada porque sus pruebas
pasan, la suite completa sigue verde y la documentacion coincide con lo probado.
```

## Como usar el backend como ejemplo

Estas fueron las herramientas usadas en backend:

1. `Vitest`
2. `Supertest`
3. `socket.io-client`
4. mocks para servicios externos

Lo que se probo en backend sirve como referencia para pensar pruebas en otras
areas:

1. endpoints reales
2. codigos HTTP
3. contratos de respuesta
4. permisos y roles
5. aislamiento multitenant
6. reglas de negocio
7. integraciones con mocks cuando dependan de servicios externos

Ejemplo de capa backend ya cerrada:

```text
Capa: seguridad y autenticacion
Modulo: auth
Regla: una peticion sin token no puede acceder a rutas protegidas
Prueba: GET /api/grupos devuelve 401 sin token
Comando: npm run test:capa1
Evidencia: prueba verde y suite completa verde
```

## Como adaptar el metodo si te toca frontend

Si tu trabajo es frontend, no copias los tests backend. Tomas la estructura de
capas y la adaptas a lo que el usuario ve y hace en la interfaz. La herramienta
puede ser distinta. Por ejemplo:

1. `Vitest`
2. `Testing Library`
3. `Playwright`
4. mocks de API

Lo importante es conservar la estructura por capas.

Capas sugeridas para frontend:

1. rutas principales y renderizado base
2. formularios y validaciones
3. flujos por rol
4. consumo de API, loading, error y exito
5. componentes criticos reutilizables
6. flujos end to end o regresion visual

Que debes probar:

1. lo que el usuario ve
2. lo que el usuario puede hacer
3. validaciones de formulario
4. mensajes de error
5. estados de carga
6. rutas protegidas
7. botones o acciones que dependan del rol

Ejemplo frontend:

```text
Capa: formularios y validaciones
Modulo: login
Regla: el usuario no debe enviar credenciales vacias
Prueba: muestra mensaje de validacion si email o contrasena estan vacios
Herramienta posible: Testing Library
Evidencia: test verde y suite frontend verde
```

## Como adaptar el metodo si te toca movil

Si tu trabajo es movil, tampoco repites backend. Tomas el metodo y lo llevas a
pantallas, navegacion, QR, errores de red y flujos conectados al backend. La
herramienta depende del framework usado por la app movil. Puede ser una
herramienta de pruebas unitarias, pruebas de componentes, end to end o pruebas
manuales guiadas cuando intervienen camara, sensores o red local.

Capas sugeridas para movil:

1. arranque de app y navegacion base
2. acceso por QR o login infantil
3. dashboard del estudiante
4. inicio de juego desde estado real
5. errores de red o backend no disponible
6. flujo completo conectado al backend

Que debes probar:

1. que la app abra correctamente
2. que navegue entre pantallas principales
3. que el QR funcione o falle con mensaje claro
4. que el juego no inicie si el backend lo bloquea
5. que los errores de red no rompan la app
6. que los datos mostrados coincidan con el backend

Ejemplo movil:

```text
Capa: acceso por QR
Modulo: login infantil
Regla: un QR invalido no debe abrir el dashboard
Prueba: al escanear QR invalido se muestra error y no se guarda sesion
Herramienta posible: test del framework movil o prueba end to end
Evidencia: prueba verde o checklist manual aprobado con captura/registro
```

## Como organizar cualquier prueba

Antes de escribir el test, llena mentalmente o por escrito esta ficha:

```text
Area:
Modulo:
Capa:
Caso de uso:
Regla:
Riesgo:
Herramienta:
Archivo de prueba:
Comando:
Resultado esperado:
Evidencia:
```

Ejemplo basado en backend, solo como referencia:

```text
Area: backend
Modulo: recomendaciones
Capa: analitica, logros y recomendaciones
Caso de uso: generar recomendacion para un estudiante
Regla: la recomendacion debe salir de estadisticas reales
Riesgo: que se recomiende informacion falsa o de otro estudiante
Herramienta: Vitest + Supertest
Archivo de prueba: tests/analytics-achievements-recommendations.test.js
Comando: npm run test:capa5
Resultado esperado: recomendacion creada desde datos reales
Evidencia: test verde y suite completa verde
```

## Orden recomendado de criticidad

Empieza por lo que mas dano puede causar si falla:

1. seguridad, login, permisos y roles
2. reglas de negocio criticas
3. flujo principal del usuario
4. estados de error
5. integraciones externas
6. detalles visuales o secundarios

No se debe empezar por pruebas faciles si hay riesgos mayores sin cubrir.

## Cuando una capa se puede cerrar

Una capa se puede cerrar cuando:

1. sus pruebas directas pasan
2. la suite completa del area sigue pasando
3. la documentacion fue actualizada
4. los archivos de prueba existen y son claros
5. los comandos para repetir la validacion estan documentados
6. no quedan huecos criticos conocidos en esa capa

Si algo falla, la capa queda abierta.

## Como documentar lo que hiciste

Cada vez que cierres una capa o agregues pruebas importantes, documenta:

1. que modulo tocaste
2. que reglas cubriste
3. que casos de uso probaste
4. que herramienta usaste
5. que comando corriste
6. que resultado dio
7. que queda pendiente

La documentacion debe poder responderle a otro companero:

```text
Que se probo?
Por que era importante?
Como lo puedo volver a correr?
Que archivo debo mirar?
Que falta?
```

## Que no se debe hacer

1. no crear pruebas solo por aumentar cantidad
2. no documentar como cerrado algo que no se ejecuto
3. no cambiar la logica para esconder un fallo
4. no mezclar frontend, backend y movil en una misma evidencia
5. no depender de servicios externos reales si se pueden mockear
6. no subir archivos basura o de otro modulo sin revisar
7. no resolver conflictos de `develop` a ciegas

## Como usar esta guia cuando llegue trabajo nuevo

Cuando llegue un cambio desde `develop` o una tarea nueva:

1. identifica si afecta backend, frontend o movil
2. revisa que modulo cambia
3. mira si cambia una regla o contrato
4. decide si pertenece a una capa existente o una nueva
5. agrega o ajusta pruebas
6. corre la capa afectada
7. corre la suite completa del area
8. actualiza la documentacion
9. deja claro que quedo pendiente

## Ejemplo real de esta rama backend

En esta rama se cerro backend con seis capas:

1. seguridad, autenticacion y multitenant
2. ciclo de vida institucional y administrativo
3. operacion academica base
4. sesiones, ranking y realtime
5. analitica, logros y recomendaciones
6. IA CSV e integraciones secundarias

Resultado verificado:

```text
15/15 archivos de prueba pasando
99/99 pruebas pasando
6/6 capas cerradas
```

Comando final:

```powershell
npm run test:backend:full
```

## Mensaje para el equipo

No tienen que repetir backend si no les corresponde. Backend queda como ejemplo
cerrado de como se hizo el proceso. Si el trabajo es frontend o movil, usen esta
guia para adaptar el mismo metodo: capas, reglas, criticidad, evidencia y cierre
solo cuando las pruebas pasen.
