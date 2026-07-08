import nodemailer from 'nodemailer';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRAND_CHARACTER_FILE = 'loogoo-nodemailer.png';
const BRAND_CHARACTER_PATH = join(__dirname, '../assets/email', BRAND_CHARACTER_FILE);
const BRAND_CHARACTER_CID = 'logickids-brand-character';

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

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const getPrimerNombre = (nombre, fallback) => escapeHtml(nombre?.trim().split(/\s+/)[0] || fallback);

const getBrandCharacterUrl = () => {
  if (!env.EMAIL_PUBLIC_BASE_URL) {
    return null;
  }

  return `${env.EMAIL_PUBLIC_BASE_URL.replace(/\/$/, '')}/email-assets/${BRAND_CHARACTER_FILE}`;
};

const getBrandCharacterSrc = () => getBrandCharacterUrl() || `cid:${BRAND_CHARACTER_CID}`;

const getEmailAttachments = () => {
  if (env.EMAIL_PUBLIC_BASE_URL) {
    return [];
  }

  return [
    {
      filename: 'personaje-logickids.png',
      path: BRAND_CHARACTER_PATH,
      contentType: 'image/png',
      contentDisposition: 'inline',
      cid: BRAND_CHARACTER_CID,
    },
  ];
};

const renderActionItems = (items) =>
  items
    .map(
      (item) => `
        <tr>
          <td style="padding: 10px 0; border-top: 1px solid #d9efe7;">
            <span style="display: inline-block; width: 9px; height: 9px; margin-right: 12px; border-radius: 999px; background: #7b36d8;"></span>
            <span>${escapeHtml(item)}</span>
          </td>
        </tr>
      `,
    )
    .join('');

