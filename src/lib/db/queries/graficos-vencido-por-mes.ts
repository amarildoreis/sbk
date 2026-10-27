import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import { STATUS_PAGTO_CASE, VENCIMENTO_EFETIVO, SIGFIDC_CODIGOS_FIDC, SIGBORS_OPERADOR_CTE } from "./sigfidc-shared";
import { GRAFICO_ANO_MIN, GRAFICO_ANO_MAX, type PontoMensal } from "./graficos-shared";

export { GRAFICO_ANO_MIN, GRAFICO_ANO_MAX };
export type { PontoMensal };

// "Vencido por mês de vencimento" — CUIDADO pra não confundir com "Vencidos
// — Evolução Geral/Vencidos" (graficos-vencidos.ts, saldo ACUMULADO ao
// longo do ano — um conceito de negócio diferente). Aqui é a MESMA
// definição de "Vencido" já usada em Comercial - Visão Geral
// (vencido-cedente.ts) e no grupo Exposição Cedente do Comportamental
// (comportamental-exposicao-cedente.ts) — SUM(SIGFIDC.VALOR_) WHERE
// STATUS_PAGTO = 'Vencido' — só que quebrada por mês de VENCIMENTO do
// título em vez de um total único. A soma dos 12 meses bate com o total de
// "Vencido" das outras duas telas (mesmo ano cobrindo os vencimentos dos
// títulos hoje vencidos). Criado em 2026-07-19 — o cliente pediu
// explicitamente um gráfico mês a mês de vencidos, mas usando a mesma base
// de "Vencido" de sempre, com o eixo sendo a DATA DE VENCIMENTO do título
// (não data de compra/pagamento — não faria sentido pra este conceito,
// título pago não é mais "Vencido").
export interface GraficoVencidoPorMesFiltros {
  ano?: number;
  comercial?: string;
  grupoEconomico?: string;
  cedente?: string;
}

function parseAno(value: string | null): number {
  const atual = new Date().getFullYear();
  const ano = Number(value);
  if (!Number.isInteger(ano) || ano < GRAFICO_ANO_MIN || ano > GRAFICO_ANO_MAX) {
    return Math.min(Math.max(atual, GRAFICO_ANO_MIN), GRAFICO_ANO_MAX);
  }
  return ano;
}

export function parseFiltrosFromSearchParams(
  searchParams: URLSearchParams,
): GraficoVencidoPorMesFiltros {
  return {
    ano: parseAno(searchParams.get("ano")),
    comercial: searchParams.get("comercial") ?? "",
    grupoEconomico: searchParams.get("grupoEconomico") ?? "",
    cedente: searchParams.get("cedente") ?? "",
  };
}

const FILTROS_CTE = `
${SIGBORS_OPERADOR_CTE},
GrupoEmpresaUnico AS (
    SELECT clifor, idgrupo, ROW_NUMBER() OVER (PARTITION BY clifor ORDER BY clifor) AS RN
    FROM GrupoEmpresa
)
`;

const QUERY = `
;WITH ${FILTROS_CTE}
SELECT
    MONTH(${VENCIMENTO_EFETIVO}) AS mes,
    ISNULL(SUM(f.VALOR_), 0) AS valor
FROM SIGFIDC f
LEFT JOIN SigborsOperador SO ON SO.BORDERO = f.BORDERO
LEFT JOIN GrupoEmpresaUnico GEU ON GEU.clifor = f.CLIFOR AND GEU.RN = 1
WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
  AND ${STATUS_PAGTO_CASE} = 'Vencido'
  AND ${VENCIMENTO_EFETIVO} IS NOT NULL
  AND YEAR(${VENCIMENTO_EFETIVO}) = @ano
  AND (@comercial = '' OR SO.codigoComercial = @comercial)
  AND (@grupoEconomico = '' OR CAST(GEU.idgrupo AS VARCHAR) = @grupoEconomico)
  AND (@cedente = '' OR CAST(f.CLIFOR AS VARCHAR) = @cedente)
GROUP BY MONTH(${VENCIMENTO_EFETIVO})
`;

