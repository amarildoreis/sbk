"use client";

import { RotateCcw } from "lucide-react";
import { MesAMesChart } from "./mes-a-mes-chart";
import type { GraficosFiltros } from "./graficos-page";

// Gráfico "Recompra" — sexto dos 7 gráficos do módulo (CLAUDE.md seção 9).
// Sem radio de eixo — só o filtro de Ano, mesmo padrão de VOP Cedente
// (`opcoesEixo={[]}`). Medida DAX `recompra_total` — ver
// graficos-recompra.ts pra fórmula completa (SUM(VALOR_PAGAMENTO) onde
// BANCO='01', agrupado por mês de DTPGTO). Cor azul-escuro (`#1A2347`,
// paleta oficial — CLAUDE.md 5.1), sexta cor distinta, nunca repetindo
// azul-médio/âmbar/verde-escuro/vermelho/verde-claro já usados.
export function RecompraChart({
  filtros,
  resumoFiltros,
}: {
  filtros: GraficosFiltros;
  resumoFiltros?: string;
}) {
  return (
    <MesAMesChart
      slug="recompra"
      icon={RotateCcw}
      titulo="Recompra"
      subtitulo="Valor pago em recompra, mês a mês, no ano selecionado."
      cor="#1A2347"
      apiEndpoint="/api/graficos/recompra"
      filtros={filtros}
      resumoFiltros={resumoFiltros}
      opcoesEixo={[]}
    />
  );
}
