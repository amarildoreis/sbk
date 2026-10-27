"use client";

import { Lock } from "lucide-react";

// Campo de filtro travado — usado quando o perfil logado (Comercial/Cedente/
// Sacado) só pode ver os próprios dados (CLAUDE.md, 2026-07-18): mostra o
// valor fixo (o próprio) em vez do seletor normal, com um cadeado
// sinalizando que não dá pra trocar. A trava de verdade é sempre no
// servidor (applyAccessScope) — isto é só a comunicação visual.
export function LockedFiltroField({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-cinza-prata/60 bg-surface-alt py-3 pl-3.5 pr-4 text-sm text-azul-escuro/70">
      <Lock size={15} strokeWidth={1.75} className="shrink-0 text-azul-escuro/35" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </div>
  );
}
