import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import { STATUS_PAGTO_CASE, SIGFIDC_CODIGOS_FIDC } from "./sigfidc-shared";

export interface ClienteCarteira {
  codigo: string;
  cedente: string | null;
  comercial: string | null;
  situacao: string | null;
  limiteCredito: number;
  risco: number;
  participacao: number;
  limiteDisponivel: number;
  vencido: number;
  aVencer: number;
  ultimaData: string | null;
  tranche: number;
  taxa: number | null;
  metodo: string | null;
}

export interface CarteiraClientesFiltros {
  comercial?: string;
  grupoEconomico?: string;
  cedente?: string;
  /** "todos" | "com-risco" | "sem-risco" — slicer "Visão" do Power BI (CLAUDE.md 21.2) */
  visao?: string;
}

// Lê os filtros de um URLSearchParams — usado igual nos dois endpoints
// (listagem e exportação), mesmo padrão de relatorio-titulos.ts.
export function parseFiltrosFromSearchParams(
  searchParams: URLSearchParams,
): CarteiraClientesFiltros {
  return {
    comercial: searchParams.get("comercial") ?? "",
    grupoEconomico: searchParams.get("grupoEconomico") ?? "",
    cedente: searchParams.get("cedente") ?? "",
    visao: searchParams.get("visao") ?? "",
  };
}

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

// Bloqueio e Método são tabelas ESTÁTICAS do Power BI (CLAUDE.md seção 18)
// — não existem no SQL Server (confirmado via INFORMATION_SCHEMA em
// 2026-07-14). Mapeamento colado pelo cliente a partir do Power BI.
const SITUACAO_CASE = `
CASE SIGCAD.BLOQUEIO
    WHEN 0 THEN 'Liberado'
    WHEN 1 THEN 'Liberado'
    WHEN 2 THEN 'Em Alerta'
    WHEN 3 THEN 'Bloqueado'
    ELSE NULL
END
`;

const METODO_CASE = `
CASE CADCRED.METODOCALCULOFIDC
    WHEN 1 THEN 'Efetivo'
    WHEN 2 THEN 'Nominal'
    WHEN 3 THEN 'Misto'
    WHEN 4 THEN 'Efetivo VA'
    WHEN 7 THEN 'Padrão'
    ELSE NULL
END
`;

// CTEs reutilizadas pela listagem, contagem e totalizadores — sempre a
// mesma estrutura, só o WHERE (FILTROS_WHERE) muda.
//
// RiscoPorClifor: um agregado por CLIFOR (risco/a_vencer/vencido/tranche —
// medidas DAX limite_credito/risco/a_vencer/vencido/tranche_tomada,
// traduzidas igual aos cards da Visão Geral). tranche_tomada = A Vencer +
// SITUACAO (ESTADOCONFIRMACAOTITULO) = 'A Confirmar', DAX colado pelo
// cliente em 2026-07-14.
//
// UltimaDataPorClifor: ultima_data = MAX(SIGFIDC[DATA_BORDERO]) — essa
// coluna não existe fisicamente em SIGFIDC (era um merge do Power Query com
// SIGBORS.DATA por BORDERO); aqui é direto MAX(SIGBORS.DATA) agrupado pelo
// CLIFOR dos títulos daquele cedente.
const CARTEIRA_CTE = `
RiscoPorClifor AS (
    SELECT
        f.CLIFOR,
        SUM(CASE WHEN ${STATUS_PAGTO_CASE} NOT IN ('Pago Em Dia', 'Pago Vencido') THEN f.VALOR_ ELSE 0 END) AS risco,
        SUM(CASE WHEN ${STATUS_PAGTO_CASE} = 'A Vencer' THEN f.VALOR_ ELSE 0 END) AS aVencer,
        SUM(CASE WHEN ${STATUS_PAGTO_CASE} = 'Vencido' THEN f.VALOR_ ELSE 0 END) AS vencido,
        SUM(CASE WHEN ${STATUS_PAGTO_CASE} = 'A Vencer' AND ECT.DESCRICAO = 'A Confirmar' THEN f.VALOR_ ELSE 0 END) AS tranche
    FROM SIGFIDC f
    LEFT JOIN SIGFLS SF ON SF.ctrl_id = f.SIGFLS
    LEFT JOIN ESTADOCONFIRMACAOTITULO ECT ON ECT.CTRL_ID = SF.ESTADOCONFIRMACAOTITULO_ID
    WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
    GROUP BY f.CLIFOR
),
UltimaDataPorClifor AS (
    SELECT f.CLIFOR, MAX(SB.DATA) AS ultimaData
    FROM SIGFIDC f
    INNER JOIN SIGBORS SB ON SB.BORDERO = f.BORDERO
    WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
    GROUP BY f.CLIFOR
),
CedentesComRisco AS (
    SELECT CLIFOR FROM RiscoPorClifor WHERE risco > 0
),
TotalRiscoGeral AS (
    SELECT ISNULL(SUM(risco), 0) AS total FROM RiscoPorClifor
),
-- Universo = CADCRED ∪ quem tem título em SIGFIDC. CADCRED sozinho perderia
-- cedentes com título real mas sem registro de crédito configurado (achado
-- em 2026-07-14: 2 CLIFOR, R$ 2,17 milhões de risco, confirmado com o
-- cliente que devem aparecer — mesma lógica de "nunca colapsar CADCRED e
-- SIGFIDC sem UNION cuidadoso" do CLAUDE.md 21.1, agora aplicada também na
-- direção oposta: SIGFIDC sem CADCRED).
Universo AS (
    SELECT clifor FROM CADCRED
    UNION
    SELECT CLIFOR FROM RiscoPorClifor
),
-- Grupo Econômico — mesmo padrão do filtro de Títulos (GrupoEmpresa +
-- cadGrupoEmpresarial, deduplicado por CLIFOR com ROW_NUMBER).
GrupoEmpresaUnico AS (
    SELECT
        GE.clifor,
        GE.idgrupo,
        CG.NOME,
        ROW_NUMBER() OVER (PARTITION BY GE.clifor ORDER BY GE.clifor) AS RN
    FROM GrupoEmpresa GE
    LEFT JOIN cadGrupoEmpresarial CG ON CG.ID = GE.idgrupo
)
`;

