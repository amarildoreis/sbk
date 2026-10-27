import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery, type QueryParam } from "@/lib/db/query";
import { SIGFIDC_CODIGOS_FIDC, TIPO_PAGAMENTO_CASE } from "./sigfidc-shared";

// Base compartilhada por TODOS os gráficos mensualizados do módulo Gráficos
// (CLAUDE.md seção 9) — Títulos, Deságios e os que vierem depois. Regras
// confirmadas pelo cliente em 2026-07-16/17: "as regras são exatamente as
// mesmas [entre os gráficos], só muda o valor". Isso inclui: filtro de Ano
// (2023-2033), os 3 radios de "Base de data" (Compra/Pagamento/Vencimento,
// cada um com sua própria coluna de data + filtro de TIPO_PAGAMENTO — 19.2),
// e os filtros de Comercial/Grupo Econômico/Cedente do cabeçalho da tela.
export type GraficoEixo = "compra" | "pagamento" | "vencimento";

export const DATA_EXPR_POR_EIXO: Record<GraficoEixo, string> = {
  compra: "CAST(F.DIGITACAO AS DATE)",
  pagamento: "CAST(F.DTPGTO AS DATE)",
  vencimento: "CAST(F.DATA AS DATE)",
};

// Mudança de regra confirmada pelo cliente em 2026-07-17: só "Data de
// Pagamento" restringe a Pagamento Total. "Data de Compra" e "Data de
// Vencimento" não filtram por tipo de pagamento — pegam Pago Total, Parcial
// e Pendente (os 3 tipos possíveis, ou seja, sem filtro).
export const TIPO_PAGAMENTO_POR_EIXO: Record<GraficoEixo, string> = {
  compra: "",
  pagamento: "Pagamento Total",
  vencimento: "",
};

export function parseEixo(value: string | null): GraficoEixo {
  return value === "pagamento" || value === "vencimento" ? value : "compra";
}

export const GRAFICO_ANO_MIN = 2023;
export const GRAFICO_ANO_MAX = 2033;

export function parseAno(value: string | null): number {
  const atual = new Date().getFullYear();
  const ano = Number(value);
  if (!Number.isInteger(ano) || ano < GRAFICO_ANO_MIN || ano > GRAFICO_ANO_MAX) {
    return Math.min(Math.max(atual, GRAFICO_ANO_MIN), GRAFICO_ANO_MAX);
  }
  return ano;
}

export interface GraficoMensalFiltros {
  ano?: number;
  eixo?: GraficoEixo;
  comercial?: string;
  grupoEconomico?: string;
  cedente?: string;
}

export function parseFiltrosFromSearchParams(
  searchParams: URLSearchParams,
): GraficoMensalFiltros {
  return {
    ano: parseAno(searchParams.get("ano")),
    eixo: parseEixo(searchParams.get("eixo")),
    comercial: searchParams.get("comercial") ?? "",
    grupoEconomico: searchParams.get("grupoEconomico") ?? "",
    cedente: searchParams.get("cedente") ?? "",
  };
}

// GrupoEmpresaUnico dedup por CLIFOR (ROW_NUMBER) — mesmo padrão de
// exposicao-cedente.ts/tranche.ts. Comercial por borderô, mesma prioridade
// INDICANTE > OPERADOR de SIGBORS_OPERADOR_CTE (CLAUDE.md 21.9), calculada
// inline via LEFT JOIN SIGBORS.
const FILTROS_CTE = `
GrupoEmpresaUnico AS (
    SELECT clifor, idgrupo, ROW_NUMBER() OVER (PARTITION BY clifor ORDER BY clifor) AS RN
    FROM GrupoEmpresa
)
`;

