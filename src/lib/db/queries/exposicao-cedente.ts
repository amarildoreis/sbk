import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import { SIGFIDC_CODIGOS_FIDC, STATUS_PAGTO_CASE, VENCIMENTO_EFETIVO } from "./sigfidc-shared";

export interface TituloExposicaoCedente {
  id: number;
  titulo: string;
  valor: number;
  sacado: string | null;
  cedente: string | null;
  vencimento: string | null;
  vencimentoTranche: string | null;
  dataBordero: string | null;
}

// Toggle "A Vencer" / "Vencidos" — mesmo componente visual do slicer
// "Visão" de Carteira de Clientes (CLAUDE.md 19.8/21.2), mas aqui só 2
// opções (não Todos/Com Risco/Sem Risco). Grão da tabela é o título, não o
// cedente, então o toggle simplesmente filtra STATUS_PAGTO — não precisa da
// lógica de CedentesComRisco/SemRisco da medida DAX `a_vencer` original (o
// cliente pediu explicitamente pra desconsiderar essa parte da Visão).
export type ExposicaoCedenteVisao = "avencer" | "vencido";

const STATUS_POR_VISAO: Record<ExposicaoCedenteVisao, string> = {
  avencer: "A Vencer",
  vencido: "Vencido",
};

function parseVisao(value: string | null): ExposicaoCedenteVisao {
  return value === "vencido" ? "vencido" : "avencer";
}

// 3 filtros confirmados pelo cliente em 2026-07-16 — Comercial (via
// SIGBORS.INDICANTE/OPERADOR por borderô, mesma prioridade de
// SIGBORS_OPERADOR_CTE), Grupo Econômico (GrupoEmpresa pelo lado cedente,
// deduplicado por CLIFOR) e Cedente. Mesmo padrão de painel retrátil das
// demais telas.
export interface ExposicaoCedenteFiltros {
  visao?: ExposicaoCedenteVisao;
  comercial?: string;
  grupoEconomico?: string;
  cedente?: string;
}

