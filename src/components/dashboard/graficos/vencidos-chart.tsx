"use client";

import { CalendarX } from "lucide-react";
import { MesAMesChart, type OpcaoEixo } from "./mes-a-mes-chart";
import type { GraficosFiltros } from "./graficos-page";

// Radios próprios deste gráfico — diferente dos demais (Base de data:
// Compra/Pagamento/Vencimento), aqui são 2 opções de "evolução acumulada"
// (cada mês soma o acumulado desde janeiro até o fim daquele mês, não só o
// valor isolado do mês) — medidas DAX coladas pelo cliente em 2026-07-17.
const OPCOES_EIXO_VENCIDOS: OpcaoEixo[] = [
  {
    value: "geral",
    label: "Evolução Geral",
    detalhe: "Vencimento Acumulado",
  },
  {
    value: "vencidos",
    label: "Evolução Vencidos",
    detalhe: "Vencimento Acumulado",
  },
];

// Gráfico "Vencidos" — quarto dos 7 gráficos do módulo (CLAUDE.md seção 9).
// Diverge dos demais: em vez de "Base de data" (Compra/Pagamento/
// Vencimento), o radio group interno é "Evolução Acumulada" (Geral/
// Vencidos) — cada barra é um saldo ACUMULADO desde janeiro até o fim
// daquele mês, não o valor isolado do mês (ver graficos-vencidos.ts pras
// medidas DAX completas: acumulado_evolucao_geral/acumulado_vencido_
// evolucao). Wrapper fino sobre MesAMesChart, reaproveitando cabeçalho/
// filtro de ano/exportação — só o radio group e a query mudam. Cor
// vermelho-risco (`#B3495A`, paleta oficial — CLAUDE.md 5.1), semântica de
// risco/vencido, condizente com o conteúdo do gráfico.
export function VencidosChart({
  filtros,
  resumoFiltros,
}: {
  filtros: GraficosFiltros;
  resumoFiltros?: string;
}) {
  return (
    <MesAMesChart
      slug="vencidos"
      icon={CalendarX}
      titulo="Vencidos"
      subtitulo="Saldo vencido acumulado mês a mês, no ano selecionado."
      cor="#B3495A"
      apiEndpoint="/api/graficos/vencidos"
      filtros={filtros}
      resumoFiltros={resumoFiltros}
      opcoesEixo={OPCOES_EIXO_VENCIDOS}
      rotuloRadios="Evolução Acumulada"
    />
  );
}
