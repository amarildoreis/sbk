import { NextResponse } from "next/server";
import { applyAccessScope } from "@/lib/auth/access-scope";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getCarteiraSacados,
  parseFiltrosFromSearchParams,
  type SortDirection,
} from "@/lib/db/queries/carteira-sacados";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_carteira_sacados")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "50");
  const sortKey = searchParams.get("sort") ?? "riscoSacado";
  const sortDir: SortDirection = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const filtros = applyAccessScope(parseFiltrosFromSearchParams(searchParams), session);
  const forceRefresh = searchParams.get("refresh") === "1";

  try {
    const resultado = await getCarteiraSacados(
      page,
      pageSize,
      sortKey,
      sortDir,
      filtros,
      forceRefresh,
    );
    return NextResponse.json(resultado);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/carteira-sacados] falha na consulta", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível carregar o relatório no momento." },
      { status: 503 },
    );
  }
}
