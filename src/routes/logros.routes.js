import { Router } from 'express';
import * as ctrl from '../controllers/logros.controller.js';
import { requireAuth, requireEstudiante } from '../middlewares/auth.js';

const router = Router();

// Catálogo público — cualquiera puede ver qué logros existen
router.get('/catalogo', ctrl.catalogo);

// Rutas del estudiante autenticado
router.get('/mis-logros', requireEstudiante, ctrl.misLogros);

// Rutas del tutor/admin — ver logros de un estudiante específico
router.get('/estudiante/:id', requireAuth, ctrl.listar);

export default router;