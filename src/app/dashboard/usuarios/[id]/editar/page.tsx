import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { prisma } from "@/lib/prisma";
import {
  UserRegistrationForm,
  type UsuarioInitialData,
} from "@/components/dashboard/usuarios/user-registration-form";
import type { Status, ComercialTipo } from "@/components/dashboard/usuarios/constants";

export default async function EditarUsuarioPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "cadastrar_usuarios")) {
    return <AccessDenied message="Você não tem permissão para editar usuários." />;
  }

  const usuario = await prisma.usuario.findFirst({
    where: { id: params.id, deletedAt: null },
  });
  if (!usuario) notFound();

  const initialData: UsuarioInitialData = {
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    status: usuario.status as Status,
    vinculo: usuario.vinculo,
    comercialTipo: usuario.comercialTipo as ComercialTipo | null,
    comercialCodigo: usuario.comercialCodigo,
    fotoBase64: usuario.fotoBase64,
    permissoes: (usuario.permissoes ?? {}) as Record<string, boolean>,
  };

  return (
    <UserRegistrationForm mode="edit" userId={usuario.id} initialData={initialData} />
  );
}
