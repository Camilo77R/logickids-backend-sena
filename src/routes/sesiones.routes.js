import { Router } from 'express';
import * as ctrl from '../controllers/sesiones.controller.js';
import { requireAuth, requireEstudiante } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  iniciarSesionSchema,
  registrarEventoSchema,
  finalizarSesionSchema,
} from '../schemas/sesiones.schema.js';

const router = Router();

// Rutas usadas por el estudiante con su propio JWT
router.post('/iniciar',        requireEstudiante, validate(iniciarSesionSchema),    ctrl.iniciar);
router.post('/:id/eventos',    requireEstudiante, validate(registrarEventoSchema),  ctrl.registrarEvento);
router.post('/:id/finalizar',  requireEstudiante, validate(finalizarSesionSchema),  ctrl.finalizar);
router.get('/mis-sesiones',    requireEstudiante, ctrl.miHistorial);

// Rutas usadas por admin y tutores para ver historial
router.get('/estudiante/:id',  requireAuth, ctrl.historial);
router.get('/:id/eventos',     requireAuth, ctrl.detalleEventos);

export default router;