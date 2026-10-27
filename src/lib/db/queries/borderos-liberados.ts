import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import { SIGFIDC_CODIGOS_FIDC } from "./sigfidc-shared";

export interface BorderoLiberado {
  id: number;
  bordero: number;
  dataLiberacao: string | null;
  titulosFidc: number;
  cedente: string | null;
  prazoMedio: number;
  metodo: string | null;
  fator: number | null;
}

// Filtros retráteis (não popup — decisão do cliente em 2026-07-16, ver
// comentário em cima de buildQuery). Comercial aqui vem direto de
// SIGBORS.INDICANTE/OPERADOR (a própria tabela-guia já traz esse vínculo,
// diferente de Títulos/Comissões que precisam de SIGBORS_OPERADOR_CTE pra
// juntar a partir de SIGFIDC). Método usa o código cru (1/2/3/4/7), não o
// texto traduzido — mesmo valor salvo em CALCULOFIDC.
export interface BorderosLiberadosFiltros {
  bordero?: string;
  borderoLabel?: string;
  dataLiberacaoInicio?: string | null;
  dataLiberacaoFim?: string | null;
  comercial?: string;
  grupoEconomico?: string;
  cedente?: string;
  metodo?: string;
}

export function parseFiltrosFromSearchParams(
  searchParams: URLSearchParams,
): BorderosLiberadosFiltros {
  return {
    bordero: searchParams.get("bordero") ?? "",
    dataLiberacaoInicio: searchParams.get("dataLiberacaoInicio") || null,
    dataLiberacaoFim: searchParams.get("dataLiberacaoFim") || null,
    comercial: searchParams.get("comercial") ?? "",
    grupoEconomico: searchParams.get("grupoEconomico") ?? "",
    cedente: searchParams.get("cedente") ?? "",
    metodo: searchParams.get("metodo") ?? "",
  };
}

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_SORT_KEY = "dataLiberacao";

export type SortDirection = "asc" | "desc";

// Método = SIGBORS.CALCULOFIDC traduzido — mesmo mapeamento de
// CADCRED.METODOCALCULOFIDC (CLAUDE.md 19.8/carteira-clientes.ts),
// confirmado pelo cliente em 2026-07-16 (SIGBORS[CALCULOFIDC] -> Metodo[id]).
const METODO_CASE = `
CASE B.CALCULOFIDC
    WHEN 1 THEN 'Efetivo'
    WHEN 2 THEN 'Nominal'
    WHEN 3 THEN 'Misto'
    WHEN 4 THEN 'Efetivo VA'
    WHEN 7 THEN 'Padrão'
    ELSE NULL
END
`;

// Prazo Médio — regra colada pelo cliente em 2026-07-16 (script de origem
// do Power BI): soma de FLOTMEDIOFIDC + PRAZOFIDC, ambos tratados como 0
// quando nulos.
const PRAZO_MEDIO_EXPR = `ISNULL(B.FLOTMEDIOFIDC, 0) + ISNULL(B.PRAZOFIDC, 0)`;

// Títulos FIDC — medida DAX `borderos_liberados` (CLAUDE.md, colada pelo
// cliente em 2026-07-16): soma SIGBORS.TITULOSFIDC só quando o borderô está
// liberado (LIBERADO = 'S') E tem ao menos um título dentro do universo
// padrão do FIDC (SIGFIDC.CODIGO IN (040,041,042,046)) — replica
// `FILTER(SIGBORS, SIGBORS[BORDERO] IN VALUES(SIGFIDC[BORDERO]) &&
// SIGBORS[LIBERADO] = "S")`. Como a tela já filtra a tabela-guia por
// LIBERADO = 'S' (ver buildQuery), é o LEFT JOIN com BorderosComTituloFidc
// que efetivamente zera a coluna quando não há título FIDC associado ao
// borderô — importante pra quando filtros forem adicionados numa etapa
// futura (a medida original responde ao contexto de filtro do relatório).
// Usa LEFT JOIN em vez de EXISTS correlacionado porque o SQL Server 2008 R2
// (compat level 100) rejeita `SUM(CASE WHEN EXISTS(...) THEN x END)` com o
// erro "Cannot perform an aggregate function on an expression containing an
// aggregate or a subquery" — confirmado em 2026-07-16 ao tentar somar o
// totalizador "Valor do Borderô".
const FILTROS_CTE = `
BorderosComTituloFidc AS (
    SELECT DISTINCT BORDERO FROM SIGFIDC WHERE CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
),
GrupoEmpresaUnico AS (
    SELECT
        GE.clifor,
        GE.idgrupo,
        ROW_NUMBER() OVER (PARTITION BY GE.clifor ORDER BY GE.clifor) AS RN
    FROM GrupoEmpresa GE
)
`;

