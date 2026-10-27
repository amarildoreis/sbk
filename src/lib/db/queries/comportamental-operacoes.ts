import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import { SIGFIDC_CODIGOS_FIDC, SIGBORS_OPERADOR_CTE } from "./sigfidc-shared";

// Grupo "Operações" do módulo Comportamental. Medidas DAX coladas pelo
// cliente em 2026-07-15. Prazo Mínimo/Máximo (SUM sobre CADCRED) só fazem
// sentido de verdade com Cedente/Grupo Econômico filtrado — mesma ressalva
// já feita em Tarifário.
export interface OperacoesFiltros {
  comercial?: string;
  grupoEconomico?: string;
  cedente?: string;
}

export function parseFiltrosFromSearchParams(searchParams: URLSearchParams): OperacoesFiltros {
  return {
    comercial: searchParams.get("comercial") ?? "",
    grupoEconomico: searchParams.get("grupoEconomico") ?? "",
    cedente: searchParams.get("cedente") ?? "",
  };
}

function filtrosParams(filtros: OperacoesFiltros) {
  return [
    { name: "comercial", type: sql.VarChar(20), value: (filtros.comercial ?? "").trim() },
    { name: "grupoEconomico", type: sql.VarChar(20), value: (filtros.grupoEconomico ?? "").trim() },
    { name: "cedente", type: sql.VarChar(20), value: (filtros.cedente ?? "").trim() },
  ];
}

export interface OperacoesTotais {
  prazoMinimo: number;
  prazoMedioGeral: number;
  prazoMedio30d: number;
  prazoMedio60d: number;
  prazoMedio90d: number;
  prazoMaximo: number;
  ticketMedio: number;
  borderoMedio: number;
}

// Prazo Médio (geral e por janela de dias) é uma média ponderada de
// SIGBORS[titulosFIDC] * (SIGBORS[flotmedioFIDC] + SIGBORS[prazoFIDC]) sobre
// os borderôs presentes em SIGFIDC no contexto filtrado — não uma média
// simples. SIGFIDC[DATA_BORDERO] (usado nas janelas 30/60/90d) não existe
// fisicamente em SIGFIDC (mesma observação já registrada pra "ultima_data"
// em Carteira de Clientes, CLAUDE.md 19.8): é SIGBORS.DATA por BORDERO.
//
// IMPORTANTE — performance: as 4 janelas (geral/30/60/90d) precisam ser
// calculadas em UMA ÚNICA passada sobre SigborsBase (SUM condicional com
// CASE WHEN), não em CTEs separadas somadas por CROSS JOIN. O SQL Server
// 2008 reinlina/reavalia toda a cadeia FiltroClifor→Universo→BorderosBase→
// SigborsBase a cada referência à mesma CTE — medido em 2026-07-16: 1
// referência = ~400ms, 2 referências = ~7s, 4 referências = timeout (>20s),
// mesmo com poucas linhas envolvidas (SIGBORS tem só ~28 mil linhas). A
// versão de passada única roda em ~200ms em qualquer cenário de filtro.
//
// Comercial tem dois vínculos diferentes (CLAUDE.md 21.9): Prazos (CADCRED)
// filtra via CADCRED.gerenteconta; Ticket/BorderosBase (SIGFIDC) filtram via
// COD_OPERADOR_INDICANTE por BORDERÔ (SIGBORS_OPERADOR_CTE) — igual
// BorderosFiltrados = VALUES(SIGFIDC[BORDERO]) na DAX, que herda o contexto
// de filtro corrente (inclusive Comercial via COD_OPERADOR_INDICANTE).
function weightedAvgExpr(sumTitulosCol: string, sumPesoCol: string): string {
  return `CASE WHEN ${sumTitulosCol} = 0 THEN 0 ELSE ${sumPesoCol} / ${sumTitulosCol} END`;
}

function janelaExpr(coluna: string, dias: number): string {
  const inicio = `DATEADD(DAY, -${dias + 1}, CAST(GETDATE() AS DATE))`;
  const fim = `DATEADD(DAY, -1, CAST(GETDATE() AS DATE))`;
  return `CASE WHEN CAST(DATA AS DATE) BETWEEN ${inicio} AND ${fim} THEN ${coluna} ELSE 0 END`;
}

