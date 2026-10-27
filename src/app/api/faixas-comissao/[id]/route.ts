import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { parseFaixaComissaoInput, ValidationError } from "@/lib/faixas-comissao/validate";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "gerenciar_faixas_comissao")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = parseFaixaComissaoInput(body);

    const existing = await prisma.faixaComissao.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Faixa não encontrada." }, { status: 404 });
    }

    const faixa = await prisma.faixaComissao.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ faixa });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // eslint-disable-next-line no-console
    console.error("[api/faixas-comissao/:id] falha ao atualizar faixa", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível salvar as alterações no momento." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "gerenciar_faixas_comissao")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const existing = await prisma.faixaComissao.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Faixa não encontrada." }, { status: 404 });
  }

  await prisma.faixaComissao.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
