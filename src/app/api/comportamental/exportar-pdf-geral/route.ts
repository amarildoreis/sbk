import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { GRUPOS_COMPORTAMENTAL } from "@/lib/exports/comportamental-grupos-registry";
import { buildMultiGroupPdfBuffer, multiGroupPdfFilename } from "@/lib/exports/group-pdf";
import { applyAccessScope } from "@/lib/auth/access-scope";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_comportamental")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filtros = applyAccessScope(
    {
      comercial: searchParams.get("comercial") ?? "",
      grupoEconomico: searchParams.get("grupoEconomico") ?? "",
      cedente: searchParams.get("cedente") ?? "",
    },
    session,
  );
  const filtrosResumo = searchParams.get("resumo") ?? "";

  try {
    const grupos = Object.values(GRUPOS_COMPORTAMENTAL);
    const secoes = await Promise.all(
      grupos.map(async (grupo) => ({
        titulo: grupo.titulo,
        rows: await grupo.buildRows(filtros),
      })),
    );
    const buffer = await buildMultiGroupPdfBuffer({
      titulo: "Relatório Geral",
      subtitulo: "Módulo Comportamental — SBK Capital",
      filtrosResumo: filtrosResumo || undefined,
      secoes,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${multiGroupPdfFilename()}"`,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/comportamental/exportar-pdf-geral] falha na exportação", {
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
