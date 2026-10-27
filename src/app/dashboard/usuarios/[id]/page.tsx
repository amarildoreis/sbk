import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { prisma } from "@/lib/prisma";
import { UsuarioDetail } from "@/components/dashboard/usuarios/usuario-detail";

export default async function UsuarioViewPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "cadastrar_usuarios")) {
    return <AccessDenied message="Você não tem permissão para visualizar usuários." />;
  }

  const usuario = await prisma.usuario.findFirst({
    where: { id: params.id, deletedAt: null },
  });
  if (!usuario) notFound();

  return <UsuarioDetail usuario={usuario} />;
}
