import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Toda operação aqui confere `usuarioEmail === session.user.email` antes de
// ler/escrever — nunca confia só no `id` da URL (um usuário não pode ler,
// sobrescrever ou apagar a conversa salva de outro).
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const conversa = await prisma.conversaIA.findUnique({ where: { id: params.id } });
  if (!conversa || conversa.usuarioEmail !== session.user.email) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ conversa });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const existente = await prisma.conversaIA.findUnique({ where: { id: params.id } });
  if (!existente || existente.usuarioEmail !== session.user.email) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | { titulo?: string; mensagens?: unknown }
    | null;
  const temMensagens = Array.isArray(body?.mensagens);
  const novoTitulo = body?.titulo?.trim();
  if (!temMensagens && !novoTitulo) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const conversa = await prisma.conversaIA.update({
    where: { id: params.id },
    data: {
      ...(temMensagens ? { mensagens: body!.mensagens as object } : {}),
      ...(novoTitulo ? { titulo: novoTitulo } : {}),
    },
    select: { id: true, titulo: true, updatedAt: true },
  });

  return NextResponse.json({ conversa });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const existente = await prisma.conversaIA.findUnique({ where: { id: params.id } });
  if (!existente || existente.usuarioEmail !== session.user.email) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }

  await prisma.conversaIA.delete({ where: { id: params.id } });
  return NextResponse.json({ deleted: true });
}
