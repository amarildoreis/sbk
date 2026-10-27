import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import { SIGFIDC_CODIGOS_FIDC, STATUS_PAGTO_CASE, VENCIMENTO_EFETIVO } from "./sigfidc-shared";

export interface TituloTranche {
  id: number;
  titulo: string;
  valor: number;
  sacado: string | null;
  cedente: string | null;
  vencimento: string | null;
  vencimentoTranche: string | null;
  dataBordero: string | null;
}

// Toggle "Tomada" / "A Vencer" / "Vencida" — diferente do toggle "A
// Vencer"/"Vencidos" de Exposição Cedente, aqui são 3 opções que espelham as
// 3 medidas DAX coladas pelo cliente em 2026-07-16 (tranche_tomada,
// tranche_a_vencer, tranche_vencida). Grão da tabela é o título; o toggle
// simplesmente restringe o universo — não precisa da lógica de
// CedentesComRisco/SemRisco da medida `tranche_tomada` original (o cliente
// pediu explicitamente pra desconsiderar essa parte da Visão, mesma decisão
// já tomada em Exposição Cedente).
export type TrancheVisao = "tomada" | "avencer" | "vencida";

// "Tomada" = universo base (STATUS_PAGTO 'A Vencer' + SITUACAO 'A
// Confirmar', sem filtro de StatusTranche). "A Vencer"/"Vencida" restringem
// esse mesmo universo pelo StatusTranche (CLAUDE.md 19.5).
const STATUS_TRANCHE_POR_VISAO: Record<TrancheVisao, string> = {
  tomada: "",
  avencer: "A Vencer",
  vencida: "Vencido",
};

function parseVisao(value: string | null): TrancheVisao {
  return value === "avencer" || value === "vencida" ? value : "tomada";
}

// 3 filtros confirmados pelo cliente — mesmo padrão de Exposição Cedente:
// Comercial (via SIGBORS.INDICANTE/OPERADOR por borderô), Grupo Econômico
// (GrupoEmpresa pelo lado cedente, deduplicado por CLIFOR) e Cedente.
export interface TrancheFiltros {
  visao?: TrancheVisao;
  comercial?: string;
  grupoEconomico?: string;
  cedente?: string;
}

export function parseFiltrosFromSearchParams(searchParams: URLSearchParams): TrancheFiltros {
  return {
    visao: parseVisao(searchParams.get("visao")),
    comercial: searchParams.get("comercial") ?? "",
    grupoEconomico: searchParams.get("grupoEconomico") ?? "",
    cedente: searchParams.get("cedente") ?? "",
  };
}

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_SORT_KEY = "vencimento";

export type SortDirection = "asc" | "desc";

// Colunas confirmadas pelo cliente em 2026-07-16 (mesmas 7 de Exposição
// Cedente): Título (DCTO), Valor (medidas DAX tranche_tomada/tranche_a_vencer/
// tranche_vencida, sem a parte de Visão/CedentesComRisco — no grão do título
// isso equivale ao próprio VALOR_ da linha, já que a linha só entra no
// resultado quando bate com o toggle selecionado), Sacado e Cedente (código -
// nome - CGC), Vencimento do Título (CAST(DATA AS DATE), CLAUDE.md 19.1),
// Vencimento da Tranche (DataFuturaTranche — fórmula corrigida em
// 2026-07-16, ver CLAUDE.md 19.5: DATEADD(DAY, ISNULL(CADCRED.PrazoLimite
// ConfirmacaoDeTitulos, 0), CAST(SIGBORS.DATA AS DATE))) e Data do Borderô
// (SIGBORS.DATA via SIGFIDC.BORDERO).
//
// SITUACAO = ESTADOCONFIRMACAOTITULO.DESCRICAO via SIGFLS.ESTADOCONFIRMACAO
// TITULO_ID (mesmo mapeamento de carteira-clientes.ts/comportamental-tranche.ts,
// CLAUDE.md 19.8) — universo desta tela é sempre restrito a SITUACAO = 'A
// Confirmar' (parte fixa das 3 medidas DAX, não um filtro de tela).
const FILTROS_CTE = `
GrupoEmpresaUnico AS (
    SELECT clifor, idgrupo, ROW_NUMBER() OVER (PARTITION BY clifor ORDER BY clifor) AS RN
    FROM GrupoEmpresa
)
`;

