import sql from "mssql";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import { prisma } from "@/lib/prisma";
import type { Scoped } from "@/lib/auth/access-scope";
import {
  STATUS_PAGTO_CASE,
  TIPO_PAGAMENTO_CASE,
  JUROS_MENSAL_CASE,
  SIGFIDC_CODIGOS_FIDC,
  SIGBORS_OPERADOR_CTE,
} from "./sigfidc-shared";

export interface ComissaoTitulo {
  id: number;
  titulo: string;
  cedente: string | null;
  sacado: string | null;
  bordero: number | null;
  indicanteOperador: string | null;
  /** Código cru do indicante/operador (SIGBORS.INDICANTE/OPERADOR) — usado só
   * pra resolver `tipo` via tabela usuarios (não exibido diretamente). */
  codigoComercial: string | null;
  /** "Interno"/"Externo" — resolvido em JS via tabela usuarios (perfil
   * Comercial), não vem do SQL Server. Ver applyTipoComercial. */
  tipo: string | null;
  dataCompra: string | null;
  valorTitulo: number;
  statusPagamento: string | null;
  tipoPagamento: string | null;
  desagio: number;
  taxa: number | null;
  faixaComissao: number | null;
  comissao: number;
  vencimento: string | null;
  dataPagamento: string | null;
}

