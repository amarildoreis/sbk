import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import { SIGFIDC_CODIGOS_FIDC, STATUS_PAGTO_CASE } from "./sigfidc-shared";
import { GRAFICO_ANO_MIN, GRAFICO_ANO_MAX, COMERCIAL_EXPR, type PontoMensal } from "./graficos-shared";

export { GRAFICO_ANO_MIN, GRAFICO_ANO_MAX };
export type { PontoMensal };

function parseAno(value: string | null): number {
  const atual = new Date().getFullYear();
  const ano = Number(value);
  if (!Number.isInteger(ano) || ano < GRAFICO_ANO_MIN || ano > GRAFICO_ANO_MAX) {
    return Math.min(Math.max(atual, GRAFICO_ANO_MIN), GRAFICO_ANO_MAX);
  }
  return ano;
}

// Só o filtro de Ano além de Comercial/Grupo Econômico/Cedente — sem radio
// de eixo, mesmo padrão de VOP Cedente/Recompra.
export interface GraficoTotalPagoFiltros {
  ano?: number;
  comercial?: string;
  grupoEconomico?: string;
  cedente?: string;
}

export function parseFiltrosFromSearchParams(
  searchParams: URLSearchParams,
): GraficoTotalPagoFiltros {
  return {
    ano: parseAno(searchParams.get("ano")),
    comercial: searchParams.get("comercial") ?? "",
    grupoEconomico: searchParams.get("grupoEconomico") ?? "",
    cedente: searchParams.get("cedente") ?? "",
  };
}

// Gráfico "Total Pago" — sétimo e último dos 7 gráficos do módulo
// (CLAUDE.md seção 9). Sem radio de eixo, mesmo padrão de VOP Cedente/
// Recompra. Medida DAX colada pelo cliente em 2026-07-17:
//
// total_pago = CALCULATE(
//     SUM(SIGFIDC[VALOR_]),
//     SIGFIDC[STATUS_PAGTO] IN { "Pago Em Dia", "Pago Vencido" }
// ) + 0
//
// Fonte é SIGFIDC direto — Comercial usa COD_OPERADOR_INDICANTE por
// borderô (COMERCIAL_EXPR, idêntico a Títulos/Deságios/Comissões/Vencidos/
// Recompra), herda o filtro padrão CODIGO IN (040,041,042,046). STATUS_PAGTO
// não existe como coluna física — recalculado via STATUS_PAGTO_CASE
// (CLAUDE.md 19.1), já usado em todo o resto da plataforma. Eixo de data =
// SIGFIDC[DIGITACAO] (confirmado pelo cliente, mesmo eixo de Recompra).
const FILTROS_CTE = `
GrupoEmpresaUnico AS (
    SELECT clifor, idgrupo, ROW_NUMBER() OVER (PARTITION BY clifor ORDER BY clifor) AS RN
    FROM GrupoEmpresa
)
`;

const QUERY = `
;WITH ${FILTROS_CTE}
SELECT MONTH(F.DIGITACAO) AS mes, ISNULL(SUM(ISNULL(F.VALOR_, 0)), 0) AS valor
FROM SIGFIDC F
LEFT JOIN SIGBORS B ON B.BORDERO = F.BORDERO
LEFT JOIN GrupoEmpresaUnico GEU ON GEU.clifor = F.CLIFOR AND GEU.RN = 1
WHERE F.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
  AND ${STATUS_PAGTO_CASE} IN ('Pago Em Dia', 'Pago Vencido')
  AND F.DIGITACAO IS NOT NULL
  AND YEAR(F.DIGITACAO) = @ano
  AND (@comercial = '' OR ${COMERCIAL_EXPR} = @comercial)
  AND (@grupoEconomico = '' OR CAST(GEU.idgrupo AS VARCHAR) = @grupoEconomico)
  AND (@cedente = '' OR CAST(F.CLIFOR AS VARCHAR) = @cedente)
GROUP BY MONTH(F.DIGITACAO)
`;

function filtrosParams(filtros: GraficoTotalPagoFiltros) {
  const ano = filtros.ano ?? new Date().getFullYear();
  return [
    { name: "ano", type: sql.Int, value: ano },
    { name: "comercial", type: sql.VarChar(200), value: (filtros.comercial ?? "").trim() },
    {
      name: "grupoEconomico",
      type: sql.VarChar(200),
      value: (filtros.grupoEconomico ?? "").trim(),
    },
    { name: "cedente", type: sql.VarChar(200), value: (filtros.cedente ?? "").trim() },
  ];
}

export async function getGraficoTotalPagoMensal(
  filtros: Scoped<GraficoTotalPagoFiltros>,
  forceRefresh = false,
): Promise<PontoMensal[]> {
  const ano = filtros.ano ?? new Date().getFullYear();

  return withCache(
    `graficos-total-pago:${ano}:${JSON.stringify({
      comercial: filtros.comercial,
      grupoEconomico: filtros.grupoEconomico,
      cedente: filtros.cedente,
    })}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<PontoMensal>(QUERY, filtrosParams(filtros));
      const porMes = new Map(rows.map((r) => [r.mes, r.valor]));
      return Array.from({ length: 12 }, (_, i) => ({
        mes: i + 1,
        valor: porMes.get(i + 1) ?? 0,
      }));
    },
    { forceRefresh },
  );
}