function filtrosParams(filtros: GraficoVencidoPorMesFiltros) {
  const ano = filtros.ano ?? new Date().getFullYear();
  return [
    { name: "ano", type: sql.Int, value: ano },
    { name: "comercial", type: sql.VarChar(20), value: (filtros.comercial ?? "").trim() },
    { name: "grupoEconomico", type: sql.VarChar(20), value: (filtros.grupoEconomico ?? "").trim() },
    { name: "cedente", type: sql.VarChar(20), value: (filtros.cedente ?? "").trim() },
  ];
}

export async function getGraficoVencidoPorMesMensal(
  filtros: Scoped<GraficoVencidoPorMesFiltros>,
  forceRefresh = false,
): Promise<PontoMensal[]> {
  const ano = filtros.ano ?? new Date().getFullYear();

  return withCache(
    `graficos-vencido-por-mes:${ano}:${JSON.stringify({
      comercial: filtros.comercial,
      grupoEconomico: filtros.grupoEconomico,
      cedente: filtros.cedente,
    })}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<{ mes: number; valor: number }>(QUERY, filtrosParams(filtros));
      const porMes = new Map(rows.map((r) => [r.mes, r.valor]));
      return Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, valor: porMes.get(i + 1) ?? 0 }));
    },
    { forceRefresh },
  );
}

const QUERY_ANO_MINIMO = `
;WITH ${FILTROS_CTE}
SELECT MIN(YEAR(${VENCIMENTO_EFETIVO})) AS anoMinimo
FROM SIGFIDC f
LEFT JOIN SigborsOperador SO ON SO.BORDERO = f.BORDERO
LEFT JOIN GrupoEmpresaUnico GEU ON GEU.clifor = f.CLIFOR AND GEU.RN = 1
WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
  AND ${STATUS_PAGTO_CASE} = 'Vencido'
  AND ${VENCIMENTO_EFETIVO} IS NOT NULL
  AND (@comercial = '' OR SO.codigoComercial = @comercial)
  AND (@grupoEconomico = '' OR CAST(GEU.idgrupo AS VARCHAR) = @grupoEconomico)
  AND (@cedente = '' OR CAST(f.CLIFOR AS VARCHAR) = @cedente)
`;

function filtrosSemAnoParams(filtros: Omit<GraficoVencidoPorMesFiltros, "ano">) {
  return [
    { name: "comercial", type: sql.VarChar(20), value: (filtros.comercial ?? "").trim() },
    { name: "grupoEconomico", type: sql.VarChar(20), value: (filtros.grupoEconomico ?? "").trim() },
    { name: "cedente", type: sql.VarChar(20), value: (filtros.cedente ?? "").trim() },
  ];
}

// Menor ano de VENCIMENTO entre os títulos hoje "Vencido" (sem filtro de
// ano) — usado como ponto de partida da tabela "por ano" da IA (2026-07-19,
// correção de um bug real: o range padrão da tabela ia de GRAFICO_ANO_MIN
// (2023, o primeiro ano listado no seletor de Ano da tela de Gráficos) até
// o ano atual, mas existem títulos vencidos com vencimento ANTERIOR a 2023
// — dívidas antigas em aberto. Com o range fixo em 2023+, a soma da tabela
// ficava menor que o total real de "Vencido" de Comercial - Visão Geral/
// Exposição Cedente, porque essas linhas mais antigas ficavam de fora
// silenciosamente. GRAFICO_ANO_MIN/MAX só limitam o SELETOR da tela de
// Gráficos — a query em si aceita qualquer ano, então buscar o mínimo real
// e usá-lo como início é seguro.
export async function getAnoMinimoVencido(
  filtros: Scoped<Omit<GraficoVencidoPorMesFiltros, "ano">>,
  forceRefresh = false,
): Promise<number | null> {
  return withCache(
    `graficos-vencido-ano-minimo:${JSON.stringify({
      comercial: filtros.comercial,
      grupoEconomico: filtros.grupoEconomico,
      cedente: filtros.cedente,
    })}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<{ anoMinimo: number | null }>(
        QUERY_ANO_MINIMO,
        filtrosSemAnoParams(filtros),
      );
      return rows[0]?.anoMinimo ?? null;
    },
    { forceRefresh },
  );
}