// Mesmos 11 filtros do Relatório Analítico de Títulos (mesma popup, mesmo
// layout — CLAUDE.md: "filtros exatamente iguais"), aplicados sobre o mesmo
// universo SIGFIDC.
export interface ComissoesFiltros {
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

export function parseFiltrosFromSearchParams(searchParams: URLSearchParams): ComissoesFiltros {
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
const DEFAULT_SORT_KEY = "vencimento";

export type SortDirection = "asc" | "desc";

export interface QueryParam {
  name: string;
  type: sql.ISqlType | (() => sql.ISqlType);
  value: unknown;
}

export interface FaixaComissaoBracket {
  jurosMin: number;
  jurosMax: number | null;
  taxa: number;
}

// Faixas de comissão (CLAUDE.md 19.6) não são fixas em código — o cliente
// edita via /dashboard/faixas-comissao (permissão gerenciar_faixas_comissao),
// persistidas em MySQL (Prisma, model FaixaComissao). Como SIGFIDC vive no
// SQL Server (fonte separada), a regra vira um CASE montado dinamicamente a
// cada consulta: busca as faixas atuais no MySQL primeiro, depois gera o
// CASE com os limites/taxas como parâmetros nomeados (nunca concatenados
// direto na string) pro SQL Server. Faixa sem jurosMax = última faixa, sem
// teto superior. Exportadas (junto com buildTaxaComissaoExpr) porque também
// são reaproveitadas pelo gráfico "Comissões" do módulo Gráficos
// (graficos-comissoes.ts) — mesma regra, nunca duplicada.
export async function getFaixasOrdenadas(): Promise<FaixaComissaoBracket[]> {
  return prisma.faixaComissao.findMany({
    orderBy: { jurosMin: "asc" },
    select: { jurosMin: true, jurosMax: true, taxa: true },
  });
}

// Interno/Externo (CLAUDE.md 19.6/21.9, correção 2026-07-17) — deixou de ser
// determinado por uma lista fixa de CODIGO em SIGVEN (regra antiga do Power
// Query M, "Tipo_Comissao") e passou a vir da própria tabela usuarios
// (MySQL/Prisma): perfil "Comercial" + comercialCodigo (código do
// indicante/operador) → comercialTipo. Comercial sem registro correspondente
// em usuarios é considerado Externo automaticamente. Por enquanto isso só
// alimenta a coluna "Tipo" do relatório (exibição) — o CÁLCULO da comissão
// (Faixas de Comissões) continua igual para todo mundo até a regra
// específica de Externo ser definida.
export async function getTipoComercialMap(): Promise<Map<string, string>> {
  const usuarios = await prisma.usuario.findMany({
    where: { perfil: "Comercial", deletedAt: null, comercialCodigo: { not: null } },
    select: { comercialCodigo: true, comercialTipo: true },
  });
  const mapa = new Map<string, string>();
  for (const u of usuarios) {
    if (u.comercialCodigo) mapa.set(u.comercialCodigo.trim(), u.comercialTipo ?? "Externo");
  }
  return mapa;
}

function applyTipoComercial<T extends { codigoComercial: string | null }>(
  rows: T[],
  tipoMap: Map<string, string>,
): (T & { tipo: string | null })[] {
  return rows.map((row) => ({
    ...row,
    tipo: row.codigoComercial === null ? null : (tipoMap.get(row.codigoComercial.trim()) ?? "Externo"),
  }));
}

export function internoCodigosFromMap(tipoMap: Map<string, string>): string[] {
  return [...tipoMap.entries()].filter(([, tipo]) => tipo === "Interno").map(([codigo]) => codigo);
}

export function buildTaxaComissaoExpr(
  faixas: FaixaComissaoBracket[],
  jurosMensalExpr: string,
): { expr: string; params: QueryParam[] } {
  // Sem faixa cadastrada: comissão zero é mais seguro que travar a tela.
  if (faixas.length === 0) {
    return { expr: "0", params: [] };
  }

  const params: QueryParam[] = [];
  const whens = faixas.map((faixa, i) => {
    const minName = `faixaMin${i}`;
    params.push({ name: minName, type: sql.Float, value: faixa.jurosMin });
    let condicao = `${jurosMensalExpr} >= @${minName}`;
    if (faixa.jurosMax !== null) {
      const maxName = `faixaMax${i}`;
      params.push({ name: maxName, type: sql.Float, value: faixa.jurosMax });
      condicao += ` AND ${jurosMensalExpr} <= @${maxName}`;
    }
    const taxaName = `faixaTaxa${i}`;
    params.push({ name: taxaName, type: sql.Float, value: faixa.taxa });
    return `WHEN ${condicao} THEN @${taxaName}`;
  });

  const expr = `
    CASE
        WHEN ${jurosMensalExpr} IS NULL THEN 0
        ${whens.join("\n        ")}
        ELSE 0
    END
  `;
  return { expr, params };
}

// Comercial + Externo (CLAUDE.md 19.6, correção 2026-07-18) — NÃO usa as
// Faixas de Comissões dinâmicas (essas são exclusivas de Comercial +
// Interno). Pra Externo, a "Faixa de Comissão" é o campo SIGBORS.COMISSAO
// (já em escala percentual crua, mesma escala de FaixaComissao — ex: 6 = 6%)
// do PRÓPRIO BORDERÔ do título — ou seja, um mesmo indicante/operador pode
// ter faixas diferentes dependendo do borderô. NULL/sem match = 0 (sem
// comissão nesse borderô — comportamento confirmado pelo cliente, valor 0 é
// legítimo em ~41% dos borderôs, não é "campo não preenchido").
// Exportada (2026-07-19, POC do caminho "pergunta aberta" — CLAUDE.md seção
// 12) — reaproveitada por `src/lib/ia/open-sql/comissoes.ts` pra montar a
// coluna `tipo` (Interno/Externo) da view semântica `ComissoesEscopo`, sem
// duplicar a regra de classificação. `paramPrefix` existe só pra permitir
// chamar esta função mais de uma vez na MESMA query (ex: uma vez indireta,
// via buildFaixaComissaoExpr, outra vez direto pra montar `tipo`) sem colidir
// nome de parâmetro — mssql rejeita `request.input()` duas vezes com o
// mesmo nome.
export function buildInternoCondicao(
  codigosInterno: string[],
  codigoComercialExpr: string,
  paramPrefix = "internoCodigo",
): { condicao: string; params: QueryParam[] } {
  if (codigosInterno.length === 0) {
    return { condicao: "1 = 0", params: [] };
  }
  const params: QueryParam[] = [];
  const placeholders = codigosInterno.map((codigo, i) => {
    const name = `${paramPrefix}${i}`;
    params.push({ name, type: sql.VarChar(20), value: codigo });
    return `@${name}`;
  });
  return { condicao: `(${codigoComercialExpr}) IN (${placeholders.join(", ")})`, params };
}

// Faixa de Comissão combinada — Interno usa as faixas dinâmicas
// (buildTaxaComissaoExpr, por JUROS_MENSAL); Externo usa SIGBORS.COMISSAO
// (por borderô). `codigosInterno` vem da tabela usuarios (perfil Comercial +
// comercialTipo "Interno") — quem não está nessa lista é Externo por
// definição (CLAUDE.md 21.9), inclusive comerciais sem cadastro nenhum.
// `codigoComercialExpr`/`sigborsAlias` são parametrizáveis porque
// graficos-comissoes.ts usa uma expressão (COMERCIAL_EXPR) e um alias de
// SIGBORS (B) diferentes dos usados aqui (OC.codigoComercial / SB).
export function buildFaixaComissaoExpr(
  faixas: FaixaComissaoBracket[],
  jurosMensalExpr: string,
  codigosInterno: string[],
  options: { codigoComercialExpr?: string; sigborsAlias?: string } = {},
): { expr: string; params: QueryParam[] } {
  const codigoComercialExpr = options.codigoComercialExpr ?? "OC.codigoComercial";
  const sigborsAlias = options.sigborsAlias ?? "SB";
  const { expr: taxaInternaExpr, params: faixaParams } = buildTaxaComissaoExpr(faixas, jurosMensalExpr);
  const { condicao, params: internoParams } = buildInternoCondicao(codigosInterno, codigoComercialExpr);
  const expr = `
    CASE
        WHEN ${condicao} THEN (${taxaInternaExpr})
        ELSE ISNULL(${sigborsAlias}.COMISSAO, 0)
    END
  `;
  return { expr, params: [...faixaParams, ...internoParams] };
}

// CTEs reutilizadas por toda query de Comissões — mesmo padrão de
// relatorio-titulos.ts (FILTROS_CTE/FILTROS_JOINS/FILTROS_WHERE): comercial
// (COD_OPERADOR_INDICANTE via SIGBORS+SIGVEN por borderô — CLAUDE.md 21.9) e
// grupo econômico (GrupoEmpresa + cadGrupoEmpresarial, deduplicado por
// CLIFOR com ROW_NUMBER).
// Exportadas (2026-07-19, POC "pergunta aberta" — CLAUDE.md seção 12):
// `src/lib/ia/open-sql/comissoes.ts` monta a view semântica `ComissoesEscopo`
// reaproveitando exatamente estes mesmos fragmentos (CTEs de comercial/grupo
// econômico, JOINs e WHERE de RLS+filtros), nunca duplicando a regra.
export const FILTROS_CTE = `
${SIGBORS_OPERADOR_CTE},
OperadorComercial AS (
    SELECT
        SO.BORDERO,
        SO.codigoComercial,
        CAST(SV.CODIGO AS VARCHAR) + ' - ' + SV.NOME AS COD_COMERCIAL
    FROM SigborsOperador SO
    LEFT JOIN SIGVEN SV ON SV.CODIGO = SO.codigoComercial
),
GrupoEmpresaUnico AS (
    SELECT
        GE.clifor,
        GE.idgrupo,
        ROW_NUMBER() OVER (PARTITION BY GE.clifor ORDER BY GE.clifor) AS RN
    FROM GrupoEmpresa GE
)
`;

// Espera aliases F (SIGFIDC), fl (SIGFLS) já no FROM/JOIN da query externa.
// SB (SIGBORS por F.BORDERO) alimenta SB.COMISSAO — faixa de comissão dos
// comerciais Externo (ver buildFaixaComissaoExpr).
export const FILTROS_JOINS = `
LEFT JOIN OperadorComercial OC ON OC.BORDERO = F.BORDERO
LEFT JOIN SIGBORS SB ON SB.BORDERO = F.BORDERO
LEFT JOIN ESTADOCONFIRMACAOTITULO ECT ON ECT.CTRL_ID = fl.ESTADOCONFIRMACAOTITULO_ID
LEFT JOIN GrupoEmpresaUnico GC_CED ON GC_CED.clifor = F.CLIFOR AND GC_CED.RN = 1
LEFT JOIN GrupoEmpresaUnico GC_SAC ON GC_SAC.clifor = F.SACADO AND GC_SAC.RN = 1
`;

export const FILTROS_WHERE = `
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

export function filtrosParams(filtros: ComissoesFiltros): QueryParam[] {
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

function buildSortExpressions(faixaComissaoExpr: string, comissaoExpr: string): Record<string, string> {
  return {
    titulo: "F.DCTO",
    cedente: "CED.NOME",
    sacado: "SAC.NOME",
    bordero: "F.BORDERO",
    indicanteOperador: "OC.COD_COMERCIAL",
    dataCompra: "CAST(F.DIGITACAO AS DATE)",
    valorTitulo: "ISNULL(F.VALOR_, 0)",
    statusPagamento: STATUS_PAGTO_CASE,
    tipoPagamento: TIPO_PAGAMENTO_CASE,
    desagio: "ISNULL(fl.JUROS, 0)",
    taxa: JUROS_MENSAL_CASE,
    faixaComissao: faixaComissaoExpr,
    comissao: comissaoExpr,
    vencimento: "CAST(F.DATA AS DATE)",
    dataPagamento: "CAST(F.DTPGTO AS DATE)",
  };
}

// Relatório de Comissões (CLAUDE.md seção 9, "Comissões" — 19.6). Mesmo
// padrão de tabela paginada/ordenável do Relatório Analítico de Títulos:
// ROW_NUMBER() (sem OFFSET/FETCH, SQL Server 2008 R2 — CLAUDE.md 16),
// ordenação no servidor, e os MESMOS 11 filtros da popup de Títulos (mesma
// janela, mesmo layout — a pedido do cliente em 2026-07-16).
//
// Deságio = SIGFLS.JUROS (não SIGFIDC — vive em SIGFLS, join via
// F.SIGFLS = fl.ctrl_id, nunca F.CTRL_ID — CLAUDE.md 19.3). Taxa =
// JUROS_MENSAL. Faixa de Comissão = TAXA_COMISSAO pra Interno (faixas
// dinâmicas) ou SIGBORS.COMISSAO pra Externo (ver buildFaixaComissaoExpr).
// Comissão = VALOR_COMISSAO só quando há Indicante/Operador (COD_COMERCIAL
// não nulo) — replica a FILTER(NOT ISBLANK(...)) da medida DAX original.
function buildQuery(sortKey: string, sortDir: SortDirection, faixaComissaoExpr: string) {
  // faixaComissao vem em escala percentual (3 = 3%), por isso /100 aqui —
  // ver comentário em getComissoes sobre o formato do FaixaComissao.
  const comissaoExpr = `CASE WHEN OC.codigoComercial IS NULL THEN 0 ELSE ISNULL(fl.JUROS, 0) * (${faixaComissaoExpr}) / 100.0 END`;
  const sortExpressions = buildSortExpressions(faixaComissaoExpr, comissaoExpr);
  const expr = sortExpressions[sortKey] ?? sortExpressions[DEFAULT_SORT_KEY];
  const dir = sortDir === "asc" ? "ASC" : "DESC";

  return `
;WITH ${FILTROS_CTE},
Numerado AS (
    SELECT
        F.ID AS id,
        F.DCTO AS titulo,
        CED.NOME AS cedente,
        SAC.NOME AS sacado,
        F.BORDERO AS bordero,
        OC.COD_COMERCIAL AS indicanteOperador,
        OC.codigoComercial AS codigoComercial,
        CAST(F.DIGITACAO AS DATE) AS dataCompra,
        ISNULL(F.VALOR_, 0) AS valorTitulo,
        ${STATUS_PAGTO_CASE} AS statusPagamento,
        ${TIPO_PAGAMENTO_CASE} AS tipoPagamento,
        ISNULL(fl.JUROS, 0) AS desagio,
        ${JUROS_MENSAL_CASE} AS taxa,
        ${faixaComissaoExpr} AS faixaComissao,
        ${comissaoExpr} AS comissao,
        CAST(F.DATA AS DATE) AS vencimento,
        CAST(F.DTPGTO AS DATE) AS dataPagamento,
        ROW_NUMBER() OVER (ORDER BY ${expr} ${dir}, F.ID DESC) AS rn
    FROM SIGFIDC F
    LEFT JOIN SIGCAD CED ON CED.CODIGO = F.CLIFOR
    LEFT JOIN SIGCAD SAC ON SAC.CODIGO = F.SACADO
    LEFT JOIN SIGFLS fl ON fl.ctrl_id = F.SIGFLS
    ${FILTROS_JOINS}
    ${FILTROS_WHERE}
)
SELECT id, titulo, cedente, sacado, bordero, indicanteOperador, codigoComercial, dataCompra, valorTitulo,
       statusPagamento, tipoPagamento, desagio, taxa, faixaComissao, comissao,
       vencimento, dataPagamento
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
LEFT JOIN SIGFLS fl ON fl.ctrl_id = F.SIGFLS
${FILTROS_JOINS}
${FILTROS_WHERE}
`;
}

// Totalizadores da barra de filtros/exportação — soma sobre TODO o universo
// filtrado, não só a página carregada na tela (mesmo padrão de
// buildTotaisQuery em relatorio-titulos.ts).
function buildTotaisQuery(faixaComissaoExpr: string) {
  const comissaoExpr = `CASE WHEN OC.codigoComercial IS NULL THEN 0 ELSE ISNULL(fl.JUROS, 0) * (${faixaComissaoExpr}) / 100.0 END`;

  return `
;WITH ${FILTROS_CTE}
SELECT
    ISNULL(SUM(ISNULL(F.VALOR_, 0)), 0) AS valorTitulo,
    ISNULL(SUM(ISNULL(fl.JUROS, 0)), 0) AS desagio,
    ISNULL(SUM(${comissaoExpr}), 0) AS comissao
FROM SIGFIDC F
LEFT JOIN SIGFLS fl ON fl.ctrl_id = F.SIGFLS
${FILTROS_JOINS}
${FILTROS_WHERE}
`;
}

export interface ComissoesTotais {
  valorTitulo: number;
  desagio: number;
  comissao: number;
}

export interface ComissoesPage {
  rows: ComissaoTitulo[];
  total: number;
  page: number;
  pageSize: number;
  totais: ComissoesTotais;
}

export async function getComissoes(
  page: number,
  pageSize: number,
  sortKey: string = DEFAULT_SORT_KEY,
  sortDir: SortDirection = "desc",
  filtros: Scoped<ComissoesFiltros>,
  forceRefresh = false,
): Promise<ComissoesPage> {
  const safePageSize = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
  const safePage = Math.max(page, 1);

  return withCache(
    `comissoes:${safePage}:${safePageSize}:${sortKey}:${sortDir}:${JSON.stringify(filtros)}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const [faixas, tipoMap] = await Promise.all([
        getFaixasOrdenadas(),
        getTipoComercialMap(),
      ]);
      // FaixaComissao (Prisma/MySQL) guarda jurosMin/jurosMax/taxa em escala
      // percentual "crua" (ex: 2.1 = 2,1%, 3 = 3%) — mesmo formato mostrado em
      // /dashboard/faixas-comissao (faixas-comissao-table.tsx: formatPct só
      // acrescenta "%", sem multiplicar por 100). JUROS_MENSAL_CASE, por sua
      // vez, é uma fração (0.0226 = 2,26%) — por isso convertida pra escala
      // percentual (*100) antes de comparar com os limites da faixa. Só vale
      // pra Interno — Externo usa SIGBORS.COMISSAO (buildFaixaComissaoExpr).
      const { expr: faixaComissaoExpr, params: faixaParams } = buildFaixaComissaoExpr(
        faixas,
        `(${JUROS_MENSAL_CASE}) * 100`,
        internoCodigosFromMap(tipoMap),
      );

      const rnStart = (safePage - 1) * safePageSize + 1;
      const rnEnd = safePage * safePageSize;
      const fParams = filtrosParams(filtros);

      const [rows, countRows, totaisRows] = await Promise.all([
        executeReadQuery<ComissaoTitulo>(buildQuery(sortKey, sortDir, faixaComissaoExpr), [
          { name: "rnStart", type: sql.Int, value: rnStart },
          { name: "rnEnd", type: sql.Int, value: rnEnd },
          ...faixaParams,
          ...fParams,
        ]),
        executeReadQuery<{ total: number }>(buildCountQuery(), fParams),
        executeReadQuery<ComissoesTotais>(buildTotaisQuery(faixaComissaoExpr), [
          ...faixaParams,
          ...fParams,
        ]),
      ]);

      return {
        rows: applyTipoComercial(rows, tipoMap),
        total: countRows[0]?.total ?? 0,
        page: safePage,
        pageSize: safePageSize,
        totais: totaisRows[0] ?? { valorTitulo: 0, desagio: 0, comissao: 0 },
      };
    },
    { forceRefresh },
  );
}