const CARTEIRA_JOINS = `
FROM Universo
LEFT JOIN CADCRED ON CADCRED.clifor = Universo.clifor
LEFT JOIN SIGCAD ON SIGCAD.CODIGO = Universo.clifor
LEFT JOIN SIGVEN ON SIGVEN.CODIGO = CADCRED.gerenteconta
LEFT JOIN RiscoPorClifor ON RiscoPorClifor.CLIFOR = Universo.clifor
LEFT JOIN UltimaDataPorClifor ON UltimaDataPorClifor.CLIFOR = Universo.clifor
LEFT JOIN GrupoEmpresaUnico ON GrupoEmpresaUnico.clifor = Universo.clifor AND GrupoEmpresaUnico.RN = 1
CROSS JOIN TotalRiscoGeral
`;

// apoio_cliente_risco (CLAUDE.md-style coluna de apoio do próprio cliente):
// soma das 6 medidas: se tudo for 0, a linha não representa nenhuma posição
// real (nem limite configurado, nem título algum) e é ocultada — mesma
// lógica usada no Power BI pra não poluir a tabela.
const APOIO_EXPR = `
(ISNULL(CADCRED.ConsLimCedFIDC, 0)
  + ISNULL(RiscoPorClifor.risco, 0)
  + (ISNULL(CADCRED.ConsLimCedFIDC, 0) - ISNULL(RiscoPorClifor.risco, 0))
  + ISNULL(RiscoPorClifor.aVencer, 0)
  + ISNULL(RiscoPorClifor.vencido, 0)
  + ISNULL(RiscoPorClifor.tranche, 0))
`;

function visaoClause(visao: string | undefined): string {
  if (visao === "com-risco") {
    return "AND Universo.clifor IN (SELECT CLIFOR FROM CedentesComRisco)";
  }
  if (visao === "sem-risco") {
    return "AND Universo.clifor NOT IN (SELECT CLIFOR FROM CedentesComRisco)";
  }
  return "";
}

const FILTROS_WHERE = `
WHERE (@comercial = '' OR CADCRED.gerenteconta = @comercial)
  AND (@grupoEconomico = '' OR CAST(GrupoEmpresaUnico.idgrupo AS VARCHAR) = @grupoEconomico)
  AND (@cedente = '' OR CAST(Universo.clifor AS VARCHAR) = @cedente)
  AND ${APOIO_EXPR} <> 0
`;

function filtrosParams(filtros: CarteiraClientesFiltros) {
  return [
    { name: "comercial", type: sql.VarChar(20), value: (filtros.comercial ?? "").trim() },
    { name: "grupoEconomico", type: sql.VarChar(20), value: (filtros.grupoEconomico ?? "").trim() },
    { name: "cedente", type: sql.VarChar(20), value: (filtros.cedente ?? "").trim() },
  ];
}

