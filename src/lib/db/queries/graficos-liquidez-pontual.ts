import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import { STATUS_PAGTO_CASE, VENCIMENTO_EFETIVO, SIGFIDC_CODIGOS_FIDC, SIGBORS_OPERADOR_CTE } from "./sigfidc-shared";
import { GRAFICO_ANO_MIN, GRAFICO_ANO_MAX, type PontoMensal } from "./graficos-shared";

export { GRAFICO_ANO_MIN, GRAFICO_ANO_MAX };
export type { PontoMensal };

// Liquidez Pontual mensal — não existe como gráfico na tela /dashboard/
// graficos (só os 7 originais: Títulos/Deságios/Comissões/Vencidos/VOP
// Cedente/Recompra/Total Pago); criado em 2026-07-19 especificamente pra
// suprir a Interação por IA, depois do cliente pedir "gráfico mensal de
// liquidez pontual" e a IA ter respondido com o gráfico errado (nenhuma das
// 8 opções do template `graficos` cobria liquidez — CLAUDE.md seção 12).
//
// Mesma regra do grupo "Liquidez Pontual" do Comportamental
// (comportamental-liquidez-pontual.ts, "Geral" = totalPagoEmDia/totalPago),
// só que agrupada por MÊS do vencimento efetivo (SIGFIDC.DATA) em vez de um
// único total — mesmo eixo que a janela "Geral"/30/60/90d já usa pra
// filtrar (VENCIMENTO_EFETIVO), não DTPGTO nem DIGITACAO, então não tem
// ambiguidade de eixo igual Títulos/Deságios/Comissões.
export interface GraficoLiquidezPontualFiltros {
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
): GraficoLiquidezPontualFiltros {
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

const PAGO_VALOR = `CASE WHEN ${STATUS_PAGTO_CASE} IN ('Pago Em Dia', 'Pago Vencido') THEN f.VALOR_ ELSE 0 END`;
const PAGO_EM_DIA_VALOR = `CASE WHEN ${STATUS_PAGTO_CASE} = 'Pago Em Dia' THEN f.VALOR_ ELSE 0 END`;

const QUERY = `
;WITH ${FILTROS_CTE}
SELECT
    MONTH(${VENCIMENTO_EFETIVO}) AS mes,
    ISNULL(SUM(${PAGO_VALOR}), 0) AS totalPago,
    ISNULL(SUM(${PAGO_EM_DIA_VALOR}), 0) AS totalPagoEmDia
FROM SIGFIDC f
LEFT JOIN SigborsOperador SO ON SO.BORDERO = f.BORDERO
LEFT JOIN GrupoEmpresaUnico GEU ON GEU.clifor = f.CLIFOR AND GEU.RN = 1
WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
  AND ${VENCIMENTO_EFETIVO} IS NOT NULL
  AND YEAR(${VENCIMENTO_EFETIVO}) = @ano
  AND (@comercial = '' OR SO.codigoComercial = @comercial)
  AND (@grupoEconomico = '' OR CAST(GEU.idgrupo AS VARCHAR) = @grupoEconomico)
  AND (@cedente = '' OR CAST(f.CLIFOR AS VARCHAR) = @cedente)
GROUP BY MONTH(${VENCIMENTO_EFETIVO})
`;

interface LinhaMensal {
  mes: number;
  totalPago: number;
  totalPagoEmDia: number;
}

function filtrosParams(filtros: GraficoLiquidezPontualFiltros) {
  const ano = filtros.ano ?? new Date().getFullYear();
  return [
    { name: "ano", type: sql.Int, value: ano },
    { name: "comercial", type: sql.VarChar(20), value: (filtros.comercial ?? "").trim() },
    { name: "grupoEconomico", type: sql.VarChar(20), value: (filtros.grupoEconomico ?? "").trim() },
    { name: "cedente", type: sql.VarChar(20), value: (filtros.cedente ?? "").trim() },
  ];
}

// `valor` já vem em ESCALA PERCENTUAL (85.2 = 85,2%), diferente dos demais
// pontos mensais (que são valores em R$) — quem consome (templates.ts/
// mini-grafico-mensal.tsx) precisa saber tratar isso como percentual, não
// moeda.
export async function getGraficoLiquidezPontualMensal(
  filtros: Scoped<GraficoLiquidezPontualFiltros>,
  forceRefresh = false,
): Promise<PontoMensal[]> {
  const ano = filtros.ano ?? new Date().getFullYear();

  return withCache(
    `graficos-liquidez-pontual:${ano}:${JSON.stringify({
      comercial: filtros.comercial,
      grupoEconomico: filtros.grupoEconomico,
      cedente: filtros.cedente,
    })}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<LinhaMensal>(QUERY, filtrosParams(filtros));
      const porMes = new Map(rows.map((r) => [r.mes, r]));
      return Array.from({ length: 12 }, (_, i) => {
        const linha = porMes.get(i + 1);
        if (!linha || linha.totalPago === 0) return { mes: i + 1, valor: 0 };
        return { mes: i + 1, valor: (linha.totalPagoEmDia / linha.totalPago) * 100 };
      });
    },
    { forceRefresh },
  );
}
