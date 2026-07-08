import { Router } from 'express';
import * as ctrl from '../controllers/sesiones.controller.js';
import { requireAuth, requireEstudiante, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  iniciarSesionSchema,
  registrarEventoSchema,
  finalizarSesionSchema,
  guardarCheckpointSchema,
} from '../schemas/sesiones.schema.js';

const router = Router();

// Rutas usadas por el estudiante con su propio JWT
router.post('/iniciar',        requireEstudiante, validate(iniciarSesionSchema),    ctrl.iniciar);
router.post('/:id/eventos',    requireEstudiante, validate(registrarEventoSchema),  ctrl.registrarEvento);
router.post('/:id/finalizar',  requireEstudiante, validate(finalizarSesionSchema),  ctrl.finalizar);
router.get('/:id/checkpoint',  requireEstudiante, ctrl.obtenerCheckpoint);
router.put(
  '/:id/checkpoint',
  requireEstudiante,
  validate(guardarCheckpointSchema),
  ctrl.guardarCheckpoint
);
router.get('/mis-sesiones',    requireEstudiante, ctrl.miHistorial);

// Rutas usadas por adultos con alcance institucional/pedagógico
router.get('/estudiante/:id',  requireAuth, requireRole('admin', 'tutor'), ctrl.historial);
router.get('/:id/eventos',     requireAuth, requireRole('admin', 'tutor'), ctrl.detalleEventos);

export default router;
