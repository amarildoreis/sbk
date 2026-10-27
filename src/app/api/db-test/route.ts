import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { executeReadQuery } from "@/lib/db/query";

// Endpoint de diagnóstico — valida que a conexão com o SQL Server (FACTORING)
// está de pé, respeitando pool/timeout/retry configurados. Não expõe nenhum
// dado de negócio; só confirma round-trip. Protegido por sessão para não
// virar um jeito de qualquer um bater no banco sem autenticação.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const rows = await executeReadQuery<{ ok: number }>("SELECT 1 AS ok");
    return NextResponse.json({
      status: "ok",
      latencyMs: Date.now() - startedAt,
      result: rows[0]?.ok === 1,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/db-test] falha na conexão", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      {
        status: "error",
        message:
          "Não foi possível conectar ao banco de dados no momento. Tente novamente em instantes.",
      },
      { status: 503 },
    );
  }
}
