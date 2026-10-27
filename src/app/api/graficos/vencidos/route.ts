import { NextResponse } from "next/server";
import { applyAccessScope } from "@/lib/auth/access-scope";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getGraficoVencidosMensal,
  parseFiltrosFromSearchParams,
} from "@/lib/db/queries/graficos-vencidos";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_graficos")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filtros = applyAccessScope(parseFiltrosFromSearchParams(searchParams), session);
  const forceRefresh = searchParams.get("refresh") === "1";

  try {
    const pontos = await getGraficoVencidosMensal(filtros, forceRefresh);
    return NextResponse.json({ pontos });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/graficos/vencidos] falha na consulta", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível carregar o gráfico no momento." },
      { status: 503 },
    );
  }
}
