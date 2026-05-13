import { Router } from 'express';
import * as ctrl from '../controllers/logros.controller.js';
import { attachOptionalSession, requireAuth, requireEstudiante, requireRole } from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import { desbloquearLogroSchema } from '../schemas/logros.schema.js';

const router = Router();

// Catálogo público — cualquiera puede ver qué logros existen
router.get('/catalogo', attachOptionalSession, ctrl.catalogo);

// Rutas del estudiante autenticado
router.get('/mis-logros', requireEstudiante, ctrl.misLogros);
router.post(
  '/desbloquear',
  requireEstudiante,
  validate(desbloquearLogroSchema),
  ctrl.desbloquear
);

// Rutas del tutor — ver logros de un estudiante específico
router.get('/estudiante/:id', requireAuth, requireRole('tutor'), ctrl.listar);

export default router;