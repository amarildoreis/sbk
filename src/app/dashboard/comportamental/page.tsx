import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { ComportamentalPage } from "@/components/dashboard/comportamental/comportamental-page";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "ver_comportamental")) {
    return <AccessDenied message="Você não tem permissão para ver o módulo Comportamental." />;
  }

  return <ComportamentalPage />;
}
