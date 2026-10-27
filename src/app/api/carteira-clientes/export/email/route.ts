import { NextResponse } from "next/server";
import { applyAccessScope } from "@/lib/auth/access-scope";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getCarteiraClientesParaExportacao,
  type CarteiraClientesFiltros,
  type SortDirection,
} from "@/lib/db/queries/carteira-clientes";
import {
  buildCarteiraClientesWorkbookBuffer,
  carteiraClientesFilename,
} from "@/lib/exports/carteira-clientes-xlsx";
import { sendMail } from "@/lib/email/mailer";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailRequestBody {
  to: string;
  message?: string;
  sort?: string;
  dir?: SortDirection;
  filtros?: CarteiraClientesFiltros;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_carteira_clientes")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as EmailRequestBody | null;
  if (!body?.to) {
    return NextResponse.json({ error: "Informe ao menos um destinatário." }, { status: 400 });
  }

  const destinatarios = body.to
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  if (destinatarios.length === 0 || destinatarios.some((email) => !EMAIL_REGEX.test(email))) {
    return NextResponse.json(
      { error: "Um ou mais destinatários têm e-mail inválido." },
      { status: 400 },
    );
  }

  const sortKey = body.sort ?? "risco";
  const sortDir: SortDirection = body.dir === "asc" ? "asc" : "desc";
  const filtros = applyAccessScope(body.filtros ?? {}, session);

  const nomeUsuario = session?.user?.name ?? "SBK Capital";
  const emailUsuario = session?.user?.email ?? undefined;
  const cc =
    emailUsuario &&
    !destinatarios.some((email) => email.toLowerCase() === emailUsuario.toLowerCase())
      ? emailUsuario
      : undefined;

  try {
    const rows = await getCarteiraClientesParaExportacao(sortKey, sortDir, filtros);
    const buffer = await buildCarteiraClientesWorkbookBuffer(rows);

    const mensagemHtml = `
      <p>Olá,</p>
      <p>${nomeUsuario} compartilhou a Carteira de Clientes da SBK Capital com você.</p>
      ${body.message ? `<p>${body.message.replace(/\n/g, "<br />")}</p>` : ""}
      <p>${rows.length.toLocaleString("pt-BR")} cedente${rows.length === 1 ? "" : "s"} no arquivo em anexo.</p>
    `;

    const resultado = await sendMail({
      to: destinatarios.join(", "),
      subject: `Carteira de Clientes — ${new Date().toLocaleDateString("pt-BR")}`,
      html: mensagemHtml,
      fromName: nomeUsuario,
      replyTo: emailUsuario,
      cc,
      attachments: [
        {
          filename: carteiraClientesFilename(),
          content: Buffer.from(buffer),
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    });

    if (!resultado.sent) {
      return NextResponse.json(
        { error: "Não foi possível enviar o e-mail no momento." },
        { status: 503 },
      );
    }

    return NextResponse.json({ sent: true, total: rows.length });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/carteira-clientes/export/email] falha no envio", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível enviar o e-mail no momento." },
      { status: 503 },
    );
  }
}
