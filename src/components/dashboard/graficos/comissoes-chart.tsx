"use client";

import { Coins } from "lucide-react";
import { MesAMesChart } from "./mes-a-mes-chart";
import type { GraficosFiltros } from "./graficos-page";

// Gráfico "Comissões" — terceiro dos 7 gráficos do módulo (CLAUDE.md seção
// 9). Medida DAX `comissao_comercial` colada pelo cliente em 2026-07-17
// (SUM(VALOR_COMISSAO) só quando há Indicante/Operador, 0 quando em
// branco). Wrapper fino sobre MesAMesChart, mesma mecânica de Títulos/
// Deságios. Cor verde-escuro (`#2D5C3A`, paleta oficial — CLAUDE.md 5.1)
// pra diferenciar visualmente dos demais gráficos.
export function ComissoesChart({
  filtros,
  resumoFiltros,
}: {
  filtros: GraficosFiltros;
  resumoFiltros?: string;
}) {
  return (
    <MesAMesChart
      slug="comissoes"
      icon={Coins}
      titulo="Comissões"
      subtitulo="Valor de comissões mês a mês, no ano selecionado."
      cor="#2D5C3A"
      apiEndpoint="/api/graficos/comissoes"
      filtros={filtros}
      resumoFiltros={resumoFiltros}
    />
  );
}
