import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { GRAFICOS, graficoPdfFilename, buildSubtitulo } from "@/lib/exports/graficos-registry";
import { buildGroupPdfBuffer } from "@/lib/exports/group-pdf";
import { sendMail } from "@/lib/email/mailer";
import { applyAccessScope } from "@/lib/auth/access-scope";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailRequestBody {
  to: string;
  message?: string;
  grafico?: string;
  ano?: number;
  eixo?: string;
  filtros?: { comercial?: string; grupoEconomico?: string; cedente?: string };
  resumoFiltros?: string;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_graficos")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as EmailRequestBody | null;
  if (!body?.to) {
    return NextResponse.json({ error: "Informe ao menos um destinatário." }, { status: 400 });
  }

  const grafico = GRAFICOS[body.grafico ?? ""];
  if (!grafico) {
    return NextResponse.json({ error: "Gráfico inválido." }, { status: 400 });
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

  const ano = body.ano ?? new Date().getFullYear();
  const eixo = body.eixo ?? "";
  const filtros = applyAccessScope(
    {
      ano,
      eixo,
      comercial: body.filtros?.comercial ?? "",
      grupoEconomico: body.filtros?.grupoEconomico ?? "",
      cedente: body.filtros?.cedente ?? "",
    },
    session,
  );

  const nomeUsuario = session?.user?.name ?? "SBK Capital";
  const emailUsuario = session?.user?.email ?? undefined;
  const cc =
    emailUsuario &&
    !destinatarios.some((email) => email.toLowerCase() === emailUsuario.toLowerCase())
      ? emailUsuario
      : undefined;

  try {
    const rows = await grafico.buildRows(filtros);
    const buffer = await buildGroupPdfBuffer({
      titulo: grafico.titulo,
      subtitulo: buildSubtitulo(ano, grafico.eixoLabel(eixo)),
      filtrosResumo: body.resumoFiltros || undefined,
      rows,
      modulo: "Módulo Gráficos",
    });

    const mensagemHtml = `
      <p>Olá,</p>
      <p>${nomeUsuario} compartilhou o gráfico "${grafico.titulo}" (Gráficos) da SBK Capital com você.</p>
      ${body.message ? `<p>${body.message.replace(/\n/g, "<br />")}</p>` : ""}
      <p>Segue o PDF em anexo.</p>
    `;

    const resultado = await sendMail({
      to: destinatarios.join(", "),
      subject: `${grafico.titulo} — Gráficos — ${new Date().toLocaleDateString("pt-BR")}`,
      html: mensagemHtml,
      fromName: nomeUsuario,
      replyTo: emailUsuario,
      cc,
      attachments: [
        {
          filename: graficoPdfFilename(grafico.slug),
          content: buffer,
          contentType: "application/pdf",
        },
      ],
    });

    if (!resultado.sent) {
      return NextResponse.json(
        { error: "Não foi possível enviar o e-mail no momento." },
        { status: 503 },
      );
    }

    return NextResponse.json({ sent: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/graficos/exportar-pdf/email] falha no envio", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
      stack: (error as Error).stack,
    });
    return NextResponse.json(
      { error: "Não foi possível enviar o e-mail no momento." },
      { status: 503 },
    );
  }
}
