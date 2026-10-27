import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { TrancheTable } from "@/components/dashboard/tranche/tranche-table";

export default async function TranchePage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_tranche")) {
    return <AccessDenied message="Você não tem permissão para ver o módulo Tranche." />;
  }

  return <TrancheTable />;
}
