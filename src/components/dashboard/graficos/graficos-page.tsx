"use client";

import { useState } from "react";
import { BarChart3, SlidersHorizontal, ChevronDown, FilterX } from "lucide-react";
import { RetractableFiltrosPanel } from "../retractable-filtros-panel";
import { GraficosVisaoToggle } from "./graficos-visao-toggle";
import { FiltrosGraficosInline } from "./filtros-graficos-inline";
import { TitulosChart } from "./titulos-chart";
import { DesagiosChart } from "./desagios-chart";
import { ComissoesChart } from "./comissoes-chart";
import { VencidosChart } from "./vencidos-chart";
import { VopCedenteChart } from "./vop-cedente-chart";
import { RecompraChart } from "./recompra-chart";
import { TotalPagoChart } from "./total-pago-chart";

// Os mesmos 3 filtros de Exposição Cedente/Tranche (Comercial, Grupo
// Econômico, Cedente), abertos num painel retrátil embutido na tela — mesmo
// padrão de todas as demais telas com filtro da plataforma.
export interface GraficosFiltros {
  comercial: string;
  grupoEconomico: string;
  cedente: string;
}

const FILTROS_VAZIOS: GraficosFiltros = {
  comercial: "",
  grupoEconomico: "",
  cedente: "",
};

// Módulo Gráficos (novo menu, abaixo de Comissões — CLAUDE.md seção 9).
// Diferente dos demais relatórios (tabela + filtros + exportação), aqui a
// tela começa pelo componente de escolha no cabeçalho — mesmo padrão visual
// do toggle "Visão" de Exposição Cedente/Tranche, com 7 opções (Títulos,
// Deságios, Comissões, Vencidos, VOP Cedente, Recompra, Total Pago). Sem
// label centralizada (diferente dos outros toggles, que têm só 2-3 opções):
// com 7 botões o próprio estado ativo já comunica a seleção, uma label
// grande adicional só poluiria a tela. Etapa 2 (2026-07-16): filtros
// retráteis (Comercial, Grupo Econômico, Cedente) — mesmos 3 de Exposição
// Cedente/Tranche, mesmo painel retrátil. O conteúdo gráfico de cada opção
// (fonte de dados, tipo de visualização) entra numa etapa seguinte.
export function GraficosPage() {
  const [visao, setVisao] = useState("titulos");
  const [filtros, setFiltros] = useState<GraficosFiltros>(FILTROS_VAZIOS);
  const [resumoFiltros, setResumoFiltros] = useState("");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const hasActiveFilters = Object.values(filtros).some((value) => value !== "");

  function handleAplicarFiltros(novosFiltros: GraficosFiltros, novoResumo: string) {
    setFiltros(novosFiltros);
    setResumoFiltros(novoResumo);
    setFiltrosAbertos(false);
  }

  function handleLimparFiltros() {
    setFiltros(FILTROS_VAZIOS);
    setResumoFiltros("");
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="rounded-2xl border border-cinza-prata/40 bg-white shadow-premium-sm">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-azul-escuro/5 text-azul-escuro">
              <BarChart3 size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-azul-escuro">Gráficos</h2>
              <p className="text-sm text-azul-escuro/50">
                Visão gráfica consolidada dos indicadores da plataforma.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <GraficosVisaoToggle value={visao} onChange={setVisao} />
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
                {hasActiveFilters && (
                  <span className="h-1.5 w-1.5 rounded-full bg-vermelho-risco" />
                )}
                <ChevronDown
                  size={14}
                  strokeWidth={2}
                  className={`transition-transform duration-300 ${filtrosAbertos ? "rotate-180" : ""}`}
                />
              </button>
              {hasActiveFilters && (
                <button
                  onClick={handleLimparFiltros}
                  title="Limpar filtros"
                  className="flex h-10 items-center gap-2 rounded-xl border border-cinza-prata/60 px-3.5 text-sm font-medium text-azul-escuro/70 transition hover:border-vermelho-risco/40 hover:bg-vermelho-risco/5 hover:text-vermelho-risco"
                >
                  <FilterX size={16} strokeWidth={1.75} />
                  Limpar
                </button>
              )}
            </div>
            {hasActiveFilters && (
              <p className="text-xs text-vermelho-risco/70">
                As informações desta tela estão filtradas.
              </p>
            )}
          </div>
        </div>

        <RetractableFiltrosPanel open={filtrosAbertos}>
          <FiltrosGraficosInline value={filtros} onApply={handleAplicarFiltros} />
        </RetractableFiltrosPanel>
      </div>

      {visao === "titulos" ? (
        <TitulosChart filtros={filtros} resumoFiltros={resumoFiltros} />
      ) : visao === "desagios" ? (
        <DesagiosChart filtros={filtros} resumoFiltros={resumoFiltros} />
      ) : visao === "comissoes" ? (
        <ComissoesChart filtros={filtros} resumoFiltros={resumoFiltros} />
      ) : visao === "vencidos" ? (
        <VencidosChart filtros={filtros} resumoFiltros={resumoFiltros} />
      ) : visao === "vop-cedente" ? (
        <VopCedenteChart filtros={filtros} resumoFiltros={resumoFiltros} />
      ) : visao === "recompra" ? (
        <RecompraChart filtros={filtros} resumoFiltros={resumoFiltros} />
      ) : (
        <TotalPagoChart filtros={filtros} resumoFiltros={resumoFiltros} />
      )}
    </div>
  );
}
