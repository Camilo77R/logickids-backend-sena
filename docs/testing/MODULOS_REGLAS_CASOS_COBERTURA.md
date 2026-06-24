# Modulos, Reglas, Casos y Cobertura Backend

## Auth

Casos de uso:

1. iniciar sesion
2. consultar perfil
3. actualizar perfil
4. cambiar contrasena
5. registrar tutor

Reglas:

1. las credenciales invalidas devuelven error
2. un token falso o ausente no accede a rutas protegidas
3. una institucion inactiva bloquea registro/login segun corresponda
4. la contrasena nueva debe cumplir validaciones minimas

Cobertura:

1. `tests/auth.test.js`
2. `tests/tenant-security.test.js`

## Instituciones, roles y multitenant

Casos de uso:

1. superadmin gestiona instituciones
2. admin gestiona usuarios de su institucion
3. tutor gestiona grupos y estudiantes propios
4. estudiante accede solo a sus datos

Reglas:

1. un tenant no puede leer ni modificar datos de otro
2. los roles globales e institucionales no se mezclan
3. los tokens viejos dejan de servir si el estado real queda bloqueado

Cobertura:

1. `tests/tenant-security.test.js`
2. `tests/institution-centric-model.test.js`
3. `tests/lifecycle-rules.test.js`

## Ciclo de vida administrativo

Casos de uso:

1. activar/desactivar institucion
2. suspender/reactivar tutor
3. crear solicitudes de reactivacion
4. aprobar o rechazar solicitudes

Reglas:

1. no se reactiva algo que ya esta activo
2. no se desactiva algo ya desactivado
3. un tutor suspendido no debe acceder
4. una solicitud ya procesada no se procesa otra vez

Cobertura:

1. `tests/lifecycle-rules.test.js`
2. `tests/solicitudes-reactivacion.test.js`

## Grupos y estudiantes

Casos de uso:

1. crear y asignar grupos
2. mover estudiantes entre grupos
3. desactivar/reactivar estudiantes
4. consultar dashboard infantil
5. iniciar sesion por QR

Reglas:

1. un tutor solo ve estudiantes de su alcance
2. un estudiante desactivado no inicia sesion
3. una institucion desactivada bloquea acceso infantil
4. un estudiante no debe tener mas de un grupo activo simultaneo

Cobertura:

1. `tests/institution-centric-model.test.js`
2. `tests/student-access-operations.test.js`
3. `tests/student-dashboard.test.js`

## Sesiones y minijuegos

Casos de uso:

1. abrir clase
2. iniciar sesion de juego
3. registrar eventos
4. finalizar sesion
5. cerrar clase automaticamente o manualmente

Reglas:

1. no se inicia juego si la clase no esta abierta
2. el backend calcula resumen oficial desde eventos
3. finalizar de nuevo no debe duplicar historicos
4. una clase mixta conserva completados y cierra pendientes

Cobertura:

1. `tests/sesiones-codigo-estelar.test.js`
2. `tests/matriz-estados-sesiones.test.js`
3. `tests/codigo-estelar-sockets.test.js`

## Ranking y realtime

Casos de uso:

1. consultar ranking oficial
2. consultar mi posicion
3. emitir invalidaciones por socket
4. notificar cierre automatico

Reglas:

1. el desempate lo define el backend
2. el tutor recibe cambios de clase/ranking por socket
3. el socket respeta estado real de institucion, grupo y estudiante

Cobertura:

1. `tests/realtime-ranking.test.js`
2. `tests/codigo-estelar-sockets.test.js`

## Analitica, logros y recomendaciones

Casos de uso:

1. consultar estadisticas
2. acumular habilidades
3. desbloquear logros
4. crear recomendaciones
5. archivar recomendaciones

Reglas:

1. las estadisticas salen de sesiones finalizadas
2. los logros se reflejan en catalogo y progreso
3. las recomendaciones nacen de datos reales del estudiante o grupo

Cobertura:

1. `tests/analytics-achievements-recommendations.test.js`

## IA CSV e integraciones secundarias

Casos de uso:

1. leer catalogo CSV local
2. listar/borrar historial CSV
3. generar recomendaciones con IA mockeada
4. exportar estadisticas reales

Reglas:

1. los historiales se filtran sin tocar registros ajenos
2. el servicio externo se mockea para evitar dependencia real
3. el backend mantiene el contrato esperado por la integracion

Cobertura:

1. `tests/ia-csv-integration.test.js`
