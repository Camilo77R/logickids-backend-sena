import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import {
  borrarHistorialCsv,
  exportarYRecomendar,
  obtenerHistorialCsv,
  obtenerCatalogoCsvLocal,
  recomendarDesdeArchivoLocal,
} from '../services/ia.service.js';

const router = Router();

// Endpoint para tutores autenticados
router.get('/recomendaciones/catalogo-csv', requireAuth, requireRole('tutor'), obtenerCatalogoCsvLocal);
router.get('/recomendaciones/historial-csv', requireAuth, requireRole('tutor'), obtenerHistorialCsv);
router.post('/recomendaciones/generar', requireAuth, requireRole('tutor'), exportarYRecomendar);
router.post('/recomendaciones/generar-desde-archivo', requireAuth, requireRole('tutor'), recomendarDesdeArchivoLocal);
router.delete('/recomendaciones/historial-csv', requireAuth, requireRole('tutor'), borrarHistorialCsv);

// Endpoint para pruebas (sin autenticación)
router.post('/recomendaciones/test', exportarYRecomendar);
router.post('/recomendaciones/test-desde-archivo', recomendarDesdeArchivoLocal);

export default router;
