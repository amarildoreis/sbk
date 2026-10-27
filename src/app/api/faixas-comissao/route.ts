import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { parseFaixaComissaoInput, ValidationError } from "@/lib/faixas-comissao/validate";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "gerenciar_faixas_comissao")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const faixas = await prisma.faixaComissao.findMany({
    orderBy: { jurosMin: "asc" },
  });

  return NextResponse.json({ faixas });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "gerenciar_faixas_comissao")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = parseFaixaComissaoInput(body);

    const faixa = await prisma.faixaComissao.create({ data });
    return NextResponse.json({ faixa }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // eslint-disable-next-line no-console
    console.error("[api/faixas-comissao] falha ao criar faixa", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível salvar a faixa no momento." },
      { status: 500 },
    );
  }
}
