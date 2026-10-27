import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import { SIGFIDC_CODIGOS_FIDC, ESTOQUE_VENCIDO_EXPR } from "./sigfidc-shared";
import { GRAFICO_ANO_MIN, GRAFICO_ANO_MAX, COMERCIAL_EXPR, type PontoMensal } from "./graficos-shared";

export { GRAFICO_ANO_MIN, GRAFICO_ANO_MAX };
export type { PontoMensal };

// Gráfico "Vencidos" (módulo Gráficos, quarto dos 7 — CLAUDE.md seção 9).
// Diverge dos demais gráficos mensualizados: em vez dos 3 radios de "Base
// de data" (Compra/Pagamento/Vencimento), tem 2 radios de "Evolução
// Acumulada" — cada mês mostra um valor ACUMULADO desde janeiro do ano
// selecionado até o fim daquele mês (não o valor isolado do mês), medidas
// DAX coladas pelo cliente em 2026-07-17:
//
// acumulado_evolucao_geral = [acumulado_digitacao] - [acumulado_pagamento]
// acumulado_vencido_evolucao = [acumulado_vencido_digitacao] - [acumulado_vencido_pgto]
//
// Onde (todas cortadas em DIGITACAO <= fim do mês, YEAR(DIGITACAO) = ano
// selecionado — e em BLANK/0 pra meses futuros, ver `zerarMesesFuturos`):
// - acumulado_digitacao = SUM(VALOR_) de títulos digitados até o mês.
// - acumulado_pagamento = idem, só os já PAGOS (DTPGTO <= fim do mês) até o mês.
// - acumulado_vencido_digitacao = idem digitação, só os com estoque_vencido='Sim'.
// - acumulado_vencido_pgto = idem pagamento, só os com estoque_vencido='Sim'
//   (ou seja, pagos só depois do vencimento).
//
// "Evolução Geral" = digitado acumulado - pago acumulado = saldo em aberto
// acumulado ao longo do ano. "Evolução Vencidos" = mesma conta, só entre os
// títulos que estão/ficaram em atraso — saldo vencido em aberto acumulado.
export type GraficoVencidosEixo = "geral" | "vencidos";

export function parseEixo(value: string | null): GraficoVencidosEixo {
  return value === "vencidos" ? "vencidos" : "geral";
}

function parseAno(value: string | null): number {
  const atual = new Date().getFullYear();
  const ano = Number(value);
  if (!Number.isInteger(ano) || ano < GRAFICO_ANO_MIN || ano > GRAFICO_ANO_MAX) {
    return Math.min(Math.max(atual, GRAFICO_ANO_MIN), GRAFICO_ANO_MAX);
  }
  return ano;
}

export interface GraficoVencidosFiltros {
  ano?: number;
  eixo?: GraficoVencidosEixo;
  comercial?: string;
  grupoEconomico?: string;
  cedente?: string;
}

export function parseFiltrosFromSearchParams(
  searchParams: URLSearchParams,
): GraficoVencidosFiltros {
  return {
    ano: parseAno(searchParams.get("ano")),
    eixo: parseEixo(searchParams.get("eixo")),
    comercial: searchParams.get("comercial") ?? "",
    grupoEconomico: searchParams.get("grupoEconomico") ?? "",
    cedente: searchParams.get("cedente") ?? "",
  };
}

const FILTROS_CTE = `
GrupoEmpresaUnico AS (
    SELECT clifor, idgrupo, ROW_NUMBER() OVER (PARTITION BY clifor ORDER BY clifor) AS RN
    FROM GrupoEmpresa
)
`;

const JOINS = `
FROM SIGFIDC F
LEFT JOIN SIGBORS B ON B.BORDERO = F.BORDERO
LEFT JOIN GrupoEmpresaUnico GEU ON GEU.clifor = F.CLIFOR AND GEU.RN = 1
`;

const BASE_WHERE = `
WHERE F.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
  AND YEAR(F.DIGITACAO) = @ano
  AND (@comercial = '' OR ${COMERCIAL_EXPR} = @comercial)
  AND (@grupoEconomico = '' OR CAST(GEU.idgrupo AS VARCHAR) = @grupoEconomico)
  AND (@cedente = '' OR CAST(F.CLIFOR AS VARCHAR) = @cedente)
`;

interface DigitacaoRow {
  mes: number;
  valorDigitacao: number;
  valorVencidoDigitacao: number;
}

interface PagamentoRow {
  mes: number;
  valorPagamento: number;
  valorVencidoPagamento: number;
}

// Bucket de "digitação" — cada título contribui pro mês da própria
// DIGITACAO (já garantido dentro do ano filtrado pelo WHERE).
function buildDigitacaoQuery() {
  return `
;WITH ${FILTROS_CTE}
SELECT
    MONTH(F.DIGITACAO) AS mes,
    ISNULL(SUM(ISNULL(F.VALOR_, 0)), 0) AS valorDigitacao,
    ISNULL(SUM(CASE WHEN ${ESTOQUE_VENCIDO_EXPR} = 'Sim' THEN ISNULL(F.VALOR_, 0) ELSE 0 END), 0) AS valorVencidoDigitacao
${JOINS}
${BASE_WHERE}
GROUP BY MONTH(F.DIGITACAO)
`;
}

