import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import {
  SIGFIDC_CODIGOS_FIDC,
  VENCIMENTO_EFETIVO,
  TIPO_PAGAMENTO_CASE,
  SIGBORS_OPERADOR_CTE,
} from "./sigfidc-shared";

export interface SacadoCarteira {
  id: string;
  sacado: string | null;
  cedente: string | null;
  riscoSacado: number;
  percentual: number;
  ultimoVencimento: string | null;
}

// 5 filtros confirmados pelo cliente em 2026-07-16 — mesmo universo
// SIGFIDC/comercial-por-borderô de Títulos/Comissões, por isso reaproveita
// as MESMAS query functions de cascata delas (grupos-economicos-titulos.ts,
// cedentes-titulos.ts, sacados-busca.ts) via wrappers finos nas rotas de
// API — nenhuma lógica SQL duplicada.
export interface CarteiraSacadosFiltros {
  comercial?: string;
  grupoCedente?: string;
  grupoSacado?: string;
  cedente?: string;
  sacado?: string;
  sacadoLabel?: string;
}

export function parseFiltrosFromSearchParams(
  searchParams: URLSearchParams,
): CarteiraSacadosFiltros {
  return {
    comercial: searchParams.get("comercial") ?? "",
    grupoCedente: searchParams.get("grupoCedente") ?? "",
    grupoSacado: searchParams.get("grupoSacado") ?? "",
    cedente: searchParams.get("cedente") ?? "",
    sacado: searchParams.get("sacado") ?? "",
  };
}

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_SORT_KEY = "riscoSacado";

export type SortDirection = "asc" | "desc";

// Carteira de Sacados (novo menu, abaixo de Borderôs Liberados — CLAUDE.md
// seção 9 / 3.13 Risco Sacado e Concentração). Grão da tabela é o par
// (SACADO, CLIFOR) — um sacado pode comprar de vários cedentes, cada
// combinação vira uma linha própria (regras coladas pelo cliente em
// 2026-07-16, a partir das medidas DAX originais):
//
// - risco_sacado = SUM(VALOR_) onde TIPO_PAGAMENTO <> 'Pagamento Total'
//   (títulos ainda não totalmente pagos — pendentes ou parciais).
// - risco_sacado_ultimo_venc = MAX(VENCIMENTO) no mesmo subconjunto.
// - % = participação do risco desse par sobre o risco total de TODOS os
//   pares (soma 100% ao final) — mesmo padrão de "Participação Cedente" em
//   carteira-clientes.ts (CTE de total geral + CROSS JOIN).
//
// Filtros aplicados ANTES do agrupamento (dentro do WHERE da própria CTE de
// agregação) — Comercial (COD_OPERADOR_INDICANTE por borderô, via
// SIGBORS_OPERADOR_CTE) e Grupo Econômico Cedente/Sacado (GrupoEmpresa,
// deduplicado por CLIFOR com ROW_NUMBER, joins separados pro lado cedente e
// pro lado sacado — mesmo padrão de relatorio-titulos.ts) restringem quais
// títulos entram na soma antes de agrupar por (SACADO, CLIFOR).
//
// HAVING (2026-07-16, a pedido do cliente): pares com Risco Sacado = 0 (já
// totalmente quitados) não aparecem na lista — diferente do "+0" literal da
// medida DAX original, que os mantinha visíveis com valor zerado. Não afeta
// TotalRiscoSacadoGeral (pares com riscoSacado=0 nunca contribuíam pra soma).
const FILTROS_CTE = `
${SIGBORS_OPERADOR_CTE},
GrupoEmpresaUnico AS (
    SELECT
        GE.clifor,
        GE.idgrupo,
        ROW_NUMBER() OVER (PARTITION BY GE.clifor ORDER BY GE.clifor) AS RN
    FROM GrupoEmpresa GE
),
RiscoSacadoPorPar AS (
    SELECT
        f.SACADO,
        f.CLIFOR,
        SUM(CASE WHEN ${TIPO_PAGAMENTO_CASE} <> 'Pagamento Total' THEN f.VALOR_ ELSE 0 END) AS riscoSacado,
        MAX(CASE WHEN ${TIPO_PAGAMENTO_CASE} <> 'Pagamento Total' THEN ${VENCIMENTO_EFETIVO} END) AS ultimoVencimento
    FROM SIGFIDC f
    LEFT JOIN SigborsOperador SO ON SO.BORDERO = f.BORDERO
    LEFT JOIN GrupoEmpresaUnico GC_CED ON GC_CED.clifor = f.CLIFOR AND GC_CED.RN = 1
    LEFT JOIN GrupoEmpresaUnico GC_SAC ON GC_SAC.clifor = f.SACADO AND GC_SAC.RN = 1
    WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
      AND (@comercial = '' OR SO.codigoComercial = @comercial)
      AND (@grupoCedente = '' OR CAST(GC_CED.idgrupo AS VARCHAR) = @grupoCedente)
      AND (@grupoSacado = '' OR CAST(GC_SAC.idgrupo AS VARCHAR) = @grupoSacado)
      AND (@cedente = '' OR CAST(f.CLIFOR AS VARCHAR) = @cedente)
      AND (@sacado = '' OR CAST(f.SACADO AS VARCHAR) = @sacado)
    GROUP BY f.SACADO, f.CLIFOR
    HAVING SUM(CASE WHEN ${TIPO_PAGAMENTO_CASE} <> 'Pagamento Total' THEN f.VALOR_ ELSE 0 END) <> 0
),
TotalRiscoSacadoGeral AS (
    SELECT ISNULL(SUM(riscoSacado), 0) AS total FROM RiscoSacadoPorPar
)
`;

