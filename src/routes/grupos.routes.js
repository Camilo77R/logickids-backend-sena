import { Router } from 'express';
import * as ctrl from '../controllers/grupos.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  crearGrupoSchema,
  actualizarGrupoSchema,
  asignarTutorGrupoSchema,
  toggleSesionGrupoSchema,
} from '../schemas/grupos.schema.js';

const router = Router();

router.use(requireAuth);

router.get('/', requireRole('admin', 'tutor'), ctrl.listar);
router.get('/:id', requireRole('admin', 'tutor'), ctrl.obtener);
router.post('/', requireRole('admin'), validate(crearGrupoSchema), ctrl.crear);
router.put('/:id', requireRole('admin'), validate(actualizarGrupoSchema), ctrl.actualizar);
router.patch('/:id/tutor', requireRole('admin'), validate(asignarTutorGrupoSchema), ctrl.asignarTutor);
router.patch('/:id/sesion', requireRole('tutor'), validate(toggleSesionGrupoSchema), ctrl.toggleSesion);
router.patch('/:id/archivar', requireRole('admin'), ctrl.archivar);
router.patch('/:id/restaurar', requireRole('admin'), ctrl.restaurar);
router.delete('/:id', requireRole('admin'), ctrl.eliminar);

export default router;
