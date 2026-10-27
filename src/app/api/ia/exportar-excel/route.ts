import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildGenericWorkbookBuffer, genericXlsxFilename } from "@/lib/exports/generic-xlsx";

// Exportação Excel de um resultado tabular da Interação por IA (CLAUDE.md
// seção 12) — diferente das demais rotas de exportação, não roda uma nova
// consulta: o cliente já tem `linhas` (o mesmo resultado exibido na tela,
// vindo de um template RLS-aplicado) e só pede pra formatar como .xlsx.
// Continua exigindo sessão válida — mesmo padrão de "Interação por IA" não
// ter `permissionKey` própria, só sessão.
const MAX_LINHAS = 10_000;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { linhas?: unknown; titulo?: string }
    | null;

  if (!Array.isArray(body?.linhas) || body.linhas.length === 0) {
    return NextResponse.json({ error: "Nada para exportar." }, { status: 400 });
  }
  if (body.linhas.length > MAX_LINHAS) {
    return NextResponse.json({ error: "Resultado grande demais para exportar." }, { status: 400 });
  }

  const titulo = body.titulo?.trim() || "Resultado";

  try {
    const buffer = await buildGenericWorkbookBuffer(body.linhas as Record<string, unknown>[], titulo);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${genericXlsxFilename(titulo)}"`,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/ia/exportar-excel] falha na exportação", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json({ error: "Não foi possível exportar agora." }, { status: 503 });
  }
}
