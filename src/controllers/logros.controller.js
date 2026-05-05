import * as svc from '../services/logros.service.js';
import { AppError } from '../middlewares/errorHandler.js';
import { ok, created } from '../utils/response.js';
import { db } from '../config/db.js';

export const catalogo = async (req, res, next) => {
  try {
    // Permite marcar logros como desbloqueados si se pasa ?estudiante_id=
    // o si el que consulta es un estudiante autenticado (HU-25)
    const estudiante_id = req.estudiante?.id ?? (req.query.estudiante_id ? Number(req.query.estudiante_id) : null);
    const data = await svc.listarCatalogo(estudiante_id);
    ok(res, data, 'Catálogo de logros obtenido correctamente');
  } catch (e) { next(e); }
};

export const misLogros = async (req, res, next) => {
  try {
    const data = await svc.listarPorEstudiante(req.estudiante.id);
    ok(res, data, 'Logros del estudiante obtenidos correctamente');
  } catch (e) { next(e); }
};

export const listar = async (req, res, next) => {
  try {
    const estudianteId = Number(req.params.id);
    const tutorId = req.user.id;
    
    // Verificación corregida
    const pertenece = await db('estudiante_grupo_historial')
      .join('grupos', 'estudiante_grupo_historial.grupo_id', 'grupos.id_grupo')
      .where('grupos.usuario_id', tutorId)
      .where('estudiante_grupo_historial.estudiante_id', estudianteId)
      .where('estudiante_grupo_historial.activo', true)
      .first();
    
    if (!pertenece) {
      return res.status(403).json({ 
        success: false, 
        message: 'No tienes permisos para ver los logros de este estudiante' 
      });
    }
    
    const data = await svc.listarPorEstudiante(estudianteId);
    ok(res, data, 'Logros del estudiante obtenidos correctamente');
  } catch (e) { 
    next(e); 
  }
};

export const desbloquear = async (req, res, next) => {
  try {
    const requestedStudentId = req.params.id ? Number(req.params.id) : req.estudiante.id;
    if (requestedStudentId !== req.estudiante.id) {
      throw new AppError('No puedes desbloquear logros para otro estudiante', 403);
    }

    const data = await svc.desbloquear(req.estudiante.id, req.body.clave_logro);
    created(res, data, 'Logro desbloqueado correctamente');
  } catch (e) { next(e); }
};

// Obtener estudiantes del tutor
export const misEstudiantes = async (req, res, next) => {
  try {
    const tutorId = req.user.id;
    const data = await svc.obtenerEstudiantesDelTutor(tutorId);
    ok(res, data, 'Estudiantes obtenidos correctamente');
  } catch (e) {
    next(e);
  }
};