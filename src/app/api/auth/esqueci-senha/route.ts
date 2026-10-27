import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateRandomPassword } from "@/lib/usuarios/password";
import { sendMail } from "@/lib/email/mailer";
import { renderPasswordResetEmail } from "@/lib/email/password-reset-template";
import { checkRateLimit } from "@/lib/rate-limit";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mensagem sempre igual, com ou sem sucesso — nunca revela se o e-mail
// existe ou não na base (evita enumeração de contas).
const GENERIC_RESPONSE = {
  message:
    "Se esse e-mail estiver cadastrado e ativo, enviamos uma nova senha temporária.",
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }

  // Limite por e-mail (evita spam pro mesmo destinatário) e por IP (evita
  // um único cliente varrendo vários e-mails).
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const withinEmailLimit = checkRateLimit(`esqueci-senha:email:${email}`, 3, 15 * 60_000);
  const withinIpLimit = checkRateLimit(`esqueci-senha:ip:${ip}`, 10, 15 * 60_000);

  if (!withinEmailLimit || !withinIpLimit) {
    // Mesma resposta genérica — não denuncia que foi bloqueado por limite.
    return NextResponse.json(GENERIC_RESPONSE);
  }

  try {
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (adminEmail && email === adminEmail) {
      // Conta administrativa via variável de ambiente — não tem senha na
      // tabela usuarios, não há o que redefinir por aqui.
      return NextResponse.json(GENERIC_RESPONSE);
    }

    const usuario = await prisma.usuario.findFirst({
      where: { email, deletedAt: null, status: "Ativo" },
    });

    if (usuario) {
      const senhaGerada = generateRandomPassword();
      const senhaHash = await bcrypt.hash(senhaGerada, 12);

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { senhaHash, mustChangePassword: true },
      });

      const loginUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/login`;
      await sendMail({
        to: usuario.email,
        subject: "Sua senha na plataforma SBK Capital foi redefinida",
        html: renderPasswordResetEmail({
          nome: usuario.nome,
          email: usuario.email,
          senha: senhaGerada,
          loginUrl,
        }),
      });
    }

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/auth/esqueci-senha] falha", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });
    // Ainda genérica — erro interno não deve virar sinal de "e-mail existe".
    return NextResponse.json(GENERIC_RESPONSE);
  }
}
