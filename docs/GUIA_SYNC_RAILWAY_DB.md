# 🚀 Guía: Sincronizar Base de Datos con Railway (PostgreSQL)

> Aplica cuando Railway tiene tablas vacías o desactualizadas y necesitás cargar
> el schema + datos base del repositorio.

---

## 🧰 Requisitos previos

| Herramienta | Cómo verificar |
|-------------|---------------|
| PostgreSQL instalado localmente | `psql --version` (debe responder) |
| Git Bash o terminal con acceso al repo | — |
| URL pública de Railway | Ver sección abajo |

### Dónde encontrar `psql` si no está en el PATH (Windows)

```
C:\Program Files\PostgreSQL\<versión>\bin\psql.exe
```

Ejemplo con versión 18:
```
C:\Program Files\PostgreSQL\18\bin\psql.exe
```

---

## 🔑 Obtener la URL pública de Railway

1. Entrá a [railway.app](https://railway.app) → tu proyecto
2. Click en el servicio **PostgreSQL**
3. Pestaña **"Connect"** → sección **"Public Networking"**
4. Copiá la URL que tenga `rlwy.net` en el host

> ⚠️ **NO uses la URL interna** (`postgres.railway.internal`). Solo funciona
> entre servicios dentro de Railway, no desde tu PC.

```
# URL interna ❌ (no funciona desde tu PC)
postgresql://postgres:xxxx@postgres.railway.internal:5432/railway

# URL pública ✅ (esta es la que necesitás)
postgresql://postgres:xxxx@metro.proxy.rlwy.net:32786/railway
```

---

## 📋 Flujo completo de sincronización

### Paso 1 — Aplicar el schema (estructura de tablas)

```powershell
# En PowerShell (desde la raíz del proyecto)
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" `
  "TU_URL_PUBLICA_RAILWAY" `
  -f "database/schema.sql"
```

```bash
# En Git Bash (si psql está en el PATH)
psql "TU_URL_PUBLICA_RAILWAY" -f database/schema.sql
```

✅ **Resultado esperado:** una línea `CREATE TABLE` por cada tabla + `COMMIT` al final.

> El schema usa `CREATE TABLE IF NOT EXISTS` → **es seguro, nunca borra datos existentes.**

---

### Paso 2 — Resetear secuencias (solo si hay datos viejos borrados)

Si Railway tenía datos anteriores que fueron borrados manualmente, las secuencias
de identidad quedan "sucias" (ej: empiezan en 7 en vez de 1) y el seed falla.

**Cómo detectarlo:**
```sql
-- Si esto devuelve un número > 1 y la tabla está vacía, hay problema
SELECT last_value FROM estados_usuario_id_estado_usuario_seq;
```

**Solución: resetear todas las secuencias**
```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" "TU_URL_PUBLICA_RAILWAY" -c "
ALTER SEQUENCE catalogo_logros_id_catalogo_logro_seq       RESTART WITH 1;
ALTER SEQUENCE estadisticas_habilidad_id_estadistica_seq   RESTART WITH 1;
ALTER SEQUENCE estados_estudiante_id_estado_estudiante_seq RESTART WITH 1;
ALTER SEQUENCE estados_sesion_id_estado_sesion_seq         RESTART WITH 1;
ALTER SEQUENCE estados_usuario_id_estado_usuario_seq       RESTART WITH 1;
ALTER SEQUENCE estudiante_grupo_historial_id_est_grupo_seq RESTART WITH 1;
ALTER SEQUENCE estudiantes_id_estudiante_seq               RESTART WITH 1;
ALTER SEQUENCE eventos_sesion_id_evento_sesion_seq         RESTART WITH 1;
ALTER SEQUENCE grupos_id_grupo_seq                         RESTART WITH 1;
ALTER SEQUENCE habilidades_id_habilidad_seq                RESTART WITH 1;
ALTER SEQUENCE instituciones_id_institucion_seq            RESTART WITH 1;
ALTER SEQUENCE logros_id_logro_seq                         RESTART WITH 1;
ALTER SEQUENCE minijuegos_id_minijuego_seq                 RESTART WITH 1;
ALTER SEQUENCE modelos_ia_id_modelo_ia_seq                 RESTART WITH 1;
ALTER SEQUENCE niveles_severidad_id_nivel_severidad_seq    RESTART WITH 1;
ALTER SEQUENCE recomendaciones_id_recomendacion_seq        RESTART WITH 1;
ALTER SEQUENCE roles_id_rol_seq                            RESTART WITH 1;
ALTER SEQUENCE sesiones_juego_id_sesion_juego_seq          RESTART WITH 1;
ALTER SEQUENCE solicitudes_reactivacion_id_solicitud_seq   RESTART WITH 1;
ALTER SEQUENCE tipos_evento_id_tipo_evento_seq             RESTART WITH 1;
ALTER SEQUENCE usuarios_id_usuario_seq                     RESTART WITH 1;
"
```

✅ **Resultado esperado:** 21 líneas `ALTER SEQUENCE`

---

### Paso 3 — Aplicar el seed (datos base)

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" `
  "TU_URL_PUBLICA_RAILWAY" `
  -f "database/seed.sql"
```

✅ **Resultado esperado:** ~22 líneas `INSERT 0 X` + `COMMIT` al final.

El seed inserta:
- Roles: `superadmin`, `admin`, `tutor`
- Estados de usuario, estudiante y sesión
- Habilidades cognitivas
- Catálogo de logros
- Minijuegos base (Código Estelar, Secuencias Lógicas)
- Usuario superadmin (`superadmin@logickids.dev` / `SuperAdmin2025!`)
- Institución, tutor y estudiante de prueba

---

### Paso 4 — Aplicar migraciones

Las migraciones se aplican **en orden cronológico** (por nombre de archivo):

```powershell
# Migración 1: tabla solicitudes_reactivacion
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" `
  "TU_URL_PUBLICA_RAILWAY" `
  -f "database/migrations/20260509_create_solicitudes_reactivacion_table.sql"

# Migración 2: minijuego Código Estelar
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" `
  "TU_URL_PUBLICA_RAILWAY" `
  -f "database/migrations/2026-05-11_add_codigo_estelar_minijuego.sql"
```

> ⚠️ El orden importa: la migración de Código Estelar necesita que el seed
> ya haya insertado la habilidad 'Lógica'.

✅ **Resultado esperado:** `DO` + `INSERT 0 1` + `COMMIT` por cada migración.
Los `NOTICE: relation already exists, skipping` **no son errores**.

---

## 🔍 Verificar que todo quedó bien

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" "TU_URL_PUBLICA_RAILWAY" -c "
SELECT 'roles'             AS tabla, COUNT(*) FROM roles
UNION ALL
SELECT 'usuarios',          COUNT(*) FROM usuarios
UNION ALL
SELECT 'habilidades',       COUNT(*) FROM habilidades
UNION ALL
SELECT 'minijuegos',        COUNT(*) FROM minijuegos
UNION ALL
SELECT 'estados_usuario',   COUNT(*) FROM estados_usuario;
"
```

**Resultado esperado:**

| tabla | count |
|-------|-------|
| roles | 3 |
| usuarios | 2 |
| habilidades | 5 |
| minijuegos | 2 |
| estados_usuario | 3 |

---

## ⚙️ Configurar el backend para apuntar a Railway

En el archivo `.env` del proyecto:

```env
DB_HOST=metro.proxy.rlwy.net
DB_PORT=32786
DB_USER=postgres
DB_PASSWORD=tu_password
DB_NAME=railway
NODE_ENV=development
```

O con la variable DATABASE_URL directa (si el backend la soporta):
```env
DATABASE_URL=postgresql://postgres:xxxx@metro.proxy.rlwy.net:32786/railway
```

---

## 🔄 Flujo para cuando lleguen nuevas migraciones del equipo

```bash
# 1. Traer últimos cambios del repo
git pull origin develop

# 2. Aplicar solo las migraciones nuevas (NO repetir schema ni seed)
psql "TU_URL" -f database/migrations/NUEVA_MIGRACION.sql
```

> 💡 El seed es idempotente (`ON CONFLICT DO NOTHING`) — podés volverlo a
> correr sin miedo, solo inserta lo que falta.

---

## ❗ Errores comunes y soluciones

| Error | Causa | Solución |
|-------|-------|----------|
| `command not found: psql` | psql no está en PATH | Usar ruta completa `"C:\Program Files\PostgreSQL\18\bin\psql.exe"` |
| `Cannot find package 'axios'` al arrancar Node | Dependencia nueva sin instalar | `npm install` en la raíz del proyecto |
| `Key (estado_id)=(1) is not present` | Secuencias desfasadas | Resetear secuencias (Paso 2) |
| `No existe la habilidad 'Lógica'` en migración | Seed no aplicado antes | Aplicar seed primero (Paso 3), luego migraciones |
| `NOTICE: relation already exists, skipping` | Tabla ya creada por schema | **No es error** — la migración lo detecta y salta |
| URL interna usada desde PC local | Confundir URL interna con pública | Usar URL con `rlwy.net`, no `railway.internal` |

---

## 📦 Resumen del orden correcto

```
1. schema.sql          ← Crea tablas (IF NOT EXISTS, seguro)
2. [opcional] RESET SEQUENCES  ← Solo si había datos viejos borrados
3. seed.sql            ← Inserta datos base (idempotente)
4. migrations/*.sql   ← En orden cronológico por nombre de archivo
```