const CARTEIRA_SACADOS_JOINS = `
FROM RiscoSacadoPorPar R
LEFT JOIN SIGCAD SAC ON SAC.CODIGO = R.SACADO
LEFT JOIN SIGCAD CED ON CED.CODIGO = R.CLIFOR
CROSS JOIN TotalRiscoSacadoGeral
`;

const SACADO_EXPR = `CAST(R.SACADO AS VARCHAR) + ' - ' + ISNULL(SAC.NOME, '') + ' - ' + ISNULL(SAC.CGC, '')`;
const CEDENTE_EXPR = `CAST(R.CLIFOR AS VARCHAR) + ' - ' + ISNULL(CED.NOME, '') + ' - ' + ISNULL(CED.CGC, '')`;
const PERCENTUAL_EXPR = `
CASE WHEN TotalRiscoSacadoGeral.total = 0 THEN 0
     ELSE R.riscoSacado * 100.0 / TotalRiscoSacadoGeral.total
END
`;

function filtrosParams(filtros: CarteiraSacadosFiltros) {
  const strParam = (name: string, value: string | undefined) => ({
    name,
    type: sql.VarChar(200),
    value: (value ?? "").trim(),
  });

  return [
    strParam("comercial", filtros.comercial),
    strParam("grupoCedente", filtros.grupoCedente),
    strParam("grupoSacado", filtros.grupoSacado),
    strParam("cedente", filtros.cedente),
    strParam("sacado", filtros.sacado),
  ];
}

const SORT_EXPRESSIONS: Record<string, string> = {
  sacado: "SAC.NOME",
  cedente: "CED.NOME",
  riscoSacado: "R.riscoSacado",
  percentual: "R.riscoSacado",
  ultimoVencimento: "R.ultimoVencimento",
};

// Etapa 1 (2026-07-16): tabela + card totalizador. Etapa 2 (2026-07-16):
// filtros retráteis (mesmo padrão das demais telas) + exportação/e-mail.
// Mesmo padrão de paginação/ordenação no servidor via ROW_NUMBER() dos
// demais relatórios (SQL Server 2008 R2, sem OFFSET/FETCH — CLAUDE.md 16).
function buildQuery(sortKey: string, sortDir: SortDirection) {
  const expr = SORT_EXPRESSIONS[sortKey] ?? SORT_EXPRESSIONS[DEFAULT_SORT_KEY];
  const dir = sortDir === "asc" ? "ASC" : "DESC";

  return `
;WITH ${FILTROS_CTE},
Numerado AS (
    SELECT
        CAST(R.SACADO AS VARCHAR) + '_' + CAST(R.CLIFOR AS VARCHAR) AS id,
        ${SACADO_EXPR} AS sacado,
        ${CEDENTE_EXPR} AS cedente,
        R.riscoSacado AS riscoSacado,
        ${PERCENTUAL_EXPR} AS percentual,
        R.ultimoVencimento AS ultimoVencimento,
        ROW_NUMBER() OVER (ORDER BY ${expr} ${dir}, R.SACADO DESC, R.CLIFOR DESC) AS rn
    ${CARTEIRA_SACADOS_JOINS}
)
SELECT id, sacado, cedente, riscoSacado, percentual, ultimoVencimento
FROM Numerado
WHERE rn BETWEEN @rnStart AND @rnEnd
ORDER BY rn
`;
}

