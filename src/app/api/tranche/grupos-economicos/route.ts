import { NextResponse } from "next/server";
import { resolveComercialParam } from "@/lib/auth/access-scope";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { getGruposEconomicosCedenteTitulos } from "@/lib/db/queries/grupos-economicos-titulos";

// Efeito cascata: mesma query de relatorio-titulos (universo SIGFIDC
// idêntico), só exposta num endpoint dedicado à tela de Tranche — mesmo
// padrão de "endpoint por tela" do CLAUDE.md 21.14 (aqui gated por
// ver_tranche, não ver_titulos).
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_tranche")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const comercial = resolveComercialParam(searchParams.get("comercial") ?? "", session);

  try {
    const grupos = await getGruposEconomicosCedenteTitulos(comercial);
    return NextResponse.json({ grupos });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/tranche/grupos-economicos] falha na consulta", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível carregar os grupos econômicos no momento." },
      { status: 503 },
    );
  }
}