// Exportação para Excel/e-mail — sem paginação, com trava de segurança
// (@maxRows) e timeout maior, mesmo padrão de
// getRelatorioTitulosParaExportacao em relatorio-titulos.ts.
const EXPORT_MAX_ROWS = 200_000;
const EXPORT_TIMEOUT_MS = 25_000;

function buildExportQuery(sortKey: string, sortDir: SortDirection, faixaComissaoExpr: string) {
  const comissaoExpr = `CASE WHEN OC.codigoComercial IS NULL THEN 0 ELSE ISNULL(fl.JUROS, 0) * (${faixaComissaoExpr}) / 100.0 END`;
  const sortExpressions = buildSortExpressions(faixaComissaoExpr, comissaoExpr);
  const expr = sortExpressions[sortKey] ?? sortExpressions[DEFAULT_SORT_KEY];
  const dir = sortDir === "asc" ? "ASC" : "DESC";

  return `
;WITH ${FILTROS_CTE}
SELECT TOP (@maxRows)
    F.ID AS id,
    F.DCTO AS titulo,
    CED.NOME AS cedente,
    SAC.NOME AS sacado,
    F.BORDERO AS bordero,
    OC.COD_COMERCIAL AS indicanteOperador,
    OC.codigoComercial AS codigoComercial,
    CAST(F.DIGITACAO AS DATE) AS dataCompra,
    ISNULL(F.VALOR_, 0) AS valorTitulo,
    ${STATUS_PAGTO_CASE} AS statusPagamento,
    ${TIPO_PAGAMENTO_CASE} AS tipoPagamento,
    ISNULL(fl.JUROS, 0) AS desagio,
    ${JUROS_MENSAL_CASE} AS taxa,
    ${faixaComissaoExpr} AS faixaComissao,
    ${comissaoExpr} AS comissao,
    CAST(F.DATA AS DATE) AS vencimento,
    CAST(F.DTPGTO AS DATE) AS dataPagamento
FROM SIGFIDC F
LEFT JOIN SIGCAD CED ON CED.CODIGO = F.CLIFOR
LEFT JOIN SIGCAD SAC ON SAC.CODIGO = F.SACADO
LEFT JOIN SIGFLS fl ON fl.ctrl_id = F.SIGFLS
${FILTROS_JOINS}
${FILTROS_WHERE}
ORDER BY ${expr} ${dir}, F.ID DESC
`;
}

