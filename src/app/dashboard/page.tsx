import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-alt p-6">
      <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-8 text-center shadow-premium">
        <p className="text-sm font-medium text-azul-medio">Bem-vindo</p>
        <h1 className="mt-1 text-2xl font-bold text-azul-escuro">
          {session?.user?.name ?? session?.user?.email}
        </h1>
        <p className="mt-2 text-sm text-azul-escuro/50">
          {session?.user?.email}
        </p>
        <div className="mt-8">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
