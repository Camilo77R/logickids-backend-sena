// En el backend, modifica src/routes/logros.routes.js
import { Router } from 'express';
import * as ctrl from '../controllers/logros.controller.js';
import { requireAuth, requireEstudiante } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { desbloquearLogroSchema } from '../schemas/logros.schema.js';
import { db } from '../config/db.js';

const router = Router();

router.get('/catalogo', ctrl.catalogo);
router.get('/mis-logros', requireEstudiante, ctrl.misLogros);
router.get('/estudiante/:id', requireAuth, ctrl.listar);
router.post('/desbloquear', requireEstudiante, validate(desbloquearLogroSchema), ctrl.desbloquear);
router.post('/estudiante/:id', requireEstudiante, validate(desbloquearLogroSchema), ctrl.desbloquear);

// Endpoint corregido para obtener estudiantes del tutor
router.get('/mis-estudiantes', requireAuth, async (req, res, next) => {
  try {
    console.log('Usuario autenticado:', req.user);
    
    // Consulta para obtener estudiantes del tutor
    const estudiantes = await db('estudiante')
      .leftJoin('estudiante_grupo_historial', 'estudiante.id_estudiante', 'estudiante_grupo_historial.estudiante_id')
      .leftJoin('grupos', 'estudiante_grupo_historial.grupo_id', 'grupos.id_grupo')
      .where('grupos.usuario_id', req.user.id)
      .whereNull('estudiante_grupo_historial.fecha_fin')
      .select(
        'estudiante.id_estudiante as id',
        'estudiante.nombre',
        'estudiante.edad',
        'estudiante.color_avatar',
        'estudiante.sesion_activa'
      )
      .orderBy('estudiante.nombre');
    
    console.log('Estudiantes encontrados:', estudiantes.length);
    res.json({ success: true, data: estudiantes });
  } catch (error) {
    console.error('Error en mis-estudiantes:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;