import { Router } from 'express';
import * as ctrl from '../controllers/recomendaciones.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';

const router = Router();
router.use(requireAuth);
// Admin puede ver y generar recomendaciones de su institución — scope garantizado por access.service.js
router.use(requireRole('tutor', 'admin'));

router.get('/estudiante/:id', ctrl.porEstudiante);
router.get('/grupo/:id', ctrl.porGrupo);
router.post('/generar/estudiante/:id', ctrl.generarEstudiante);
router.post('/generar/grupo/:id', ctrl.generarGrupo);
router.patch('/:id/archivar', ctrl.archivar);

export default router;
