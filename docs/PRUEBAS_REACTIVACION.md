# Pruebas de reactivación de tutores suspendidos (HU-51 y HU-52)

## Objetivo

Validar el flujo completo de reactivación de cuentas de tutores suspendidos.

## Endpoints involucrados

| Método | Endpoint | Ubicación | Función |
|--------|----------|-----------|---------|
| POST | `/api/solicitudes/reactivacion` | Backend | Tutor envía solicitud |
| GET | `/api/admin/solicitudes` | Backend | Admin lista solicitudes |
| GET | `/api/admin/solicitudes/:id` | Backend | Admin ve detalle |
| PUT | `/api/admin/solicitudes/:id/aprobar` | Backend | Admin aprueba |
| PUT | `/api/admin/solicitudes/:id/rechazar` | Backend | Admin rechaza |
| POST | `/api/auth/login` | Backend | Modificado: detecta suspendido |

## Dependencias

| Dependencia | Versión | Para qué |
|-------------|---------|----------|
| `nodemailer` | ^6.x.x | Envío de correos |
| Variables .env | `EMAIL_*` | Configuración Gmail |

## Flujo completo

### 1. Suspender tutor (admin)
- **Frontend:** `UsuariosPage` → botón "Marcar suspendido"
- **Backend:** No requiere endpoint específico

### 2. Login con tutor suspendido
- **Endpoint:** `POST /api/auth/login`
- **Respuesta:** `403` con `{ estado: "suspendido", email }`
- **Frontend:** Redirige a `/solicitar-reactivacion`

### 3. Enviar solicitud
- **Endpoint:** `POST /api/solicitudes/reactivacion`
- **Body:** `{ email, correo_respuesta, motivo, descripcion }`
- **Frontend:** Formulario en `/solicitar-reactivacion`

### 4. Admin visualiza solicitudes
- **Endpoint:** `GET /api/admin/solicitudes`
- **Frontend:** Panel `/admin/solicitudes`

### 5. Admin aprueba
- **Endpoint:** `PUT /api/admin/solicitudes/:id/aprobar`
- **Frontend:** Botón "Aprobar"

### 6. Admin rechaza
- **Endpoint:** `PUT /api/admin/solicitudes/:id/rechazar`
- **Body:** `{ motivo_rechazo }`
- **Frontend:** Botón "Rechazar" + modal con motivo

## Reglas de negocio

| ID | Regla |
|----|-------|
| RN-26 | Tutor suspendido no puede iniciar sesión |
| RN-27 | Solicitud requiere motivo y correo |
| RN-28 | Admin gestiona desde panel (sin correo) |
| RN-29 | Al aprobar/rechazar → correo al tutor |
| RN-30 | No se puede enviar si hay pendiente |
| RN-31 | Admin no cambia manualmente suspendido |

## Smoke manual

| Paso | Acción | Resultado esperado |
|------|--------|-------------------|
| 1 | Suspender tutor desde admin |  Estado = suspendido |
| 2 | Login con tutor suspendido |  Redirige a formulario |
| 3 | Enviar solicitud |  Mensaje de éxito |
| 4 | Admin ve badge |  Número de solicitudes |
| 5 | Admin aprueba |  Tutor activado + correo |
| 6 | Admin rechaza |  Tutor suspendido + correo c/motivo |

## Verificación en BD

```sql
-- Ver solicitudes
SELECT * FROM solicitudes_reactivacion ORDER BY fecha_solicitud DESC;

-- Ver estado del tutor
SELECT id_usuario, nombre, email, estado_id FROM usuarios WHERE email = 'tutor@ejemplo.com';