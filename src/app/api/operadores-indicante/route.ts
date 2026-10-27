import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOperadoresIndicante } from "@/lib/db/queries/operadores-indicante";

// Lista de apoio (código + nome do comercial) usada em mais de uma tela:
// cadastro de usuários (seletor "Comercial do Sistema") e o filtro de
// Comercial da Visão Geral. Basta estar autenticado — cada tela que consome
// isso já tem seu próprio controle de permissão (cadastrar_usuarios /
// ver_comercial); aqui só exigimos sessão válida.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  try {
    const operadores = await getOperadoresIndicante();
    return NextResponse.json({ operadores });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/operadores-indicante] falha na consulta", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível carregar a lista de comerciais no momento." },
      { status: 503 },
    );
  }
}
