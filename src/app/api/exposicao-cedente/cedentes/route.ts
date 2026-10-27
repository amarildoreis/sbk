import { NextResponse } from "next/server";
import { resolveComercialParam } from "@/lib/auth/access-scope";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { getCedentesTitulosFiltrado } from "@/lib/db/queries/cedentes-titulos";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_exposicao_cedente")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const comercial = resolveComercialParam(searchParams.get("comercial") ?? "", session);
  const grupoEconomico = searchParams.get("grupoEconomico") ?? "";

  try {
    const cedentes = await getCedentesTitulosFiltrado(comercial, grupoEconomico);
    return NextResponse.json({ cedentes });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/exposicao-cedente/cedentes] falha na consulta", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível carregar os cedentes no momento." },
      { status: 503 },
    );
  }
}
