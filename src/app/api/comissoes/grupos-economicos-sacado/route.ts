import { NextResponse } from "next/server";
import { resolveComercialParam } from "@/lib/auth/access-scope";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { getGruposEconomicosSacadoTitulos } from "@/lib/db/queries/grupos-economicos-titulos";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_comissoes")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const comercial = resolveComercialParam(searchParams.get("comercial") ?? "", session);

  try {
    const grupos = await getGruposEconomicosSacadoTitulos(comercial);
    return NextResponse.json({ grupos });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/comissoes/grupos-economicos-sacado] falha na consulta", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível carregar os grupos econômicos no momento." },
      { status: 503 },
    );
  }
}
