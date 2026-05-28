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
    console.log(` Correo enviado a ${to}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(` Error al enviar correo a ${to}:`, error);
    return { success: false, error: error.message };
  }
};

export const enviarResultadoReactivacion = async ({
  tutorNombre,
  tutorEmail,
  resultado,
  motivo = null,
}) => {
  const esAprobado = resultado === 'aprobado';
  const primerNombre = tutorNombre?.split(' ')[0] || 'Usuario';

  const subject = esAprobado
    ? ' ¡Tu cuenta ha sido reactivada! - LogicKids'
    : ' Solicitud de reactivación rechazada - LogicKids';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${subject}</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: 'Segoe UI', 'Poppins', sans-serif;
          background-color: #f0f2f5;
        }
        .container {
          max-width: 500px;
          margin: 30px auto;
          background: white;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          text-align: center;
        }
        .header {
          background: linear-gradient(135deg, #1796ED 0%, #9A4FD3 100%);
          padding: 25px;
        }
        .header h1 {
          color: white;
          margin: 0;
          font-size: 28px;
        }
        .content {
          padding: 30px;
        }
        .title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 20px;
        }
        .title-success { color: #10b981; }
        .title-error { color: #ef4444; }
        .motivo-box {
          background: #fef2f2;
          padding: 15px;
          border-radius: 12px;
          margin: 20px 0;
        }
        .footer {
          background: #f8fafc;
          padding: 15px;
          font-size: 11px;
          color: #94a3b8;
        }
        p {
          margin: 15px 0;
          line-height: 1.5;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1> LogicKids</h1>
        </div>
        <div class="content">
          ${
            esAprobado
              ? `
                <div class="title title-success"> ¡REACTIVACIÓN EXITOSA! </div>
                <p>Hola ${primerNombre},</p>
                <p>Tu cuenta ha sido <strong>reactivada exitosamente</strong>.</p>
                <p>Ya puedes iniciar sesión.</p>
              `
              : `
                <div class="title title-error"> SOLICITUD RECHAZADA</div>
                <p>Hola ${primerNombre},</p>
                <p>Tu solicitud de reactivación no ha sido aprobada.</p>
                <div class="motivo-box">
                  <strong> Motivo:</strong><br>${motivo || 'No se especificó un motivo.'}
                </div>
                <p>Si consideras que el motivo puede volverse a tomar en cuenta, puedes volver a enviar tu solicitud.</p>
              `
          }
        </div>
        <div class="footer">
          <p>Este es un mensaje automático de LogicKids. Por favor no responder a este correo.</p>
          <p>© ${new Date().getFullYear()} LogicKids</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to: tutorEmail, subject, html });
};

export const enviarCorreoActivacionTutor = async ({ tutorNombre, tutorEmail }) => {
  const primerNombre = tutorNombre?.split(' ')[0] || 'Tutor';

  const subject = ' ¡Tu cuenta ha sido activada! - LogicKids';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${subject}</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: 'Segoe UI', 'Poppins', sans-serif;
          background-color: #f0f2f5;
        }
        .container {
          max-width: 500px;
          margin: 30px auto;
          background: white;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          text-align: center;
        }
        .header {
          background: linear-gradient(135deg, #1796ED 0%, #9A4FD3 100%);
          padding: 25px;
        }
        .header h1 {
          color: white;
          margin: 0;
          font-size: 28px;
        }
        .content {
          padding: 30px;
        }
        .title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 20px;
          color: #10b981;
        }
        .info-box {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          padding: 15px;
          border-radius: 12px;
          margin: 20px 0;
          text-align: left;
        }
        .info-box ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .info-box li {
          padding: 6px 0;
          color: #166534;
        }
        .info-box li::before {
          content: "• ";
          font-weight: bold;
        }
        .footer {
          background: #f8fafc;
          padding: 15px;
          font-size: 11px;
          color: #94a3b8;
        }
        p {
          margin: 15px 0;
          line-height: 1.5;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1> LogicKids</h1>
        </div>
        <div class="content">
          <div class="title"> ¡CUENTA ACTIVADA! </div>
          <p>Hola ${primerNombre},</p>
          <p>Tu cuenta de <strong>tutor</strong> ha sido <strong>activada</strong> por la administración de tu institución.</p>
          <div class="info-box">
            <p style="margin: 0 0 10px 0; font-weight: bold;">Como tutor puedes:</p>
            <ul>
              <li>Acceder a tus grupos y estudiantes</li>
              <li>Gestionar sesiones de clase</li>
              <li>Revisar el progreso de tus alumnos</li>
            </ul>
          </div>j 432werdsf 
          <p>Ya puedes iniciar sesión.</p>
        </div>
        <div class="footer">
          <p>Este es un mensaje automático de LogicKids. Por favor no responder a este correo.</p>
          <p>© ${new Date().getFullYear()} LogicKids</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to: tutorEmail, subject, html });
};