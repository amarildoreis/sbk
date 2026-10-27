import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { UserRegistrationForm } from "@/components/dashboard/usuarios/user-registration-form";

export default async function NovoUsuarioPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "cadastrar_usuarios")) {
    return <AccessDenied message="Você não tem permissão para cadastrar usuários." />;
  }

  return <UserRegistrationForm />;
}
