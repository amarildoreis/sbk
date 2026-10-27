"use client";

import { useState } from "react";
import { Activity, FilterX, SlidersHorizontal, ChevronDown } from "lucide-react";
import { ComportamentalExportAllMenu } from "./comportamental-export-all-menu";
import { RetractableFiltrosPanel } from "../retractable-filtros-panel";
import { FiltrosComportamentalInline } from "./filtros-comportamental-inline";
import type { ComportamentalFiltros } from "./comportamental-page";

// Faixa branca superior — mesmo padrão visual de Carteira de Clientes e
// Relatório Analítico de Títulos (ícone + título + subtítulo à esquerda,
// filtros à direita). O resumo do(s) filtro(s) aplicado(s) aparece
// centralizado na barra, mesmo espírito do rótulo "Visão" de Carteira de
// Clientes — só que aqui é texto livre (nomes escolhidos), não um toggle
// fixo, e só aparece quando há algum filtro ativo. Filtros abrem num
// painel retrátil embutido na própria tela (não popup) — mesmo padrão de
// Borderôs Liberados/Títulos/Carteira de Clientes (CLAUDE.md, 2026-07-16).
export function ComportamentalHeader({
  filtros,
  hasActiveFilters,
  resumo,
  onClearFilters,
  onApplyFiltros,
}: {
  filtros: ComportamentalFiltros;
  hasActiveFilters: boolean;
  resumo: string;
  onClearFilters: () => void;
  onApplyFiltros: (filtros: ComportamentalFiltros, resumo: string) => void;
}) {
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  function handleAplicar(novosFiltros: ComportamentalFiltros, novoResumo: string) {
    onApplyFiltros(novosFiltros, novoResumo);
    setFiltrosAbertos(false);
  }

  return (
    <div className="rounded-2xl border border-cinza-prata/40 bg-white shadow-premium-sm">
      <div className="relative flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-azul-escuro/5 text-azul-escuro">
            <Activity size={20} strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-azul-escuro">Comportamental</h2>
            <p className="text-sm text-azul-escuro/50">
              Indicadores de exposição e comportamento de pagamento da carteira.
            </p>
          </div>
        </div>

        {hasActiveFilters && resumo && (
          <div className="pointer-events-none hidden items-center justify-center lg:absolute lg:inset-0 lg:flex">
            <span className="truncate px-4 text-lg font-bold tracking-tight text-azul-escuro">
              {resumo}
            </span>
          </div>
        )}

        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setFiltrosAbertos((v) => !v)}
              aria-expanded={filtrosAbertos}
              className={`relative flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition ${
                filtrosAbertos || hasActiveFilters
                  ? "border-azul-medio/50 bg-azul-medio/5 text-azul-escuro"
                  : "border-cinza-prata/60 text-azul-escuro/70 hover:border-azul-medio/40 hover:bg-azul-medio/5 hover:text-azul-escuro"
              }`}
            >
              <SlidersHorizontal size={16} strokeWidth={1.75} />
              Filtros
              {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-vermelho-risco" />}
              <ChevronDown
                size={14}
                strokeWidth={2}
                className={`transition-transform duration-300 ${filtrosAbertos ? "rotate-180" : ""}`}
              />
            </button>
            {hasActiveFilters && (
              <button
                onClick={onClearFilters}
                title="Limpar filtros"
                className="flex h-10 items-center gap-2 rounded-xl border border-cinza-prata/60 px-3.5 text-sm font-medium text-azul-escuro/70 transition hover:border-vermelho-risco/40 hover:bg-vermelho-risco/5 hover:text-vermelho-risco"
              >
                <FilterX size={16} strokeWidth={1.75} />
                Limpar
              </button>
            )}
            <ComportamentalExportAllMenu filtros={filtros} resumoFiltros={resumo} />
          </div>
          {hasActiveFilters && (
            <p className="text-xs text-vermelho-risco/70">
              As informações desta tela estão filtradas.
            </p>
          )}
        </div>
      </div>

      <RetractableFiltrosPanel open={filtrosAbertos}>
        <FiltrosComportamentalInline value={filtros} onApply={handleAplicar} />
      </RetractableFiltrosPanel>
    </div>
  );
}
