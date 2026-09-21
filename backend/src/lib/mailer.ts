import nodemailer from 'nodemailer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let transporter: ReturnType<typeof nodemailer.createTransport> | null | undefined;

/**
 * Crea el transporte SMTP una sola vez, a partir de las variables de entorno.
 * Si no están configuradas, devuelve null y el resto del código simplemente
 * omite el envío (no rompe el guardado de la celda por falta de correo).
 */
function getTransporter() {
  if (transporter !== undefined) return transporter;

  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    transporter = null;
    return transporter;
  }

  const puerto = Number(process.env.SMTP_PORT ?? 587);
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: puerto,
    secure: puerto === 465, // 587/25 usan STARTTLS; 465 va cifrado desde el inicio
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
}

interface AvisoPendiente {
  paraEmail: string;
  paraNombre: string;
  asignatura: string;
  categoria: string;
  paso: string;
  /** este aviso solo existe para "Pendiente jefe" -- un paso que solo queda
   *  "En proceso" no avisa por correo (esos avisos son por fecha límite,
   *  fecha de contrato o fecha de entrega, no por el simple cambio de estado) */
  estado: 'pendiente_jefe';
  /** id de la asignatura y clave del apartado (p. ej. "guias.1"), para armar el link directo */
  subjectId: number;
  apartado: string;
}

const COLOR_ESTADO = { fondo: '#FEF3C7', texto: '#92400E', label: 'Pendiente jefe' };

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}

function construirLink(subjectId: number, apartado: string): string {
  const base = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
  return `${base}/asignaturas/${subjectId}?apartado=${encodeURIComponent(apartado)}`;
}

function construirHtml(datos: AvisoPendiente, link: string): string {
  const color = COLOR_ESTADO;
  const asignatura = escapeHtml(datos.asignatura);
  const categoria = escapeHtml(datos.categoria);
  const paso = escapeHtml(datos.paso);
  const nombre = escapeHtml(datos.paraNombre);

  return `
<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#F1F5F9; padding:32px 16px;">
  <div style="max-width:480px; margin:0 auto; background:#FFFFFF; border-radius:16px; overflow:hidden; border:1px solid #E2E8F0;">
    <div style="background:#0F172A; padding:18px 28px;">
      <p style="margin:0; color:#FFFFFF; font-size:14px; font-weight:600; letter-spacing:.02em;">
        Matriz de Seguimiento
      </p>
    </div>

    <div style="padding:28px;">
      <p style="margin:0 0 4px; color:#64748B; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em;">
        ${categoria}
      </p>
      <h1 style="margin:0 0 18px; color:#0F172A; font-size:19px; line-height:1.3;">
        ${asignatura}
      </h1>

      <div style="background:#F8FAFC; border:1px solid #F1F5F9; border-radius:10px; padding:14px 16px; margin-bottom:22px;">
        <p style="margin:0 0 8px; color:#334155; font-size:14px; font-weight:500;">${paso}</p>
        <span style="display:inline-block; background:${color.fondo}; color:${color.texto}; font-size:11px; font-weight:700; padding:4px 10px; border-radius:999px;">
          ${color.label}
        </span>
      </div>

      <p style="margin:0 0 24px; color:#475569; font-size:14px; line-height:1.55;">
        Hola ${nombre}, este paso necesita tu atención.
      </p>

      <a href="${link}"
         style="display:inline-block; background:#0F172A; color:#FFFFFF; text-decoration:none;
                font-size:14px; font-weight:600; padding:12px 22px; border-radius:10px;">
        Ver en la Matriz de Seguimiento →
      </a>
    </div>
  </div>

  <p style="max-width:480px; margin:16px auto 0; text-align:center; color:#94A3B8; font-size:11px;">
    Aviso automático — no hace falta responder a este correo.
  </p>
</div>`.trim();
}

