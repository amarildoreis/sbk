"use client";

const OPCOES = [
  { value: "avencer", label: "A Vencer" },
  { value: "vencido", label: "Vencidos" },
] as const;

export function exposicaoCedenteVisaoLabel(value: string): string {
  return OPCOES.find((opcao) => opcao.value === value)?.label ?? "A Vencer";
}

// Toggle "A Vencer" / "Vencidos" do módulo Exposição Cedente — mesmo padrão
// visual do slicer "Visão" de Carteira de Clientes (carteira-visao-toggle.tsx),
// só que com 2 opções em vez de 3. Sempre visível ao lado do botão de
// filtros, não dentro do painel retrátil.
export function ExposicaoCedenteVisaoToggle({
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
