import { Router } from 'express';
import * as ctrl from '../controllers/grupos.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  crearGrupoSchema,
  actualizarGrupoSchema,
  toggleSesionGrupoSchema,
} from '../schemas/grupos.schema.js';

const router = Router();

router.use(requireAuth);

router.get('/',     ctrl.listar);
router.get('/:id',  ctrl.obtener);
router.post('/',    validate(crearGrupoSchema),     ctrl.crear);
router.put('/:id',  validate(actualizarGrupoSchema), ctrl.actualizar);
router.patch('/:id/sesion', validate(toggleSesionGrupoSchema), ctrl.toggleSesion);
router.delete('/:id', ctrl.eliminar);

export default router;
