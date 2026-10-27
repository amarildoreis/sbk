import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { CarteiraSacadosTable } from "@/components/dashboard/carteira-sacados/carteira-sacados-table";

export default async function CarteiraSacadosPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_carteira_sacados")) {
    return <AccessDenied message="Você não tem permissão para ver a Carteira de Sacados." />;
  }

  return <CarteiraSacadosTable />;
}
