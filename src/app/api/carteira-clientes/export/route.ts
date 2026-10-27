import { NextResponse } from "next/server";
import { applyAccessScope } from "@/lib/auth/access-scope";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getCarteiraClientesParaExportacao,
  parseFiltrosFromSearchParams,
  type SortDirection,
} from "@/lib/db/queries/carteira-clientes";
import {
  buildCarteiraClientesWorkbookBuffer,
  carteiraClientesFilename,
} from "@/lib/exports/carteira-clientes-xlsx";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_carteira_clientes")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sortKey = searchParams.get("sort") ?? "risco";
  const sortDir: SortDirection = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const filtros = applyAccessScope(parseFiltrosFromSearchParams(searchParams), session);

  try {
    const rows = await getCarteiraClientesParaExportacao(sortKey, sortDir, filtros);
    const buffer = await buildCarteiraClientesWorkbookBuffer(rows);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${carteiraClientesFilename()}"`,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/carteira-clientes/export] falha na exportação", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível exportar a carteira no momento." },
      { status: 503 },
    );
  }
}
