import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { searchBorderos } from "@/lib/db/queries/borderos-busca";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_titulos")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const termo = searchParams.get("q") ?? "";

  try {
    const borderos = await searchBorderos(termo);
    return NextResponse.json({ borderos });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/relatorio-titulos/borderos] falha na consulta", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível buscar agora." },
      { status: 503 },
    );
  }
}
