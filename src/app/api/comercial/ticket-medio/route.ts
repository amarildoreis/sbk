import { NextResponse } from "next/server";
import { resolveComercialParam } from "@/lib/auth/access-scope";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { getTicketMedio } from "@/lib/db/queries/ticket-medio";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_comercial")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const comercial = resolveComercialParam(searchParams.get("comercial") ?? "", session);
  const forceRefresh = searchParams.get("refresh") === "1";

  try {
    const { geral, estoque } = await getTicketMedio(comercial, forceRefresh);
    return NextResponse.json({ geral, estoque });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/comercial/ticket-medio] falha na consulta", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível carregar o indicador no momento." },
      { status: 503 },
    );
  }
}
