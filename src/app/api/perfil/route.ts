import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MIN_PASSWORD_LENGTH = 8;
// Mesmo limite usado no cadastro (ver src/lib/usuarios/validate.ts).
const MAX_FOTO_BASE64_LENGTH = 2.8 * 1024 * 1024;

function getUsuarioId(session: Session | null) {
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id || id === "admin-env") return null;
  return id;
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  const usuarioId = getUsuarioId(session);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!usuarioId) {
    return NextResponse.json(
      {
        error:
          "Esta conta administrativa é controlada por variável de ambiente e não pode ser editada por aqui.",
      },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const usuario = await prisma.usuario.findFirst({
    where: { id: usuarioId, deletedAt: null },
  });
  if (!usuario) {
    return NextResponse.json(
      { error: "Usuário não encontrado." },
      { status: 404 },
    );
  }

  const data: { fotoBase64?: string | null; senhaHash?: string } = {};

  if ("fotoBase64" in body) {
    const fotoBase64 = body.fotoBase64;
    if (fotoBase64 !== null && typeof fotoBase64 !== "string") {
      return NextResponse.json({ error: "Foto inválida." }, { status: 400 });
    }
    if (fotoBase64 && fotoBase64.length > MAX_FOTO_BASE64_LENGTH) {
      return NextResponse.json(
        { error: "Foto muito grande — envie uma imagem menor." },
        { status: 400 },
      );
    }
    if (fotoBase64 && !fotoBase64.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Foto inválida — envie uma imagem (data URI)." },
        { status: 400 },
      );
    }
    data.fotoBase64 = fotoBase64;
  }

  if (body.novaSenha) {
    const senhaAtual =
      typeof body.senhaAtual === "string" ? body.senhaAtual : "";
    const novaSenha = typeof body.novaSenha === "string" ? body.novaSenha : "";
    const confirmarSenha =
      typeof body.confirmarSenha === "string" ? body.confirmarSenha : "";

    const senhaAtualValida = await bcrypt.compare(senhaAtual, usuario.senhaHash);
    if (!senhaAtualValida) {
      return NextResponse.json(
        { error: "Senha atual incorreta." },
        { status: 400 },
      );
    }
    if (novaSenha.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` },
        { status: 400 },
      );
    }
    if (novaSenha !== confirmarSenha) {
      return NextResponse.json(
        { error: "As senhas não coincidem." },
        { status: 400 },
      );
    }
    data.senhaHash = await bcrypt.hash(novaSenha, 12);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const atualizado = await prisma.usuario.update({
    where: { id: usuarioId },
    data,
    select: { id: true, nome: true, email: true, fotoBase64: true },
  });

  return NextResponse.json({ usuario: atualizado });
}
