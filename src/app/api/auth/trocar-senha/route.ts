import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const usuarioId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !usuarioId || usuarioId === "admin-env") {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const novaSenha = typeof body.novaSenha === "string" ? body.novaSenha : "";
  const confirmarSenha =
    typeof body.confirmarSenha === "string" ? body.confirmarSenha : "";

  if (novaSenha.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` },
      { status: 400 },
    );
  }
  if (novaSenha !== confirmarSenha) {
    return NextResponse.json(
      { error: "As senhas não coincidem." },
      { status: 400 },
    );
  }

  const usuario = await prisma.usuario.findFirst({
    where: { id: usuarioId, deletedAt: null },
    select: { id: true },
  });
  if (!usuario) {
    return NextResponse.json(
      { error: "Usuário não encontrado." },
      { status: 404 },
    );
  }

  const senhaHash = await bcrypt.hash(novaSenha, 12);
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { senhaHash, mustChangePassword: false },
  });

  return NextResponse.json({ ok: true });
}
