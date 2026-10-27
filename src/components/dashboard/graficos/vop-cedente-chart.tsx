"use client";

import { TrendingUp } from "lucide-react";
import { MesAMesChart } from "./mes-a-mes-chart";
import type { GraficosFiltros } from "./graficos-page";

// Gráfico "VOP Cedente" (Volume de Operações Cedente) — quinto dos 7
// gráficos do módulo (CLAUDE.md seção 9). Único sem radio de eixo — só o
// filtro de Ano, pedido explícito do cliente em 2026-07-17 (`opcoesEixo={[]}`
// oculta o radio group por completo em MesAMesChart). Medida DAX
// `vop_cedente` — ver graficos-vop-cedente.ts pra fórmula completa e
// observações (SIGFLS.DTBORDERO como eixo de data, universo via CADCRED).
// Cor verde-claro (`#4A8C5C`, paleta oficial — CLAUDE.md 5.1), quinta cor
// distinta, nunca repetindo azul/âmbar/verde-escuro/vermelho já usados.
export function VopCedenteChart({
  filtros,
  resumoFiltros,
}: {
  filtros: GraficosFiltros;
  resumoFiltros?: string;
}) {
  return (
    <MesAMesChart
      slug="vop-cedente"
      icon={TrendingUp}
      titulo="VOP Cedente"
      subtitulo="Volume de operações por cedente, mês a mês, no ano selecionado."
      cor="#4A8C5C"
      apiEndpoint="/api/graficos/vop-cedente"
      filtros={filtros}
      resumoFiltros={resumoFiltros}
      opcoesEixo={[]}
    />
  );
}
