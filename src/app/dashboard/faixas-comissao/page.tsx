import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { FaixasComissaoTable } from "@/components/dashboard/faixas-comissao/faixas-comissao-table";

export default async function FaixasComissaoPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "gerenciar_faixas_comissao")) {
    return (
      <AccessDenied message="Você não tem permissão para gerenciar faixas de comissões." />
    );
  }

  return <FaixasComissaoTable />;
}
