import { Router } from 'express';
import * as ctrl from '../controllers/admin.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  cambiarEstadoUsuarioSchema,
  crearInstitucionSchema,
  actualizarInstitucionSchema,
  toggleMinijuegoSchema,
} from '../schemas/admin.schema.js';

const router = Router();

router.use(requireAuth);

// Rutas exclusivas del admin de institución
router.get('/usuarios', requireRole('admin'), ctrl.listarUsuarios);
router.get('/usuarios/:id', requireRole('admin'), ctrl.obtenerUsuario);
router.patch('/usuarios/:id/estado', requireRole('admin'), validate(cambiarEstadoUsuarioSchema), ctrl.cambiarEstadoUsuario);

// Rutas exclusivas del superadmin
router.get('/instituciones',      requireRole('superadmin'), ctrl.listarInstituciones);
router.post('/instituciones',     requireRole('superadmin'), validate(crearInstitucionSchema),      ctrl.crearInstitucion);
router.put('/instituciones/:id',  requireRole('superadmin'), validate(actualizarInstitucionSchema), ctrl.actualizarInstitucion);
router.delete('/instituciones/:id', requireRole('superadmin'), ctrl.eliminarInstitucion);
router.get('/minijuegos', requireRole('superadmin'), ctrl.listarMinijuegos);
router.patch('/minijuegos/:id/toggle', requireRole('superadmin'), validate(toggleMinijuegoSchema), ctrl.toggleMinijuego);

export default router;