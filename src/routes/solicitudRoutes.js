import express from 'express';
import {
    crearSolicitudReactivacion,
    listarSolicitudes,
    obtenerSolicitud,
    aprobarSolicitud,
    rechazarSolicitud
} from '../controllers/solicitudController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';

const router = express.Router();

// Ruta pública (no requiere autenticación)
// El tutor suspendido no puede iniciar sesión, por eso esta ruta es pública
router.post('/reactivacion', crearSolicitudReactivacion);

// Rutas protegidas (solo para administradores)
router.get('/admin/solicitudes', 
    requireAuth, 
    requireRole('admin', 'superadmin'), 
    listarSolicitudes
);

router.get('/admin/solicitudes/:id', 
    requireAuth, 
    requireRole('admin', 'superadmin'), 
    obtenerSolicitud
);

router.put('/admin/solicitudes/:id/aprobar', 
    requireAuth, 
    requireRole('admin', 'superadmin'), 
    aprobarSolicitud
);

router.put('/admin/solicitudes/:id/rechazar', 
    requireAuth, 
    requireRole('admin', 'superadmin'), 
    rechazarSolicitud
);

export default router;