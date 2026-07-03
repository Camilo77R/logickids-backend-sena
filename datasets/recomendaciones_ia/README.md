# Dataset inicial para recomendaciones IA

Este directorio deja una base ordenada para empezar a entrenar o evaluar el modelo de recomendaciones del proyecto.

## Objetivo

Separar el dataset en dos capas:

1. `observaciones`
   - filas con métricas reales por estudiante y habilidad
   - sirven para análisis, clustering, reglas y feature engineering

2. `ejemplos supervisados`
   - filas con contexto + recomendación histórica
   - sirven para fine-tuning, evaluación offline o RAG con ejemplos

## Estructura

- `schema/dataset_recomendaciones_template.csv`
  - plantilla manual para capturar nuevos ejemplos de alta calidad
- `exports/student_skill_observations.csv`
  - se genera desde PostgreSQL
- `exports/recommendation_examples.csv`
  - se genera desde PostgreSQL

## Cómo exportarlo

Desde la raíz del proyecto:

```powershell
npm run dataset:export:recomendaciones
```

La base de datos es la fuente oficial. Los CSV se regeneran desde PostgreSQL y
no deben usarse como almacenamiento operativo del módulo.

Cada recomendación nueva exporta también:

- `origen_generacion`: `plantilla`, `gemini`, `fallback` o legado
- `version_reglas`: versión del motor determinista
- `input_snapshot_json`: métricas y decisión utilizadas en ese momento

El exportador excluye las recomendaciones masivas creadas por `seed_demo.sql`.
Esos registros permanecen en PostgreSQL, pero no contaminan el dataset.

Salida por defecto:

```txt
datasets/recomendaciones_ia/exports/
```

También puedes cambiar la carpeta:

```powershell
node scripts/export-recommendation-dataset.mjs --out=tmp\\dataset
```

## Qué contiene cada archivo

### `student_skill_observations.csv`

Una fila por estudiante y habilidad con:

- identidad académica básica
- grupo e institución actual
- intentos, aciertos y errores
- precisión
- tiempo de reacción
- severidad sugerida por regla

Úsalo como tabla base de features.

### `recommendation_examples.csv`

Una fila por recomendación guardada en backend con:

- tipo de recomendación (`estudiante` o `grupo`)
- habilidad asociada
- precisión al momento registrada
- severidad
- modelo IA usado
- mensaje generado

Úsalo como tabla de labels o ejemplos objetivo.

## Limitación importante del dataset actual

Las recomendaciones históricas guardan `mensaje`, `habilidad`, `severidad` y `precision_momento`, pero no un snapshot completo de todas las métricas usadas para construir el prompt en ese instante.

Eso significa que:

- sí puedes arrancar ya con dataset supervisado
- pero el contexto histórico no es perfecto para entrenamiento fino
- para una siguiente iteración conviene guardar un `input_snapshot_json` por recomendación

## Siguiente mejora recomendada

Cuando generes una nueva recomendación, guarda además:

- métricas completas por habilidad
- grupo e institución
- versión del prompt
- origen del dato (`db`, `csv`, `manual`)
- validación humana de calidad

Con eso el dataset pasaría de "útil para arrancar" a "mucho más confiable para entrenamiento".
