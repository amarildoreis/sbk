import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { VisaoGeralCards } from "@/components/dashboard/comercial/visao-geral-cards";

export default async function VisaoGeralPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_comercial")) {
    return <AccessDenied message="Você não tem permissão para ver o módulo Comercial." />;
  }

  return <VisaoGeralCards />;
}