/** Avisa por correo al encargado de una categoría que un paso quedó pendiente. Nunca lanza. */
export async function enviarAvisoPendiente(datos: AvisoPendiente): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(`[mailer] SMTP no configurado — se omite el aviso a ${datos.paraEmail}`);
    return;
  }

  const link = construirLink(datos.subjectId, datos.apartado);
  const estadoLabel = COLOR_ESTADO.label;

  try {
    const info = await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: datos.paraEmail,
      subject: `Pendiente en ${datos.categoria}: ${datos.asignatura}`,
      text:
        `Hola ${datos.paraNombre},\n\n` +
        `El paso "${datos.paso}" (${datos.categoria}) de la asignatura "${datos.asignatura}" ` +
        `quedó en estado "${estadoLabel}" y necesita tu atención.\n\n` +
        `Verlo en la Matriz de Seguimiento: ${link}\n\n` +
        `— Matriz de Seguimiento`,
      html: construirHtml(datos, link),
    });
    console.log(`[mailer] Aviso enviado a ${datos.paraEmail} (${info.messageId})`);
  } catch (err) {
    console.error(`[mailer] No se pudo enviar el aviso a ${datos.paraEmail}:`, err);
  }
}

interface AvisoContratoPorVencer {
  paraEmail: string;
  paraNombre: string;
  docente: string;
  asignatura: string;
  programa: string;
  /** 'YYYY-MM-DD' */
  endDate: string;
  diasRestantes: number;
  avancePorcentaje: number;
  subjectId: number;
}

function construirLinkAsignatura(subjectId: number): string {
  const base = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
  return `${base}/asignaturas/${subjectId}`;
}

let confettiGif: Buffer | null | undefined;

/**
 * Lee (una sola vez) el GIF animado de confeti que se incrusta en el correo de
 * finalización. La ruta se resuelve desde la raíz del backend, que es el cwd
 * con el que corren `npm run dev` y PM2 (el mismo desde el que dotenv lee
 * backend/.env). Si el archivo no está, devuelve null y el correo se envía
 * igual, sin la animación. Nunca lanza.
 */
function getConfettiGif(): Buffer | null {
  if (confettiGif !== undefined) return confettiGif;

  const candidatos = [
    join(process.cwd(), 'assets', 'confetti.gif'),
    join(process.cwd(), 'backend', 'assets', 'confetti.gif'),
  ];
  for (const ruta of candidatos) {
    try {
      confettiGif = readFileSync(ruta);
      return confettiGif;
    } catch {
      // probamos la siguiente ubicación
    }
  }

  console.warn('[mailer] No se encontró assets/confetti.gif — el correo irá sin la animación');
  confettiGif = null;
  return confettiGif;
}

