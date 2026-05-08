# Ciclo de Vida Backend Para Novatos

## Qué cambiamos

Antes, el sistema pensaba así:

- institución -> se elimina
- grupo -> se elimina

Ahora piensa así:

- institución -> se desactiva o reactiva
- grupo -> se archiva o restaura

La idea es simple: **ya no borramos historia útil**.

## Por qué lo hicimos

Imagine una institución como una carpeta física en una oficina.

- `eliminar` sería botar la carpeta a la basura
- `desactivar` sería guardarla en archivo y ponerle un sello de "no operativa"

En software real, casi siempre conviene la segunda opción porque:

- no se pierde historial
- no se rompen relaciones
- se puede auditar después
- se evita borrar por error información valiosa

## Qué se agregó en base de datos

### Tabla `instituciones`

- `activo`
- `desactivado_en`

### Tabla `grupos`

- `activo`
- `archivado_en`

Además, se agregaron:

- `CHECK constraints` para evitar estados incoherentes
- índices por `activo`

## Qué significa cada campo

### Instituciones

- `activo = true` -> la institución puede operar
- `activo = false` -> la institución existe, pero está bloqueada
- `desactivado_en` -> fecha en que se sacó de operación

### Grupos

- `activo = true` -> el grupo está disponible para uso normal
- `activo = false` -> el grupo está archivado
- `archivado_en` -> fecha en que se archivó

## Dónde vive cada regla

### 1. Migración de base de datos

Archivo:

- [2026-05-07_soft_lifecycle_instituciones_grupos.sql](c:/Users/Cristian/Escritorio/logickids-backend-sena/database/migrations/2026-05-07_soft_lifecycle_instituciones_grupos.sql)

Ahí está el cambio estructural de la base.

### 2. Esquema base del proyecto

Archivo:

- [schema.sql](c:/Users/Cristian/Escritorio/logickids-backend-sena/database/schema.sql)

Este archivo quedó actualizado para que una base nueva nazca ya con la estructura correcta.

### 3. Revalidación de sesiones

Archivo:

- [session-access.service.js](c:/Users/Cristian/Escritorio/logickids-backend-sena/src/services/session-access.service.js)

Este archivo responde una pregunta clave:

> "El token dice quién era el usuario cuando entró, pero sigue habilitado ahora mismo?"

Eso protege contra el caso donde:

- el usuario inició sesión
- luego lo desactivan
- intenta seguir usando el token viejo

### 4. Middleware de autenticación

Archivo:

- [auth.js](c:/Users/Cristian/Escritorio/logickids-backend-sena/src/middlewares/auth.js)

Antes validaba solo JWT.

Ahora hace dos pasos:

1. verifica que el token sea válido
2. vuelve a mirar la base para confirmar que el usuario o estudiante sigue habilitado

### 5. Reglas de instituciones

Archivo:

- [admin.service.js](c:/Users/Cristian/Escritorio/logickids-backend-sena/src/services/admin.service.js)

Aquí quedaron las reglas de:

- listar instituciones con su estado
- desactivar institución
- reactivar institución
- cerrar sesiones activas de estudiantes al desactivar una institución

### 6. Reglas de grupos

Archivo:

- [grupos.service.js](c:/Users/Cristian/Escritorio/logickids-backend-sena/src/services/grupos.service.js)

Aquí quedaron las reglas de:

- listar solo grupos activos
- impedir editar un grupo archivado
- archivar un grupo
- restaurar un grupo
- cerrar la sesión activa de sus estudiantes
- sacar a los estudiantes del grupo activo para que luego puedan ser reasignados

### 7. Acceso histórico del estudiante

Archivo:

- [access.service.js](c:/Users/Cristian/Escritorio/logickids-backend-sena/src/services/access.service.js)

Este es uno de los puntos más importantes.

Problema:

- si se archiva un grupo, el estudiante deja de tener grupo activo
- si la seguridad solo mira el grupo activo, el tutor podría "perder" al estudiante

Solución:

- se agregó un scope histórico
- el tutor sigue teniendo permiso para gestionar estudiantes que alguna vez pertenecieron a sus grupos

Analogía:

- aunque el niño ya no esté hoy sentado en el salón, el colegio sigue sabiendo que era parte de ese curso

### 8. Login y registro

Archivo:

- [auth.service.js](c:/Users/Cristian/Escritorio/logickids-backend-sena/src/services/auth.service.js)

Reglas nuevas:

- el registro público solo muestra instituciones activas
- un usuario web no puede iniciar sesión si su institución está desactivada

### 9. Login por QR del estudiante

Archivo:

- [estudiantes.service.js](c:/Users/Cristian/Escritorio/logickids-backend-sena/src/services/estudiantes.service.js)

Reglas nuevas:

- el estudiante no entra si está inactivo
- el estudiante no entra si su institución está desactivada

### 10. Permiso real para jugar

Archivo:

- [sesiones.service.js](c:/Users/Cristian/Escritorio/logickids-backend-sena/src/services/sesiones.service.js)

Aquí se separó una idea importante:

- **entrar al dashboard** no es lo mismo que **poder jugar**

Por eso el estudiante puede:

- autenticarse
- ver su perfil

pero no puede iniciar partida si:

- no tiene grupo activo
- su grupo está archivado
- la sesión del aula está cerrada

## Endpoints nuevos o reforzados

### Instituciones

- `PATCH /api/admin/instituciones/:id/desactivar`
- `PATCH /api/admin/instituciones/:id/reactivar`
- `GET /api/admin/instituciones?estado=activas|desactivadas|todas`

Se dejó además compatibilidad temporal:

- `DELETE /api/admin/instituciones/:id`

Ese endpoint viejo ya no elimina de verdad. Internamente desactiva.

### Grupos

- `PATCH /api/grupos/:id/archivar`
- `PATCH /api/grupos/:id/restaurar`

También quedó compatibilidad temporal:

- `DELETE /api/grupos/:id`

Ese endpoint viejo ya no elimina: ahora archiva.

### Logros

- `GET /api/logros/catalogo`

Sigue siendo público para ver el catálogo general.

- `GET /api/logros/catalogo?estudiante_id=:id`

Ahora solo devuelve el estado desbloqueado si el request trae una sesión válida:

- del propio estudiante
- o de un tutor/admin con permiso sobre ese estudiante

Esto evita una fuga de información donde cualquiera podía intentar averiguar
el progreso de un estudiante solo adivinando su ID.

## Qué reglas de negocio quedan cumplidas

- una institución desactivada no puede operar
- el filtro de instituciones activas/desactivadas queda disponible para superadmin
- una institución desactivada no aparece en listados públicos
- un token viejo deja de servir si el usuario o la institución se bloquean
- un grupo archivado deja de operar
- un grupo archivado no aparece en listados activos
- el estudiante no juega si no tiene grupo operativo
- el estado de logros de un estudiante ya no se expone públicamente
- la historia se conserva

## Qué falta después de esto

Esto deja la base del backend mucho más sólida, pero después toca:

- adaptar frontend a los endpoints y mensajes nuevos
- revisar si el panel tutor necesita mostrar estudiantes "sin grupo activo"
- ampliar pruebas para flujo completo tutor -> grupo -> estudiante -> QR -> juego

## Idea final

La mejor forma de entender este cambio es esta:

> Antes el sistema "desaparecía" cosas.
> Ahora el sistema "administra su ciclo de vida".

Eso es más profesional, más seguro y más parecido a un producto real.
