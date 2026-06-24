# Guia de Practicas de Testing por Capas

## Proposito

Esta guia explica la forma de trabajo usada en el backend de LogicKids para que
el equipo pueda repetirla en backend, frontend o movil con la herramienta que
corresponda.

## Principio central

No se escriben pruebas al azar. Primero se entiende el modulo, luego se sacan
sus casos de uso, reglas y riesgos. Despues se prueba por capas y se documenta
solo lo que esta verde.

## Flujo recomendado

1. identificar el area: backend, frontend o movil
2. listar modulos reales
3. extraer casos de uso
4. escribir reglas de negocio, reglas visuales o reglas de navegacion
5. revisar pruebas existentes
6. detectar huecos
7. priorizar por criticidad
8. escribir pruebas pequenas y repetibles
9. correr la capa afectada
10. correr la suite completa
11. actualizar documentacion

## Backend

Herramientas recomendadas:

1. `Vitest`
2. `Supertest`
3. `socket.io-client`
4. mocks para servicios externos

Practicas:

1. probar endpoints reales
2. validar codigos HTTP y contratos de respuesta
3. cubrir permisos, roles y multitenant
4. aislar integraciones externas con mocks
5. correr `npm run test:backend:full` antes de cerrar

## Frontend web

Herramientas posibles:

1. `Vitest`
2. `Testing Library`
3. `Playwright`

Practicas:

1. probar lo que el usuario ve y puede hacer
2. validar carga, error y exito
3. probar formularios con datos validos e invalidos
4. verificar rutas protegidas por rol
5. reservar end to end para flujos criticos

## Movil

Herramientas posibles:

1. pruebas unitarias del framework usado
2. pruebas de componentes
3. pruebas end to end compatibles con la app
4. pruebas manuales guiadas para camara, sensores o red local

Practicas:

1. probar arranque y navegacion base
2. probar acceso QR
3. validar bloqueo por estado real del backend
4. probar errores de red
5. verificar que el juego no inicie si el backend lo bloquea

## Orden de criticidad

1. seguridad y permisos
2. reglas de negocio criticas
3. flujo principal del usuario
4. estados de error
5. integraciones externas
6. detalles visuales o secundarios

## Regla de oro

Si una prueba falla, no se maquilla la documentacion. Primero se entiende si
falla el test, el dato, el ambiente o la logica real. Solo se cierra cuando el
comando queda verde.
