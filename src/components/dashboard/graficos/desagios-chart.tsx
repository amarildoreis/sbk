"use client";

import { Percent } from "lucide-react";
import { MesAMesChart } from "./mes-a-mes-chart";
import type { GraficosFiltros } from "./graficos-page";

// Gráfico "Deságios" — segundo dos 7 gráficos do módulo (CLAUDE.md seção
// 9). Medida DAX `juros` colada pelo cliente em 2026-07-17 (SUM(SIGFIDC
// [JUROS]), 0 quando em branco — fisicamente SIGFLS.JUROS). Wrapper fino
// sobre MesAMesChart, mesma mecânica de Títulos. Cor âmbar (`#C99A3E`,
// paleta oficial — CLAUDE.md 5.1) pra diferenciar visualmente do azul de
// Títulos, facilitando a identificação de cada gráfico ao longo do tempo
// (pedido explícito do cliente).
export function DesagiosChart({
  filtros,
  resumoFiltros,
}: {
  filtros: GraficosFiltros;
  resumoFiltros?: string;
}) {
  return (
    <MesAMesChart
      slug="desagios"
      icon={Percent}
      titulo="Deságios"
      subtitulo="Valor de deságios (juros) mês a mês, no ano selecionado."
      cor="#C99A3E"
      apiEndpoint="/api/graficos/desagios"
      filtros={filtros}
      resumoFiltros={resumoFiltros}
    />
  );
}
