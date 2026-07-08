import { Router } from 'express';
import * as ctrl from '../controllers/estudiantes.controller.js';
import { requireAuth, requireEstudiante, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  loginEstudianteSchema,
  crearEstudianteSchema,
  actualizarEstudianteSchema,
  cambiarGrupoEstudianteSchema,
  recuperarSesionDispositivoSchema,
} from '../schemas/estudiantes.schema.js';

const router = Router();

// Rutas públicas (sin JWT de tutor)
router.post('/login',         validate(loginEstudianteSchema),   ctrl.loginEstudiante);
router.delete('/mi-sesion-dispositivo', requireEstudiante,       ctrl.logoutEstudiante);
router.get('/mi-perfil',      requireEstudiante,                 ctrl.miPerfil);
router.get('/mi-ranking',     requireEstudiante,                 ctrl.miRanking);

// Rutas protegidas
router.use(requireAuth);

router.get('/', requireRole('admin', 'tutor', 'superadmin'), ctrl.listar);
router.get('/all', requireRole('admin', 'tutor', 'superadmin'), ctrl.listarTodos);
router.get('/:id', requireRole('admin', 'tutor', 'superadmin'), ctrl.obtener);
router.post('/', requireRole('admin'), validate(crearEstudianteSchema), ctrl.crear);
router.put('/:id', requireRole('admin'), validate(actualizarEstudianteSchema), ctrl.actualizar);
router.patch('/:id/grupo', requireRole('admin'), validate(cambiarGrupoEstudianteSchema), ctrl.cambiarGrupo);
router.delete('/:id', requireRole('admin'), ctrl.desactivar);
router.patch('/:id/reactivar', requireRole('admin'), ctrl.reactivar);
router.get(
  '/:id/dispositivo-activo',
  requireRole('admin', 'tutor'),
  ctrl.obtenerSesionDispositivoActiva
);
router.post(
  '/:id/recuperar-sesion-dispositivo',
  requireRole('admin', 'tutor'),
  validate(recuperarSesionDispositivoSchema),
  ctrl.recuperarSesionDispositivo
);
router.get('/:id/qr', requireRole('admin', 'tutor'), ctrl.obtenerQr);

export default router;
