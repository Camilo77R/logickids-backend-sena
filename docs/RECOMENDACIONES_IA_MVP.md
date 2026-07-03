# Recomendaciones IA: flujo operativo MVP

## Objetivo

Generar recomendaciones pedagógicas con datos reales reduciendo llamadas a
Gemini. PostgreSQL es la fuente oficial y el dataset CSV es una exportación.

## Flujo

1. El estudiante juega y sus eventos actualizan `estadisticas_habilidad`.
2. El tutor solicita una recomendación individual o grupal.
3. El motor exige evidencia mínima y prioriza la habilidad con menor precisión.
4. Si la habilidad está cubierta por el catálogo local, se usa una plantilla.
5. Gemini solo se consulta cuando la habilidad no tiene una plantilla.
6. Si Gemini no está disponible, se usa el fallback local.
7. La recomendación, su origen, versión de reglas y snapshot se guardan en
   PostgreSQL.
8. `npm run dataset:export:recomendaciones` regenera los CSV desde la base.

## Orígenes posibles

- `plantilla`: recomendación local; no consume Gemini.
- `gemini`: respuesta producida por el proveedor de IA.
- `fallback`: respuesta local por ausencia o fallo de Gemini.
- `legacy`: recomendación anterior a la migración.
- `dataset`: reservado para una futura búsqueda de casos similares.

## Requisitos de evidencia

- Estudiante: mínimo 10 intentos en al menos una habilidad.
- Grupo: mínimo 3 estudiantes y 10 intentos por estudiante en la habilidad.

## Instalación

Aplicar antes de desplegar:

```powershell
psql "TU_URL" -f database/migrations/20260702_recommendations_mvp_traceability.sql
```

En Docker, `docker/init-db.sh` aplica automáticamente las migraciones.

Verificación del esquema y prueba del motor contra datos reales, sin crear ni
modificar recomendaciones:

```powershell
npm run db:audit:recomendaciones
npm run smoke:recomendaciones
```

El exportador descarta las recomendaciones masivas de `seed_demo.sql`; estas
permanecen en la base histórica, pero no se incluyen en el dataset.

## Componentes principales

- `src/domain/recomendaciones/recommendationEngineV1.js`: decisión determinista.
- `src/domain/recomendaciones/recommendationTemplates.js`: catálogo textual.
- `src/services/recommendationText.service.js`: acceso acotado a Gemini.
- `src/services/recomendaciones.service.js`: integración y persistencia.
- `scripts/export-recommendation-dataset.mjs`: exportación del dataset.

La validación manual del tutor y el modo sombra no forman parte de este flujo.