function fechaLegible(iso: string): string {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

function construirHtmlContrato(datos: AvisoContratoPorVencer, link: string, vencido: boolean): string {
  const docente = escapeHtml(datos.docente);
  const asignatura = escapeHtml(datos.asignatura);
  const programa = escapeHtml(datos.programa);
  const nombre = escapeHtml(datos.paraNombre);
  const cuando = vencido
    ? `venció hace ${Math.abs(datos.diasRestantes)} ${Math.abs(datos.diasRestantes) === 1 ? 'día' : 'días'}`
    : `vence en ${datos.diasRestantes} ${datos.diasRestantes === 1 ? 'día' : 'días'}`;

  return `
<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#F1F5F9; padding:32px 16px;">
  <div style="max-width:480px; margin:0 auto; background:#FFFFFF; border-radius:16px; overflow:hidden; border:1px solid #E2E8F0;">
    <div style="background:#0F172A; padding:18px 28px;">
      <p style="margin:0; color:#FFFFFF; font-size:14px; font-weight:600; letter-spacing:.02em;">
        Matriz de Seguimiento
      </p>
    </div>

    <div style="padding:28px;">
      <p style="margin:0 0 4px; color:#64748B; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em;">
        ${programa}
      </p>
      <h1 style="margin:0 0 18px; color:#0F172A; font-size:19px; line-height:1.3;">
        ${asignatura}
      </h1>

      <div style="background:#FEF2F2; border:1px solid #FEE2E2; border-radius:10px; padding:14px 16px; margin-bottom:22px;">
        <p style="margin:0 0 6px; color:#334155; font-size:14px; font-weight:500;">
          El contrato de <strong>${docente}</strong> ${cuando} (${fechaLegible(datos.endDate)})
        </p>
        <span style="display:inline-block; background:#FEE2E2; color:#B91C1C; font-size:11px; font-weight:700; padding:4px 10px; border-radius:999px;">
          Matriz al ${datos.avancePorcentaje}%
        </span>
      </div>

      <p style="margin:0 0 24px; color:#475569; font-size:14px; line-height:1.55;">
        Hola ${nombre}, todavía quedan pasos sin terminar en esta asignatura y el contrato del docente
        está por vencer. Puede hacer falta gestionar una prórroga o cerrar lo pendiente antes de esa fecha.
      </p>

      <a href="${link}"
         style="display:inline-block; background:#0F172A; color:#FFFFFF; text-decoration:none;
                font-size:14px; font-weight:600; padding:12px 22px; border-radius:10px;">
        Ver la asignatura →
      </a>
    </div>
  </div>

  <p style="max-width:480px; margin:16px auto 0; text-align:center; color:#94A3B8; font-size:11px;">
    Aviso automático — no hace falta responder a este correo.
  </p>
</div>`.trim();
}

/**
 * Avisa por correo al encargado de "Tipo de contrato" que el contrato de un
 * docente está por vencer (o ya venció) y la matriz de esa asignatura
 * todavía no está completa. Nunca lanza.
 */
export async function enviarAvisoContratoPorVencer(datos: AvisoContratoPorVencer): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(`[mailer] SMTP no configurado — se omite el aviso de contrato a ${datos.paraEmail}`);
    return;
  }

  const link = construirLinkAsignatura(datos.subjectId);
  const vencido = datos.diasRestantes < 0;
  const cuando = vencido
    ? `venció hace ${Math.abs(datos.diasRestantes)} día(s)`
    : `vence en ${datos.diasRestantes} día(s)`;

  try {
    const info = await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: datos.paraEmail,
      subject: `Contrato por vencer: ${datos.docente} — ${datos.asignatura}`,
      text:
        `Hola ${datos.paraNombre},\n\n` +
        `El contrato de "${datos.docente}" en la asignatura "${datos.asignatura}" (${datos.programa}) ` +
        `${cuando} (${fechaLegible(datos.endDate)}) y la matriz todavía está al ${datos.avancePorcentaje}%.\n\n` +
        `Verla en la Matriz de Seguimiento: ${link}\n\n` +
        `— Matriz de Seguimiento`,
      html: construirHtmlContrato(datos, link, vencido),
    });
    console.log(`[mailer] Aviso de contrato enviado a ${datos.paraEmail} (${info.messageId})`);
  } catch (err) {
    console.error(`[mailer] No se pudo enviar el aviso de contrato a ${datos.paraEmail}:`, err);
  }
}

interface AvisoFechaLimite {
  paraEmail: string;
  paraNombre: string;
  categoria: string;
  paso: string;
  asignatura: string;
  /** 'YYYY-MM-DD' */
  dueDate: string;
  diasRestantes: number;
  subjectId: number;
  apartado: string;
}

