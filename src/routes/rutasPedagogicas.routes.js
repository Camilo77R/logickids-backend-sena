import { Router } from 'express';
import * as ctrl from '../controllers/rutasPedagogicas.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';

const router = Router();

router.use(requireAuth);
router.get('/', requireRole('superadmin', 'admin', 'tutor'), ctrl.listar);

export default router;
