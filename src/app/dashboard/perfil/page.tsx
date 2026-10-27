import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PerfilForm } from "@/components/dashboard/perfil/perfil-form";

export default async function PerfilPage() {
  const session = await getServerSession(authOptions);
  const usuarioId = (session?.user as { id?: string } | undefined)?.id;

  if (!usuarioId || usuarioId === "admin-env") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-cinza-prata/40 bg-white p-6 text-sm text-azul-escuro/60 shadow-premium-sm">
        Esta conta administrativa é controlada por variável de ambiente
        (fora da tabela de usuários) e não tem uma tela de perfil própria.
      </div>
    );
  }

  const usuario = await prisma.usuario.findFirst({
    where: { id: usuarioId, deletedAt: null },
    select: { id: true, nome: true, email: true, fotoBase64: true },
  });

  if (!usuario) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-cinza-prata/40 bg-white p-6 text-sm text-azul-escuro/60 shadow-premium-sm">
        Não foi possível carregar seu perfil.
      </div>
    );
  }

  return <PerfilForm usuario={usuario} />;
}
