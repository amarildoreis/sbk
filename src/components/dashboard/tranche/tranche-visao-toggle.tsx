"use client";

const OPCOES = [
  { value: "tomada", label: "Tomada" },
  { value: "avencer", label: "A Vencer" },
  { value: "vencida", label: "Vencida" },
] as const;

export function trancheVisaoLabel(value: string): string {
  return OPCOES.find((opcao) => opcao.value === value)?.label ?? "Tomada";
}

// Toggle "Tomada" / "A Vencer" / "Vencida" do módulo Tranche — mesmo padrão
// visual do slicer "Visão" de Carteira de Clientes/Exposição Cedente
// (carteira-visao-toggle.tsx/exposicao-cedente-visao-toggle.tsx), com 3
// opções que espelham as medidas DAX tranche_tomada/tranche_a_vencer/
// tranche_vencida. Sempre visível ao lado do botão de filtros, não dentro do
// painel retrátil.
export function TrancheVisaoToggle({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-cinza-prata/60 bg-white p-1">
      {OPCOES.map((opcao) => {
        const active = opcao.value === value;
        return (
          <button
            key={opcao.value}
            onClick={() => onChange(opcao.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-azul-escuro text-white shadow-premium-sm"
                : "text-azul-escuro/60 hover:bg-surface-alt hover:text-azul-escuro"
            }`}
          >
            {opcao.label}
          </button>
        );
      })}
    </div>
  );
}
