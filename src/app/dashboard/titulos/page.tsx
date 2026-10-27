import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { TitulosTable } from "@/components/dashboard/titulos/titulos-table";

export default async function TitulosPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_titulos")) {
    return <AccessDenied message="Você não tem permissão para ver o Relatório Analítico de Títulos." />;
  }

  return <TitulosTable />;
}
