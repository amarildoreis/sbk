import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { getSituacoesTitulo } from "@/lib/db/queries/situacoes-titulo";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_titulos")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  try {
    const situacoes = await getSituacoesTitulo();
    return NextResponse.json({ situacoes });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/relatorio-titulos/situacoes] falha na consulta", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível carregar as situações no momento." },
      { status: 503 },
    );
  }
}
