import nodemailer from "nodemailer";

interface SendMailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  /**
   * Nome de exibição do remetente (ex: nome do usuário logado que disparou o
   * envio). O endereço autenticado (SMTP_FROM/SMTP_USER) continua sendo o
   * mesmo — trocar só o endereço quebraria SPF/DKIM e cairia em spam. Vira
   * `"${fromName}" <endereço-da-plataforma>`.
   */
  fromName?: string;
  /** Para onde vão as respostas — normalmente o e-mail do usuário logado. */
  replyTo?: string;
  /**
   * Cópia — normalmente o e-mail do usuário logado, além do replyTo. Garante
   * que ele sempre tem uma cópia do que foi enviado, sem depender de o
   * destinatário responder (nem de cada cliente de e-mail respeitar
   * Reply-To do mesmo jeito).
   */
  cc?: string;
  attachments?: SendMailAttachment[];
}

interface SendMailResult {
  sent: boolean;
  reason?: "smtp-not-configured" | "send-failed";
}

function getTransportConfig() {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;

  return {
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: (process.env.SMTP_SECURE ?? "false").trim().toLowerCase() === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  };
}

/**
 * Envia um e-mail. Se SMTP não estiver configurado (.env.local), não lança
 * erro — só loga um aviso e retorna sent:false, para nunca quebrar o fluxo
 * de cadastro de usuário por falta de credenciais de e-mail.
 */
export async function sendMail({
  to,
  subject,
  html,
  fromName,
  replyTo,
  cc,
  attachments,
}: SendMailInput): Promise<SendMailResult> {
  const config = getTransportConfig();
  if (!config) {
    // eslint-disable-next-line no-console
    console.warn("[email] SMTP não configurado em .env.local — envio pulado", {
      to,
      subject,
    });
    return { sent: false, reason: "smtp-not-configured" };
  }

  // Endereço autenticado nunca muda (SPF/DKIM) — só o nome de exibição, para
  // o e-mail aparecer como enviado "por" o usuário logado.
  const baseFrom = process.env.SMTP_FROM || config.auth?.user || "";
  const baseAddress = baseFrom.match(/<(.+)>/)?.[1] ?? baseFrom;
  const from = fromName ? `"${fromName}" <${baseAddress}>` : baseFrom;

  try {
    const transporter = nodemailer.createTransport(config);
    await transporter.sendMail({
      from,
      to,
      subject,
      html,
      replyTo,
      cc,
      attachments,
    });
    return { sent: true };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[email] falha ao enviar", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return { sent: false, reason: "send-failed" };
  }
}