const QUERY = `
;WITH ${SIGBORS_OPERADOR_CTE},
GrupoEmpresaUnico AS (
    SELECT clifor, idgrupo, ROW_NUMBER() OVER (PARTITION BY clifor ORDER BY clifor) AS RN
    FROM GrupoEmpresa
),
Universo AS (
    SELECT clifor FROM CADCRED
    UNION
    SELECT CLIFOR FROM SIGFIDC WHERE CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
),
FiltroClifor AS (
    SELECT Universo.clifor
    FROM Universo
    LEFT JOIN CADCRED ON CADCRED.clifor = Universo.clifor
    LEFT JOIN GrupoEmpresaUnico GEU ON GEU.clifor = Universo.clifor AND GEU.RN = 1
    WHERE (@comercial = '' OR CADCRED.gerenteconta = @comercial)
      AND (@grupoEconomico = '' OR CAST(GEU.idgrupo AS VARCHAR) = @grupoEconomico)
      AND (@cedente = '' OR CAST(Universo.clifor AS VARCHAR) = @cedente)
),
Prazos AS (
    SELECT
        ISNULL(SUM(CADCRED.pzminimofidc), 0) AS prazoMinimo,
        ISNULL(SUM(CADCRED.pzmaximofidc), 0) AS prazoMaximo
    FROM CADCRED
    INNER JOIN FiltroClifor ON FiltroClifor.clifor = CADCRED.clifor
),
Ticket AS (
    SELECT ISNULL(AVG(f.VALOR_), 0) AS ticketMedio
    FROM SIGFIDC f
    LEFT JOIN SigborsOperador SO ON SO.BORDERO = f.BORDERO
    LEFT JOIN GrupoEmpresaUnico GEU2 ON GEU2.clifor = f.CLIFOR AND GEU2.RN = 1
    WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
      AND (@comercial = '' OR SO.codigoComercial = @comercial)
      AND (@grupoEconomico = '' OR CAST(GEU2.idgrupo AS VARCHAR) = @grupoEconomico)
      AND (@cedente = '' OR CAST(f.CLIFOR AS VARCHAR) = @cedente)
),
BorderosBase AS (
    SELECT DISTINCT f.BORDERO
    FROM SIGFIDC f
    LEFT JOIN SigborsOperador SO ON SO.BORDERO = f.BORDERO
    LEFT JOIN GrupoEmpresaUnico GEU3 ON GEU3.clifor = f.CLIFOR AND GEU3.RN = 1
    WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
      AND (@comercial = '' OR SO.codigoComercial = @comercial)
      AND (@grupoEconomico = '' OR CAST(GEU3.idgrupo AS VARCHAR) = @grupoEconomico)
      AND (@cedente = '' OR CAST(f.CLIFOR AS VARCHAR) = @cedente)
),
SigborsBase AS (
    SELECT SB.DATA, SB.titulosFIDC, SB.flotmedioFIDC, SB.prazoFIDC
    FROM SIGBORS SB
    INNER JOIN BorderosBase BB ON BB.BORDERO = SB.BORDERO
),
Agregados AS (
    SELECT
        ISNULL(SUM(titulosFIDC), 0) AS somaTitulosGeral,
        ISNULL(SUM(titulosFIDC * (flotmedioFIDC + prazoFIDC)), 0) AS somaPesoGeral,
        ISNULL(AVG(titulosFIDC), 0) AS borderoMedio,
        ISNULL(SUM(${janelaExpr("titulosFIDC", 30)}), 0) AS somaTitulos30,
        ISNULL(SUM(${janelaExpr("titulosFIDC * (flotmedioFIDC + prazoFIDC)", 30)}), 0) AS somaPeso30,
        ISNULL(SUM(${janelaExpr("titulosFIDC", 60)}), 0) AS somaTitulos60,
        ISNULL(SUM(${janelaExpr("titulosFIDC * (flotmedioFIDC + prazoFIDC)", 60)}), 0) AS somaPeso60,
        ISNULL(SUM(${janelaExpr("titulosFIDC", 90)}), 0) AS somaTitulos90,
        ISNULL(SUM(${janelaExpr("titulosFIDC * (flotmedioFIDC + prazoFIDC)", 90)}), 0) AS somaPeso90
    FROM SigborsBase
)
SELECT
    Prazos.prazoMinimo,
    ${weightedAvgExpr("Agregados.somaTitulosGeral", "Agregados.somaPesoGeral")} AS prazoMedioGeral,
    ${weightedAvgExpr("Agregados.somaTitulos30", "Agregados.somaPeso30")} AS prazoMedio30d,
    ${weightedAvgExpr("Agregados.somaTitulos60", "Agregados.somaPeso60")} AS prazoMedio60d,
    ${weightedAvgExpr("Agregados.somaTitulos90", "Agregados.somaPeso90")} AS prazoMedio90d,
    Prazos.prazoMaximo,
    Ticket.ticketMedio,
    Agregados.borderoMedio
FROM Prazos
CROSS JOIN Ticket
CROSS JOIN Agregados
`;

const VAZIO: OperacoesTotais = {
  prazoMinimo: 0,
  prazoMedioGeral: 0,
  prazoMedio30d: 0,
  prazoMedio60d: 0,
  prazoMedio90d: 0,
  prazoMaximo: 0,
  ticketMedio: 0,
  borderoMedio: 0,
};

export async function getOperacoes(
  filtros: Scoped<OperacoesFiltros>,
  forceRefresh = false,
): Promise<OperacoesTotais> {
  return withCache(
    `comportamental-operacoes:${JSON.stringify(filtros)}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<OperacoesTotais>(QUERY, filtrosParams(filtros));
      return rows[0] ?? VAZIO;
    },
    { forceRefresh },
  );
}
