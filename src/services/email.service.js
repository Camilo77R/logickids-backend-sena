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
 * Notifica al tutor que su cuenta fue creada pero queda inactiva
 * hasta que el administrador la active manualmente.
 */
export const notificarRegistroTutor = async ({ tutorNombre, tutorEmail }) => {
  const subject = 'Tu cuenta de LogicKids ha sido creada';

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
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>LogicKids</h1>
        </div>
        <div class="content">
          <h2>Hola ${tutorNombre},</h2>
          <p>Tu cuenta ha sido creada exitosamente.</p>
          <p>Quedará <strong>inactiva</strong> hasta que el administrador de tu institución la active. Recibirás un correo cuando esté lista para usar.</p>
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

/**
 * Notifica al tutor que su cuenta ha sido activada manualmente por el admin
 * El correo incluye las funciones del tutor (sin botón de inicio de sesión)
 */
export const notificarActivacionTutor = async ({ tutorNombre, tutorEmail }) => {
  const subject = '¡CUENTA ACTIVADA!';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>${subject}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1796ED, #9A4FD3); padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .header h2 { color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 20px; }
        .content { background: #f5f5f5; padding: 30px 25px; border-radius: 0 0 10px 10px; }
        .greeting { font-size: 18px; color: #333; margin-bottom: 20px; }
        .message { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .features { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .features h3 { color: #1796ED; margin-top: 0; margin-bottom: 15px; }
        .features ul { margin: 0; padding-left: 20px; }
        .features li { margin: 10px 0; color: #555; }
        .footer { margin-top: 25px; font-size: 12px; color: #999; text-align: center; }
        hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>LogicKids</h1>
          <h2>${subject}</h2>
        </div>
        <div class="content">
          <div class="greeting">
            <strong>Hola ${tutorNombre},</strong>
          </div>
          
          <div class="message">
            <p>Tu cuenta de tutor ha sido <strong>activada</strong> por la administración de tu institución.</p>
          </div>
          
          <div class="features">
            <h3>Como tutor puedes:</h3>
            <ul>
              <li>Acceder a tus grupos y estudiantes</li>
              <li>Gestionar sesiones de clase</li>
              <li>Revisar el progreso de tus alumnos</li>
            </ul>
          </div>
          
          <p>Ya puedes iniciar sesión.</p>
        </div>
        <div class="footer">
          <hr>
          <p>Este es un mensaje automático de LogicKids. Por favor no responder a este correo.</p>
          <p>© ${new Date().getFullYear()} LogicKids</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to: tutorEmail, subject, html });
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