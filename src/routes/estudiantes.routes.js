import { Router } from 'express';
import * as ctrl from '../controllers/estudiantes.controller.js';
import { requireAuth, requireEstudiante, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  loginEstudianteSchema,
  crearEstudianteSchema,
  actualizarEstudianteSchema,
  cambiarGrupoEstudianteSchema,
  toggleSesionSchema,
} from '../schemas/estudiantes.schema.js';

const router = Router();

// Rutas públicas (sin JWT de tutor)
router.post('/login',         validate(loginEstudianteSchema),   ctrl.loginEstudiante);
router.get('/mi-perfil',      requireEstudiante,                 ctrl.miPerfil);

// Rutas protegidas
router.use(requireAuth);
router.use(requireRole('tutor'));

router.get('/',          ctrl.listar);
router.get('/all',       ctrl.listarTodos);
router.get('/:id',       ctrl.obtener);
router.post('/',         validate(crearEstudianteSchema),        ctrl.crear);
router.put('/:id',       validate(actualizarEstudianteSchema),   ctrl.actualizar);
router.patch('/:id/grupo', validate(cambiarGrupoEstudianteSchema), ctrl.cambiarGrupo);
router.delete('/:id',    ctrl.desactivar);
router.patch('/:id/reactivar', ctrl.reactivar);
router.get('/:id/qr',    ctrl.obtenerQr);
router.patch('/:id/sesion', validate(toggleSesionSchema),        ctrl.toggleSesion);

export default router;
