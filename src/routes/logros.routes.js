import { Router } from 'express';
import * as ctrl from '../controllers/logros.controller.js';
import { requireAuth, requireEstudiante } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { desbloquearLogroSchema } from '../schemas/logros.schema.js';

const router = Router();

router.get('/catalogo', ctrl.catalogo);
router.get('/mis-logros', requireEstudiante, ctrl.misLogros);
router.get('/estudiante/:id', requireAuth, ctrl.listar);
router.get('/mis-estudiantes', requireAuth, ctrl.misEstudiantes);
router.post('/desbloquear', requireEstudiante, validate(desbloquearLogroSchema), ctrl.desbloquear);
router.post('/estudiante/:id', requireEstudiante, validate(desbloquearLogroSchema), ctrl.desbloquear);

export default router;