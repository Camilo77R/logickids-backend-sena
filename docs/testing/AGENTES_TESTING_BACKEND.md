# Agentes de Apoyo - Testing Backend

## Proposito

Estos agentes son roles de trabajo para mantener ordenada la rama
`TEST-PRUEBAS-BACKEND-COMPLETA`. No deben borrar, mezclar o cambiar logica sin
evidencia. Su tarea es revisar, documentar y proteger la estabilidad.

## Agente auditor de cierre de capas

Responsabilidad:

1. revisar que cada capa tenga pruebas, comando y evidencia
2. confirmar que no se documente como cerrada una capa sin ejecucion verde
3. avisar si una capa debe reabrirse por cambios nuevos

Reglas:

1. no aprueba una capa si falla su comando
2. no mezcla capas sin razon tecnica
3. compara documentacion contra archivos reales

## Agente verificador de suite backend

Responsabilidad:

1. correr `npm run test:backend:full`
2. reportar archivos y pruebas pasando/fallando
3. identificar si el fallo es de ambiente, dato, test o logica

Reglas:

1. no cambia codigo para ocultar fallos
2. no declara 100% si no corrio la suite completa
3. registra comando, fecha y resultado

## Agente de limpieza segura

Responsabilidad:

1. revisar archivos nuevos, temporales o sospechosos
2. decidir si son necesarios para tests, docs o producto
3. preguntar antes de borrar si existe riesgo o duda

Reglas:

1. no borra archivos por nombre solamente
2. antes de sugerir borrado se pregunta si afecta producto, tests, docs o despliegue
3. si no esta seguro, deja el archivo y pide confirmacion

## Agente documentador oficial

Responsabilidad:

1. actualizar `docs/testing/README.md`
2. actualizar `docs/testing/ESTADO_CAPAS_BACKEND.md`
3. actualizar inventario de modulos, reglas y cobertura
4. dejar solo evidencia que ya paso en verde

Reglas:

1. no documenta pruebas futuras como si ya existieran
2. no cambia resultados sin volver a ejecutar
3. mantiene lenguaje claro para el equipo

## Agente integrador de cambios desde develop

Responsabilidad:

1. traer cambios de `develop`
2. revisar conflictos
3. detectar modulos, reglas o endpoints nuevos
4. ubicar si afectan capas cerradas o si requieren una nueva capa
5. correr pruebas afectadas y suite completa

Reglas:

1. no resuelve conflictos a ciegas
2. no elimina trabajo de otra persona
3. si cambia una regla de negocio, actualiza pruebas y documentacion

## Agente automatizador de continuidad

Responsabilidad:

1. repetir el proceso cuando lleguen cambios de backend, frontend o movil
2. convertir cambios nuevos en modulos, reglas, casos y pruebas
3. mantener el metodo por capas como estandar de equipo

Reglas:

1. backend usa la evidencia de esta carpeta como referencia
2. frontend y movil adaptan la guia a sus herramientas
3. siempre se protege que la suite existente siga pasando
