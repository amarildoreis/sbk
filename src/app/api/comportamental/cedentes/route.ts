import { NextResponse } from "next/server";
import { applyAccessScope } from "@/lib/auth/access-scope";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { getCedentesComportamental } from "@/lib/db/queries/comportamental-cedentes";

// Efeito cascata: recebe comercial/grupoEconomico já selecionados na popup
// e retorna só os cedentes compatíveis — ver comportamental-cedentes.ts.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_comportamental")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filtros = applyAccessScope(
    {
      comercial: searchParams.get("comercial") ?? "",
      grupoEconomico: searchParams.get("grupoEconomico") ?? "",
    },
    session,
  );

  try {
    const cedentes = await getCedentesComportamental(filtros);
    return NextResponse.json({ cedentes });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/comportamental/cedentes] falha na consulta", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível carregar os cedentes no momento." },
      { status: 503 },
    );
  }
}
