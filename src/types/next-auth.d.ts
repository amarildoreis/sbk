import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      role?: string;
      /** Código do comercial (COD_OPERADOR_INDICANTE) — só perfil Comercial. */
      comercialCodigo?: string | null;
      /** Código do cedente/sacado vinculado (CLIFOR/SACADO) — só perfil
       * Cedente/Sacado. Extraído de `Usuario.vinculo` (ver lib/usuarios/vinculo.ts). */
      vinculoCodigo?: string | null;
      /** Nome do cedente/sacado vinculado — só exibição (filtro travado na UI). */
      vinculoNome?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    comercialCodigo?: string | null;
    vinculoCodigo?: string | null;
    vinculoNome?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    comercialCodigo?: string | null;
    vinculoCodigo?: string | null;
    vinculoNome?: string | null;
  }
}
