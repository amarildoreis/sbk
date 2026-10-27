import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { GRAFICOS, graficoPdfFilename, buildSubtitulo } from "@/lib/exports/graficos-registry";
import { buildGroupPdfBuffer } from "@/lib/exports/group-pdf";
import { applyAccessScope } from "@/lib/auth/access-scope";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_graficos")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const graficoSlug = searchParams.get("grafico") ?? "";
  const grafico = GRAFICOS[graficoSlug];
  if (!grafico) {
    return NextResponse.json({ error: "Gráfico inválido." }, { status: 400 });
  }

  const ano = Number(searchParams.get("ano")) || new Date().getFullYear();
  const eixo = searchParams.get("eixo") ?? "";
  const filtros = applyAccessScope(
    {
      ano,
      eixo,
      comercial: searchParams.get("comercial") ?? "",
      grupoEconomico: searchParams.get("grupoEconomico") ?? "",
      cedente: searchParams.get("cedente") ?? "",
    },
    session,
  );
  const filtrosResumo = searchParams.get("resumo") ?? "";

  try {
    const rows = await grafico.buildRows(filtros);
    const buffer = await buildGroupPdfBuffer({
      titulo: grafico.titulo,
      subtitulo: buildSubtitulo(ano, grafico.eixoLabel(eixo)),
      filtrosResumo: filtrosResumo || undefined,
      rows,
      modulo: "Módulo Gráficos",
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${graficoPdfFilename(grafico.slug)}"`,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/graficos/exportar-pdf] falha na exportação", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
      stack: (error as Error).stack,
    });
    return NextResponse.json(
      { error: "Não foi possível exportar o PDF no momento." },
      { status: 503 },
    );
  }
}
