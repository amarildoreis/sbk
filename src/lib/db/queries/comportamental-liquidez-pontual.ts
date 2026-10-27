import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import {
  STATUS_PAGTO_CASE,
  VENCIMENTO_EFETIVO,
  SIGFIDC_CODIGOS_FIDC,
  SIGBORS_OPERADOR_CTE,
} from "./sigfidc-shared";

// Grupo "Liquidez Pontual" do módulo Comportamental. Medidas DAX coladas
// pelo cliente em 2026-07-16 (Visão sempre "Todos", mesma decisão dos
// grupos anteriores). liquidez_pontual (Geral) = total_pago_em_dia /
// total_pago, sem filtro de data; as janelas 30/60/90d aplicam o mesmo
// DIVIDE mas restrito a SIGFIDC[VENCIMENTO] dentro da janela.
export interface LiquidezPontualFiltros {
  comercial?: string;
  grupoEconomico?: string;
  cedente?: string;
}

export function parseFiltrosFromSearchParams(
  searchParams: URLSearchParams,
): LiquidezPontualFiltros {
  return {
    comercial: searchParams.get("comercial") ?? "",
    grupoEconomico: searchParams.get("grupoEconomico") ?? "",
    cedente: searchParams.get("cedente") ?? "",
  };
}

function filtrosParams(filtros: LiquidezPontualFiltros) {
  return [
    { name: "comercial", type: sql.VarChar(20), value: (filtros.comercial ?? "").trim() },
    { name: "grupoEconomico", type: sql.VarChar(20), value: (filtros.grupoEconomico ?? "").trim() },
    { name: "cedente", type: sql.VarChar(20), value: (filtros.cedente ?? "").trim() },
  ];
}

export interface LiquidezPontualTotais {
  /** Fração (0.85 = 85%), mesma convenção de outros grupos. */
  geral: number;
  janela30d: number;
  janela60d: number;
  janela90d: number;
}

// Comercial filtra via COD_OPERADOR_INDICANTE por BORDERÔ (CLAUDE.md 21.9),
// igual aos demais grupos SIGFIDC-based do Comportamental (Exposição
// Cedente, Tranche, Operações) — não CADCRED.gerenteconta.
//
// IMPORTANTE — performance: as 4 janelas (geral/30/60/90d) são calculadas
// numa ÚNICA passada sobre SIGFIDC com SUM condicional, nunca em CTEs
// separadas somadas por CROSS JOIN (CLAUDE.md 21.12 — SQL Server 2008
// reexecuta a cadeia inteira a cada referência).
function divideExpr(numerador: string, denominador: string): string {
  return `CASE WHEN ${denominador} = 0 THEN 0 ELSE ${numerador} / ${denominador} END`;
}

function janelaExpr(condicaoValor: string, dias: number): string {
  const inicio = `DATEADD(DAY, -${dias + 1}, CAST(GETDATE() AS DATE))`;
  const fim = `DATEADD(DAY, -1, CAST(GETDATE() AS DATE))`;
  return `CASE WHEN ${VENCIMENTO_EFETIVO} BETWEEN ${inicio} AND ${fim} THEN ${condicaoValor} ELSE 0 END`;
}

const PAGO_VALOR = `CASE WHEN ${STATUS_PAGTO_CASE} IN ('Pago Em Dia', 'Pago Vencido') THEN f.VALOR_ ELSE 0 END`;
const PAGO_EM_DIA_VALOR = `CASE WHEN ${STATUS_PAGTO_CASE} = 'Pago Em Dia' THEN f.VALOR_ ELSE 0 END`;

const QUERY = `
;WITH ${SIGBORS_OPERADOR_CTE},
GrupoEmpresaUnico AS (
    SELECT clifor, idgrupo, ROW_NUMBER() OVER (PARTITION BY clifor ORDER BY clifor) AS RN
    FROM GrupoEmpresa
),
Agregados AS (
    SELECT
        ISNULL(SUM(${PAGO_VALOR}), 0) AS totalPago,
        ISNULL(SUM(${PAGO_EM_DIA_VALOR}), 0) AS totalPagoEmDia,
        ISNULL(SUM(${janelaExpr(PAGO_VALOR, 30)}), 0) AS totalPago30,
        ISNULL(SUM(${janelaExpr(PAGO_EM_DIA_VALOR, 30)}), 0) AS totalPagoEmDia30,
        ISNULL(SUM(${janelaExpr(PAGO_VALOR, 60)}), 0) AS totalPago60,
        ISNULL(SUM(${janelaExpr(PAGO_EM_DIA_VALOR, 60)}), 0) AS totalPagoEmDia60,
        ISNULL(SUM(${janelaExpr(PAGO_VALOR, 90)}), 0) AS totalPago90,
        ISNULL(SUM(${janelaExpr(PAGO_EM_DIA_VALOR, 90)}), 0) AS totalPagoEmDia90
    FROM SIGFIDC f
    LEFT JOIN SigborsOperador SO ON SO.BORDERO = f.BORDERO
    LEFT JOIN GrupoEmpresaUnico GEU ON GEU.clifor = f.CLIFOR AND GEU.RN = 1
    WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
      AND (@comercial = '' OR SO.codigoComercial = @comercial)
      AND (@grupoEconomico = '' OR CAST(GEU.idgrupo AS VARCHAR) = @grupoEconomico)
      AND (@cedente = '' OR CAST(f.CLIFOR AS VARCHAR) = @cedente)
)
SELECT
    ${divideExpr("totalPagoEmDia", "totalPago")} AS geral,
    ${divideExpr("totalPagoEmDia30", "totalPago30")} AS janela30d,
    ${divideExpr("totalPagoEmDia60", "totalPago60")} AS janela60d,
    ${divideExpr("totalPagoEmDia90", "totalPago90")} AS janela90d
FROM Agregados
`;

const VAZIO: LiquidezPontualTotais = {
  geral: 0,
  janela30d: 0,
  janela60d: 0,
  janela90d: 0,
};

export async function getLiquidezPontual(
  filtros: Scoped<LiquidezPontualFiltros>,
  forceRefresh = false,
): Promise<LiquidezPontualTotais> {
  return withCache(
    `comportamental-liquidez-pontual:${JSON.stringify(filtros)}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<LiquidezPontualTotais>(QUERY, filtrosParams(filtros));
      return rows[0] ?? VAZIO;
    },
    { forceRefresh },
  );
}