export async function getComissoesParaExportacao(
  sortKey: string = DEFAULT_SORT_KEY,
  sortDir: SortDirection = "desc",
  filtros: Scoped<ComissoesFiltros>,
): Promise<ComissaoTitulo[]> {
  const [faixas, tipoMap] = await Promise.all([getFaixasOrdenadas(), getTipoComercialMap()]);
  const { expr: faixaComissaoExpr, params: faixaParams } = buildFaixaComissaoExpr(
    faixas,
    `(${JUROS_MENSAL_CASE}) * 100`,
    internoCodigosFromMap(tipoMap),
  );

  const rows = await executeReadQuery<ComissaoTitulo>(
    buildExportQuery(sortKey, sortDir, faixaComissaoExpr),
    [
      { name: "maxRows", type: sql.Int, value: EXPORT_MAX_ROWS },
      ...faixaParams,
      ...filtrosParams(filtros),
    ],
    { timeoutMs: EXPORT_TIMEOUT_MS },
  );
  return applyTipoComercial(rows, tipoMap);
}

export interface ComissaoPorComercial {
  codigoComercial: string | null;
  /** "código - nome", mesmo formato de indicanteOperador em ComissaoTitulo. */
  comercial: string | null;
  tipo: string | null;
  comissao: number;
}

