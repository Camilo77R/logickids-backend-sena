# Guia paso a paso - levantar Codigo Estelar en otra PC

## 1. Objetivo

Esta guia sirve para levantar la version estable de `Codigo Estelar` en:

- el PC del colegio
- cualquier PC nueva
- una maquina de un compañero

Incluye:

- backend
- base de datos
- datos demo
- mobile
- prueba multijugador

---

## 2. Idea clave

### Concepto: entorno reproducible

**Que es:** un proyecto que no depende de "mi computadora", sino de pasos claros y repetibles.

**Analogia:** no es una receta que solo le sale a la abuela en su cocina; es una receta escrita para que cualquiera la repita.

**Pareto:** si otra PC puede levantar backend, DB y demo, entonces el proyecto ya es portable.

---

## 3. Lo que se necesita instalar primero

### Software base

1. `Git`
2. `Node.js 20` o cercano
3. `PostgreSQL 15+`
4. `npm` (ya viene con Node)
5. Si se va a construir app Android:
   - `Android Studio` o al menos toolchain Android
   - o usar `EAS Build` desde la nube

### Opcional pero recomendado

- `pgAdmin` para revisar la DB
- `Postman` o `Insomnia`

---

## 4. Clonar los 2 repos

> Reemplace las URLs por las de GitHub cuando ya las tenga.

### Backend

```bash
git clone <URL_BACKEND>
cd logickids-backend-sena
git checkout feature/game-sockets
```

### Mobile

```bash
git clone <URL_MOBILE>
cd logickidsMobile
git checkout feature/codigo-estelar-mobile
```

---

## 5. Backend - instalacion completa

### 5.1 Instalar dependencias

```bash
cd C:\ruta\al\backend\logickids-backend-sena
npm install
```

### 5.2 Crear archivo `.env`

Copiar `.env.example` a `.env`.

```bash
copy .env.example .env
```

O manualmente.

### 5.3 Variables recomendadas para esta demo

> Ojo: en `.env.example` el puerto por defecto es `3001`, pero para esta demo venimos usando `3000`.

```env
NODE_ENV=development
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=logickids
DB_USER=postgres
DB_PASSWORD=TU_PASSWORD_REAL

JWT_SECRET=lk2_s3cr3t_jwt_k3y_logickids_v2_2024_ultra_secure_32chars_min
JWT_STUDENT_SECRET=lk2_student_s3cr3t_jwt_logickids_v2_2024_secure
JWT_EXPIRES_IN=7d
JWT_STUDENT_EXPIRES_IN=4h

CORS_ORIGIN=http://localhost:5173,http://localhost:5174,http://localhost:3000
GEMINI_API_KEY=
```

### 5.4 Crear la base de datos

Desde PostgreSQL:

```sql
CREATE DATABASE logickids;
```

### 5.5 Crear schema

```bash
psql -U postgres -d logickids -f database/schema.sql
```

### 5.6 Cargar seed base

```bash
psql -U postgres -d logickids -f database/seed.sql
```

### 5.7 Aplicar migracion de Codigo Estelar

```bash
psql -U postgres -d logickids -f database/migrations/2026-05-11_add_codigo_estelar_minijuego.sql
```

---

## 6. Por que la DB y los datos demo son vitales

### Concepto: fixture de demo

**Que es:** un escenario controlado con tutor, grupo y estudiantes listos para jugar.

**Analogia:** no llegar a la exposicion a "ver si aparece alguien", sino llevar los jugadores ya inscritos.

**Pareto:** sin schema + seed + migracion + fixture, el juego no tiene sobre que correr.

### Que aporta cada paso

- `schema.sql`
  - crea tablas y relaciones
- `seed.sql`
  - crea catalogos base
  - crea `superadmin`
  - agrega `codigo-estelar`
- migracion `2026-05-11_add_codigo_estelar_minijuego.sql`
  - asegura que el minijuego exista en bases ya creadas
- `provision-codigo-estelar-demo.mjs`
  - crea institucion demo
  - crea tutor
  - crea grupo
  - crea estudiantes
  - abre la clase

---

## 7. Crear datos demo listos para jugar

### Comando rapido - 6 estudiantes

```bash
cd C:\ruta\al\backend\logickids-backend-sena
npm run provision:codigo-estelar:6
```

### Que hace

- crea escenario nuevo
- devuelve:
  - institucion
  - admin
  - tutor
  - grupo
  - QR de los estudiantes
  - API sugerida