const renderExecutiveEmail = ({
  subject,
  eyebrow,
  title,
  greetingName,
  intro,
  highlight,
  status = 'success',
  detailsTitle,
  details = [],
  notice,
}) => {
  const statusColor = status === 'danger' ? '#ef4444' : '#22c55e';
  const brandCharacterSrc = getBrandCharacterSrc();

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="color-scheme" content="dark light" />
      <title>${escapeHtml(subject)}</title>
    </head>
    <body style="margin: 0; padding: 0; background: #101216; font-family: Arial, Helvetica, sans-serif; color: #ffffff;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; background: #101216;">
        <tr>
          <td align="center" style="padding: 28px 12px;">
            <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width: 100%; max-width: 640px; background: #202329; border-radius: 0; overflow: hidden;">
              <tr>
                <td style="padding: 0; background: #202329;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="padding: 42px 54px 20px 54px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                          <tr>
                            <td style="vertical-align: bottom;">
                              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(90deg, #7b36d8 0%, #5465ef 42%, #18b8d6 100%); border-radius: 24px 24px 0 0;">
                                <tr>
                                  <td width="68%" style="padding: 28px 26px; vertical-align: middle;">
                                    <table role="presentation" cellspacing="0" cellpadding="0">
                                      <tr>
                                        <td style="font-size: 28px; line-height: 1; font-weight: 900; color: #ffffff;">
                                          Logic<span style="color: #ffe45f;">Kids</span>
                                        </td>
                                        <td style="padding-left: 16px;">
                                          <span style="display: block; width: 2px; height: 34px; background: rgba(255,255,255,0.82);"></span>
                                        </td>
                                        <td style="padding-left: 16px; color: #ffffff; font-size: 13px; line-height: 1.35; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase;">
                                          ${escapeHtml(eyebrow)}
                                        </td>
                                      </tr>
                                    </table>
                                  </td>
                                  <td width="32%" align="right" style="padding: 0 14px 0 0; vertical-align: bottom;">
                                    <img src="${brandCharacterSrc}" alt="Personaje LogicKids" width="224" style="display: block; width: 224px; max-width: 224px; height: auto; margin: -52px -18px -58px auto; border: 0;" />
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 42px 108px 18px 108px; background: #202329;">
                        <p style="margin: 0 0 14px 0; color: #ffffff; font-size: 25px; line-height: 1.3;">
                          Hola, <strong style="font-weight: 900; font-style: italic;">${greetingName}</strong>
                        </p>
                        <h1 style="margin: 0 0 24px 0; color: #ffffff; font-size: 35px; line-height: 1.16; font-weight: 400; letter-spacing: 0;">
                          ${escapeHtml(title)}
                        </h1>
                        <p style="margin: 0; color: #ffffff; font-size: 26px; line-height: 1.34;">
                          ${intro}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 108px 18px 108px; background: #202329;">
                  <p style="margin: 0 0 30px 0; color: ${statusColor}; font-size: 22px; line-height: 1.42; font-weight: 900; font-style: italic;">
                    ${highlight}
                  </p>
                  ${
                    details.length
                      ? `
                        <p style="margin: 0 0 18px 0; color: #ffffff; font-size: 24px; line-height: 1.36;">
                          ${escapeHtml(detailsTitle)}:
                        </p>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 0; background: #ffffff; border-radius: 28px 28px 0 0; overflow: hidden;">
                          <tr>
                            <td style="padding: 28px 34px 30px 34px; color: #141821; font-size: 19px; line-height: 1.45; font-weight: 800;">
                              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                ${renderActionItems(details)}
                              </table>
                            </td>
                          </tr>
                        </table>
                      `
                      : ''
                  }
                  <p style="margin: 28px 0 0 0; color: #ffffff; font-size: 19px; line-height: 1.55;">
                    ${notice}
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 54px 38px 54px; background: #202329;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #181b21; border-radius: 0;">
                    <tr>
                      <td align="center" style="padding: 18px 24px; color: #aeb6c5; font-size: 12px; line-height: 1.6;">
                        Este es un mensaje automatico de LogicKids. Por favor no responder a este correo.<br />
                        &copy; ${new Date().getFullYear()} LogicKids
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

export const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  const mailer = resolveTransporter();

  if (!mailer) {
    console.warn('[email.service] Servicio de correo no configurado; se omite el envio.');
    return {
      success: false,
      skipped: true,
      error: 'Servicio de correo no configurado',
    };
  }

  try {
    const mailOptions = {
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
    };

    if (attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    const info = await mailer.sendMail(mailOptions);
    console.log(`Correo enviado a ${to}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Error al enviar correo a ${to}:`, error);
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
  const primerNombre = getPrimerNombre(tutorNombre, 'Usuario');

  const subject = esAprobado
    ? 'Tu cuenta ha sido reactivada - LogicKids'
    : 'Solicitud de reactivacion rechazada - LogicKids';

  const html = renderExecutiveEmail({
    subject,
    eyebrow: 'Comunicacion institucional',
    title: esAprobado ? 'Reactivacion exitosa' : 'Solicitud no aprobada',
    greetingName: primerNombre,
    status: esAprobado ? 'success' : 'danger',
    intro: esAprobado
      ? 'La administracion reviso tu solicitud y habilito nuevamente tu acceso a la plataforma.'
      : 'La administracion reviso tu solicitud y determino que por ahora no puede ser aprobada.',
    highlight: esAprobado
      ? 'Tu cuenta ya se encuentra activa.'
      : `Motivo: ${escapeHtml(motivo || 'No se especifico un motivo.')}`,
    detailsTitle: esAprobado ? 'A partir de ahora puedes' : '',
    details: esAprobado
      ? ['Ingresar a tu panel de tutor', 'Consultar tus grupos asignados', 'Continuar el seguimiento de tus estudiantes']
      : [],
    notice: esAprobado
      ? 'Ya puedes iniciar sesion con tus credenciales habituales.'
      : 'Si consideras que la situacion cambio, puedes enviar una nueva solicitud para que sea evaluada.',
  });

  return sendEmail({
    to: tutorEmail,
    subject,
    html,
    attachments: getEmailAttachments(),
  });
};

export const enviarCorreoActivacionTutor = async ({ tutorNombre, tutorEmail }) => {
  const primerNombre = getPrimerNombre(tutorNombre, 'Tutor');
  const subject = 'Tu cuenta ha sido activada - LogicKids';

  const html = renderExecutiveEmail({
    subject,
    eyebrow: 'Acceso aprobado',
    title: 'Cuenta activada',
    greetingName: primerNombre,
    intro:
      'Bienvenido a LogicKids. Tu cuenta de tutor fue activada por la administracion de tu institucion.',
    highlight: 'Ya puedes acceder a tu espacio de trabajo.',
    detailsTitle: 'Como tutor puedes',
    details: [
      'Acceder a tus grupos y estudiantes',
      'Gestionar sesiones de clase',
      'Revisar el progreso de tus alumnos',
    ],
    notice: 'Inicia sesion para continuar con el acompanamiento pedagogico de tus estudiantes.',
  });

  return sendEmail({
    to: tutorEmail,
    subject,
    html,
    attachments: getEmailAttachments(),
  });
};