function buildCountQuery() {
  return `
;WITH ${FILTROS_CTE}
SELECT COUNT(*) AS total FROM RiscoSacadoPorPar
`;
}

// Único totalizador da tela — "Valor Total do Risco Sacado" = soma da
// coluna Risco Sacado sobre TODO o universo filtrado (não só a página
// carregada), mesmo padrão de "Valor Total dos Borderôs" em Borderôs
// Liberados.
function buildTotaisQuery() {
  return `
;WITH ${FILTROS_CTE}
SELECT total AS riscoSacado FROM TotalRiscoSacadoGeral
`;
}

export interface CarteiraSacadosTotais {
  riscoSacado: number;
}

export interface CarteiraSacadosPage {
  rows: SacadoCarteira[];
  total: number;
  page: number;
  pageSize: number;
  totais: CarteiraSacadosTotais;
}

export async function getCarteiraSacados(
  page: number,
  pageSize: number,
  sortKey: string = DEFAULT_SORT_KEY,
  sortDir: SortDirection = "desc",
  filtros: Scoped<CarteiraSacadosFiltros>,
  forceRefresh = false,
): Promise<CarteiraSacadosPage> {
  const safePageSize = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
  const safePage = Math.max(page, 1);

  return withCache(
    `carteira-sacados:${safePage}:${safePageSize}:${sortKey}:${sortDir}:${JSON.stringify(filtros)}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rnStart = (safePage - 1) * safePageSize + 1;
      const rnEnd = safePage * safePageSize;
      const fParams = filtrosParams(filtros);

      const [rows, countRows, totaisRows] = await Promise.all([
        executeReadQuery<SacadoCarteira>(buildQuery(sortKey, sortDir), [
          { name: "rnStart", type: sql.Int, value: rnStart },
          { name: "rnEnd", type: sql.Int, value: rnEnd },
          ...fParams,
        ]),
        executeReadQuery<{ total: number }>(buildCountQuery(), fParams),
        executeReadQuery<CarteiraSacadosTotais>(buildTotaisQuery(), fParams),
      ]);

      return {
        rows,
        total: countRows[0]?.total ?? 0,
        page: safePage,
        pageSize: safePageSize,
        totais: totaisRows[0] ?? { riscoSacado: 0 },
      };
    },
    { forceRefresh },
  );
}

// Exportação para Excel/e-mail — sem paginação, com trava de segurança
// (@maxRows) e timeout maior, mesmo padrão dos demais módulos.
const EXPORT_MAX_ROWS = 200_000;
const EXPORT_TIMEOUT_MS = 25_000;

function buildExportQuery(sortKey: string, sortDir: SortDirection) {
  const expr = SORT_EXPRESSIONS[sortKey] ?? SORT_EXPRESSIONS[DEFAULT_SORT_KEY];
  const dir = sortDir === "asc" ? "ASC" : "DESC";

  return `
;WITH ${FILTROS_CTE}
SELECT TOP (@maxRows)
    CAST(R.SACADO AS VARCHAR) + '_' + CAST(R.CLIFOR AS VARCHAR) AS id,
    ${SACADO_EXPR} AS sacado,
    ${CEDENTE_EXPR} AS cedente,
    R.riscoSacado AS riscoSacado,
    ${PERCENTUAL_EXPR} AS percentual,
    R.ultimoVencimento AS ultimoVencimento
${CARTEIRA_SACADOS_JOINS}
ORDER BY ${expr} ${dir}, R.SACADO DESC, R.CLIFOR DESC
`;
}

export async function getCarteiraSacadosParaExportacao(
  sortKey: string = DEFAULT_SORT_KEY,
  sortDir: SortDirection = "desc",
  filtros: Scoped<CarteiraSacadosFiltros>,
): Promise<SacadoCarteira[]> {
  return executeReadQuery<SacadoCarteira>(
    buildExportQuery(sortKey, sortDir),
    [
      { name: "maxRows", type: sql.Int, value: EXPORT_MAX_ROWS },
      ...filtrosParams(filtros),
    ],
    { timeoutMs: EXPORT_TIMEOUT_MS },
  );
}
