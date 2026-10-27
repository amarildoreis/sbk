import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { parseUsuarioInput, ValidationError } from "@/lib/usuarios/validate";
import { generateRandomPassword } from "@/lib/usuarios/password";
import { sendMail } from "@/lib/email/mailer";
import { renderWelcomeEmail } from "@/lib/email/welcome-template";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "cadastrar_usuarios")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const usuarios = await prisma.usuario.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nome: true,
      email: true,
      perfil: true,
      status: true,
      fotoBase64: true,
      permissoes: true,
      comercialTipo: true,
    },
  });

  return NextResponse.json({ usuarios });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "cadastrar_usuarios")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = parseUsuarioInput(body);

    // E-mail só precisa ser único entre usuários ATIVOS — um e-mail de um
    // usuário excluído logicamente pode ser reaproveitado num cadastro novo.
    const existingActive = await prisma.usuario.findFirst({
      where: { email: data.email, deletedAt: null },
      select: { id: true },
    });
    if (existingActive) {
      return NextResponse.json(
        { error: "Já existe um usuário ativo com esse e-mail." },
        { status: 409 },
      );
    }

    const senhaGerada = generateRandomPassword();
    const senhaHash = await bcrypt.hash(senhaGerada, 12);

    const { enviarEmail, ...usuarioData } = data;

    const usuario = await prisma.usuario.create({
      data: {
        ...usuarioData,
        senhaHash,
        mustChangePassword: true,
      },
    });

    let emailSent = false;
    if (enviarEmail) {
      const loginUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/login`;
      const result = await sendMail({
        to: usuario.email,
        subject: "Seu acesso à plataforma SBK Capital",
        html: renderWelcomeEmail({
          nome: usuario.nome,
          email: usuario.email,
          senha: senhaGerada,
          loginUrl,
        }),
      });
      emailSent = result.sent;
      if (emailSent) {
        await prisma.usuario.update({
          where: { id: usuario.id },
          data: { welcomeEmailSentAt: new Date() },
        });
      }
    }

    return NextResponse.json(
      {
        usuario,
        // Só aparece aqui, na resposta de criação — nunca em listagem/detalhe.
        senhaGerada,
        emailSent,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Já existe um usuário com esse e-mail." },
        { status: 409 },
      );
    }
    // eslint-disable-next-line no-console
    console.error("[api/usuarios] falha ao criar usuário", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Não foi possível salvar o usuário no momento." },
      { status: 500 },
    );
  }
}
