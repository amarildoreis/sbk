import type { Session } from "next-auth";
import { ADMIN_ONLY_PERMISSAO_KEYS } from "@/components/dashboard/usuarios/permissoes";

export function getSessionPermissoes(
  session: Session | null,
): Record<string, boolean> {
  return (
    (session?.user as { permissoes?: Record<string, boolean> } | undefined)
      ?.permissoes ?? {}
  );
}

export function getSessionRole(session: Session | null): string | undefined {
  return (session?.user as { role?: string } | undefined)?.role;
}

export function hasPermission(session: Session | null, key: string): boolean {
  // Algumas permissões só fazem sentido pro perfil Administrador — mesmo que
  // o campo `permissoes` no banco tenha `true` por engano (ex: editado direto
  // no MySQL), a checagem de autorização nunca confia só nisso pra essas
  // chaves.
  if (
    (ADMIN_ONLY_PERMISSAO_KEYS as readonly string[]).includes(key) &&
    getSessionRole(session) !== "Administrador"
  ) {
    return false;
  }

  return Boolean(getSessionPermissoes(session)[key]);
}
