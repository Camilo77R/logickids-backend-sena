import { Router } from 'express';
import * as ctrl from '../controllers/minijuegos.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { crearMinijuegoSchema, toggleActivoSchema } from '../schemas/minijuegos.schema.js';

const router = Router();

// Rutas públicas — cualquiera puede ver los minijuegos
router.get('/',    ctrl.listar);
router.get('/:id', ctrl.obtener);

// Rutas de administración — solo el superadmin gestiona el catálogo global de minijuegos
// Un admin de institución no puede crear ni desactivar minijuegos porque son recursos globales
router.post('/',
  requireAuth, requireRole('superadmin'),
  validate(crearMinijuegoSchema),
  ctrl.crear,
);

router.patch('/:id/estado',
  requireAuth, requireRole('superadmin'),
  validate(toggleActivoSchema),
  ctrl.toggleActivo,
);

export default router;
