"use client";

import { useSession } from "next-auth/react";

// Espelha src/lib/auth/access-scope.ts (server) pro lado do cliente — usado
// pelos componentes de filtro pra travar/pré-preencher o campo de
// Comercial/Cedente/Sacado quando o perfil logado exige vínculo (CLAUDE.md,
// implementado 2026-07-18). A trava de verdade é sempre no servidor
// (applyAccessScope), que falha fechado (nenhum dado) quando o perfil exige
// vínculo mas não tem nenhum cadastrado — por isso aqui `locked` é `true`
// sempre que o PERFIL exige vínculo, mesmo sem `codigo` ainda (mostra aviso
// de vínculo pendente em vez de deixar escolher, o que o servidor ia
// ignorar de qualquer forma).
type ScopeField =
  | { locked: true; codigo: string; label: string }
  | { locked: false };

function buildField(perfilExigido: boolean, codigo: string | null, nome: string): ScopeField {
  if (!perfilExigido) return { locked: false };
  if (!codigo) return { locked: true, codigo: "", label: "Nenhum vínculo cadastrado" };
  return { locked: true, codigo, label: `${codigo} - ${nome}` };
}

export function useAccessScope() {
  const { data: session } = useSession();
  const perfil = session?.user?.role;
  const nomeUsuario = session?.user?.name ?? "";
  const comercialCodigo = session?.user?.comercialCodigo ?? null;
  const vinculoCodigo = session?.user?.vinculoCodigo ?? null;
  const vinculoNome = session?.user?.vinculoNome ?? null;

  return {
    comercial: buildField(perfil === "Comercial", comercialCodigo, nomeUsuario),
    cedente: buildField(perfil === "Cedente", vinculoCodigo, vinculoNome ?? nomeUsuario),
    sacado: buildField(perfil === "Sacado", vinculoCodigo, vinculoNome ?? nomeUsuario),
  };
}
