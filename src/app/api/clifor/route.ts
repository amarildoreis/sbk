import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { searchClifor } from "@/lib/db/queries/clifor";

// Busca sob demanda (não lista tudo — SIGCAD tem ~57 mil linhas). Usado hoje
// só no cadastro de usuários (Cedente/Sacado vinculado), mesma permissão.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "cadastrar_usuarios")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const termo = searchParams.get("q") ?? "";

  try {
    const clifores = await searchClifor(termo);
    return NextResponse.json({ clifores });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/clifor] falha na consulta", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível buscar agora." },
      { status: 503 },
    );
  }
}