function construirHtmlFechaLimite(datos: AvisoFechaLimite, link: string, vencido: boolean): string {
  const categoria = escapeHtml(datos.categoria);
  const paso = escapeHtml(datos.paso);
  const asignatura = escapeHtml(datos.asignatura);
  const nombre = escapeHtml(datos.paraNombre);
  const cuando = vencido
    ? `venció hace ${Math.abs(datos.diasRestantes)} ${Math.abs(datos.diasRestantes) === 1 ? 'día' : 'días'}`
    : `vence en ${datos.diasRestantes} ${datos.diasRestantes === 1 ? 'día' : 'días'}`;

  return `
<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#F1F5F9; padding:32px 16px;">
  <div style="max-width:480px; margin:0 auto; background:#FFFFFF; border-radius:16px; overflow:hidden; border:1px solid #E2E8F0;">
    <div style="background:#0F172A; padding:18px 28px;">
      <p style="margin:0; color:#FFFFFF; font-size:14px; font-weight:600; letter-spacing:.02em;">
        Matriz de Seguimiento
      </p>
    </div>

    <div style="padding:28px;">
      <p style="margin:0 0 4px; color:#64748B; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em;">
        ${categoria}
      </p>
      <h1 style="margin:0 0 18px; color:#0F172A; font-size:19px; line-height:1.3;">
        ${asignatura}
      </h1>

      <div style="background:#FEF2F2; border:1px solid #FEE2E2; border-radius:10px; padding:14px 16px; margin-bottom:22px;">
        <p style="margin:0 0 6px; color:#334155; font-size:14px; font-weight:500;">${paso}</p>
        <span style="display:inline-block; background:#FEE2E2; color:#B91C1C; font-size:11px; font-weight:700; padding:4px 10px; border-radius:999px;">
          Fecha límite ${cuando} (${fechaLegible(datos.dueDate)})
        </span>
      </div>

      <p style="margin:0 0 24px; color:#475569; font-size:14px; line-height:1.55;">
        Hola ${nombre}, este paso todavía no está terminado y su fecha límite está por vencer.
      </p>

      <a href="${link}"
         style="display:inline-block; background:#0F172A; color:#FFFFFF; text-decoration:none;
                font-size:14px; font-weight:600; padding:12px 22px; border-radius:10px;">
        Ver en la Matriz de Seguimiento →
      </a>
    </div>
  </div>

  <p style="max-width:480px; margin:16px auto 0; text-align:center; color:#94A3B8; font-size:11px;">
    Aviso automático — no hace falta responder a este correo.
  </p>
</div>`.trim();
}

interface CorreoRecuperacion {
  paraEmail: string;
  paraNombre: string;
  /** token en claro (sin hashear); solo vive en este correo, nunca en la base */
  token: string;
}

function construirLinkRecuperacion(token: string): string {
  const base = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
  return `${base}/restablecer-password?token=${encodeURIComponent(token)}`;
}

function construirHtmlRecuperacion(nombre: string, link: string): string {
  return `
<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#F1F5F9; padding:32px 16px;">
  <div style="max-width:480px; margin:0 auto; background:#FFFFFF; border-radius:16px; overflow:hidden; border:1px solid #E2E8F0;">
    <div style="background:#0F172A; padding:18px 28px;">
      <p style="margin:0; color:#FFFFFF; font-size:14px; font-weight:600; letter-spacing:.02em;">
        Matriz de Seguimiento
      </p>
    </div>

    <div style="padding:28px;">
      <h1 style="margin:0 0 18px; color:#0F172A; font-size:19px; line-height:1.3;">
        Restablecer contraseña
      </h1>

      <p style="margin:0 0 24px; color:#475569; font-size:14px; line-height:1.55;">
        Hola ${nombre}, recibimos una solicitud para restablecer tu contraseña. Si fuiste tú,
        hacé clic en el botón de abajo para elegir una nueva. El enlace vence en 1 hora.
      </p>

      <a href="${link}"
         style="display:inline-block; background:#0F172A; color:#FFFFFF; text-decoration:none;
                font-size:14px; font-weight:600; padding:12px 22px; border-radius:10px;">
        Restablecer contraseña →
      </a>

      <p style="margin:24px 0 0; color:#94A3B8; font-size:12px; line-height:1.5;">
        Si no solicitaste esto, ignorá este correo — tu contraseña sigue siendo la misma.
      </p>
    </div>
  </div>

  <p style="max-width:480px; margin:16px auto 0; text-align:center; color:#94A3B8; font-size:11px;">
    Aviso automático — no hace falta responder a este correo.
  </p>
</div>`.trim();
}

/**
 * Envía el correo de "olvidé mi contraseña" con el link para restablecerla.
 * Nunca lanza — el llamador siempre responde igual al usuario, exista o no
 * exista esa cuenta, para no filtrar qué correos están registrados.
 */
