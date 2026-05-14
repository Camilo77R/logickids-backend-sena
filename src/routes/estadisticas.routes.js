import { Router } from 'express';
import * as ctrl from '../controllers/estadisticas.controller.js';
import { requireAuth, requireEstudiante, requireRole } from '../middlewares/auth.js';

const router = Router();
router.get('/mis-estadisticas', requireEstudiante, ctrl.misEstadisticas);
router.use(requireAuth);
// Admin ve estadísticas de su institución, tutor solo las suyas — el scope lo aplica access.service.js
router.use(requireRole('tutor', 'admin'));
router.get('/estudiante/:id', ctrl.porEstudiante);
router.get('/grupo/:id', ctrl.porGrupo);

export default router;
