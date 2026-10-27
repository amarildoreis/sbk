import { NextResponse } from "next/server";
import { applyAccessScope } from "@/lib/auth/access-scope";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getTrancheParaExportacao,
  parseFiltrosFromSearchParams,
  type SortDirection,
} from "@/lib/db/queries/tranche";
import { buildTrancheWorkbookBuffer, trancheFilename } from "@/lib/exports/tranche-xlsx";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_tranche")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sortKey = searchParams.get("sort") ?? "vencimento";
  const sortDir: SortDirection = searchParams.get("dir") === "desc" ? "desc" : "asc";
  const filtros = applyAccessScope(parseFiltrosFromSearchParams(searchParams), session);

  try {
    const rows = await getTrancheParaExportacao(sortKey, sortDir, filtros);
    const buffer = await buildTrancheWorkbookBuffer(rows);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${trancheFilename()}"`,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/tranche/export] falha na exportação", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível exportar o relatório no momento." },
      { status: 503 },
    );
  }
}