const SORT_EXPRESSIONS: Record<string, string> = {
  codigo: "Universo.clifor",
  cedente: "SIGCAD.NOME",
  comercial: "SIGVEN.NOME",
  situacao: SITUACAO_CASE,
  limiteCredito: "ISNULL(CADCRED.ConsLimCedFIDC, 0)",
  risco: "ISNULL(RiscoPorClifor.risco, 0)",
  participacao: "ISNULL(RiscoPorClifor.risco, 0)",
  limiteDisponivel: "(ISNULL(CADCRED.ConsLimCedFIDC, 0) - ISNULL(RiscoPorClifor.risco, 0))",
  vencido: "ISNULL(RiscoPorClifor.vencido, 0)",
  aVencer: "ISNULL(RiscoPorClifor.aVencer, 0)",
  ultimaData: "UltimaDataPorClifor.ultimaData",
  tranche: "ISNULL(RiscoPorClifor.tranche, 0)",
  taxa: "ISNULL(SIGCAD.fatorfidc, 0)",
  metodo: METODO_CASE,
};

const DEFAULT_SORT_KEY = "risco";

export type SortDirection = "asc" | "desc";

function buildQuery(sortKey: string, sortDir: SortDirection, visao: string | undefined) {
  const expr = SORT_EXPRESSIONS[sortKey] ?? SORT_EXPRESSIONS[DEFAULT_SORT_KEY];
  const dir = sortDir === "asc" ? "ASC" : "DESC";

  return `
;WITH ${CARTEIRA_CTE},
Numerado AS (
    SELECT
        CAST(Universo.clifor AS VARCHAR) AS codigo,
        SIGCAD.NOME AS cedente,
        CASE WHEN SIGVEN.CODIGO IS NULL THEN NULL ELSE CAST(SIGVEN.CODIGO AS VARCHAR) + ' - ' + SIGVEN.NOME END AS comercial,
        ${SITUACAO_CASE} AS situacao,
        ISNULL(CADCRED.ConsLimCedFIDC, 0) AS limiteCredito,
        ISNULL(RiscoPorClifor.risco, 0) AS risco,
        CASE WHEN TotalRiscoGeral.total = 0 THEN 0
             ELSE ISNULL(RiscoPorClifor.risco, 0) * 100.0 / TotalRiscoGeral.total
        END AS participacao,
        (ISNULL(CADCRED.ConsLimCedFIDC, 0) - ISNULL(RiscoPorClifor.risco, 0)) AS limiteDisponivel,
        ISNULL(RiscoPorClifor.vencido, 0) AS vencido,
        ISNULL(RiscoPorClifor.aVencer, 0) AS aVencer,
        UltimaDataPorClifor.ultimaData AS ultimaData,
        ISNULL(RiscoPorClifor.tranche, 0) AS tranche,
        SIGCAD.fatorfidc / 100.0 AS taxa,
        ${METODO_CASE} AS metodo,
        ROW_NUMBER() OVER (ORDER BY ${expr} ${dir}, Universo.clifor DESC) AS rn
    ${CARTEIRA_JOINS}
    ${FILTROS_WHERE}
      ${visaoClause(visao)}
)
SELECT codigo, cedente, comercial, situacao, limiteCredito, risco, participacao,
       limiteDisponivel, vencido, aVencer, ultimaData, tranche, taxa, metodo
FROM Numerado
WHERE rn BETWEEN @rnStart AND @rnEnd
ORDER BY rn
`;
}

function buildCountQuery(visao: string | undefined) {
  return `
;WITH ${CARTEIRA_CTE}
SELECT COUNT(*) AS total
${CARTEIRA_JOINS}
${FILTROS_WHERE}
  ${visaoClause(visao)}
`;
}

export interface CarteiraClientesTotais {
  limiteCredito: number;
  risco: number;
  limiteDisponivel: number;
  vencido: number;
  aVencer: number;
  tranche: number;
}

function buildTotaisQuery(visao: string | undefined) {
  return `
;WITH ${CARTEIRA_CTE}
SELECT
    ISNULL(SUM(ISNULL(CADCRED.ConsLimCedFIDC, 0)), 0) AS limiteCredito,
    ISNULL(SUM(ISNULL(RiscoPorClifor.risco, 0)), 0) AS risco,
    ISNULL(SUM(ISNULL(CADCRED.ConsLimCedFIDC, 0) - ISNULL(RiscoPorClifor.risco, 0)), 0) AS limiteDisponivel,
    ISNULL(SUM(ISNULL(RiscoPorClifor.vencido, 0)), 0) AS vencido,
    ISNULL(SUM(ISNULL(RiscoPorClifor.aVencer, 0)), 0) AS aVencer,
    ISNULL(SUM(ISNULL(RiscoPorClifor.tranche, 0)), 0) AS tranche
${CARTEIRA_JOINS}
${FILTROS_WHERE}
  ${visaoClause(visao)}
`;
}

