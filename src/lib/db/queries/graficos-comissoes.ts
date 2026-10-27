import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import type { Scoped } from "@/lib/auth/access-scope";
import { JUROS_MENSAL_CASE } from "./sigfidc-shared";
import {
  getGraficoMensal,
  parseFiltrosFromSearchParams as parseFiltrosMensal,
  COMERCIAL_EXPR,
  type GraficoMensalFiltros,
  type PontoMensal,
} from "./graficos-shared";
import {
  getFaixasOrdenadas,
  buildFaixaComissaoExpr,
  getTipoComercialMap,
  internoCodigosFromMap,
} from "./comissoes";

export type { PontoMensal };
export type GraficoComissoesFiltros = GraficoMensalFiltros;
export const parseFiltrosFromSearchParams = parseFiltrosMensal;

// Gráfico "Comissões" (módulo Gráficos, terceiro dos 7 — CLAUDE.md seção
// 9), mensualizado. Medida DAX colada pelo cliente em 2026-07-17:
//
// comissao_comercial =
//     CALCULATE(
//         SUM(SIGFIDC[VALOR_COMISSAO]),
//         FILTER(SIGFIDC, NOT ISBLANK(SIGFIDC[COD_COMERCIAL]))
//     ) + 0
//
// VALOR_COMISSAO e a Faixa de Comissão (Interno via faixas dinâmicas,
// Externo via SIGBORS.COMISSAO — correção 2026-07-18) são EXATAMENTE as
// mesmas do módulo Comissões (CLAUDE.md 19.6) — getFaixasOrdenadas/
// buildFaixaComissaoExpr/getTipoComercialMap reaproveitados de
// comissoes.ts, nunca duplicados. "COD_COMERCIAL não em branco" =
// COMERCIAL_EXPR (mesma expressão de Comercial por borderô já usada como
// filtro nos demais gráficos) IS NOT NULL — não precisa da CTE
// OperadorComercial completa (que só formata "código - nome" pra exibição),
// já que aqui só interessa se existe indicante/operador ou não. O alias de
// SIGBORS aqui é `B` (já joined em getGraficoMensal/graficos-shared.ts para
// COMERCIAL_EXPR), diferente do `SB` usado em comissoes.ts.
export async function getGraficoComissoesMensal(
  filtros: Scoped<GraficoComissoesFiltros>,
  forceRefresh = false,
): Promise<PontoMensal[]> {
  const ano = filtros.ano ?? new Date().getFullYear();
  const eixo = filtros.eixo ?? "compra";

  return withCache(
    `graficos-comissoes:${ano}:${eixo}:${JSON.stringify({
      comercial: filtros.comercial,
      grupoEconomico: filtros.grupoEconomico,
      cedente: filtros.cedente,
    })}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const [faixas, tipoMap] = await Promise.all([getFaixasOrdenadas(), getTipoComercialMap()]);
      // FaixaComissao (Prisma/MySQL) guarda jurosMin/jurosMax/taxa em escala
      // percentual "crua" (ex: 2.1 = 2,1%); JUROS_MENSAL_CASE é uma fração
      // (0.0226 = 2,26%) — por isso *100 antes de comparar (mesmo padrão de
      // getComissoes em comissoes.ts).
      const { expr: faixaComissaoExpr, params: faixaParams } = buildFaixaComissaoExpr(
        faixas,
        `(${JUROS_MENSAL_CASE}) * 100`,
        internoCodigosFromMap(tipoMap),
        { codigoComercialExpr: COMERCIAL_EXPR, sigborsAlias: "B" },
      );
      const valorExpr = `CASE WHEN (${COMERCIAL_EXPR}) IS NULL THEN 0 ELSE ISNULL(fl.JUROS, 0) * (${faixaComissaoExpr}) / 100.0 END`;

      return getGraficoMensal(
        valorExpr,
        "LEFT JOIN SIGFLS fl ON fl.ctrl_id = F.SIGFLS",
        filtros,
        faixaParams,
      );
    },
    { forceRefresh },
  );
}
