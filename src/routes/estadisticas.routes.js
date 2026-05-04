import { Router } from 'express';
import * as ctrl from '../controllers/estadisticas.controller.js';
import { requireAuth, requireEstudiante } from '../middlewares/auth.js';

const router = Router();
router.get('/mis-estadisticas', requireEstudiante, ctrl.misEstadisticas);
router.use(requireAuth);
router.get('/estudiante/:id', ctrl.porEstudiante);
router.get('/grupo/:id', ctrl.porGrupo);

export default router;
