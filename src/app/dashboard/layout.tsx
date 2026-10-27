import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionPermissoes } from "@/lib/auth/permissions";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const userLabel = session.user?.name ?? session.user?.email ?? "Usuário";
  const permissoes = getSessionPermissoes(session);

  return (
    <DashboardShell userLabel={userLabel} permissoes={permissoes}>
      {children}
    </DashboardShell>
  );
}
