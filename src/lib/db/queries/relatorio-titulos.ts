import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import {
  STATUS_PAGTO_CASE,
  TIPO_PAGAMENTO_CASE,
  SIGFIDC_CODIGOS_FIDC,
  VALOR_PAGAMENTO_EXPR,
} from "./sigfidc-shared";

export interface TituloRelatorio {
  id: number;
  titulo: string;
  cedente: string | null;
  sacado: string | null;
  indicanteOperador: string | null;
  valorTitulo: number;
  valorPagamento: number;
  saldoTitulo: number;
  vencimento: string | null;
  dataCompra: string | null;
  dataPagamento: string | null;
  statusPagamento: string | null;
  bordero: number | null;
  tipoPagamento: string | null;
  situacao: string | null;
  diasAtraso: number | null;
}

export interface RelatorioTitulosFiltros {
  comercial?: string;
  grupoCedente?: string;
  grupoSacado?: string;
  bordero?: string;
  titulo?: string;
  cedente?: string;
  sacado?: string;
  situacao?: string;
  /** Delimitado por "|" — ex: "A Vencer|Vencido" */
  statusPagamento?: string;
  tipoPagamento?: string;
  dataCompraInicio?: string | null;
  dataCompraFim?: string | null;
  dataPagamentoInicio?: string | null;
  dataPagamentoFim?: string | null;
  vencimentoInicio?: string | null;
  vencimentoFim?: string | null;
}

// Lê os filtros de um URLSearchParams — usado igual nos dois endpoints
// (listagem e exportação) pra não duplicar a lista de nomes de parâmetro.
export function parseFiltrosFromSearchParams(
  searchParams: URLSearchParams,
): RelatorioTitulosFiltros {
  return {
    comercial: searchParams.get("comercial") ?? "",
    grupoCedente: searchParams.get("grupoCedente") ?? "",
    grupoSacado: searchParams.get("grupoSacado") ?? "",
    bordero: searchParams.get("bordero") ?? "",
    titulo: searchParams.get("titulo") ?? "",
    cedente: searchParams.get("cedente") ?? "",
    sacado: searchParams.get("sacado") ?? "",
    situacao: searchParams.get("situacao") ?? "",
    statusPagamento: searchParams.get("statusPagamento") ?? "",
    tipoPagamento: searchParams.get("tipoPagamento") ?? "",
    dataCompraInicio: searchParams.get("dataCompraInicio") || null,
    dataCompraFim: searchParams.get("dataCompraFim") || null,
    dataPagamentoInicio: searchParams.get("dataPagamentoInicio") || null,
    dataPagamentoFim: searchParams.get("dataPagamentoFim") || null,
    vencimentoInicio: searchParams.get("vencimentoInicio") || null,
    vencimentoFim: searchParams.get("vencimentoFim") || null,
  };
}

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

const SALDO_TITULO_EXPR = `
CASE
    WHEN F.BANCO IS NULL OR LTRIM(RTRIM(CAST(F.BANCO AS VARCHAR))) = ''
    THEN ISNULL(F.VALOR, 0)
    ELSE 0
END
`;

