import { NextResponse } from "next/server";
import { resolveComercialParam } from "@/lib/auth/access-scope";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { searchSacados } from "@/lib/db/queries/sacados-busca";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_titulos")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const termo = searchParams.get("q") ?? "";
  const comercial = resolveComercialParam(searchParams.get("comercial") ?? "", session);
  const grupoSacado = searchParams.get("grupoSacado") ?? "";

  try {
    const sacados = await searchSacados(termo, comercial, grupoSacado);
    return NextResponse.json({ sacados });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/relatorio-titulos/sacados] falha na consulta", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível buscar agora." },
      { status: 503 },
    );
  }
}
