import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { CarteiraClientesTable } from "@/components/dashboard/carteira/carteira-clientes-table";

export default async function CarteiraClientesPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_carteira_clientes")) {
    return <AccessDenied message="Você não tem permissão para ver a Carteira de Clientes." />;
  }

  return <CarteiraClientesTable />;
}
