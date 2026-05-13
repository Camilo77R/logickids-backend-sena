import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { exportarYRecomendar } from '../services/ia.service.js';

const router = Router();

// Endpoint para tutores autenticados
router.post('/recomendaciones/generar', requireAuth, requireRole('tutor'), exportarYRecomendar);

// Endpoint para pruebas (sin autenticación)
router.post('/recomendaciones/test', exportarYRecomendar);

export default router;