// CTEs reutilizadas por toda query do relatório — comercial (COD_COMERCIAL,
// via SIGBORS+SIGVEN por borderô) e grupo econômico (via GrupoEmpresa +
// cadGrupoEmpresarial, deduplicado por CLIFOR com ROW_NUMBER, igual ao
// script SQL de origem do Power BI). `OC.codigoComercial`/`GC.idgrupo` são
// os códigos crus usados nos filtros; `OC.COD_COMERCIAL` é o texto
// formatado "código - nome" mostrado na coluna Indicante/Operador.
const FILTROS_CTE = `
SigborsOperador AS (
    SELECT
        B.BORDERO,
        CASE
            WHEN B.INDICANTE IS NOT NULL AND B.INDICANTE <> '' THEN B.INDICANTE
            WHEN B.OPERADOR IS NOT NULL AND B.OPERADOR <> '' THEN B.OPERADOR
            ELSE NULL
        END AS COD_OPERADOR_INDICANTE
    FROM SIGBORS B
),
OperadorComercial AS (
    SELECT
        SO.BORDERO,
        SO.COD_OPERADOR_INDICANTE AS codigoComercial,
        CAST(SV.CODIGO AS VARCHAR) + ' - ' + SV.NOME AS COD_COMERCIAL
    FROM SigborsOperador SO
    LEFT JOIN SIGVEN SV ON SV.CODIGO = SO.COD_OPERADOR_INDICANTE
),
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

// JOINs padrão usados por toda query do relatório — sempre os mesmos,
// filtro nenhum muda a estrutura, só o WHERE (FILTROS_WHERE) abaixo.
const FILTROS_JOINS = `
LEFT JOIN OperadorComercial OC ON OC.BORDERO = F.BORDERO
LEFT JOIN ESTADOCONFIRMACAOTITULO ECT ON ECT.CTRL_ID = SF.ESTADOCONFIRMACAOTITULO_ID
LEFT JOIN GrupoEmpresaUnico GC_CED ON GC_CED.clifor = F.CLIFOR AND GC_CED.RN = 1
LEFT JOIN GrupoEmpresaUnico GC_SAC ON GC_SAC.clifor = F.SACADO AND GC_SAC.RN = 1
`;

// Condições de filtro — todas opcionais (parâmetro vazio/nulo = sem
// filtro). Cada filtro novo (seção 9 do pedido do cliente, 2026-07-14) vira
// uma linha aqui + um parâmetro nomeado; nunca concatenado direto na query.
// STATUS_PAGTO é múltipla escolha: @statusPagamento chega como string
// delimitada por "|" (ex: "A Vencer|Vencido") e usamos CHARINDEX pra
// verificar se o status da linha está na lista — evita SQL dinâmico pra uma
// lista de tamanho variável.
const FILTROS_WHERE = `
WHERE F.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
  AND (@comercial = '' OR OC.codigoComercial = @comercial)
  AND (@grupoCedente = '' OR CAST(GC_CED.idgrupo AS VARCHAR) = @grupoCedente)
  AND (@grupoSacado = '' OR CAST(GC_SAC.idgrupo AS VARCHAR) = @grupoSacado)
  AND (@bordero = '' OR CAST(F.BORDERO AS VARCHAR) = @bordero)
  AND (@titulo = '' OR F.DCTO LIKE @titulo)
  AND (@cedente = '' OR CAST(F.CLIFOR AS VARCHAR) = @cedente)
  AND (@sacado = '' OR CAST(F.SACADO AS VARCHAR) = @sacado)
  AND (@situacao = '' OR ECT.DESCRICAO = @situacao)
  AND (@statusPagamento = '' OR CHARINDEX('|' + ${STATUS_PAGTO_CASE} + '|', '|' + @statusPagamento + '|') > 0)
  AND (@tipoPagamento = '' OR ${TIPO_PAGAMENTO_CASE} = @tipoPagamento)
  AND (@dataCompraInicio IS NULL OR CAST(F.DIGITACAO AS DATE) >= @dataCompraInicio)
  AND (@dataCompraFim IS NULL OR CAST(F.DIGITACAO AS DATE) <= @dataCompraFim)
  AND (@dataPagamentoInicio IS NULL OR CAST(F.DTPGTO AS DATE) >= @dataPagamentoInicio)
  AND (@dataPagamentoFim IS NULL OR CAST(F.DTPGTO AS DATE) <= @dataPagamentoFim)
  AND (@vencimentoInicio IS NULL OR CAST(F.DATA AS DATE) >= @vencimentoInicio)
  AND (@vencimentoFim IS NULL OR CAST(F.DATA AS DATE) <= @vencimentoFim)
