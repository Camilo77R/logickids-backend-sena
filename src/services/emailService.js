import nodemailer from 'nodemailer';

// Configuración del transportador de correo
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: false, // false para puerto 587, true para 465
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Verificar conexión al inicio
transporter.verify((error, success) => {
    if (error) {
        console.error(' Error de configuración de correo:', error);
    } else {
        console.log(' Servicio de correo configurado correctamente');
    }
});

/**
 * Envía un correo electrónico
 * @param {Object} options - Opciones del correo
 * @param {string} options.to - Destinatario
 * @param {string} options.subject - Asunto
 * @param {string} options.html - Contenido HTML
 * @returns {Promise<Object>}
 */
const sendEmail = async ({ to, subject, html }) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: to,
            subject: subject,
            html: html,
        });
        console.log(` Correo enviado a ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(` Error al enviar correo a ${to}:`, error);
        return { success: false, error: error.message };
    }
};

/**
 * Envía notificación al tutor con el resultado de su solicitud
 * @param {Object} params
 * @param {string} params.tutorNombre - Nombre del tutor
 * @param {string} params.tutorEmail - Correo del tutor
 * @param {string} params.resultado - 'aprobado' o 'rechazado'
 * @param {string} params.motivo - Motivo del rechazo (solo si es rechazado)
 */
const enviarResultadoReactivacion = async ({ tutorNombre, tutorEmail, resultado, motivo = null }) => {
    const esAprobado = resultado === 'aprobado';
    
    const subject = esAprobado 
        ? ' Tu cuenta ha sido reactivada - LogicKids'
        : ' Tu solicitud de reactivación fue rechazada - LogicKids';
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${subject}</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #1796ED, #9A4FD3); padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .header h1 { color: white; margin: 0; }
                .content { background: #f5f5f5; padding: 20px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; padding: 10px 20px; background: #1796ED; color: white; text-decoration: none; border-radius: 5px; }
                .footer { margin-top: 20px; font-size: 12px; color: #999; text-align: center; }
                .success { color: #28a745; }
                .error { color: #dc3545; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>LogicKids</h1>
                </div>
                <div class="content">
                    <h2>Hola ${tutorNombre},</h2>
                    
                    ${esAprobado ? `
                        <p class="success"> ¡Tu cuenta ha sido reactivada exitosamente!</p>
                        <p>Ya puedes iniciar sesión en LogicKids y acceder a todas las funcionalidades normalmente.</p>
                        <p>Si tienes alguna pregunta, contacta al administrador de tu institución.</p>
                    ` : `
                        <p class="error"> Tu solicitud de reactivación ha sido rechazada.</p>
                        <p><strong>Motivo del rechazo:</strong></p>
                        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #dc3545;">
                            ${motivo || 'No se especificó un motivo.'}
                        </div>
                        <p>Puedes volver a enviar una nueva solicitud de reactivación si consideras que el motivo puede ser reconsiderado.</p>
                    `}
                </div>
                <div class="footer">
                    <p>Este es un mensaje automático de LogicKids. Por favor no responder a este correo.</p>
                    <p>© ${new Date().getFullYear()} LogicKids - Plataforma Educativa</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    return sendEmail({ to: tutorEmail, subject, html });
};

export { sendEmail, enviarResultadoReactivacion };