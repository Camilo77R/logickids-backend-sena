import { Router } from 'express';
import * as ctrl from '../controllers/solicitudes.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  crearSolicitudReactivacionSchema,
  rechazarSolicitudSchema,
} from '../schemas/solicitudes.schema.js';

const router = Router();

// El tutor suspendido no puede iniciar sesión, por eso esta ruta es pública.
router.post(
  '/reactivacion',
  validate(crearSolicitudReactivacionSchema),
  ctrl.crearSolicitudReactivacion
);

router.get(
  '/admin/solicitudes',
  requireAuth,
  requireRole('admin'),
  ctrl.listarSolicitudes
);

router.get(
  '/admin/solicitudes/:id',
  requireAuth,
  requireRole('admin'),
  ctrl.obtenerSolicitud
);

router.put(
  '/admin/solicitudes/:id/aprobar',
  requireAuth,
  requireRole('admin'),
  ctrl.aprobarSolicitud
);

router.put(
  '/admin/solicitudes/:id/rechazar',
  requireAuth,
  requireRole('admin'),
  validate(rechazarSolicitudSchema),
  ctrl.rechazarSolicitud
);

export default router;
