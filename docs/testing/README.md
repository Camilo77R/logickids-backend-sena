# Testing Backend LogicKids - Rama TEST-PRUEBAS-BACKEND-COMPLETA

## Objetivo

Esta carpeta documenta el cierre de pruebas automatizadas del backend de
LogicKids. El trabajo se organizo por capas, modulos reales, reglas de negocio
y evidencia ejecutable con `Vitest`.

## Estado actual

1. Rama de trabajo: `TEST-PRUEBAS-BACKEND-COMPLETA`
2. Runner: `Vitest`
3. Suite completa backend: `99/99` pruebas pasando
4. Archivos de prueba: `15/15` pasando
5. Capas cerradas: `6/6`
6. Ultima verificacion local: `2026-06-24`

## Como verificar

Desde la carpeta `logickids-backend-sena`:

```powershell
npm run test:capa1
npm run test:capa2
npm run test:capa3
npm run test:capa4
npm run test:capa5
npm run test:capa6
npm run test:backend:full
```

## Documentos principales

1. `ESTADO_CAPAS_BACKEND.md`: estado cerrado de cada capa y comandos.
2. `GUIA_PRACTICAS_TESTING_POR_CAPAS.md`: guia para que el equipo aplique el mismo metodo en backend, frontend o movil cambiando la herramienta segun el caso.
3. `MODULOS_REGLAS_CASOS_COBERTURA.md`: inventario backend de modulos, reglas, casos y pruebas.
4. `AGENTES_TESTING_BACKEND.md`: agentes definidos para auditoria, documentacion, limpieza, monitoria y continuidad.
5. `REPORTE_ENTREGA_TESTING_BACKEND.md`: resumen de lo subido, metodo usado, agentes, estado y pendientes.

## Regla principal

Solo se documenta como cerrado lo que fue ejecutado y paso en verde. Si llega
algo nuevo desde `develop`, primero se identifica el modulo afectado, luego se
actualizan pruebas y finalmente se actualiza esta documentacion.
