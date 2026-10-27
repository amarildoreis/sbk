"use client";

import { FileBarChart2 } from "lucide-react";
import { MesAMesChart } from "./mes-a-mes-chart";
import type { GraficosFiltros } from "./graficos-page";

// Gráfico "Títulos" — primeiro dos 7 gráficos do módulo (CLAUDE.md seção
// 9). Medida DAX `valor_titulo` colada pelo cliente em 2026-07-16
// (SUM(VALOR_), 0 quando em branco). Wrapper fino sobre MesAMesChart — toda
// a mecânica (filtro de ano, radios de base de data, barras) é
// compartilhada com os demais gráficos do módulo.
export function TitulosChart({
  filtros,
  resumoFiltros,
}: {
  filtros: GraficosFiltros;
  resumoFiltros?: string;
}) {
  return (
    <MesAMesChart
      slug="titulos"
      icon={FileBarChart2}
      titulo="Títulos"
      subtitulo="Valor de títulos mês a mês, no ano selecionado."
      cor="#2E3F7F"
      apiEndpoint="/api/graficos/titulos"
      filtros={filtros}
      resumoFiltros={resumoFiltros}
    />
  );
}
