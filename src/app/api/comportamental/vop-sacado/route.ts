import { NextResponse } from "next/server";
import { applyAccessScope } from "@/lib/auth/access-scope";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getVopSacado,
  parseFiltrosFromSearchParams,
} from "@/lib/db/queries/comportamental-vop-sacado";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_comportamental")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filtros = applyAccessScope(parseFiltrosFromSearchParams(searchParams), session);
  const forceRefresh = searchParams.get("refresh") === "1";

  try {
    const totais = await getVopSacado(filtros, forceRefresh);
    return NextResponse.json(totais);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/comportamental/vop-sacado] falha na consulta", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
      stack: (error as Error).stack,
    });
    return NextResponse.json(
      { error: "Não foi possível carregar o VOP Sacado no momento." },
      { status: 503 },
    );
  }
}
