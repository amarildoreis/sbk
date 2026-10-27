import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { UsuariosTable } from "@/components/dashboard/usuarios/usuarios-table";

export default async function UsuariosPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "cadastrar_usuarios")) {
    return <AccessDenied message="Você não tem permissão para gerenciar usuários." />;
  }

  return <UsuariosTable />;
}