export function parseFiltrosFromSearchParams(
  searchParams: URLSearchParams,
): ExposicaoCedenteFiltros {
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

// Colunas confirmadas pelo cliente em 2026-07-16: Título (DCTO), Valor
// (medida DAX a_vencer, sem a parte de Visão/CedentesComRisco — no grão do
// título isso equivale ao próprio VALOR_ da linha, já que a linha só entra
// no resultado quando o STATUS_PAGTO bate com o toggle selecionado), Sacado
// e Cedente (código - nome - CGC, mesmo padrão de carteira-sacados.ts),
// Vencimento (CAST(DATA AS DATE), CLAUDE.md 19.1), Vencimento Tranche
// (DataFuturaTranche) e Data do Borderô (SIGBORS.DATA via SIGFIDC.BORDERO —
// SIGFIDC não tem essa coluna fisicamente, mesma observação já registrada em
// comportamental-operacoes.ts/carteira-clientes.ts).
//
// CORREÇÃO (2026-07-16): DataFuturaTranche = DATEADD(DAY,
// ISNULL(CADCRED.PrazoLimiteConfirmacaoDeTitulos, 0), CAST(SIGBORS.DATA AS
// DATE)) via SIGFIDC.BORDERO — confirmado pelo script SQL de origem colado
// pelo cliente (validação com o cedente 249/UZUCLEAN, que mostrava
// Vencimento Tranche sempre vazio). A fórmula usada até então (SIGFLS.DTBORDERO
// em vez de SIGBORS.DATA, copiada de comportamental-tranche.ts/CLAUDE.md 19.5)
// estava ERRADA: SIGFLS.DTBORDERO fica nulo com frequência (título sem
// SIGFLS/CTRL_ID casando), enquanto praticamente todo título tem um BORDERO
// válido — daí o campo aparecer vazio na maioria das linhas. `comportamental-
// tranche.ts` (grupo Tranche do Comportamental) usa a MESMA fórmula errada e
// provavelmente também precisa dessa correção — ver nota em CLAUDE.md 19.5.
//
// GrupoEmpresaUnico dedup por CLIFOR (ROW_NUMBER) — mesmo padrão de
// relatorio-titulos.ts/carteira-sacados.ts, evita duplicar título quando o
// cedente aparece mais de uma vez em GrupoEmpresa.
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
LEFT JOIN SIGBORS B ON B.BORDERO = F.BORDERO
LEFT JOIN GrupoEmpresaUnico GEU ON GEU.clifor = F.CLIFOR AND GEU.RN = 1
`;

// Comercial por borderô — mesma prioridade INDICANTE > OPERADOR de
// SIGBORS_OPERADOR_CTE (CLAUDE.md 21.9), calculada inline porque SIGBORS já
// está no JOIN como `B` (usado também pra Data do Borderô).
const COMERCIAL_EXPR = `
CASE
    WHEN B.INDICANTE IS NOT NULL AND B.INDICANTE <> '' THEN B.INDICANTE
    WHEN B.OPERADOR IS NOT NULL AND B.OPERADOR <> '' THEN B.OPERADOR
    ELSE NULL
END
`;

const WHERE = `
WHERE F.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
  AND ${STATUS_PAGTO_CASE} = @statusPagto
  AND (@comercial = '' OR ${COMERCIAL_EXPR} = @comercial)
  AND (@grupoEconomico = '' OR CAST(GEU.idgrupo AS VARCHAR) = @grupoEconomico)
  AND (@cedente = '' OR CAST(F.CLIFOR AS VARCHAR) = @cedente)
`;

const SACADO_EXPR = `CAST(F.SACADO AS VARCHAR) + ' - ' + ISNULL(SAC.NOME, '') + ' - ' + ISNULL(SAC.CGC, '')`;
const CEDENTE_EXPR = `CAST(F.CLIFOR AS VARCHAR) + ' - ' + ISNULL(CED.NOME, '') + ' - ' + ISNULL(CED.CGC, '')`;
const VENCIMENTO_TRANCHE_EXPR = `DATEADD(DAY, ISNULL(CADCRED.PrazoLimiteConfirmacaoDeTitulos, 0), CAST(B.DATA AS DATE))`;

function filtrosParams(filtros: ExposicaoCedenteFiltros) {
  const visao = filtros.visao ?? "avencer";
  const strParam = (name: string, value: string | undefined) => ({
    name,
    type: sql.VarChar(200),
    value: (value ?? "").trim(),
  });

  return [
    { name: "statusPagto", type: sql.VarChar(20), value: STATUS_POR_VISAO[visao] },
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
// padrão de "Valor Total dos Borderôs"/"Valor Total do Risco Sacado".
function buildTotaisQuery() {
  return `
;WITH ${FILTROS_CTE}
SELECT ISNULL(SUM(ISNULL(F.VALOR_, 0)), 0) AS valor
${JOINS}
${WHERE}
`;
}

export interface ExposicaoCedenteTotais {
  valor: number;
}

export interface ExposicaoCedentePage {
  rows: TituloExposicaoCedente[];
  total: number;
  page: number;
  pageSize: number;
  totais: ExposicaoCedenteTotais;
}

export async function getExposicaoCedente(
  page: number,
  pageSize: number,
  sortKey: string = DEFAULT_SORT_KEY,
  sortDir: SortDirection = "asc",
  filtros: Scoped<ExposicaoCedenteFiltros>,
  forceRefresh = false,
): Promise<ExposicaoCedentePage> {
  const safePageSize = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
  const safePage = Math.max(page, 1);

  return withCache(
    `exposicao-cedente:${safePage}:${safePageSize}:${sortKey}:${sortDir}:${JSON.stringify(filtros)}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rnStart = (safePage - 1) * safePageSize + 1;
      const rnEnd = safePage * safePageSize;
      const fParams = filtrosParams(filtros);

      const [rows, countRows, totaisRows] = await Promise.all([
        executeReadQuery<TituloExposicaoCedente>(buildQuery(sortKey, sortDir), [
          { name: "rnStart", type: sql.Int, value: rnStart },
          { name: "rnEnd", type: sql.Int, value: rnEnd },
          ...fParams,
        ]),
        executeReadQuery<{ total: number }>(buildCountQuery(), fParams),
        executeReadQuery<ExposicaoCedenteTotais>(buildTotaisQuery(), fParams),
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

export async function getExposicaoCedenteParaExportacao(
  sortKey: string = DEFAULT_SORT_KEY,
  sortDir: SortDirection = "asc",
  filtros: Scoped<ExposicaoCedenteFiltros>,
): Promise<TituloExposicaoCedente[]> {
  return executeReadQuery<TituloExposicaoCedente>(
    buildExportQuery(sortKey, sortDir),
    [{ name: "maxRows", type: sql.Int, value: EXPORT_MAX_ROWS }, ...filtrosParams(filtros)],
    { timeoutMs: EXPORT_TIMEOUT_MS },
  );
}
