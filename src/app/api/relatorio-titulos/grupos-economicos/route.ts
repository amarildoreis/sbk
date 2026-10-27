import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { getGruposEconomicos } from "@/lib/db/queries/grupos-economicos";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_titulos")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  try {
    const grupos = await getGruposEconomicos();
    return NextResponse.json({ grupos });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/relatorio-titulos/grupos-economicos] falha na consulta", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível carregar os grupos econômicos no momento." },
      { status: 503 },
    );
  }
}