const JOINS = `
FROM SIGFIDC F
LEFT JOIN SIGCAD SAC ON SAC.CODIGO = F.SACADO
LEFT JOIN SIGCAD CED ON CED.CODIGO = F.CLIFOR
LEFT JOIN CADCRED ON CADCRED.clifor = F.CLIFOR
LEFT JOIN SIGFLS fl ON fl.ctrl_id = F.SIGFLS
LEFT JOIN ESTADOCONFIRMACAOTITULO ECT ON ECT.CTRL_ID = fl.ESTADOCONFIRMACAOTITULO_ID
LEFT JOIN SIGBORS B ON B.BORDERO = F.BORDERO
LEFT JOIN GrupoEmpresaUnico GEU ON GEU.clifor = F.CLIFOR AND GEU.RN = 1
`;

// Comercial por borderô — mesma prioridade INDICANTE > OPERADOR de
// SIGBORS_OPERADOR_CTE (CLAUDE.md 21.9), calculada inline porque SIGBORS já
// está no JOIN como `B`.
const COMERCIAL_EXPR = `
CASE
    WHEN B.INDICANTE IS NOT NULL AND B.INDICANTE <> '' THEN B.INDICANTE
    WHEN B.OPERADOR IS NOT NULL AND B.OPERADOR <> '' THEN B.OPERADOR
    ELSE NULL
END
`;

const VENCIMENTO_TRANCHE_EXPR = `DATEADD(DAY, ISNULL(CADCRED.PrazoLimiteConfirmacaoDeTitulos, 0), CAST(B.DATA AS DATE))`;

const STATUS_TRANCHE_EXPR = `
CASE
    WHEN ${VENCIMENTO_TRANCHE_EXPR} >= CAST(GETDATE() AS DATE) THEN 'A Vencer'
    ELSE 'Vencido'
END
`;

const WHERE = `
WHERE F.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
  AND ${STATUS_PAGTO_CASE} = 'A Vencer'
  AND ECT.DESCRICAO = 'A Confirmar'
  AND (@statusTranche = '' OR ${STATUS_TRANCHE_EXPR} = @statusTranche)
  AND (@comercial = '' OR ${COMERCIAL_EXPR} = @comercial)
  AND (@grupoEconomico = '' OR CAST(GEU.idgrupo AS VARCHAR) = @grupoEconomico)
  AND (@cedente = '' OR CAST(F.CLIFOR AS VARCHAR) = @cedente)
`;

const SACADO_EXPR = `CAST(F.SACADO AS VARCHAR) + ' - ' + ISNULL(SAC.NOME, '') + ' - ' + ISNULL(SAC.CGC, '')`;
const CEDENTE_EXPR = `CAST(F.CLIFOR AS VARCHAR) + ' - ' + ISNULL(CED.NOME, '') + ' - ' + ISNULL(CED.CGC, '')`;

function filtrosParams(filtros: TrancheFiltros) {
  const visao = filtros.visao ?? "tomada";
  const strParam = (name: string, value: string | undefined) => ({
    name,
    type: sql.VarChar(200),
    value: (value ?? "").trim(),
  });

  return [
    { name: "statusTranche", type: sql.VarChar(20), value: STATUS_TRANCHE_POR_VISAO[visao] },
    strParam("comercial", filtros.comercial),
    strParam("grupoEconomico", filtros.grupoEconomico),
    strParam("cedente", filtros.cedente),
  ];
}

const SORT_EXPRESSIONS: Record<string, string> = {
  titulo: "F.DCTO",
  valor: "ISNULL(F.VALOR_, 0)",
  sacado: "SAC.NOME",
  cedente: "CED.NOME",
  vencimento: VENCIMENTO_EFETIVO,
  vencimentoTranche: VENCIMENTO_TRANCHE_EXPR,
  dataBordero: "B.DATA",
};

