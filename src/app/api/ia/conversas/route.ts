import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Conversas salvas da Interação por IA — escopadas por e-mail da sessão
// (não por FK pra Usuario, já que a conta administrativa via variável de
// ambiente não tem linha na tabela `usuarios` — CLAUDE.md seção 12).
const MAX_CONVERSAS = 20;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const conversas = await prisma.conversaIA.findMany({
    where: { usuarioEmail: session.user.email },
    orderBy: { updatedAt: "desc" },
    select: { id: true, titulo: true, updatedAt: true },
  });

  return NextResponse.json({ conversas });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { titulo?: string; mensagens?: unknown }
    | null;
  const titulo = body?.titulo?.trim();
  if (!titulo) {
    return NextResponse.json({ error: "Informe um nome para a conversa." }, { status: 400 });
  }
  if (!Array.isArray(body?.mensagens)) {
    return NextResponse.json({ error: "Conversa vazia — nada para salvar." }, { status: 400 });
  }

  const total = await prisma.conversaIA.count({ where: { usuarioEmail: session.user.email } });
  if (total >= MAX_CONVERSAS) {
    return NextResponse.json(
      {
        error: `Você atingiu o limite de ${MAX_CONVERSAS} conversas salvas. Exclua uma conversa existente antes de salvar uma nova.`,
      },
      { status: 409 },
    );
  }

  const conversa = await prisma.conversaIA.create({
    data: { usuarioEmail: session.user.email, titulo, mensagens: body.mensagens as object },
    select: { id: true, titulo: true, updatedAt: true },
  });

  return NextResponse.json({ conversa }, { status: 201 });
}
