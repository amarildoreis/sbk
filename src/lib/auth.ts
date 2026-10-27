import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { PERMISSOES } from "@/components/dashboard/usuarios/permissoes";
import { extractVinculoCodigo, extractVinculoNome } from "@/lib/usuarios/vinculo";

const ALL_PERMISSOES_GRANTED: Record<string, boolean> = PERMISSOES.reduce(
  (acc, p) => ({ ...acc, [p.key]: true }),
  {} as Record<string, boolean>,
);

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        // Fallback do admin original via variáveis de ambiente — mantido de
        // propósito para nunca depender só da tabela `usuarios` (MySQL) para
        // o acesso administrativo original. Nunca remover sem confirmação.
        const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
        if (adminEmail && adminPasswordHash && email === adminEmail) {
          const isValid = await bcrypt.compare(password, adminPasswordHash);
          if (!isValid) return null;
          return {
            id: "admin-env",
            email: adminEmail,
            name: process.env.ADMIN_NAME?.trim() || "Administrador",
            role: "Administrador",
            mustChangePassword: false,
            permissoes: ALL_PERMISSOES_GRANTED,
          };
        }

        // Usuários cadastrados na plataforma (tabela usuarios, MySQL).
        const usuario = await prisma.usuario.findFirst({
          where: { email, deletedAt: null },
        });
        if (!usuario) return null;

        const isValid = await bcrypt.compare(password, usuario.senhaHash);
        if (!isValid) return null;

        // Só revela o status "Inativo" depois de confirmar a senha — não dá
        // pra alguém sem a senha descobrir se uma conta existe e está inativa.
        if (usuario.status !== "Ativo") {
          throw new Error(
            "Seu usuário se encontra INATIVO nesta plataforma. Entre em contato com o Administrador!!.",
          );
        }

        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.nome,
          role: usuario.perfil,
          mustChangePassword: usuario.mustChangePassword,
          permissoes: (usuario.permissoes ?? {}) as Record<string, boolean>,
          // Trava de acesso por perfil (CLAUDE.md — Comercial só vê os
          // próprios dados via COD_OPERADOR_INDICANTE; Cedente/Sacado via
          // CLIFOR/SACADO vinculado). Só um dos dois faz sentido por perfil.
          comercialCodigo: usuario.perfil === "Comercial" ? usuario.comercialCodigo : null,
          vinculoCodigo: extractVinculoCodigo(usuario.vinculo),
          vinculoNome: extractVinculoNome(usuario.vinculo),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        const u = user as {
          id: string;
          role?: string;
          mustChangePassword?: boolean;
          permissoes?: Record<string, boolean>;
          comercialCodigo?: string | null;
          vinculoCodigo?: string | null;
          vinculoNome?: string | null;
        };
        token.usuarioId = u.id;
        token.role = u.role ?? "admin";
        token.mustChangePassword = u.mustChangePassword ?? false;
        token.permissoes = u.permissoes ?? {};
        token.comercialCodigo = u.comercialCodigo ?? null;
        token.vinculoCodigo = u.vinculoCodigo ?? null;
        token.vinculoNome = u.vinculoNome ?? null;
      }

      // Disparado por `useSession().update()` no front — usado depois de
      // trocar a senha ou editar permissões, pra não precisar deslogar/logar
      // de novo.
      if (trigger === "update" && token.usuarioId && token.usuarioId !== "admin-env") {
        const usuario = await prisma.usuario.findUnique({
          where: { id: token.usuarioId as string },
          select: { mustChangePassword: true, permissoes: true, perfil: true, comercialCodigo: true, vinculo: true },
        });
        if (usuario) {
          token.mustChangePassword = usuario.mustChangePassword;
          token.permissoes = (usuario.permissoes ?? {}) as Record<string, boolean>;
          token.comercialCodigo = usuario.perfil === "Comercial" ? usuario.comercialCodigo : null;
          token.vinculoCodigo = extractVinculoCodigo(usuario.vinculo);
          token.vinculoNome = extractVinculoNome(usuario.vinculo);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { id?: string }).id = token.usuarioId as string;
        (session.user as { mustChangePassword?: boolean }).mustChangePassword =
          token.mustChangePassword as boolean;
        (session.user as { permissoes?: Record<string, boolean> }).permissoes =
          (token.permissoes as Record<string, boolean>) ?? {};
        session.user.comercialCodigo = (token.comercialCodigo as string | null) ?? null;
        session.user.vinculoCodigo = (token.vinculoCodigo as string | null) ?? null;
        session.user.vinculoNome = (token.vinculoNome as string | null) ?? null;
      }
      return session;
    },
  },
};
