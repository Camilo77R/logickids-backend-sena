# README - Funcionalidad Recomendaciones IA

## 1. Objetivo

Este documento explica como levantar y probar la funcionalidad `Recomendaciones IA` en otro equipo.

La funcionalidad permite que un tutor:

- genere recomendaciones individuales desde datos del backend
- genere recomendaciones grupales desde datos del backend
- ejecute un flujo `CSV + FastAPI` para obtener recomendaciones desde el archivo `datos_estudiantes.csv`

---

## 2. Arquitectura de la funcionalidad

La solucion trabaja con 3 piezas:

1. `Frontend React`
   - muestra la vista `Recomendaciones IA`
   - permite seleccionar grupo y estudiante
   - permite ejecutar el flujo `CSV + FastAPI`

2. `Backend Node + Express`
   - autentica al tutor
   - expone endpoints de recomendaciones
   - lee el archivo `datos_estudiantes.csv`
   - filtra por grupo o estudiante
   - envia el CSV al microservicio FastAPI

3. `Microservicio FastAPI`
   - recibe un archivo CSV
   - analiza el rendimiento del estudiante
   - construye un prompt pedagogico
   - llama el modelo de IA
   - devuelve recomendaciones

---

## 3. Estructura relacionada

Archivos principales:

- `logickids-frontend-sena/src/pages/tutor/TutorRecomendacionesPage.jsx`
- `logickids-frontend-sena/src/services/recomendacionesService.js`
- `src/routes/ia.routes.js`
- `src/services/ia.service.js`
- `ia_service/main.py`
- `ia_service/analizador.py`
- `ia_service/requirements.txt`
- `datos_estudiantes.csv`

---

## 4. Requisitos previos

Instalar en el equipo:

- `Node.js` 20 o superior
- `npm`
- `Python` 3.11 o superior
- `PostgreSQL` 15 o superior

Opcional pero recomendado:

- `pgAdmin`
- `Postman` o `Insomnia`

---

## 5. Dependencias importantes de IA

En el microservicio FastAPI se usan estas dependencias:

```txt
fastapi==0.104.1
uvicorn==0.24.0
pandas==2.1.3
python-multipart==0.0.6
google-genai
```

La dependencia clave agregada para la integracion con IA es:

- `google-genai`

---

## 6. Configuracion del backend principal

Desde la raiz del proyecto:

```powershell
npm install
Copy-Item .env.example .env
```

Revisar el archivo `.env`.

Variables importantes:

```env
NODE_ENV=development
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=logickids
DB_USER=postgres
DB_PASSWORD=TU_PASSWORD

JWT_SECRET=lk2_s3cr3t_jwt_k3y_logickids_v2_2024_ultra_secure_32chars_min
JWT_STUDENT_SECRET=lk2_student_s3cr3t_jwt_logickids_v2_2024_secure
JWT_EXPIRES_IN=7d
JWT_STUDENT_EXPIRES_IN=4h

CORS_ORIGIN=http://localhost:5173,http://localhost:5174,http://localhost:3000

GEMINI_API_KEY=TU_API_KEY
GEMINI_MODEL_NAME=gemini-3-flash-preview
RECOMENDACIONES_PROMPT_VERSION=v1
```

Notas:

- `GEMINI_API_KEY` habilita la salida generativa real.
- Si no hay API key, algunas rutas pueden usar comportamiento de respaldo segun la implementacion.
- Si el frontend corre en `5173`, el backend debe permitir ese origen en `CORS_ORIGIN`.

---

## 7. Configuracion de la base de datos

Crear la base:

```sql
CREATE DATABASE logickids;
```

Luego ejecutar:

```powershell
psql -U postgres -d logickids -f database/schema.sql
psql -U postgres -d logickids -f database/seed.sql
```

Esto deja el backend con tablas, catalogos base y usuarios demo.

---

## 8. Levantar el backend principal

Desde la raiz del proyecto:

```powershell
npm run dev
```

Si todo esta bien, el backend quedara disponible en:

```txt
http://localhost:3000/api
```

Healthcheck:

```txt
http://localhost:3000/api/health
```

---

## 9. Levantar el microservicio FastAPI

Entrar a la carpeta del servicio:

```powershell
cd ia_service
```

Crear entorno virtual:

```powershell
python -m venv .venv
```

Activarlo en Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Instalar dependencias:

```powershell
pip install -r requirements.txt
```

Levantar el servicio:

```powershell
python main.py
```

Ese comando fue parte del flujo usado durante el desarrollo y debe dejar el servicio corriendo en:

```txt
http://localhost:8001
```

Healthcheck:

```txt
http://localhost:8001/api/ia/health
```

Si prefieren usar `uvicorn` directamente:

```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

---

## 10. Levantar el frontend

Abrir otra terminal:

```powershell
cd logickids-frontend-sena
npm install
npm run dev
```

El frontend normalmente quedara en:

```txt
http://localhost:5173
```

Si el backend corre en un puerto diferente de `3000`, crear o ajustar:

`logickids-frontend-sena/.env`

```env
VITE_API_URL=http://localhost:3000/api
```

---

## 11. Archivo CSV necesario

La funcionalidad `CSV + FastAPI` depende del archivo:

```txt
datos_estudiantes.csv
```

Debe estar ubicado en la raiz del proyecto:

```txt
logickids-backend-sena/datos_estudiantes.csv
```

Columnas esperadas:

```csv
estudiante_id,nombre_estudiante,edad,grupo_id,nombre_grupo,habilidad,total_intentos,aciertos,errores,precision_porcentaje,tiempo_reaccion_ms,fecha_evaluacion,nivel_logro,recomendacion_manual
```

El backend lee este archivo para:

- obtener el catalogo de grupos del CSV
- obtener los estudiantes de cada grupo
- filtrar el contenido antes de enviarlo al microservicio FastAPI

---

## 12. Flujo funcional actual

Dentro de la vista `Recomendaciones IA` existen 3 bloques principales:

### 12.1 Recomendacion individual

- usa datos del backend y la base de datos
- genera una recomendacion para el estudiante seleccionado
- guarda el resultado en la tabla `recomendaciones`

### 12.2 Recomendacion grupal

- usa datos del backend y la base de datos
- genera una recomendacion consolidada para el grupo seleccionado
- guarda el resultado en la tabla `recomendaciones`

### 12.3 CSV + FastAPI

- usa el archivo `datos_estudiantes.csv`
- muestra grupos del CSV en el selector `Grupo del CSV`
- muestra estudiantes del grupo en el selector `Estudiante del CSV`
- envia solo el subconjunto seleccionado al microservicio
- devuelve recomendaciones calculadas desde el analizador

Importante:

- antes este flujo era global y generaba para todos los estudiantes
- ahora fue ajustado para trabajar por grupo o por estudiante dentro del CSV

---

## 13. Endpoints involucrados

### Backend principal

- `GET /api/ia/recomendaciones/catalogo-csv`
  - devuelve grupos y estudiantes detectados en `datos_estudiantes.csv`

- `POST /api/ia/recomendaciones/generar-desde-archivo`
  - ejecuta el flujo CSV + FastAPI
  - recibe opcionalmente:

```json
{
  "grupoId": "1",
  "estudianteId": "101"
}
```

- `POST /api/recomendaciones/generar/estudiante/:id`
  - genera recomendacion individual

- `POST /api/recomendaciones/generar/grupo/:id`
  - genera recomendacion grupal

### Microservicio FastAPI

- `POST /api/ia/recomendaciones`
  - recibe un archivo CSV y devuelve recomendaciones

- `GET /api/ia/health`
  - valida que el servicio esta arriba

---

## 14. Prompt y rol de la IA

El prompt esta implementado en:

- `ia_service/analizador.py`

La IA recibe un rol pedagogico orientado a educacion infantil y genera recomendaciones para el tutor con base en:

- habilidad con menor precision
- tiempo de reaccion
- intentos, aciertos y errores
- nivel de logro
- sugerencia manual previa

La salida busca ser:

- breve
- clara
- accionable
- en espanol

---

## 15. Como probar la funcionalidad

### Paso 1

Levantar:

- PostgreSQL
- backend Node
- frontend React
- microservicio FastAPI

### Paso 2

Entrar al frontend.

### Paso 3

Iniciar sesion como tutor.

Si el seed actual incluye usuario demo, usar las credenciales que tengan vigentes en su entorno local.

### Paso 4

Ir a:

```txt
/tutor/recomendaciones
```

### Paso 5

Probar:

- recomendacion individual
- recomendacion grupal
- flujo `CSV + FastAPI`

### Paso 6

En el flujo CSV:

1. seleccionar `Grupo del CSV`
2. seleccionar `Estudiante del CSV` si se desea filtrar aun mas
3. pulsar `Generar desde CSV IA`

---

## 16. Problemas comunes

### El frontend no conecta con el backend

Revisar:

- que el backend este arriba
- que el puerto sea correcto
- que `VITE_API_URL` apunte bien
- que `CORS_ORIGIN` incluya el origen del frontend

### El boton CSV no responde o falla

Revisar:

- que `python main.py` este corriendo en `ia_service`
- que `http://localhost:8001/api/ia/health` responda
- que exista `datos_estudiantes.csv` en la raiz del proyecto

### No aparecen grupos del CSV

Revisar:

- que `datos_estudiantes.csv` tenga datos
- que incluya `grupo_id` y `nombre_grupo`
- que el endpoint `GET /api/ia/recomendaciones/catalogo-csv` responda correctamente

### Error al instalar dependencias Python

Probar:

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### La IA no devuelve respuesta real

Revisar:

- `GEMINI_API_KEY`
- acceso a internet desde el equipo
- instalacion correcta de `google-genai`

---

## 17. Checklist rapido para replicar en otra PC

1. Clonar el proyecto.
2. Ejecutar `npm install` en la raiz.
3. Configurar `.env`.
4. Crear la base `logickids`.
5. Ejecutar `schema.sql` y `seed.sql`.
6. Levantar backend con `npm run dev`.
7. Entrar a `ia_service`.
8. Crear y activar `.venv`.
9. Ejecutar `pip install -r requirements.txt`.
10. Levantar FastAPI con `python main.py`.
11. Entrar a `logickids-frontend-sena`.
12. Ejecutar `npm install`.
13. Levantar frontend con `npm run dev`.
14. Verificar que exista `datos_estudiantes.csv`.
15. Entrar a la vista `Recomendaciones IA`.

---

## 18. Conclusion

La funcionalidad `Recomendaciones IA` depende de la coordinacion de frontend, backend, CSV y microservicio FastAPI.

Si esos 4 componentes estan correctamente configurados, cualquier compañero deberia poder:

- levantar el entorno local
- visualizar la pantalla del tutor
- seleccionar grupos y estudiantes del CSV
- generar recomendaciones apoyadas por IA

