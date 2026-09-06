import nodemailer from 'nodemailer';

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
  estado: 'pendiente_equipo' | 'pendiente_jefe';
  /** id de la asignatura y clave del apartado (p. ej. "guias.1"), para armar el link directo */
  subjectId: number;
  apartado: string;
}

const COLOR_ESTADO: Record<AvisoPendiente['estado'], { fondo: string; texto: string; label: string }> = {
  pendiente_equipo: { fondo: '#FEE2E2', texto: '#B91C1C', label: 'En proceso' },
  pendiente_jefe: { fondo: '#FEF3C7', texto: '#92400E', label: 'Pendiente jefe' },
};

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
  const color = COLOR_ESTADO[datos.estado];
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
  const estadoLabel = COLOR_ESTADO[datos.estado].label;

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
