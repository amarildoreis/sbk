import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildGroupPdfBuffer, groupPdfFilename } from "@/lib/exports/group-pdf";

// Exportação PDF de um mini gráfico da Interação por IA (CLAUDE.md seção
// 12) — mesmo builder genérico já usado por Comportamental/Gráficos
// (buildGroupPdfBuffer), sem rodar nova consulta: o cliente já tem `pontos`
// (o mesmo resultado exibido no gráfico, vindo de um template RLS-aplicado)
// e só pede pra formatar como PDF.
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function fmtMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { titulo?: string; pontos?: unknown; itens?: unknown }
    | null;

  if (!body?.titulo?.trim() || (!Array.isArray(body.pontos) && !Array.isArray(body.itens))) {
    return NextResponse.json({ error: "Nada para exportar." }, { status: 400 });
  }

  // Gráfico mensal (jan-dez) ou categórico (ex: um comercial por barra) —
  // mesmo builder de PDF, só muda de onde vem o rótulo de cada linha.
  const rows = Array.isArray(body.itens)
    ? (body.itens as { rotulo: string; valor: number }[])
        .filter((i) => typeof i?.rotulo === "string" && typeof i?.valor === "number")
        .map((i) => ({ label: i.rotulo, value: fmtMoeda(i.valor) }))
    : (body.pontos as { mes: number; valor: number }[])
        .filter((p) => typeof p?.mes === "number" && typeof p?.valor === "number")
        .sort((a, b) => a.mes - b.mes)
        .map((p) => ({ label: MESES[p.mes - 1] ?? `Mês ${p.mes}`, value: fmtMoeda(p.valor) }));

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nada para exportar." }, { status: 400 });
  }

  try {
    const buffer = await buildGroupPdfBuffer({
      titulo: body.titulo.trim(),
      subtitulo: Array.isArray(body.itens) ? "Gráfico por comercial — Interação por IA" : "Gráfico mês a mês — Interação por IA",
      rows,
      modulo: "Interação por IA",
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${groupPdfFilename(slugify(body.titulo), "ia")}"`,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/ia/exportar-grafico-pdf] falha na exportação", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json({ error: "Não foi possível exportar agora." }, { status: 503 });
  }
}