// Bucket de "pagamento" — cada título pago contribui pro mês em que passou
// a contar como pago dentro da janela do ano (MAX entre o mês de digitação
// e o mês de pagamento, replicando os dois AND da medida DAX: DTPGTO <=
// DataMax E DIGITACAO <= DataMax). Títulos pagos em anos anteriores ao
// filtrado (raro/anomalia de dado) contam a partir do próprio mês de
// digitação; pagos em anos posteriores nunca entram (não há registro de
// pagamento dentro do ano corrente).
function buildPagamentoQuery() {
  return `
;WITH ${FILTROS_CTE}
SELECT
    payBucketMonth AS mes,
    ISNULL(SUM(valor), 0) AS valorPagamento,
    ISNULL(SUM(CASE WHEN estoqueVencido = 'Sim' THEN valor ELSE 0 END), 0) AS valorVencidoPagamento
FROM (
    SELECT
        ISNULL(F.VALOR_, 0) AS valor,
        ${ESTOQUE_VENCIDO_EXPR} AS estoqueVencido,
        CASE
            WHEN F.DTPGTO IS NULL THEN NULL
            WHEN YEAR(F.DTPGTO) < @ano THEN MONTH(F.DIGITACAO)
            WHEN YEAR(F.DTPGTO) = @ano THEN
                CASE WHEN MONTH(F.DTPGTO) > MONTH(F.DIGITACAO) THEN MONTH(F.DTPGTO) ELSE MONTH(F.DIGITACAO) END
            ELSE NULL
        END AS payBucketMonth
    ${JOINS}
    ${BASE_WHERE}
) X
WHERE payBucketMonth IS NOT NULL
GROUP BY payBucketMonth
`;
}

function filtrosParams(filtros: GraficoVencidosFiltros) {
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

// Soma acumulada (prefix sum) mês a mês — meses futuros (relativos a hoje)
// ficam zerados: a medida DAX original retorna BLANK() pra qualquer mês
// além do mês corrente (`AnoAtual < AnoHoje || (AnoAtual = AnoHoje &&
// MesAtual <= MesHoje)`), porque sem esse corte o acumulado de um mês
// futuro incluiria TODO título já digitado até hoje (DataMax futuro >=
// qualquer digitação já existente), inflando o gráfico. Sem esse corte
// explícito o problema não aparece "sozinho" como nos outros 3 gráficos
// (Títulos/Deságios/Comissões), porque ali cada mês soma só o que aconteceu
// NAQUELE mês — aqui é acumulado, então precisa do corte manual.
function acumularComCorteFuturo(mensal: number[], ano: number): number[] {
  const hoje = new Date();
  const anoHoje = hoje.getFullYear();
  const mesHoje = hoje.getMonth() + 1;

  let acumulado = 0;
  return mensal.map((valorDoMes, i) => {
    const mes = i + 1;
    acumulado += valorDoMes;
    const noFuturo = ano > anoHoje || (ano === anoHoje && mes > mesHoje);
    return noFuturo ? 0 : acumulado;
  });
}

export async function getGraficoVencidosMensal(
  filtros: Scoped<GraficoVencidosFiltros>,
  forceRefresh = false,
): Promise<PontoMensal[]> {
  const ano = filtros.ano ?? new Date().getFullYear();
  const eixo = filtros.eixo ?? "geral";

  return withCache(
    `graficos-vencidos:${ano}:${eixo}:${JSON.stringify({
      comercial: filtros.comercial,
      grupoEconomico: filtros.grupoEconomico,
      cedente: filtros.cedente,
    })}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const params = filtrosParams(filtros);
      const [digRows, pagRows] = await Promise.all([
        executeReadQuery<DigitacaoRow>(buildDigitacaoQuery(), params),
        executeReadQuery<PagamentoRow>(buildPagamentoQuery(), params),
      ]);

      const digPorMes = new Map(digRows.map((r) => [r.mes, r.valorDigitacao]));
      const vencDigPorMes = new Map(digRows.map((r) => [r.mes, r.valorVencidoDigitacao]));
      const pagPorMes = new Map(pagRows.map((r) => [r.mes, r.valorPagamento]));
      const vencPagPorMes = new Map(pagRows.map((r) => [r.mes, r.valorVencidoPagamento]));

      const mensalDigitacao = Array.from({ length: 12 }, (_, i) => digPorMes.get(i + 1) ?? 0);
      const mensalVencidoDigitacao = Array.from(
        { length: 12 },
        (_, i) => vencDigPorMes.get(i + 1) ?? 0,
      );
      const mensalPagamento = Array.from({ length: 12 }, (_, i) => pagPorMes.get(i + 1) ?? 0);
      const mensalVencidoPagamento = Array.from(
        { length: 12 },
        (_, i) => vencPagPorMes.get(i + 1) ?? 0,
      );

      const acumDigitacao = acumularComCorteFuturo(mensalDigitacao, ano);
      const acumPagamento = acumularComCorteFuturo(mensalPagamento, ano);
      const acumVencidoDigitacao = acumularComCorteFuturo(mensalVencidoDigitacao, ano);
      const acumVencidoPagamento = acumularComCorteFuturo(mensalVencidoPagamento, ano);

      const serie =
        eixo === "vencidos"
          ? acumVencidoDigitacao.map((v, i) => v - acumVencidoPagamento[i])
          : acumDigitacao.map((v, i) => v - acumPagamento[i]);

      return serie.map((valor, i) => ({ mes: i + 1, valor }));
    },
    { forceRefresh },
  );
}