`;

function filtrosParams(filtros: RelatorioTitulosFiltros) {
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
  // Título (DCTO) é busca parcial (contém), não igualdade — praticamente
  // único por título, não faz sentido como lista/dropdown.
  const likeParam = (name: string, value: string | undefined) => {
    const termo = (value ?? "").trim();
    return { name, type: sql.VarChar(200), value: termo ? `%${termo}%` : "" };
  };

  return [
    strParam("comercial", filtros.comercial),
    strParam("grupoCedente", filtros.grupoCedente),
    strParam("grupoSacado", filtros.grupoSacado),
    strParam("bordero", filtros.bordero),
    likeParam("titulo", filtros.titulo),
    strParam("cedente", filtros.cedente),
    strParam("sacado", filtros.sacado),
    strParam("situacao", filtros.situacao),
    strParam("statusPagamento", filtros.statusPagamento),
    strParam("tipoPagamento", filtros.tipoPagamento),
    dateParam("dataCompraInicio", filtros.dataCompraInicio),
    dateParam("dataCompraFim", filtros.dataCompraFim),
    dateParam("dataPagamentoInicio", filtros.dataPagamentoInicio),
    dateParam("dataPagamentoFim", filtros.dataPagamentoFim),
    dateParam("vencimentoInicio", filtros.vencimentoInicio),
    dateParam("vencimentoFim", filtros.vencimentoFim),
  ];
}

// Expressão SQL real por coluna ordenável — usada tanto no SELECT quanto no
// ORDER BY do ROW_NUMBER() OVER(...). Não dá pra usar o alias da coluna
// (ex: "valorPagamento") dentro do próprio OVER() da mesma lista SELECT, T-SQL
// não permite — por isso repetimos a expressão. Allowlist fixo: a chave que
// vem do cliente só escolhe qual expressão usar, nunca é concatenada direto
// na query (proteção contra SQL injection via nome de coluna).
const SORT_EXPRESSIONS: Record<string, string> = {
  titulo: "F.DCTO",
  cedente: "CED.NOME",
  sacado: "SAC.NOME",
  indicanteOperador: "OC.COD_COMERCIAL",
  valorTitulo: "ISNULL(F.VALOR_, 0)",
  valorPagamento: VALOR_PAGAMENTO_EXPR,
  saldoTitulo: SALDO_TITULO_EXPR,
  vencimento: "CAST(F.DATA AS DATE)",
  dataCompra: "CAST(F.DIGITACAO AS DATE)",
  dataPagamento: "CAST(F.DTPGTO AS DATE)",
  statusPagamento: STATUS_PAGTO_CASE,
  bordero: "F.BORDERO",
  tipoPagamento: TIPO_PAGAMENTO_CASE,
  situacao: "ECT.DESCRICAO",
  diasAtraso: "DA.DIAS_ATRASO",
};

const DEFAULT_SORT_KEY = "vencimento";

export type SortDirection = "asc" | "desc";

// Relatório Analítico de Títulos (módulo "Relatórios analíticos", CLAUDE.md
// seção 9). Colunas e regras de negócio vêm do script SQL de origem do
// Power BI (colado pelo cliente em 2026-07-12) — reaproveita os mesmos
// fragmentos compartilhados de STATUS_PAGTO/TIPO_PAGAMENTO já validados nos
// cards da Visão Geral, e replica exatamente: COD_COMERCIAL (indicante>
// operador por borderô, via SIGBORS+SIGVEN), VALOR_PAGAMENTO/SALDO_TITULO
// (derivados de BANCO/VALOR/VALOR_/VLPGTO), SITUACAO (SIGFLS ->
// ESTADOCONFIRMACAOTITULO, join por F.SIGFLS — não F.CTRL_ID) e DIAS_ATRASO
// (CROSS APPLY). A medida DAX `dias_atraso` original só existe pra dar
// BLANK() em contexto de agregação (matriz do Power BI); numa tabela
// linha-a-título isso não se aplica — mostramos DIAS_ATRASO direto.
//
// Paginação obrigatória (CLAUDE.md 21.5). Filtros de contexto (2026-07-14):
// comercial, grupo econômico cedente/sacado, borderô, cedente, sacado,
// situação, status/tipo de pagamento e três ranges de data.
//
// Paginação via ROW_NUMBER(), não OFFSET/FETCH: o SQL Server desta instância
// é 2008 R2 (compatibility level 100) — OFFSET/FETCH só existe a partir do
// 2012 (CLAUDE.md seção 16). Confirmado em 2026-07-12 via SERVERPROPERTY.
//
// Ordenação por coluna (clique no cabeçalho, como no Power BI) precisa ser
// no servidor, não no cliente — só uma página de dados fica carregada por
// vez, então ordenar no browser só ordenaria a página visível, não a tabela
// inteira. Trocar a ordenação também precisa voltar pra página 1 (o número
// de linha de cada título muda quando o ORDER BY muda).
function buildQuery(sortKey: string, sortDir: SortDirection) {
  const expr = SORT_EXPRESSIONS[sortKey] ?? SORT_EXPRESSIONS[DEFAULT_SORT_KEY];
  const dir = sortDir === "asc" ? "ASC" : "DESC";

  return `
