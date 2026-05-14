import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

const hasEmailConfig = () =>
  Boolean(env.EMAIL_HOST && env.EMAIL_PORT && env.EMAIL_USER && env.EMAIL_PASS && env.EMAIL_FROM);

const resolveTransporter = () => {
  if (!hasEmailConfig()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: Number(env.EMAIL_PORT),
      secure: Number(env.EMAIL_PORT) === 465,
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASS,
      },
    });
  }

  return transporter;
};

/**
 * Envía un correo electrónico de forma segura.
 *
 * POR QUÉ:
 * - no queremos efectos secundarios al importar el módulo
 * - el backend debe poder vivir aunque el SMTP no esté configurado
 * - las notificaciones son útiles, pero no deben tumbar el flujo principal
 */
export const sendEmail = async ({ to, subject, html }) => {
  const mailer = resolveTransporter();

  if (!mailer) {
    console.warn('[email.service] Servicio de correo no configurado; se omite el envío.');
    return {
      success: false,
      skipped: true,
      error: 'Servicio de correo no configurado',
    };
  }

  try {
    const info = await mailer.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[email.service] Error al enviar correo a ${to}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Envía al tutor el resultado de su solicitud de reactivación.
 */
export const enviarResultadoReactivacion = async ({
  tutorNombre,
  tutorEmail,
  resultado,
  motivo = null,
}) => {
  const esAprobado = resultado === 'aprobado';
  const subject = esAprobado
    ? 'Tu cuenta ha sido reactivada - LogicKids'
    : 'Tu solicitud de reactivación fue rechazada - LogicKids';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>${subject}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1796ED, #9A4FD3); padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .header h1 { color: white; margin: 0; }
        .content { background: #f5f5f5; padding: 20px; border-radius: 0 0 10px 10px; }
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
          ${
            esAprobado
              ? `
                <p class="success">Tu cuenta ha sido reactivada exitosamente.</p>
                <p>Ya puedes iniciar sesión en LogicKids y acceder a tus herramientas normalmente.</p>
              `
              : `
                <p class="error">Tu solicitud de reactivación fue rechazada.</p>
                <p><strong>Motivo:</strong></p>
                <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #dc3545;">
                  ${motivo || 'No se especificó un motivo.'}
                </div>
              `
          }
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
