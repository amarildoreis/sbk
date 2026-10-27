import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { ComissoesTable } from "@/components/dashboard/comissoes/comissoes-table";

export default async function ComissoesPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_comissoes")) {
    return <AccessDenied message="Você não tem permissão para ver o módulo Comissões." />;
  }

  return <ComissoesTable />;
}