// Relatório agrupado por comercial (CLAUDE.md seção 12, IA — "faça um
// relatório das comissões de todos os comerciais internos") — diferente de
// getComissoes/getComissoesParaExportacao (grão de TÍTULO, um comercial por
// vez via filtro), aqui o grão é o COMERCIAL: soma a comissão de cada
// indicante/operador dentro do universo filtrado (mesmos filtros de
// período/eixo, `filtros.comercial` deve vir vazio pra trazer todos).
// Reaproveita a MESMA regra de cálculo de comissão (Faixas dinâmicas pra
// Interno, SIGBORS.COMISSAO pra Externo — CLAUDE.md 19.6) e a MESMA
// resolução Interno/Externo via tabela usuarios — nenhuma lógica duplicada.
function buildQueryPorComercial(faixaComissaoExpr: string): string {
  const comissaoExpr = `CASE WHEN OC.codigoComercial IS NULL THEN 0 ELSE ISNULL(fl.JUROS, 0) * (${faixaComissaoExpr}) / 100.0 END`;
  return `
;WITH ${FILTROS_CTE}
SELECT
    OC.codigoComercial AS codigoComercial,
    OC.COD_COMERCIAL AS comercial,
    ISNULL(SUM(${comissaoExpr}), 0) AS comissao
FROM SIGFIDC F
LEFT JOIN SIGCAD CED ON CED.CODIGO = F.CLIFOR
LEFT JOIN SIGCAD SAC ON SAC.CODIGO = F.SACADO
LEFT JOIN SIGFLS fl ON fl.ctrl_id = F.SIGFLS
${FILTROS_JOINS}
${FILTROS_WHERE}
  AND OC.codigoComercial IS NOT NULL
GROUP BY OC.codigoComercial, OC.COD_COMERCIAL
`;
}

export async function getComissoesPorComercial(
  filtros: Scoped<ComissoesFiltros>,
  tipoFiltro: "interno" | "externo" | "todos" = "todos",
): Promise<ComissaoPorComercial[]> {
  const [faixas, tipoMap] = await Promise.all([getFaixasOrdenadas(), getTipoComercialMap()]);
  const { expr: faixaComissaoExpr, params: faixaParams } = buildFaixaComissaoExpr(
    faixas,
    `(${JUROS_MENSAL_CASE}) * 100`,
    internoCodigosFromMap(tipoMap),
  );

  const rows = await executeReadQuery<ComissaoPorComercial>(buildQueryPorComercial(faixaComissaoExpr), [
    ...faixaParams,
    ...filtrosParams(filtros),
  ]);

  const comTipo = rows.map((r) => ({
    ...r,
    tipo: r.codigoComercial ? (tipoMap.get(r.codigoComercial.trim()) ?? "Externo") : null,
  }));

  if (tipoFiltro === "todos") return comTipo;
  const alvo = tipoFiltro === "interno" ? "Interno" : "Externo";
  return comTipo.filter((r) => r.tipo === alvo);
}