;WITH ${FILTROS_CTE},
Numerado AS (
    SELECT
        F.ID AS id,
        F.DCTO AS titulo,
        CED.NOME AS cedente,
        SAC.NOME AS sacado,
        OC.COD_COMERCIAL AS indicanteOperador,
        ISNULL(F.VALOR_, 0) AS valorTitulo,
        ${VALOR_PAGAMENTO_EXPR} AS valorPagamento,
        ${SALDO_TITULO_EXPR} AS saldoTitulo,
        CAST(F.DATA AS DATE) AS vencimento,
        CAST(F.DIGITACAO AS DATE) AS dataCompra,
        CAST(F.DTPGTO AS DATE) AS dataPagamento,
        ${STATUS_PAGTO_CASE} AS statusPagamento,
        F.BORDERO AS bordero,
        ${TIPO_PAGAMENTO_CASE} AS tipoPagamento,
        ECT.DESCRICAO AS situacao,
        DA.DIAS_ATRASO AS diasAtraso,
        ROW_NUMBER() OVER (ORDER BY ${expr} ${dir}, F.ID DESC) AS rn
    FROM SIGFIDC F
    LEFT JOIN SIGCAD CED ON CED.CODIGO = F.CLIFOR
    LEFT JOIN SIGCAD SAC ON SAC.CODIGO = F.SACADO
    LEFT JOIN SIGFLS SF ON SF.ctrl_id = F.SIGFLS
    ${FILTROS_JOINS}
    CROSS APPLY (
        SELECT
            CASE
                WHEN F.DTPGTO IS NOT NULL
                    AND LEN(LTRIM(RTRIM(CAST(F.BANCO AS VARCHAR)))) > 0
                    AND CAST(F.DATA AS DATE) < CAST(F.DTPGTO AS DATE)
                THEN -DATEDIFF(DAY, CAST(F.DTPGTO AS DATE), CAST(F.DATA AS DATE))
                WHEN (F.DTPGTO IS NOT NULL AND (F.BANCO IS NULL OR LTRIM(RTRIM(CAST(F.BANCO AS VARCHAR))) = '')
                    AND CAST(F.DATA AS DATE) < CAST(GETDATE() AS DATE))
                    OR
                    (F.DTPGTO IS NULL AND CAST(F.DATA AS DATE) < CAST(GETDATE() AS DATE))
                THEN DATEDIFF(DAY, CAST(F.DATA AS DATE), CAST(GETDATE() AS DATE))
                ELSE NULL
            END AS DIAS_ATRASO
    ) DA
    ${FILTROS_WHERE}
)
SELECT id, titulo, cedente, sacado, indicanteOperador, valorTitulo, valorPagamento,
       saldoTitulo, vencimento, dataCompra, dataPagamento, statusPagamento, bordero,
       tipoPagamento, situacao, diasAtraso
FROM Numerado
WHERE rn BETWEEN @rnStart AND @rnEnd
ORDER BY rn
`;
}

function buildCountQuery() {
  return `
;WITH ${FILTROS_CTE}
SELECT COUNT(*) AS total
FROM SIGFIDC F
LEFT JOIN SIGFLS SF ON SF.ctrl_id = F.SIGFLS
${FILTROS_JOINS}
${FILTROS_WHERE}
`;
}

// Totalizadores da barra de filtros/exportação — soma sobre TODO o universo
// filtrado, não só a página carregada na tela.
function buildTotaisQuery() {
  return `
;WITH ${FILTROS_CTE}
SELECT
    ISNULL(SUM(ISNULL(F.VALOR_, 0)), 0) AS valorTitulo,
    ISNULL(SUM(${VALOR_PAGAMENTO_EXPR}), 0) AS valorPagamento,
    ISNULL(SUM(${SALDO_TITULO_EXPR}), 0) AS saldoTitulo
FROM SIGFIDC F
LEFT JOIN SIGFLS SF ON SF.ctrl_id = F.SIGFLS
${FILTROS_JOINS}
${FILTROS_WHERE}
`;
}

export interface RelatorioTitulosTotais {
  valorTitulo: number;
  valorPagamento: number;
  saldoTitulo: number;
}

export interface RelatorioTitulosPage {
  rows: TituloRelatorio[];
  total: number;
  page: number;
  pageSize: number;
  totais: RelatorioTitulosTotais;
}

export async function getRelatorioTitulos(
  page: number,
  pageSize: number,
  sortKey: string = DEFAULT_SORT_KEY,
  sortDir: SortDirection = "desc",
  filtros: Scoped<RelatorioTitulosFiltros>,
  forceRefresh = false,
): Promise<RelatorioTitulosPage> {
  const safePageSize = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
  const safePage = Math.max(page, 1);

  return withCache(
    `relatorio-titulos:${safePage}:${safePageSize}:${sortKey}:${sortDir}:${JSON.stringify(filtros)}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rnStart = (safePage - 1) * safePageSize + 1;
      const rnEnd = safePage * safePageSize;

      const [rows, countRows, totaisRows] = await Promise.all([
        executeReadQuery<TituloRelatorio>(buildQuery(sortKey, sortDir), [
          { name: "rnStart", type: sql.Int, value: rnStart },
          { name: "rnEnd", type: sql.Int, value: rnEnd },
          ...filtrosParams(filtros),
        ]),
        executeReadQuery<{ total: number }>(buildCountQuery(), filtrosParams(filtros)),
        executeReadQuery<RelatorioTitulosTotais>(buildTotaisQuery(), filtrosParams(filtros)),
      ]);

      return {
        rows,
        total: countRows[0]?.total ?? 0,
        page: safePage,
        pageSize: safePageSize,
        totais: totaisRows[0] ?? { valorTitulo: 0, valorPagamento: 0, saldoTitulo: 0 },
      };
    },
    { forceRefresh },
  );
}