export async function enviarCorreoRecuperacion(datos: CorreoRecuperacion): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(`[mailer] SMTP no configurado — se omite el correo de recuperación a ${datos.paraEmail}`);
    return;
  }

  const nombre = escapeHtml(datos.paraNombre);
  const link = construirLinkRecuperacion(datos.token);

  try {
    const info = await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: datos.paraEmail,
      subject: 'Restablecer tu contraseña — Matriz de Seguimiento',
      text:
        `Hola ${datos.paraNombre},\n\n` +
        `Recibimos una solicitud para restablecer tu contraseña. Si fuiste vos, ` +
        `abrí este enlace para elegir una nueva (vence en 1 hora):\n\n${link}\n\n` +
        `Si no solicitaste esto, ignorá este correo.\n\n` +
        `— Matriz de Seguimiento`,
      html: construirHtmlRecuperacion(nombre, link),
    });
    console.log(`[mailer] Correo de recuperación enviado a ${datos.paraEmail} (${info.messageId})`);
  } catch (err) {
    console.error(`[mailer] No se pudo enviar el correo de recuperación a ${datos.paraEmail}:`, err);
  }
}

interface AvisoLibroNoEntregado {
  paraEmail: string;
  paraNombre: string;
  /** nombres de los docentes de la asignatura, ya unidos con ", " -- null si no hay ninguno asignado */
  docentes: string | null;
  asignatura: string;
  programa: string;
  /** 'YYYY-MM-DD' */
  bookDueDate: string;
  diasRestantes: number;
  subjectId: number;
}

function construirHtmlLibroNoEntregado(datos: AvisoLibroNoEntregado, link: string): string {
  const asignatura = escapeHtml(datos.asignatura);
  const programa = escapeHtml(datos.programa);
  const nombre = escapeHtml(datos.paraNombre);
  const diasVencido = Math.abs(datos.diasRestantes);

  return `
<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#F1F5F9; padding:32px 16px;">
  <div style="max-width:480px; margin:0 auto; background:#FFFFFF; border-radius:16px; overflow:hidden; border:1px solid #E2E8F0;">
    <div style="background:#0F172A; padding:18px 28px;">
      <p style="margin:0; color:#FFFFFF; font-size:14px; font-weight:600; letter-spacing:.02em;">
        Matriz de Seguimiento
      </p>
    </div>

    <div style="padding:28px;">
      <p style="margin:0 0 4px; color:#64748B; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em;">
        ${programa}
      </p>
      <h1 style="margin:0 0 18px; color:#0F172A; font-size:19px; line-height:1.3;">
        ${asignatura}
      </h1>

      <div style="background:#FEF2F2; border:1px solid #FEE2E2; border-radius:10px; padding:14px 16px; margin-bottom:22px;">
        <p style="margin:0 0 6px; color:#334155; font-size:14px; font-weight:500;">
          Todavía no se ha entregado el libro${datos.docentes ? ` (${escapeHtml(datos.docentes)})` : ''}
        </p>
        <span style="display:inline-block; background:#FEE2E2; color:#B91C1C; font-size:11px; font-weight:700; padding:4px 10px; border-radius:999px;">
          Fecha tentativa venció hace ${diasVencido} ${diasVencido === 1 ? 'día' : 'días'} (${fechaLegible(datos.bookDueDate)})
        </span>
      </div>

      <p style="margin:0 0 24px; color:#475569; font-size:14px; line-height:1.55;">
        Hola ${nombre}, los docentes habían dado esta fecha como tentativa para la entrega del libro
        ("Recepción de libro"), pero esa fecha ya pasó y el paso todavía no está terminado.
      </p>

      <a href="${link}"
         style="display:inline-block; background:#0F172A; color:#FFFFFF; text-decoration:none;
                font-size:14px; font-weight:600; padding:12px 22px; border-radius:10px;">
        Ver la asignatura →
      </a>
    </div>
  </div>

  <p style="max-width:480px; margin:16px auto 0; text-align:center; color:#94A3B8; font-size:11px;">
    Aviso automático — no hace falta responder a este correo.
  </p>
</div>`.trim();
}

/**
 * Avisa por correo al encargado de "Libro" que una asignatura no entregó el
 * libro para la fecha tentativa que los docentes habían dado (el paso
 * "Recepción de libro" todavía no está en 'terminado'). Nunca lanza.
 */
