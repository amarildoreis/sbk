import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import type { Scoped } from "@/lib/auth/access-scope";
import {
  getGraficoMensal,
  parseFiltrosFromSearchParams as parseFiltrosMensal,
  type GraficoMensalFiltros,
  type PontoMensal,
} from "./graficos-shared";

export type { PontoMensal };
export type GraficoDesagiosFiltros = GraficoMensalFiltros;
export const parseFiltrosFromSearchParams = parseFiltrosMensal;

// Gráfico "Deságios" (módulo Gráficos, segundo dos 7 — CLAUDE.md seção 9),
// mensualizado. Medida DAX colada pelo cliente em 2026-07-17:
//
// juros = SUM(SIGFIDC[JUROS]) + 0
//
// SIGFIDC[JUROS] é fisicamente SIGFLS.JUROS (join F.SIGFLS = fl.ctrl_id) —
// mesma coluna/observação já registrada no módulo Comissões (CLAUDE.md
// 19.6/23: "Deságio = SIGFLS.JUROS"), não uma coluna própria de SIGFIDC.
// Regras de eixo/tipo de pagamento/filtros compartilhadas com todos os
// gráficos do módulo (idênticas às de Títulos, pedido explícito do cliente)
// — ver graficos-shared.ts.
export async function getGraficoDesagiosMensal(
  filtros: Scoped<GraficoDesagiosFiltros>,
  forceRefresh = false,
): Promise<PontoMensal[]> {
  const ano = filtros.ano ?? new Date().getFullYear();
  const eixo = filtros.eixo ?? "compra";

  return withCache(
    `graficos-desagios:${ano}:${eixo}:${JSON.stringify({
      comercial: filtros.comercial,
      grupoEconomico: filtros.grupoEconomico,
      cedente: filtros.cedente,
    })}`,
    DATA_CACHE_TTL_MS,
    () =>
      getGraficoMensal(
        "ISNULL(fl.JUROS, 0)",
        "LEFT JOIN SIGFLS fl ON fl.ctrl_id = F.SIGFLS",
        filtros,
      ),
    { forceRefresh },
  );
}
