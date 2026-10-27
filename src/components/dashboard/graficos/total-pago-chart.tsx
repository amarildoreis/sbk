"use client";

import { CheckCircle2 } from "lucide-react";
import { MesAMesChart } from "./mes-a-mes-chart";
import type { GraficosFiltros } from "./graficos-page";

// Gráfico "Total Pago" — sétimo e último dos 7 gráficos do módulo
// (CLAUDE.md seção 9). Sem radio de eixo — só o filtro de Ano, mesmo padrão
// de VOP Cedente/Recompra (`opcoesEixo={[]}`). Medida DAX `total_pago` —
// ver graficos-total-pago.ts pra fórmula completa (SUM(VALOR_) onde
// STATUS_PAGTO IN ('Pago Em Dia', 'Pago Vencido'), agrupado por mês de
// DIGITACAO). Cor cinza-prata (`#C8CDD6`, paleta oficial — CLAUDE.md 5.1) —
// última cor "nova" restante depois dos 6 gráficos anteriores (azul-marca é
// exclusiva da logomarca, nunca usada em UI). Como é um tom claro, ganhou
// um contorno mais escuro (`corContorno`) pra não perder contraste no fundo
// branco do card — as barras dos outros 6 gráficos, todas com cores
// saturadas, não precisam disso.
export function TotalPagoChart({
  filtros,
  resumoFiltros,
}: {
  filtros: GraficosFiltros;
  resumoFiltros?: string;
}) {
  return (
    <MesAMesChart
      slug="total-pago"
      icon={CheckCircle2}
      titulo="Total Pago"
      subtitulo="Valor total pago, mês a mês, no ano selecionado."
      cor="#C8CDD6"
      corContorno="#8A93A6"
      apiEndpoint="/api/graficos/total-pago"
      filtros={filtros}
      resumoFiltros={resumoFiltros}
      opcoesEixo={[]}
    />
  );
}