export interface CarteiraClientesPage {
  rows: ClienteCarteira[];
  total: number;
  page: number;
  pageSize: number;
  totais: CarteiraClientesTotais;
}

export async function getCarteiraClientes(
  page: number,
  pageSize: number,
  sortKey: string = DEFAULT_SORT_KEY,
  sortDir: SortDirection = "desc",
  filtros: Scoped<CarteiraClientesFiltros>,
  forceRefresh = false,
): Promise<CarteiraClientesPage> {
  const safePageSize = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
  const safePage = Math.max(page, 1);

  return withCache(
    `carteira-clientes:${safePage}:${safePageSize}:${sortKey}:${sortDir}:${JSON.stringify(filtros)}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rnStart = (safePage - 1) * safePageSize + 1;
      const rnEnd = safePage * safePageSize;
      const visao = filtros.visao;

      const [rows, countRows, totaisRows] = await Promise.all([
        executeReadQuery<ClienteCarteira>(buildQuery(sortKey, sortDir, visao), [
          { name: "rnStart", type: sql.Int, value: rnStart },
          { name: "rnEnd", type: sql.Int, value: rnEnd },
          ...filtrosParams(filtros),
        ]),
        executeReadQuery<{ total: number }>(buildCountQuery(visao), filtrosParams(filtros)),
        executeReadQuery<CarteiraClientesTotais>(buildTotaisQuery(visao), filtrosParams(filtros)),
      ]);

      return {
        rows,
        total: countRows[0]?.total ?? 0,
        page: safePage,
        pageSize: safePageSize,
        totais: totaisRows[0] ?? {
          limiteCredito: 0,
          risco: 0,
          limiteDisponivel: 0,
          vencido: 0,
          aVencer: 0,
          tranche: 0,
        },
      };
    },
    { forceRefresh },
  );
}

const EXPORT_MAX_ROWS = 200_000;
const EXPORT_TIMEOUT_MS = 25_000;

function buildExportQuery(sortKey: string, sortDir: SortDirection, visao: string | undefined) {
  const expr = SORT_EXPRESSIONS[sortKey] ?? SORT_EXPRESSIONS[DEFAULT_SORT_KEY];
  const dir = sortDir === "asc" ? "ASC" : "DESC";

  return `
;WITH ${CARTEIRA_CTE}
SELECT TOP (@maxRows)
    CAST(Universo.clifor AS VARCHAR) AS codigo,
    SIGCAD.NOME AS cedente,
    CASE WHEN SIGVEN.CODIGO IS NULL THEN NULL ELSE CAST(SIGVEN.CODIGO AS VARCHAR) + ' - ' + SIGVEN.NOME END AS comercial,
    ${SITUACAO_CASE} AS situacao,
    ISNULL(CADCRED.ConsLimCedFIDC, 0) AS limiteCredito,
    ISNULL(RiscoPorClifor.risco, 0) AS risco,
    CASE WHEN TotalRiscoGeral.total = 0 THEN 0
         ELSE ISNULL(RiscoPorClifor.risco, 0) * 100.0 / TotalRiscoGeral.total
    END AS participacao,
    (ISNULL(CADCRED.ConsLimCedFIDC, 0) - ISNULL(RiscoPorClifor.risco, 0)) AS limiteDisponivel,
    ISNULL(RiscoPorClifor.vencido, 0) AS vencido,
    ISNULL(RiscoPorClifor.aVencer, 0) AS aVencer,
    UltimaDataPorClifor.ultimaData AS ultimaData,
    ISNULL(RiscoPorClifor.tranche, 0) AS tranche,
    SIGCAD.fatorfidc / 100.0 AS taxa,
    ${METODO_CASE} AS metodo
${CARTEIRA_JOINS}
${FILTROS_WHERE}
  ${visaoClause(visao)}
ORDER BY ${expr} ${dir}, Universo.clifor DESC
`;
}

export async function getCarteiraClientesParaExportacao(
  sortKey: string = DEFAULT_SORT_KEY,
  sortDir: SortDirection = "desc",
  filtros: Scoped<CarteiraClientesFiltros>,
): Promise<ClienteCarteira[]> {
  return executeReadQuery<ClienteCarteira>(
    buildExportQuery(sortKey, sortDir, filtros.visao),
    [{ name: "maxRows", type: sql.Int, value: EXPORT_MAX_ROWS }, ...filtrosParams(filtros)],
    { timeoutMs: EXPORT_TIMEOUT_MS },
  );
}
