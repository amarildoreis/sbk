import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { ExposicaoCedenteTable } from "@/components/dashboard/exposicao-cedente/exposicao-cedente-table";

export default async function ExposicaoCedentePage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_exposicao_cedente")) {
    return <AccessDenied message="Você não tem permissão para ver Exposição Cedente." />;
  }

  return <ExposicaoCedenteTable />;
}