export async function enviarAvisoLibroNoEntregado(datos: AvisoLibroNoEntregado): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(`[mailer] SMTP no configurado — se omite el aviso de libro no entregado a ${datos.paraEmail}`);
    return;
  }

  const link = construirLinkAsignatura(datos.subjectId);
  const diasVencido = Math.abs(datos.diasRestantes);

  try {
    const info = await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: datos.paraEmail,
      subject: `Libro no entregado: ${datos.asignatura}`,
      text:
        `Hola ${datos.paraNombre},\n\n` +
        `Los docentes${datos.docentes ? ` (${datos.docentes})` : ''} habían dado el ${fechaLegible(datos.bookDueDate)} ` +
        `como fecha tentativa de entrega del libro en la asignatura "${datos.asignatura}" (${datos.programa}), ` +
        `pero ya pasaron ${diasVencido} día(s) y "Recepción de libro" todavía no está terminado.\n\n` +
        `Verla en la Matriz de Seguimiento: ${link}\n\n` +
        `— Matriz de Seguimiento`,
      html: construirHtmlLibroNoEntregado(datos, link),
    });
    console.log(`[mailer] Aviso de libro no entregado enviado a ${datos.paraEmail} (${info.messageId})`);
  } catch (err) {
    console.error(`[mailer] No se pudo enviar el aviso de libro no entregado a ${datos.paraEmail}:`, err);
  }
}

/**
 * Avisa por correo al encargado de una categoría (OVA, Podcast, Video de
 * contenido, Guías) que la fecha límite de un paso puntual (p. ej. "Creación
 * de guión") está por vencer y ese paso todavía no está terminado. Nunca
 * lanza.
 */
export async function enviarAvisoFechaLimite(datos: AvisoFechaLimite): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(`[mailer] SMTP no configurado — se omite el aviso de fecha límite a ${datos.paraEmail}`);
    return;
  }

  const link = construirLink(datos.subjectId, datos.apartado);
  const vencido = datos.diasRestantes < 0;
  const cuando = vencido
    ? `venció hace ${Math.abs(datos.diasRestantes)} día(s)`
    : `vence en ${datos.diasRestantes} día(s)`;

  try {
    const info = await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: datos.paraEmail,
      subject: `Fecha límite por vencer en ${datos.categoria}: ${datos.asignatura}`,
      text:
        `Hola ${datos.paraNombre},\n\n` +
        `El paso "${datos.paso}" (${datos.categoria}) de la asignatura "${datos.asignatura}" ` +
        `${cuando} (${fechaLegible(datos.dueDate)}) y todavía no está terminado.\n\n` +
        `Verlo en la Matriz de Seguimiento: ${link}\n\n` +
        `— Matriz de Seguimiento`,
      html: construirHtmlFechaLimite(datos, link, vencido),
    });
    console.log(`[mailer] Aviso de fecha límite enviado a ${datos.paraEmail} (${info.messageId})`);
  } catch (err) {
    console.error(`[mailer] No se pudo enviar el aviso de fecha límite a ${datos.paraEmail}:`, err);
  }
}

interface AvisoAsignaturaCompleta {
  paraEmail: string;
  paraNombre: string;
  asignatura: string;
  programa: string;
  /** URL del aula virtual (paso "Link aula" de "Revisión final"); null si todavía no se llenó */
  linkAula: string | null;
  subjectId: number;
}

