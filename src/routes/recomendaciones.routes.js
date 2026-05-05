import { Router } from 'express';
import * as ctrl from '../controllers/recomendaciones.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/estudiante/:id', ctrl.porEstudiante);
router.get('/grupo/:id', ctrl.porGrupo);
router.post('/generar/estudiante/:id', ctrl.generarEstudiante);
router.post('/generar/grupo/:id', ctrl.generarGrupo);
router.patch('/:id/archivar', ctrl.archivar);

export default router;
