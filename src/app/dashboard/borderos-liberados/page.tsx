import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { BorderosLiberadosTable } from "@/components/dashboard/borderos-liberados/borderos-liberados-table";

export default async function BorderosLiberadosPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_borderos_liberados")) {
    return <AccessDenied message="Você não tem permissão para ver Borderôs Liberados." />;
  }

  return <BorderosLiberadosTable />;
}