// Exportação para Excel. Sem paginação (o usuário pode exportar tudo que
// está listado), mas com trava de segurança (@maxRows) e timeout maior — o
// universo hoje é ~183 mil linhas e essa mesma query, sem filtro nenhum,
// leva ~5s (testado em 2026-07-12), bem dentro do teto de 30s. O cap é uma
// rede de segurança pro banco crescer no futuro, não uma restrição pensada
// pro uso normal (que na prática sempre vai ter filtro aplicado, reduzindo
// bastante o volume).
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
    CED.NOME AS cedente,
    SAC.NOME AS sacado,
    OC.COD_COMERCIAL AS indicanteOperador,
    ISNULL(F.VALOR_, 0) AS valorTitulo,
    ${VALOR_PAGAMENTO_EXPR} AS valorPagamento,
    ${SALDO_TITULO_EXPR} AS saldoTitulo,
    CAST(F.DATA AS DATE) AS vencimento,
    CAST(F.DIGITACAO AS DATE) AS dataCompra,
    CAST(F.DTPGTO AS DATE) AS dataPagamento,
    ${STATUS_PAGTO_CASE} AS statusPagamento,
    F.BORDERO AS bordero,
    ${TIPO_PAGAMENTO_CASE} AS tipoPagamento,
    ECT.DESCRICAO AS situacao,
    DA.DIAS_ATRASO AS diasAtraso
FROM SIGFIDC F
LEFT JOIN SIGCAD CED ON CED.CODIGO = F.CLIFOR
LEFT JOIN SIGCAD SAC ON SAC.CODIGO = F.SACADO
LEFT JOIN SIGFLS SF ON SF.ctrl_id = F.SIGFLS
${FILTROS_JOINS}
CROSS APPLY (
    SELECT
        CASE
            WHEN F.DTPGTO IS NOT NULL
                AND LEN(LTRIM(RTRIM(CAST(F.BANCO AS VARCHAR)))) > 0
                AND CAST(F.DATA AS DATE) < CAST(F.DTPGTO AS DATE)
            THEN -DATEDIFF(DAY, CAST(F.DTPGTO AS DATE), CAST(F.DATA AS DATE))
            WHEN (F.DTPGTO IS NOT NULL AND (F.BANCO IS NULL OR LTRIM(RTRIM(CAST(F.BANCO AS VARCHAR))) = '')
                AND CAST(F.DATA AS DATE) < CAST(GETDATE() AS DATE))
                OR
                (F.DTPGTO IS NULL AND CAST(F.DATA AS DATE) < CAST(GETDATE() AS DATE))
            THEN DATEDIFF(DAY, CAST(F.DATA AS DATE), CAST(GETDATE() AS DATE))
            ELSE NULL
        END AS DIAS_ATRASO
) DA
${FILTROS_WHERE}
ORDER BY ${expr} ${dir}, F.ID DESC
`;
}

export async function getRelatorioTitulosParaExportacao(
  sortKey: string = DEFAULT_SORT_KEY,
  sortDir: SortDirection = "desc",
  filtros: Scoped<RelatorioTitulosFiltros>,
): Promise<TituloRelatorio[]> {
  return executeReadQuery<TituloRelatorio>(
    buildExportQuery(sortKey, sortDir),
    [{ name: "maxRows", type: sql.Int, value: EXPORT_MAX_ROWS }, ...filtrosParams(filtros)],
    { timeoutMs: EXPORT_TIMEOUT_MS },
  );
}
