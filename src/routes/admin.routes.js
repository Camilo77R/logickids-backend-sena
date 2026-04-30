import { Router } from 'express';
import * as ctrl from '../controllers/admin.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  cambiarEstadoUsuarioSchema,
  crearInstitucionSchema,
  toggleMinijuegoSchema,
} from '../schemas/admin.schema.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole('admin'));

// Usuarios
router.get('/usuarios',                ctrl.listarUsuarios);
router.get('/usuarios/:id',            ctrl.obtenerUsuario);
router.patch('/usuarios/:id/estado',   validate(cambiarEstadoUsuarioSchema), ctrl.cambiarEstadoUsuario);

// Instituciones
router.get('/instituciones',           ctrl.listarInstituciones);
router.post('/instituciones',          validate(crearInstitucionSchema),      ctrl.crearInstitucion);
router.delete('/instituciones/:id',    ctrl.eliminarInstitucion);

// Minijuegos
router.get('/minijuegos',              ctrl.listarMinijuegos);
router.patch('/minijuegos/:id/toggle', validate(toggleMinijuegoSchema),       ctrl.toggleMinijuego);

export default router;