const FILTROS_JOINS = `
LEFT JOIN BorderosComTituloFidc BCT ON BCT.BORDERO = B.BORDERO
LEFT JOIN SIGCAD CAD ON CAD.CODIGO = B.CLIFOR
LEFT JOIN GrupoEmpresaUnico GC ON GC.clifor = B.CLIFOR AND GC.RN = 1
`;

// Comercial — SIGBORS já traz INDICANTE/OPERADOR direto (a tabela-guia
// desta tela É o SIGBORS, então não precisa da SIGBORS_OPERADOR_CTE usada
// em Títulos/Comissões, que existe só pra juntar esse vínculo a partir de
// SIGFIDC). Mesma prioridade INDICANTE > OPERADOR (CLAUDE.md 17/21.9).
const COMERCIAL_EXPR = `
CASE
    WHEN B.INDICANTE IS NOT NULL AND B.INDICANTE <> '' THEN B.INDICANTE
    WHEN B.OPERADOR IS NOT NULL AND B.OPERADOR <> '' THEN B.OPERADOR
    ELSE NULL
END
`;

const FILTROS_WHERE = `
WHERE B.LIBERADO = 'S'
  AND (@bordero = '' OR CAST(B.BORDERO AS VARCHAR) = @bordero)
  AND (@dataLiberacaoInicio IS NULL OR CAST(B.DTLIBERACAO AS DATE) >= @dataLiberacaoInicio)
  AND (@dataLiberacaoFim IS NULL OR CAST(B.DTLIBERACAO AS DATE) <= @dataLiberacaoFim)
  AND (@comercial = '' OR ${COMERCIAL_EXPR} = @comercial)
  AND (@grupoEconomico = '' OR CAST(GC.idgrupo AS VARCHAR) = @grupoEconomico)
  AND (@cedente = '' OR CAST(B.CLIFOR AS VARCHAR) = @cedente)
  AND (@metodo = '' OR CAST(B.CALCULOFIDC AS VARCHAR) = @metodo)
`;

function filtrosParams(filtros: BorderosLiberadosFiltros) {
  const strParam = (name: string, value: string | undefined) => ({
    name,
    type: sql.VarChar(200),
    value: (value ?? "").trim(),
  });
  const dateParam = (name: string, value: string | null | undefined) => ({
    name,
    type: sql.Date,
    value: value ? new Date(value) : null,
  });

  return [
    strParam("bordero", filtros.bordero),
    dateParam("dataLiberacaoInicio", filtros.dataLiberacaoInicio),
    dateParam("dataLiberacaoFim", filtros.dataLiberacaoFim),
    strParam("comercial", filtros.comercial),
    strParam("grupoEconomico", filtros.grupoEconomico),
    strParam("cedente", filtros.cedente),
    strParam("metodo", filtros.metodo),
  ];
}

const TITULOS_FIDC_EXPR = `
CASE
    WHEN B.LIBERADO = 'S' AND BCT.BORDERO IS NOT NULL THEN ISNULL(B.TITULOSFIDC, 0)
    ELSE 0
END
`;

// Cedente — regra colada pelo cliente em 2026-07-16 (script de origem do
// Power BI): "código - nome - CGC", via SIGBORS.CLIFOR -> SIGCAD.CODIGO.
const CEDENTE_EXPR = `CAST(B.CLIFOR AS VARCHAR) + ' - ' + ISNULL(CAD.NOME, '') + ' - ' + ISNULL(CAD.CGC, '')`;

const SORT_EXPRESSIONS: Record<string, string> = {
  bordero: "B.BORDERO",
  dataLiberacao: "CAST(B.DTLIBERACAO AS DATE)",
  titulosFidc: TITULOS_FIDC_EXPR,
  cedente: "CAD.NOME",
  prazoMedio: PRAZO_MEDIO_EXPR,
  metodo: METODO_CASE,
  fator: "B.FATORFIDC",
};

