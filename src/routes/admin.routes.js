import { Router } from 'express';
import * as ctrl from '../controllers/admin.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  cambiarEstadoUsuarioSchema,
  crearAdminInstitucionalSchema,
  crearTutorInstitucionalSchema,
  crearInstitucionSchema,
  actualizarInstitucionSchema,
  toggleMinijuegoSchema,
} from '../schemas/admin.schema.js';

const router = Router();

router.use(requireAuth);

// Rutas exclusivas del admin de institución
router.get('/dashboard', requireRole('admin', 'superadmin'), ctrl.dashboard);
router.get('/usuarios', requireRole('admin', 'superadmin'), ctrl.listarUsuarios);
router.post('/usuarios/admins', requireRole('admin', 'superadmin'), validate(crearAdminInstitucionalSchema), ctrl.crearAdminInstitucional);
router.post('/usuarios/tutores', requireRole('admin', 'superadmin'), validate(crearTutorInstitucionalSchema), ctrl.crearTutorInstitucional);
router.get('/usuarios/:id', requireRole('admin', 'superadmin'), ctrl.obtenerUsuario);
router.patch('/usuarios/:id/estado', requireRole('admin', 'superadmin'), validate(cambiarEstadoUsuarioSchema), ctrl.cambiarEstadoUsuario);

// Rutas exclusivas del superadmin
router.get('/instituciones',      requireRole('superadmin'), ctrl.listarInstituciones);
router.post('/instituciones',     requireRole('superadmin'), validate(crearInstitucionSchema),      ctrl.crearInstitucion);
router.put('/instituciones/:id',  requireRole('superadmin'), validate(actualizarInstitucionSchema), ctrl.actualizarInstitucion);
router.patch('/instituciones/:id/desactivar', requireRole('superadmin'), ctrl.desactivarInstitucion);
router.patch('/instituciones/:id/reactivar',  requireRole('superadmin'), ctrl.reactivarInstitucion);
router.delete('/instituciones/:id', requireRole('superadmin'), ctrl.eliminarInstitucion);
router.get('/minijuegos', requireRole('superadmin'), ctrl.listarMinijuegos);
router.patch('/minijuegos/:id/toggle', requireRole('superadmin'), validate(toggleMinijuegoSchema), ctrl.toggleMinijuego);

export default router;
