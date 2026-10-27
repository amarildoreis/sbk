import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { parseUsuarioInput, ValidationError } from "@/lib/usuarios/validate";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "cadastrar_usuarios")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const usuario = await prisma.usuario.findFirst({
    where: { id: params.id, deletedAt: null },
  });
  if (!usuario) {
    return NextResponse.json(
      { error: "Usuário não encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json({ usuario });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "cadastrar_usuarios")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { enviarEmail: _enviarEmail, ...data } = parseUsuarioInput(body);

    const existing = await prisma.usuario.findFirst({
      where: { id: params.id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Usuário não encontrado." },
        { status: 404 },
      );
    }

    // E-mail só precisa ser único entre usuários ATIVOS (exclui o próprio
    // registro sendo editado da checagem).
    const emailInUse = await prisma.usuario.findFirst({
      where: { email: data.email, deletedAt: null, NOT: { id: params.id } },
      select: { id: true },
    });
    if (emailInUse) {
      return NextResponse.json(
        { error: "Já existe um usuário ativo com esse e-mail." },
        { status: 409 },
      );
    }

    const usuario = await prisma.usuario.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ usuario });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // eslint-disable-next-line no-console
    console.error("[api/usuarios/:id] falha ao atualizar usuário", {
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
  if (!hasPermission(session, "cadastrar_usuarios")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const usuarioLogadoId = (session?.user as { id?: string } | undefined)?.id;
  if (usuarioLogadoId === params.id) {
    return NextResponse.json(
      { error: "Você não pode excluir seu próprio usuário." },
      { status: 400 },
    );
  }

  const existing = await prisma.usuario.findFirst({
    where: { id: params.id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Usuário não encontrado." },
      { status: 404 },
    );
  }

  const deletedBy =
    session?.user?.name ?? session?.user?.email ?? usuarioLogadoId ?? "desconhecido";

  await prisma.usuario.update({
    where: { id: params.id },
    data: { deletedAt: new Date(), deletedBy },
  });

  return NextResponse.json({ ok: true });
}
