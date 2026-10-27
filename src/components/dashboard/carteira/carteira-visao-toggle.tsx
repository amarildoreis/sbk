"use client";

const OPCOES = [
  { value: "", label: "Todos" },
  { value: "com-risco", label: "Com Risco" },
  { value: "sem-risco", label: "Sem Risco" },
] as const;

export function visaoLabel(value: string): string {
  return OPCOES.find((opcao) => opcao.value === value)?.label ?? "Todos";
}

// Slicer "Visão" do Power BI (CLAUDE.md 21.2) — Todos/Com Risco/Sem Risco.
// Não é um filtro dentro da popup: fica sempre visível ao lado do botão de
// filtros, é o controle mais usado da tela.
export function CarteiraVisaoToggle({
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