export function construirHtmlAsignaturaCompleta(datos: AvisoAsignaturaCompleta, link: string): string {
  const asignatura = escapeHtml(datos.asignatura);
  const programa = escapeHtml(datos.programa);
  const nombre = escapeHtml(datos.paraNombre);
  const linkAulaEscapado = datos.linkAula ? escapeHtml(datos.linkAula) : null;

  return `
<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#F1F5F9; padding:32px 16px;">
  <div style="max-width:480px; margin:0 auto; background:#FFFFFF; border-radius:16px; overflow:hidden; border:1px solid #E2E8F0;">
    <div style="background:#0F172A; text-align:center;">
      <img src="cid:confetti" alt="🎉🥳🎊" width="432"
           style="display:block; margin:0 auto; width:100%; max-width:432px; height:auto; border:0;" />
      <p style="margin:0; padding:0 28px 22px; color:#FFFFFF; font-size:15px; font-weight:700; letter-spacing:.02em;">
        ¡Asignatura finalizada!
      </p>
    </div>

    <div style="padding:28px;">
      <p style="margin:0 0 4px; color:#64748B; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em;">
        ${programa}
      </p>
      <h1 style="margin:0 0 18px; color:#0F172A; font-size:19px; line-height:1.3;">
        ${asignatura}
      </h1>

      <div style="background:#F0FDF4; border:1px solid #DCFCE7; border-radius:10px; padding:14px 16px; margin-bottom:22px;">
        <p style="margin:0; color:#166534; font-size:14px; font-weight:600;">
          ✅ 100% completa — todos los pasos de la matriz quedaron en "Terminado"
        </p>
      </div>

      <p style="margin:0 0 24px; color:#475569; font-size:14px; line-height:1.55;">
        Hola ${nombre}, 🎈 el aula de <strong>${asignatura}</strong> ya está lista de punta a punta. ¡Buen trabajo al equipo! 🙌
      </p>

      ${linkAulaEscapado ? `
      <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:12px 14px; margin-bottom:12px;">
        <p style="margin:0 0 4px; color:#64748B; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.04em;">
          Link del aula virtual
        </p>
        <a href="${linkAulaEscapado}" style="color:#0F172A; font-size:13px; word-break:break-all; text-decoration:underline;">
          ${linkAulaEscapado}
        </a>
      </div>
      <a href="${linkAulaEscapado}"
         style="display:block; text-align:center; background:#3F7D5C; color:#FFFFFF; text-decoration:none;
                font-size:14px; font-weight:700; padding:14px 22px; border-radius:10px; margin-bottom:12px;">
        Ir al aula virtual →
      </a>` : ''}

      <a href="${link}"
         style="display:block; text-align:center; background:#0F172A; color:#FFFFFF; text-decoration:none;
                font-size:14px; font-weight:600; padding:12px 22px; border-radius:10px;">
        Ver en la Matriz de Seguimiento →
      </a>
    </div>
  </div>

  <p style="max-width:480px; margin:16px auto 0; text-align:center; color:#94A3B8; font-size:11px;">
    Aviso automático — no hace falta responder a este correo. 🎉
  </p>
</div>`.trim();
}

/**
 * Avisa por correo, con festejo incluido 🎉, que una asignatura quedó 100%
 * completa (todos sus pasos visibles en 'terminado') -- incluye el link al
 * aula virtual si ya se llenó (paso "Link aula" de "Revisión final"). Nunca
 * lanza.
 */
export async function enviarAvisoAsignaturaCompleta(datos: AvisoAsignaturaCompleta): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(`[mailer] SMTP no configurado — se omite el aviso de finalización a ${datos.paraEmail}`);
    return;
  }

  const link = construirLinkAsignatura(datos.subjectId);
  const confetti = getConfettiGif();

  try {
    const info = await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: datos.paraEmail,
      subject: `🎉 ¡Asignatura finalizada!: ${datos.asignatura}`,
      text:
        `Hola ${datos.paraNombre},\n\n` +
        `¡La asignatura "${datos.asignatura}" (${datos.programa}) quedó 100% completa! Todos los pasos de la ` +
        `matriz están en "Terminado".\n\n` +
        (datos.linkAula ? `Link del aula virtual: ${datos.linkAula}\n\n` : '') +
        `Verla en la Matriz de Seguimiento: ${link}\n\n` +
        `— Matriz de Seguimiento`,
      html: construirHtmlAsignaturaCompleta(datos, link),
      // El GIF va adjunto y referenciado por cid: así el correo se ve animado
      // en Outlook/Gmail sin depender de imágenes remotas.
      attachments: confetti
        ? [{ filename: 'confetti.gif', content: confetti, cid: 'confetti', contentDisposition: 'inline' }]
        : undefined,
    });
    console.log(`[mailer] Aviso de finalización enviado a ${datos.paraEmail} (${info.messageId})`);
  } catch (err) {
    console.error(`[mailer] No se pudo enviar el aviso de finalización a ${datos.paraEmail}:`, err);
  }
}
