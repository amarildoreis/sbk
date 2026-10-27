import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import { SIGFIDC_CODIGOS_FIDC, VALOR_PAGAMENTO_EXPR } from "./sigfidc-shared";
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
// de eixo, mesmo padrão de VOP Cedente (pedido explícito do cliente em
// 2026-07-17).
export interface GraficoRecompraFiltros {
  ano?: number;
  comercial?: string;
  grupoEconomico?: string;
  cedente?: string;
}

export function parseFiltrosFromSearchParams(
  searchParams: URLSearchParams,
): GraficoRecompraFiltros {
  return {
    ano: parseAno(searchParams.get("ano")),
    comercial: searchParams.get("comercial") ?? "",
    grupoEconomico: searchParams.get("grupoEconomico") ?? "",
    cedente: searchParams.get("cedente") ?? "",
  };
}

// Gráfico "Recompra" — sexto dos 7 gráficos do módulo (CLAUDE.md seção 9).
// Sem radio de eixo, mesmo padrão de VOP Cedente. Medida DAX colada pelo
// cliente em 2026-07-17:
//
// recompra_total = CALCULATE(SUM(SIGFIDC[VALOR_PAGAMENTO]), SIGFIDC[BANCO] = "01") + 0
//
// Fonte é SIGFIDC direto (não SIGFLS/TREATAS via CADCRED como VOP Cedente)
// — Comercial usa COD_OPERADOR_INDICANTE por borderô (COMERCIAL_EXPR,
// idêntico a Títulos/Deságios/Comissões/Vencidos), herda o filtro padrão
// CODIGO IN (040,041,042,046) — mesmo padrão do grupo "Recompra" do
// Comportamental (comportamental-recompra.ts). A medida original não tem
// filtro de data (só BANCO='01'); pra virar um gráfico mês a mês, o eixo é
// SIGFIDC[DIGITACAO] (confirmado pelo cliente em 2026-07-17 — não DTPGTO,
// apesar de ser a coluna usada nas janelas de 30/60/90 dias do grupo
// homônimo do Comportamental, um contexto diferente).
const FILTROS_CTE = `
GrupoEmpresaUnico AS (
    SELECT clifor, idgrupo, ROW_NUMBER() OVER (PARTITION BY clifor ORDER BY clifor) AS RN
    FROM GrupoEmpresa
)
`;

const QUERY = `
;WITH ${FILTROS_CTE}
SELECT MONTH(F.DIGITACAO) AS mes, ISNULL(SUM(${VALOR_PAGAMENTO_EXPR}), 0) AS valor
FROM SIGFIDC F
LEFT JOIN SIGBORS B ON B.BORDERO = F.BORDERO
LEFT JOIN GrupoEmpresaUnico GEU ON GEU.clifor = F.CLIFOR AND GEU.RN = 1
WHERE F.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
  AND F.BANCO = '01'
  AND F.DIGITACAO IS NOT NULL
  AND YEAR(F.DIGITACAO) = @ano
  AND (@comercial = '' OR ${COMERCIAL_EXPR} = @comercial)
  AND (@grupoEconomico = '' OR CAST(GEU.idgrupo AS VARCHAR) = @grupoEconomico)
  AND (@cedente = '' OR CAST(F.CLIFOR AS VARCHAR) = @cedente)
GROUP BY MONTH(F.DIGITACAO)
`;

function filtrosParams(filtros: GraficoRecompraFiltros) {
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

export async function getGraficoRecompraMensal(
  filtros: Scoped<GraficoRecompraFiltros>,
  forceRefresh = false,
): Promise<PontoMensal[]> {
  const ano = filtros.ano ?? new Date().getFullYear();

  return withCache(
    `graficos-recompra:${ano}:${JSON.stringify({
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