### Credencial base importante del seed

Superadmin inicial:

- email: `superadmin@logickids.dev`
- password: `SuperAdmin2025!`

> Cambiar en produccion. Para demo local sirve.

---

## 8. Arrancar el backend

```bash
cd C:\ruta\al\backend\logickids-backend-sena
npm run dev
```

Debe salir algo como:

```text
PostgreSQL conectado — logickids
LogicKids API v2 → http://localhost:3000
Sockets : Inicializados y escuchando
```

---

## 9. Verificar que el backend esta vivo

Abra en el navegador de la PC o del celular:

```text
http://TU_IP_LOCAL:3000/api/health
http://TU_IP_LOCAL:3000/api/minijuegos
```

Si ambos responden, backend y red local van bien.

---

## 10. Mobile - instalacion

### 10.1 Instalar dependencias

```bash
cd C:\ruta\al\mobile\logickidsMobile
npm install
```

### 10.2 Opciones para correr

#### Opcion A - development build

Usela si usted mismo va a depurar y cambiar cosas rapido.

```bash
npx expo start --dev-client -c
```

#### Opcion B - preview build

Usela para instalar la app en otros celulares sin abrir Expo todo el tiempo.

```bash
npx eas-cli build --platform android --profile preview
```

Luego se instala esa app en los celulares.

---

## 11. Datos que se ponen en la app

### Campo 1 - API Base URL

```text
http://TU_IP_LOCAL:3000/api
```

### Campo 2 - QR del estudiante

Use uno de los QR que imprimio el script demo.

### Campo 3 - dificultad

```text
2
```

---

## 12. Ojo con esto: misma sala vs salas distintas

La sala se arma por `grupo_id`.

Si quiere que 2 celulares compitan entre si, deben usar **QR del mismo grupo**.

### QR ya validados del grupo 99

1. `QR-FEEZMU-ASD94J`
2. `QR-PPV822-XXWJN7`
3. `QR-HZL7VN-XHXWYD`
4. `QR-HLBWRS-RPAENH`
5. `QR-GLW999-RBG6D7`
6. `QR-XL2BCJ-64JNP9`

### QR que NO comparte esa sala

- `QR-DYQG3A-D6AN3F`

Ese pertenece a otro grupo.

---

## 13. Como probar rapido que ya funciona

### Prueba individual

1. Entrar con un QR del grupo 99
2. Ver:
   - `Objetivo central`
   - `Estado actual`
   - `Ranking`

### Prueba de 2 celulares

1. Celular 1:
   - `QR-FEEZMU-ASD94J`
2. Celular 2:
   - `QR-PPV822-XXWJN7`

Debe pasar:

- ambos ven la misma sala
- ambos ven el mismo ranking
- cuando uno gana, ambos ven `Juego terminado`

---

## 14. Debug si algo falla

### HTTP debug desde celular

Abra:

```text
http://TU_IP_LOCAL:3000/debug/codigo-estelar-mobile
```

Esa pagina prueba:

1. `health`
2. `minijuegos`
3. `login QR`
4. `sesion HTTP`
5. `socket join`

### Lectura rapida

- si falla `health` -> problema de red o backend apagado
- si falla `login QR` -> problema de datos o CORS
- si falla `sesion HTTP` -> problema de reglas de clase/grupo
- si falla `socket join` -> problema realtime

---

## 15. Tests utiles del backend

```bash
cd C:\ruta\al\backend\logickids-backend-sena
npm test
```

Estado actual documentado:

- `34 passed`

---

## 16. Checklist de demo antes de salir

1. Backend prende sin error
2. DB conecta
3. `npm test` pasa
4. Script demo corrido o QR anotados
5. Celulares en el mismo Wi-Fi
6. Mismo `API Base URL`
7. QRs del mismo grupo
8. Un build estable ya instalado

---

## 17. Problemas comunes

### "Network request failed"

Revise:

- backend prendido
- `API Base URL` correcta
- mismo Wi-Fi
- celular sin VPN
- build correcta instalada

### "Sesion no activa. El tutor debe abrir la clase primero."

Falta correr fixture demo o abrir clase del grupo.

### Dos celulares entran a salas distintas

Estan usando QRs de grupos distintos.

---

## 18. Conclusion practica

Si otra PC tiene:

- PostgreSQL
- schema
- seed
- migracion
- `.env`
- fixture demo
- backend corriendo
- mobile instalado

entonces `Codigo Estelar` ya puede mostrarse fuera de su maquina.

