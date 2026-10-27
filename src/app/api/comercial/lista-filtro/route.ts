import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { getComerciaisFiltro } from "@/lib/db/queries/comerciais-filtro";

// Lista de comerciais para o filtro da Visão Geral (SIGBORS ∪
// CADCRED.gerenteconta) — não confundir com /api/operadores-indicante, usada
// no cadastro de usuários.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_comercial")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  try {
    const operadores = await getComerciaisFiltro();
    return NextResponse.json({ operadores });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/comercial/lista-filtro] falha na consulta", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível carregar a lista de comerciais no momento." },
      { status: 503 },
    );
  }
}
