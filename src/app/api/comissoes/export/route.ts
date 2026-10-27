import { NextResponse } from "next/server";
import { applyAccessScope } from "@/lib/auth/access-scope";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getComissoesParaExportacao,
  parseFiltrosFromSearchParams,
  type SortDirection,
} from "@/lib/db/queries/comissoes";
import { buildComissoesWorkbookBuffer, comissoesFilename } from "@/lib/exports/comissoes-xlsx";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_comissoes")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sortKey = searchParams.get("sort") ?? "vencimento";
  const sortDir: SortDirection = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const filtros = applyAccessScope(parseFiltrosFromSearchParams(searchParams), session);

  try {
    const rows = await getComissoesParaExportacao(sortKey, sortDir, filtros);
    const buffer = await buildComissoesWorkbookBuffer(rows);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${comissoesFilename()}"`,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/comissoes/export] falha na exportação", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível exportar o relatório no momento." },
      { status: 503 },
    );
  }
}
