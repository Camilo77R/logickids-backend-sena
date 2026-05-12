import { db as knex } from '../config/db.js';
import { enviarResultadoReactivacion } from '../services/emailService.js';

/**
 * Obtener el ID del estado "suspendido" desde la tabla estados_usuario
 */
const getEstadoSuspendidoId = async () => {
    const result = await knex('estados_usuario')
        .select('id_estado_usuario')
        .where('nombre', 'suspendido')
        .first();
    return result ? result.id_estado_usuario : 5;
};

/**
 * Obtener el ID del estado "activo" desde la tabla estados_usuario
 */
const getEstadoActivoId = async () => {
    const result = await knex('estados_usuario')
        .select('id_estado_usuario')
        .where('nombre', 'activo')
        .first();
    return result ? result.id_estado_usuario : 1;
};

/**
 * POST /api/solicitudes/reactivacion
 * Crea una nueva solicitud de reactivación (tutor suspendido)
 */
export const crearSolicitudReactivacion = async (req, res) => {
    try {
        const { email, correo_respuesta, motivo, descripcion } = req.body;

        if (!email || !motivo) {
            return res.status(400).json({
                error: 'Faltan campos requeridos',
                details: 'El email de la cuenta y el motivo son obligatorios'
            });
        }

        const usuario = await knex('usuarios')
            .select('id_usuario', 'nombre', 'email', 'estado_id')
            .where('email', email)
            .first();

        if (!usuario) {
            return res.status(404).json({
                error: 'Usuario no encontrado',
                details: 'No existe una cuenta con ese correo electrónico'
            });
        }

        const suspendidoId = await getEstadoSuspendidoId();
        if (usuario.estado_id !== suspendidoId) {
            return res.status(400).json({
                error: 'Solicitud no permitida',
                details: 'Solo los usuarios suspendidos pueden solicitar reactivación'
            });
        }

        const solicitudExistente = await knex('solicitudes_reactivacion')
            .where('usuario_id', usuario.id_usuario)
            .where('estado_solicitud', 'pendiente')
            .first();

        if (solicitudExistente) {
            return res.status(400).json({
                error: 'Solicitud pendiente',
                details: 'Ya tienes una solicitud de reactivación pendiente.'
            });
        }

        const correoContacto = correo_respuesta && correo_respuesta.trim() !== '' 
            ? correo_respuesta 
            : email;

        const [nuevaSolicitud] = await knex('solicitudes_reactivacion')
            .insert({
                usuario_id: usuario.id_usuario,
                correo_contacto: correoContacto,
                motivo,
                descripcion: descripcion || null,
                estado_solicitud: 'pendiente',
                leida_admin: false,
                fecha_solicitud: knex.fn.now()
            })
            .returning('*');

        res.status(201).json({
            message: 'Solicitud enviada correctamente',
            solicitud: {
                id: nuevaSolicitud.id_solicitud,
                estado: nuevaSolicitud.estado_solicitud,
                fecha: nuevaSolicitud.fecha_solicitud
            }
        });

    } catch (error) {
        console.error('Error en crearSolicitudReactivacion:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

/**
 * GET /api/admin/solicitudes
 */
export const listarSolicitudes = async (req, res) => {
    try {
        const admin = req.user;

        const adminData = await knex('usuarios')
            .select('institucion_id')
            .where('id_usuario', admin.id)
            .first();

        if (!adminData || !adminData.institucion_id) {
            return res.status(403).json({
                error: 'Acceso denegado',
                details: 'No tienes una institución asociada'
            });
        }

        const solicitudes = await knex('solicitudes_reactivacion as sr')
            .select(
                'sr.id_solicitud',
                'sr.usuario_id',
                'sr.correo_contacto',
                'sr.motivo',
                'sr.descripcion',
                'sr.estado_solicitud',
                'sr.respuesta_admin',
                'sr.leida_admin',
                'sr.fecha_solicitud',
                'sr.fecha_respuesta',
                'u.nombre as tutor_nombre',
                'u.email as tutor_email'
            )
            .join('usuarios as u', 'sr.usuario_id', 'u.id_usuario')
            .where('u.institucion_id', adminData.institucion_id)
            .orderBy('sr.fecha_solicitud', 'desc');

        res.json({
            solicitudes,
            total: solicitudes.length
        });

    } catch (error) {
        console.error('Error en listarSolicitudes:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

/**
 * GET /api/admin/solicitudes/:id
 */
export const obtenerSolicitud = async (req, res) => {
    try {
        const { id } = req.params;
        const admin = req.user;

        const solicitud = await knex('solicitudes_reactivacion as sr')
            .select(
                'sr.*',
                'u.nombre as tutor_nombre',
                'u.email as tutor_email',
                'u.institucion_id'
            )
            .join('usuarios as u', 'sr.usuario_id', 'u.id_usuario')
            .where('sr.id_solicitud', id)
            .first();

        if (!solicitud) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }

        const adminData = await knex('usuarios')
            .select('institucion_id')
            .where('id_usuario', admin.id)
            .first();

        if (solicitud.institucion_id !== adminData.institucion_id) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        if (!solicitud.leida_admin) {
            await knex('solicitudes_reactivacion')
                .where('id_solicitud', id)
                .update({ leida_admin: true });
            solicitud.leida_admin = true;
        }

        res.json({ solicitud });

    } catch (error) {
        console.error('Error en obtenerSolicitud:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

/**
 * PUT /api/admin/solicitudes/:id/aprobar
 */
export const aprobarSolicitud = async (req, res) => {
    try {
        const { id } = req.params;
        const admin = req.user;

        const solicitud = await knex('solicitudes_reactivacion as sr')
            .select(
                'sr.*',
                'u.nombre as tutor_nombre',
                'u.email as tutor_email',
                'u.institucion_id'
            )
            .join('usuarios as u', 'sr.usuario_id', 'u.id_usuario')
            .where('sr.id_solicitud', id)
            .first();

        if (!solicitud) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }

        if (solicitud.estado_solicitud !== 'pendiente') {
            return res.status(400).json({
                error: 'Solicitud ya procesada',
                details: `Esta solicitud ya fue ${solicitud.estado_solicitud}`
            });
        }

        const adminData = await knex('usuarios')
            .select('institucion_id')
            .where('id_usuario', admin.id)
            .first();

        if (solicitud.institucion_id !== adminData.institucion_id) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const activoId = await getEstadoActivoId();

        await knex.transaction(async (trx) => {
            await trx('solicitudes_reactivacion')
                .where('id_solicitud', id)
                .update({
                    estado_solicitud: 'aprobado',
                    fecha_respuesta: trx.fn.now()
                });

            await trx('usuarios')
                .where('id_usuario', solicitud.usuario_id)
                .update({
                    estado_id: activoId,
                    actualizado_en: trx.fn.now()
                });
        });

        await enviarResultadoReactivacion({
            tutorNombre: solicitud.tutor_nombre,
            tutorEmail: solicitud.correo_contacto,
            resultado: 'aprobado'
        });

        res.json({
            message: 'Solicitud aprobada y usuario reactivado correctamente',
            usuario_id: solicitud.usuario_id
        });

    } catch (error) {
        console.error('Error en aprobarSolicitud:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

/**
 * PUT /api/admin/solicitudes/:id/rechazar
 */
export const rechazarSolicitud = async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo_rechazo } = req.body;
        const admin = req.user;

        if (!motivo_rechazo || motivo_rechazo.trim() === '') {
            return res.status(400).json({
                error: 'Motivo requerido',
                details: 'Debes proporcionar un motivo para rechazar la solicitud'
            });
        }

        const solicitud = await knex('solicitudes_reactivacion as sr')
            .select(
                'sr.*',
                'u.nombre as tutor_nombre',
                'u.email as tutor_email',
                'u.institucion_id'
            )
            .join('usuarios as u', 'sr.usuario_id', 'u.id_usuario')
            .where('sr.id_solicitud', id)
            .first();

        if (!solicitud) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }

        if (solicitud.estado_solicitud !== 'pendiente') {
            return res.status(400).json({
                error: 'Solicitud ya procesada',
                details: `Esta solicitud ya fue ${solicitud.estado_solicitud}`
            });
        }

        const adminData = await knex('usuarios')
            .select('institucion_id')
            .where('id_usuario', admin.id)
            .first();

        if (solicitud.institucion_id !== adminData.institucion_id) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        await knex('solicitudes_reactivacion')
            .where('id_solicitud', id)
            .update({
                estado_solicitud: 'rechazado',
                respuesta_admin: motivo_rechazo,
                fecha_respuesta: knex.fn.now()
            });

        await enviarResultadoReactivacion({
            tutorNombre: solicitud.tutor_nombre,
            tutorEmail: solicitud.correo_contacto,
            resultado: 'rechazado',
            motivo: motivo_rechazo
        });

        res.json({
            message: 'Solicitud rechazada correctamente',
            usuario_id: solicitud.usuario_id
        });

    } catch (error) {
        console.error('Error en rechazarSolicitud:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};