// Borderôs Liberados (novo menu, abaixo de Comportamental — CLAUDE.md
// seção 9) — tabela-guia é SIGBORS filtrada por LIBERADO = 'S' (o próprio
// nome do módulo), não SIGFIDC. Mesmo padrão de paginação/ordenação no
// servidor via ROW_NUMBER() dos demais relatórios (SQL Server 2008 R2, sem
// OFFSET/FETCH — CLAUDE.md 16). 7 colunas + 6 filtros confirmados pelo
// cliente (Borderô, Data de Liberação, Comercial, Grupo Econômico, Cedente,
// Método) — diferente de Títulos/Carteira/Comissões, os filtros aqui abrem
// num painel retrátil embutido na própria tela, não numa popup separada.
function buildQuery(sortKey: string, sortDir: SortDirection) {
  const expr = SORT_EXPRESSIONS[sortKey] ?? SORT_EXPRESSIONS[DEFAULT_SORT_KEY];
  const dir = sortDir === "asc" ? "ASC" : "DESC";

  return `
;WITH ${FILTROS_CTE},
Numerado AS (
    SELECT
        B.ID AS id,
        B.BORDERO AS bordero,
        CAST(B.DTLIBERACAO AS DATE) AS dataLiberacao,
        ${TITULOS_FIDC_EXPR} AS titulosFidc,
        ${CEDENTE_EXPR} AS cedente,
        ${PRAZO_MEDIO_EXPR} AS prazoMedio,
        ${METODO_CASE} AS metodo,
        B.FATORFIDC AS fator,
        ROW_NUMBER() OVER (ORDER BY ${expr} ${dir}, B.ID DESC) AS rn
    FROM SIGBORS B
    ${FILTROS_JOINS}
    ${FILTROS_WHERE}
)
SELECT id, bordero, dataLiberacao, titulosFidc, cedente, prazoMedio, metodo, fator
FROM Numerado
WHERE rn BETWEEN @rnStart AND @rnEnd
ORDER BY rn
`;
}

function buildCountQuery() {
  return `
;WITH ${FILTROS_CTE}
SELECT COUNT(*) AS total
FROM SIGBORS B
${FILTROS_JOINS}
${FILTROS_WHERE}
`;
}

// Único totalizador da tela — "Valor Total do Borderô" = soma de Valor do
// Borderô sobre TODO o universo filtrado (não só a página carregada),
// confirmado pelo cliente em 2026-07-16.
function buildTotaisQuery() {
  return `
;WITH ${FILTROS_CTE}
SELECT ISNULL(SUM(${TITULOS_FIDC_EXPR}), 0) AS valorBordero
FROM SIGBORS B
${FILTROS_JOINS}
${FILTROS_WHERE}
`;
}

export interface BorderosLiberadosTotais {
  valorBordero: number;
}

export interface BorderosLiberadosPage {
  rows: BorderoLiberado[];
  total: number;
  page: number;
  pageSize: number;
  totais: BorderosLiberadosTotais;
}

export async function getBorderosLiberados(
  page: number,
  pageSize: number,
  sortKey: string = DEFAULT_SORT_KEY,
  sortDir: SortDirection = "desc",
  filtros: Scoped<BorderosLiberadosFiltros>,
  forceRefresh = false,
): Promise<BorderosLiberadosPage> {
  const safePageSize = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
  const safePage = Math.max(page, 1);

  return withCache(
    `borderos-liberados:${safePage}:${safePageSize}:${sortKey}:${sortDir}:${JSON.stringify(filtros)}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rnStart = (safePage - 1) * safePageSize + 1;
      const rnEnd = safePage * safePageSize;
      const fParams = filtrosParams(filtros);

      const [rows, countRows, totaisRows] = await Promise.all([
        executeReadQuery<BorderoLiberado>(buildQuery(sortKey, sortDir), [
          { name: "rnStart", type: sql.Int, value: rnStart },
          { name: "rnEnd", type: sql.Int, value: rnEnd },
          ...fParams,
        ]),
        executeReadQuery<{ total: number }>(buildCountQuery(), fParams),
        executeReadQuery<BorderosLiberadosTotais>(buildTotaisQuery(), fParams),
      ]);

      return {
        rows,
        total: countRows[0]?.total ?? 0,
        page: safePage,
        pageSize: safePageSize,
        totais: totaisRows[0] ?? { valorBordero: 0 },
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
    B.ID AS id,
    B.BORDERO AS bordero,
    CAST(B.DTLIBERACAO AS DATE) AS dataLiberacao,
    ${TITULOS_FIDC_EXPR} AS titulosFidc,
    ${CEDENTE_EXPR} AS cedente,
    ${PRAZO_MEDIO_EXPR} AS prazoMedio,
    ${METODO_CASE} AS metodo,
    B.FATORFIDC AS fator
FROM SIGBORS B
${FILTROS_JOINS}
${FILTROS_WHERE}
ORDER BY ${expr} ${dir}, B.ID DESC
`;
}

export async function getBorderosLiberadosParaExportacao(
  sortKey: string = DEFAULT_SORT_KEY,
  sortDir: SortDirection = "desc",
  filtros: Scoped<BorderosLiberadosFiltros>,
): Promise<BorderoLiberado[]> {
  return executeReadQuery<BorderoLiberado>(
    buildExportQuery(sortKey, sortDir),
    [{ name: "maxRows", type: sql.Int, value: EXPORT_MAX_ROWS }, ...filtrosParams(filtros)],
    { timeoutMs: EXPORT_TIMEOUT_MS },
  );
}
