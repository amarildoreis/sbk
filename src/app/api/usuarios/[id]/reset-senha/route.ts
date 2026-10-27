import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { generateRandomPassword } from "@/lib/usuarios/password";
import { sendMail } from "@/lib/email/mailer";
import { renderPasswordResetEmail } from "@/lib/email/password-reset-template";

export async function POST(
  request: Request,
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

  const body = await request.json().catch(() => ({}));
  const enviarEmail = body.enviarEmail === true;

  const senhaGerada = generateRandomPassword();
  const senhaHash = await bcrypt.hash(senhaGerada, 12);

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { senhaHash, mustChangePassword: true },
  });

  let emailSent = false;
  if (enviarEmail) {
    const loginUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/login`;
    const result = await sendMail({
      to: usuario.email,
      subject: "Sua senha na plataforma SBK Capital foi redefinida",
      html: renderPasswordResetEmail({
        nome: usuario.nome,
        email: usuario.email,
        senha: senhaGerada,
        loginUrl,
      }),
    });
    emailSent = result.sent;
  }

  return NextResponse.json({
    // Só aparece aqui, na resposta do reset — nunca em listagem/detalhe.
    senhaGerada,
    emailSent,
  });
}
