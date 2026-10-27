import { NextResponse } from "next/server";
import { applyAccessScope } from "@/lib/auth/access-scope";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getBorderosLiberadosParaExportacao,
  type BorderosLiberadosFiltros,
  type SortDirection,
} from "@/lib/db/queries/borderos-liberados";
import {
  buildBorderosLiberadosWorkbookBuffer,
  borderosLiberadosFilename,
} from "@/lib/exports/borderos-liberados-xlsx";
import { sendMail } from "@/lib/email/mailer";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailRequestBody {
  to: string;
  message?: string;
  sort?: string;
  dir?: SortDirection;
  filtros?: BorderosLiberadosFiltros;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_borderos_liberados")) {
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

  const sortKey = body.sort ?? "dataLiberacao";
  const sortDir: SortDirection = body.dir === "asc" ? "asc" : "desc";
  const filtros = applyAccessScope(body.filtros ?? {}, session);

  const nomeUsuario = session?.user?.name ?? "SBK Capital";
  const emailUsuario = session?.user?.email ?? undefined;
  const cc =
    emailUsuario && !destinatarios.some((email) => email.toLowerCase() === emailUsuario.toLowerCase())
      ? emailUsuario
      : undefined;

  try {
    const rows = await getBorderosLiberadosParaExportacao(sortKey, sortDir, filtros);
    const buffer = await buildBorderosLiberadosWorkbookBuffer(rows);

    const mensagemHtml = `
      <p>Olá,</p>
      <p>${nomeUsuario} compartilhou o relatório de Borderôs Liberados da SBK Capital com você.</p>
      ${body.message ? `<p>${body.message.replace(/\n/g, "<br />")}</p>` : ""}
      <p>${rows.length.toLocaleString("pt-BR")} borderô${rows.length === 1 ? "" : "s"} no arquivo em anexo.</p>
    `;

    const resultado = await sendMail({
      to: destinatarios.join(", "),
      subject: `Borderôs Liberados — ${new Date().toLocaleDateString("pt-BR")}`,
      html: mensagemHtml,
      fromName: nomeUsuario,
      replyTo: emailUsuario,
      cc,
      attachments: [
        {
          filename: borderosLiberadosFilename(),
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
    console.error("[api/borderos-liberados/export/email] falha no envio", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível enviar o e-mail no momento." },
      { status: 503 },
    );
  }
}