// Comercial por borderô — mesma prioridade INDICANTE > OPERADOR de
// SIGBORS_OPERADOR_CTE (CLAUDE.md 21.9). Exportada porque também é usada
// como condição de valor em gráficos como Comissões ("COD_COMERCIAL não em
// branco" = esta expressão IS NOT NULL), não só como filtro de Comercial.
export const COMERCIAL_EXPR = `
CASE
    WHEN B.INDICANTE IS NOT NULL AND B.INDICANTE <> '' THEN B.INDICANTE
    WHEN B.OPERADOR IS NOT NULL AND B.OPERADOR <> '' THEN B.OPERADOR
    ELSE NULL
END
`;

export interface PontoMensal {
  mes: number;
  valor: number;
}

export type { QueryParam };

// Consulta genérica "valor agregado por mês" — a única coisa que muda de
// um gráfico pro outro é a expressão de valor somada (`valorExpr`, ex.
// `ISNULL(F.VALOR_, 0)` em Títulos, `ISNULL(fl.JUROS, 0)` em Deságios) e os
// JOINs extras que ela eventualmente precisa (`joinsExtra`, ex. SIGFLS pra
// JUROS). `extraParams` cobre casos como Comissões, cujo `valorExpr`
// referencia as faixas de comissão dinâmicas (parâmetros nomeados
// `@faixaMinN`/`@faixaMaxN`/`@faixaTaxaN`, montados em graficos-comissoes.ts).
// Todo o resto (filtro de ano, troca de eixo de data, filtro de tipo de
// pagamento por eixo, filtros de Comercial/Grupo Econômico/Cedente,
// preenchimento das 12 barras mesmo em meses sem valor) é idêntico entre
// todos os gráficos do módulo.
export async function getGraficoMensal(
  valorExpr: string,
  joinsExtra: string,
  filtros: Scoped<GraficoMensalFiltros>,
  extraParams: QueryParam[] = [],
): Promise<PontoMensal[]> {
  const ano = filtros.ano ?? new Date().getFullYear();
  const eixo = filtros.eixo ?? "compra";
  const dataExpr = DATA_EXPR_POR_EIXO[eixo];
  const tipoPagamento = TIPO_PAGAMENTO_POR_EIXO[eixo];

  const query = `
;WITH ${FILTROS_CTE}
SELECT MONTH(${dataExpr}) AS mes, ISNULL(SUM(${valorExpr}), 0) AS valor
FROM SIGFIDC F
LEFT JOIN SIGBORS B ON B.BORDERO = F.BORDERO
LEFT JOIN GrupoEmpresaUnico GEU ON GEU.clifor = F.CLIFOR AND GEU.RN = 1
${joinsExtra}
WHERE F.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
  AND ${dataExpr} IS NOT NULL
  AND YEAR(${dataExpr}) = @ano
  AND (@tipoPagamento = '' OR ${TIPO_PAGAMENTO_CASE} = @tipoPagamento)
  AND (@comercial = '' OR ${COMERCIAL_EXPR} = @comercial)
  AND (@grupoEconomico = '' OR CAST(GEU.idgrupo AS VARCHAR) = @grupoEconomico)
  AND (@cedente = '' OR CAST(F.CLIFOR AS VARCHAR) = @cedente)
GROUP BY MONTH(${dataExpr})
`;

  const rows = await executeReadQuery<PontoMensal>(query, [
    { name: "ano", type: sql.Int, value: ano },
    { name: "tipoPagamento", type: sql.VarChar(30), value: tipoPagamento },
    { name: "comercial", type: sql.VarChar(200), value: (filtros.comercial ?? "").trim() },
    {
      name: "grupoEconomico",
      type: sql.VarChar(200),
      value: (filtros.grupoEconomico ?? "").trim(),
    },
    { name: "cedente", type: sql.VarChar(200), value: (filtros.cedente ?? "").trim() },
    ...extraParams,
  ]);

  // Preenche as 12 barras (jan-dez) sempre, mesmo os meses sem valor nenhum
  // no período — o gráfico nunca deve "pular" um mês.
  const porMes = new Map(rows.map((r) => [r.mes, r.valor]));
  return Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    valor: porMes.get(i + 1) ?? 0,
  }));
}
