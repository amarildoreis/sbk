"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";

// Faixa de anos pedida pelo cliente em 2026-07-16 — padrão pra todos os
// gráficos do módulo, não só o de Títulos.
export const GRAFICO_ANO_MIN = 2023;
export const GRAFICO_ANO_MAX = 2033;

const ANOS = Array.from(
  { length: GRAFICO_ANO_MAX - GRAFICO_ANO_MIN + 1 },
  (_, i) => GRAFICO_ANO_MIN + i,
);

export function anoAtualPadrao(): number {
  const atual = new Date().getFullYear();
  return Math.min(Math.max(atual, GRAFICO_ANO_MIN), GRAFICO_ANO_MAX);
}

// Filtro de ano (2023-2033) — componente padrão pra dentro do painel de
// qualquer gráfico do módulo Gráficos (pedido explícito do cliente:
// "será padrão para os demais"). Dropdown simples, sempre com um ano
// selecionado (diferente dos FiltroSelect genéricos, que têm opção
// "Todos" — aqui não faz sentido, o gráfico sempre precisa de um ano).
export function AnoFiltro({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="flex h-10 items-center gap-2 rounded-xl border border-cinza-prata/60 bg-white px-3.5 text-sm font-medium text-azul-escuro transition hover:border-azul-medio/40 hover:bg-azul-medio/5"
      >
        <Calendar size={15} strokeWidth={1.75} className="text-azul-escuro/40" />
        {value}
        <ChevronDown
          size={14}
          strokeWidth={2}
          className={`text-azul-escuro/40 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-30 mt-1.5 max-h-64 w-28 overflow-y-auto rounded-xl border border-cinza-prata/50 bg-white py-1.5 shadow-premium">
          {ANOS.map((ano) => (
            <button
              key={ano}
              type="button"
              onClick={() => {
                onChange(ano);
                setIsOpen(false);
              }}
              className={`flex w-full items-center px-4 py-2 text-left text-sm transition hover:bg-azul-medio/5 ${
                ano === value ? "bg-azul-medio/10 font-medium text-azul-escuro" : "text-azul-escuro/80"
              }`}
            >
              {ano}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
