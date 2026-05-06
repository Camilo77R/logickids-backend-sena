# Tenant Smoke Tests

Pruebas manuales para validar el aislamiento por `institucion_id`, los permisos por rol y el flujo de activacion de tutores.

## Precondiciones

- Base de datos creada con `database/schema.sql`.
- Seed ejecutado con `database/seed.sql`.
- API corriendo localmente.
- Dos instituciones distintas creadas desde `superadmin`.
- Un admin por institucion.
- Al menos:
  - 1 tutor de Institucion A
  - 1 tutor de Institucion B
  - 1 grupo y 1 estudiante por cada tutor

## Datos sugeridos

- `superadmin@logickids.dev`
- `Institucion A`
- `Institucion B`
- `adminA`
- `adminB`
- `tutorA`
- `tutorB`

## Caso 1. Registro de tutor queda inactivo

1. `POST /api/auth/registro`
2. Body:

```json
{
  "nombre": "Tutor Pendiente",
  "email": "tutor.pendiente@demo.com",
  "contrasena": "Tutor12345!",
  "institucion_id": 1
}
```

3. Esperado:
- `201`
- respuesta con `estado: "inactivo"`

## Caso 2. Tutor inactivo no puede iniciar sesion

1. `POST /api/auth/login`
2. Body:

```json
{
  "email": "tutor.pendiente@demo.com",
  "contrasena": "Tutor12345!"
}
```

3. Esperado:
- `403`
- mensaje de cuenta inactiva o suspendida

## Caso 3. Admin solo lista tutores de su institucion

1. Login como `adminA`
2. `GET /api/admin/usuarios`
3. Esperado:
- `200`
- solo aparecen tutores de Institucion A
- no aparece ningun tutor de Institucion B

## Caso 4. Admin no puede ver detalle de tutor de otra institucion

1. Login como `adminA`
2. `GET /api/admin/usuarios/:idTutorB`
3. Esperado:
- `403`

## Caso 5. Admin puede activar tutor de su institucion

1. Login como `adminA`
2. `PATCH /api/admin/usuarios/:idTutorPendiente/estado`
3. Body:

```json
{
  "estado": "activo"
}
```

4. Esperado:
- `200`
- estado actualizado

## Caso 6. Tutor activado ya puede iniciar sesion

1. `POST /api/auth/login`
2. Body del tutor activado
3. Esperado:
- `200`
- JWT con rol `tutor`

## Caso 7. Admin no puede entrar a rutas de tutor

1. Login como `adminA`
2. Probar:
- `GET /api/grupos`
- `GET /api/estudiantes`
- `GET /api/recomendaciones/grupo/:id`
- `GET /api/sesiones/estudiante/:id`
3. Esperado:
- `403` en todos

## Caso 8. Tutor solo ve sus propios grupos

1. Login como `tutorA`
2. `GET /api/grupos`
3. Esperado:
- `200`
- solo grupos creados por `tutorA`

## Caso 9. Tutor no puede ver grupo de otro tutor

1. Login como `tutorA`
2. `GET /api/grupos/:idGrupoTutorB`
3. Esperado:
- `403`

## Caso 10. Tutor no puede ver estudiantes de otro tutor

1. Login como `tutorA`
2. `GET /api/estudiantes/:idEstudianteTutorB`
3. Esperado:
- `403`

## Caso 11. Listado de estudiantes queda filtrado por ownership

1. Login como `tutorA`
2. `GET /api/estudiantes`
3. Esperado:
- `200`
- solo estudiantes de los grupos de `tutorA`

## Caso 12. Superadmin si conserva acceso global administrativo

1. Login como `superadmin`
2. Probar:
- `GET /api/admin/instituciones`
- `POST /api/admin/instituciones`
- `GET /api/admin/minijuegos`
3. Esperado:
- `200` o `201` segun la accion

## Caso 13. No se puede eliminar institucion con usuarios asociados

1. Login como `superadmin`
2. `DELETE /api/admin/instituciones/:idInstitucionA`
3. Esperado:
- `409`

## Señales de exito

El tenant esta razonablemente bien aplicado si:

- un `admin` nunca ve tutores de otra institucion
- un `admin` no entra a rutas de tutor
- un `tutor` nunca ve grupos ni estudiantes de otro tutor
- un tutor nuevo no puede entrar hasta ser activado
- `superadmin` mantiene solo las capacidades globales
