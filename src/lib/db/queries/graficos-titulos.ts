import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import type { Scoped } from "@/lib/auth/access-scope";
import {
  getGraficoMensal,
  parseFiltrosFromSearchParams as parseFiltrosMensal,
  GRAFICO_ANO_MIN,
  GRAFICO_ANO_MAX,
  type GraficoEixo,
  type GraficoMensalFiltros,
  type PontoMensal,
} from "./graficos-shared";

export type { PontoMensal };
export type GraficoTitulosEixo = GraficoEixo;
export type GraficoTitulosFiltros = GraficoMensalFiltros;
export { GRAFICO_ANO_MIN, GRAFICO_ANO_MAX };
export const parseFiltrosFromSearchParams = parseFiltrosMensal;

// Gráfico "Títulos" (módulo Gráficos, primeiro dos 7 — CLAUDE.md seção 9),
// mensualizado (jan-dez de um ano escolhido). Medida DAX colada pelo
// cliente em 2026-07-16:
//
// valor_titulo = IF(ISBLANK(SUM(SIGFIDC[VALOR_])), 0, SUM(SIGFIDC[VALOR_]))
//
// Regras de eixo/tipo de pagamento/filtros compartilhadas com todos os
// gráficos do módulo — ver graficos-shared.ts.
export async function getGraficoTitulosMensal(
  filtros: Scoped<GraficoTitulosFiltros>,
  forceRefresh = false,
): Promise<PontoMensal[]> {
  const ano = filtros.ano ?? new Date().getFullYear();
  const eixo = filtros.eixo ?? "compra";

  return withCache(
    `graficos-titulos:${ano}:${eixo}:${JSON.stringify({
      comercial: filtros.comercial,
      grupoEconomico: filtros.grupoEconomico,
      cedente: filtros.cedente,
    })}`,
    DATA_CACHE_TTL_MS,
    () => getGraficoMensal("ISNULL(F.VALOR_, 0)", "", filtros),
    { forceRefresh },
  );
}