// Paginação via ROW_NUMBER() (SQL Server 2008 R2, sem OFFSET/FETCH —
// CLAUDE.md 16), mesmo padrão dos demais relatórios.
function buildQuery(sortKey: string, sortDir: SortDirection) {
  const expr = SORT_EXPRESSIONS[sortKey] ?? SORT_EXPRESSIONS[DEFAULT_SORT_KEY];
  const dir = sortDir === "asc" ? "ASC" : "DESC";

  return `
;WITH ${FILTROS_CTE},
Numerado AS (
    SELECT
        F.ID AS id,
        F.DCTO AS titulo,
        ISNULL(F.VALOR_, 0) AS valor,
        ${SACADO_EXPR} AS sacado,
        ${CEDENTE_EXPR} AS cedente,
        ${VENCIMENTO_EFETIVO} AS vencimento,
        ${VENCIMENTO_TRANCHE_EXPR} AS vencimentoTranche,
        B.DATA AS dataBordero,
        ROW_NUMBER() OVER (ORDER BY ${expr} ${dir}, F.ID DESC) AS rn
    ${JOINS}
    ${WHERE}
)
SELECT id, titulo, valor, sacado, cedente, vencimento, vencimentoTranche, dataBordero
FROM Numerado
WHERE rn BETWEEN @rnStart AND @rnEnd
ORDER BY rn
`;
}

function buildCountQuery() {
  return `
;WITH ${FILTROS_CTE}
SELECT COUNT(*) AS total
${JOINS}
${WHERE}
`;
}

// Único totalizador da tela — "Valor Total dos Títulos" = soma da coluna
// Valor sobre TODO o universo filtrado (não só a página carregada), mesmo
// padrão de Exposição Cedente/Borderôs Liberados/Carteira de Sacados.
function buildTotaisQuery() {
  return `
;WITH ${FILTROS_CTE}
SELECT ISNULL(SUM(ISNULL(F.VALOR_, 0)), 0) AS valor
${JOINS}
${WHERE}
`;
}

export interface TrancheTotais {
  valor: number;
}

export interface TranchePage {
  rows: TituloTranche[];
  total: number;
  page: number;
  pageSize: number;
  totais: TrancheTotais;
}

export async function getTrancheTitulos(
  page: number,
  pageSize: number,
  sortKey: string = DEFAULT_SORT_KEY,
  sortDir: SortDirection = "asc",
  filtros: Scoped<TrancheFiltros>,
  forceRefresh = false,
): Promise<TranchePage> {
  const safePageSize = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
  const safePage = Math.max(page, 1);

  return withCache(
    `tranche:${safePage}:${safePageSize}:${sortKey}:${sortDir}:${JSON.stringify(filtros)}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rnStart = (safePage - 1) * safePageSize + 1;
      const rnEnd = safePage * safePageSize;
      const fParams = filtrosParams(filtros);

      const [rows, countRows, totaisRows] = await Promise.all([
        executeReadQuery<TituloTranche>(buildQuery(sortKey, sortDir), [
          { name: "rnStart", type: sql.Int, value: rnStart },
          { name: "rnEnd", type: sql.Int, value: rnEnd },
          ...fParams,
        ]),
        executeReadQuery<{ total: number }>(buildCountQuery(), fParams),
        executeReadQuery<TrancheTotais>(buildTotaisQuery(), fParams),
      ]);

      return {
        rows,
        total: countRows[0]?.total ?? 0,
        page: safePage,
        pageSize: safePageSize,
        totais: totaisRows[0] ?? { valor: 0 },
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
    F.ID AS id,
    F.DCTO AS titulo,
    ISNULL(F.VALOR_, 0) AS valor,
    ${SACADO_EXPR} AS sacado,
    ${CEDENTE_EXPR} AS cedente,
    ${VENCIMENTO_EFETIVO} AS vencimento,
    ${VENCIMENTO_TRANCHE_EXPR} AS vencimentoTranche,
    B.DATA AS dataBordero
${JOINS}
${WHERE}
ORDER BY ${expr} ${dir}, F.ID DESC
`;
}

export async function getTrancheParaExportacao(
  sortKey: string = DEFAULT_SORT_KEY,
  sortDir: SortDirection = "asc",
  filtros: Scoped<TrancheFiltros>,
): Promise<TituloTranche[]> {
  return executeReadQuery<TituloTranche>(
    buildExportQuery(sortKey, sortDir),
    [{ name: "maxRows", type: sql.Int, value: EXPORT_MAX_ROWS }, ...filtrosParams(filtros)],
    { timeoutMs: EXPORT_TIMEOUT_MS },
  );
}
