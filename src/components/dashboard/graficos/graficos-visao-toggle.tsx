"use client";

const OPCOES = [
  { value: "titulos", label: "Títulos" },
  { value: "desagios", label: "Deságios" },
  { value: "comissoes", label: "Comissões" },
  { value: "vencidos", label: "Vencidos" },
  { value: "vop-cedente", label: "VOP Cedente" },
  { value: "recompra", label: "Recompra" },
  { value: "total-pago", label: "Total Pago" },
] as const;

export function graficosVisaoLabel(value: string): string {
  return OPCOES.find((opcao) => opcao.value === value)?.label ?? "Títulos";
}

// Componente de escolha do módulo Gráficos — mesmo padrão visual do slicer
// "Visão" de Carteira de Clientes/Exposição Cedente/Tranche
// (carteira-visao-toggle.tsx/exposicao-cedente-visao-toggle.tsx/
// tranche-visao-toggle.tsx), só que com 7 opções (Títulos, Deságios,
// Comissões, Vencidos, VOP Cedente, Recompra, Total Pago). `flex-wrap` pra
// não quebrar o layout em telas menores, já que são bem mais opções que os
// toggles de 2-3 itens dos demais módulos.
export function GraficosVisaoToggle({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-cinza-prata/60 bg-white p-1">
      {OPCOES.map((opcao) => {
        const active = opcao.value === value;
        return (
          <button
            key={opcao.value}
            onClick={() => onChange(opcao.value)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
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
