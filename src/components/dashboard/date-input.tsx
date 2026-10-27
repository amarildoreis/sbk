"use client";

// Rótulo "Início"/"Fim" fica embutido dentro do próprio campo, à esquerda
// (em vez de uma linha acima do input) — assim a seção de data ocupa a
// mesma altura de linha que as demais seções do painel de filtros
// (Comercial, Grupo Econômico etc.), sem o desalinhamento de ter um rótulo
// extra empilhado só nesse filtro. Padrão definido em Borderôs Liberados
// (CLAUDE.md, 2026-07-16) e replicado em toda tela com filtro de intervalo
// de data.
export function DateInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <label className="flex flex-1 items-center gap-2 rounded-xl border border-cinza-prata/70 bg-white pl-3 pr-1 transition focus-within:border-azul-medio focus-within:ring-4 focus-within:ring-azul-medio/10">
      <span className="shrink-0 text-xs text-azul-escuro/45">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 bg-transparent py-2 text-sm text-azul-escuro outline-none"
      />
    </label>
  );
}
