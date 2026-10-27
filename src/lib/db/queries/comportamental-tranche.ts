import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import {
  STATUS_PAGTO_CASE,
  SIGFIDC_CODIGOS_FIDC,
  SIGBORS_OPERADOR_CTE,
} from "./sigfidc-shared";

// Grupo "Tranche" do módulo Comportamental. Medidas DAX coladas pelo cliente
// em 2026-07-14 (Visão sempre "Todos", mesma decisão do grupo Exposição
// Cedente).
export interface TrancheFiltros {
  comercial?: string;
  grupoEconomico?: string;
  cedente?: string;
}

export function parseFiltrosFromSearchParams(searchParams: URLSearchParams): TrancheFiltros {
  return {
    comercial: searchParams.get("comercial") ?? "",
    grupoEconomico: searchParams.get("grupoEconomico") ?? "",
    cedente: searchParams.get("cedente") ?? "",
  };
}

function filtrosParams(filtros: TrancheFiltros) {
  return [
    { name: "comercial", type: sql.VarChar(20), value: (filtros.comercial ?? "").trim() },
    { name: "grupoEconomico", type: sql.VarChar(20), value: (filtros.grupoEconomico ?? "").trim() },
    { name: "cedente", type: sql.VarChar(20), value: (filtros.cedente ?? "").trim() },
  ];
}

export interface TrancheTotais {
  limite: number;
  tomada: number;
  tomadaQtd: number;
  disponivel: number;
  aVencer: number;
  aVencerQtd: number;
  vencida: number;
  vencidaQtd: number;
  diasPrazo: number;
}

// SIGFIDC[SITUACAO] no DAX = ESTADOCONFIRMACAOTITULO.DESCRICAO via
// SIGFLS.ESTADOCONFIRMACAOTITULO_ID (mesmo mapeamento já usado na coluna
// "Tranche" de Carteira de Clientes, CLAUDE.md 19.8).
//
// SIGFIDC[StatusTranche] (CLAUDE.md 19.5, CORRIGIDO em 2026-07-16):
// DataFuturaTranche = DATEADD(DAY, ISNULL(CADCRED.PrazoLimiteConfirmacaoDe
// Titulos, 0), CAST(SIGBORS.DATA AS DATE)) via SIGFIDC.BORDERO — confirmado
// pelo script SQL de origem colado pelo cliente. A versão anterior (sem
// ISNULL, usando SIGFLS.DTBORDERO em vez de SIGBORS.DATA) tinha um bug real:
// quando CADCRED.PrazoLimiteConfirmacaoDeTitulos é NULL pro cedente (não é
// raro — ex: cedente 249/UZUCLEAN), DATEADD(DAY, NULL, ...) retorna NULL, a
// comparação `NULL >= GETDATE()` nunca é verdadeira, e o CASE cai no ELSE —
// classificando TODOS os títulos de tranche daquele cedente como "Vencido"
// mesmo quando deveriam ser "A Vencer". Descoberto ao validar a coluna
// "Vencimento Tranche" de Exposição Cedente (mesma fórmula, mesmo bug) —
// ver exposicao-cedente.ts. StatusTranche = "A Vencer" se DataFuturaTranche
// >= hoje, senão "Vencido". Comparação por data (sem horário), mesmo padrão
// de STATUS_PAGTO_CASE.
//
// Comercial tem dois vínculos diferentes (CLAUDE.md 21.9): Limite/DiasPrazo
// (CADCRED) filtram via CADCRED.gerenteconta; Titulos (SIGFIDC) filtra via
// COD_OPERADOR_INDICANTE por BORDERÔ (SIGBORS_OPERADOR_CTE).
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
Limite AS (
    SELECT ISNULL(SUM(CADCRED.TrancheLimiteFIDC), 0) AS trancheLimite
    FROM CADCRED
    INNER JOIN FiltroClifor ON FiltroClifor.clifor = CADCRED.clifor
),
DiasPrazo AS (
    SELECT ISNULL(SUM(CADCRED.PrazoLimiteConfirmacaoDeTitulos), 0) AS diasPrazo
    FROM CADCRED
    INNER JOIN FiltroClifor ON FiltroClifor.clifor = CADCRED.clifor
),
Titulos AS (
    SELECT
        f.VALOR_,
        f.DCTO,
        CASE
            WHEN DATEADD(DAY, ISNULL(CADCRED.PrazoLimiteConfirmacaoDeTitulos, 0), CAST(B.DATA AS DATE)) >= CAST(GETDATE() AS DATE)
                THEN 'A Vencer'
            ELSE 'Vencido'
        END AS statusTranche
    FROM SIGFIDC f
    LEFT JOIN CADCRED ON CADCRED.clifor = f.CLIFOR
    LEFT JOIN SIGFLS fl ON fl.ctrl_id = f.SIGFLS
    LEFT JOIN SIGBORS B ON B.BORDERO = f.BORDERO
    LEFT JOIN ESTADOCONFIRMACAOTITULO ECT ON ECT.CTRL_ID = fl.ESTADOCONFIRMACAOTITULO_ID
    LEFT JOIN SigborsOperador SO ON SO.BORDERO = f.BORDERO
    LEFT JOIN GrupoEmpresaUnico GEU2 ON GEU2.clifor = f.CLIFOR AND GEU2.RN = 1
    WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
      AND ${STATUS_PAGTO_CASE} = 'A Vencer'
      AND ECT.DESCRICAO = 'A Confirmar'
      AND (@comercial = '' OR SO.codigoComercial = @comercial)
      AND (@grupoEconomico = '' OR CAST(GEU2.idgrupo AS VARCHAR) = @grupoEconomico)
      AND (@cedente = '' OR CAST(f.CLIFOR AS VARCHAR) = @cedente)
),
Tomada AS (
    SELECT
        ISNULL(SUM(VALOR_), 0) AS tomada,
        ISNULL(SUM(CASE WHEN DCTO IS NOT NULL THEN 1 ELSE 0 END), 0) AS tomadaQtd,
        ISNULL(SUM(CASE WHEN statusTranche = 'A Vencer' THEN VALOR_ ELSE 0 END), 0) AS aVencer,
        ISNULL(SUM(CASE WHEN statusTranche = 'A Vencer' AND DCTO IS NOT NULL THEN 1 ELSE 0 END), 0) AS aVencerQtd,
        ISNULL(SUM(CASE WHEN statusTranche = 'Vencido' THEN VALOR_ ELSE 0 END), 0) AS vencida,
        ISNULL(SUM(CASE WHEN statusTranche = 'Vencido' AND DCTO IS NOT NULL THEN 1 ELSE 0 END), 0) AS vencidaQtd
    FROM Titulos
)
SELECT
    Limite.trancheLimite AS limite,
    Tomada.tomada,
    Tomada.tomadaQtd,
    (Limite.trancheLimite - Tomada.tomada) AS disponivel,
    Tomada.aVencer,
    Tomada.aVencerQtd,
    Tomada.vencida AS vencida,
    Tomada.vencidaQtd,
    DiasPrazo.diasPrazo
FROM Limite
CROSS JOIN Tomada
CROSS JOIN DiasPrazo
`;

const VAZIO: TrancheTotais = {
  limite: 0,
  tomada: 0,
  tomadaQtd: 0,
  disponivel: 0,
  aVencer: 0,
  aVencerQtd: 0,
  vencida: 0,
  vencidaQtd: 0,
  diasPrazo: 0,
};

export async function getTranche(
  filtros: Scoped<TrancheFiltros>,
  forceRefresh = false,
): Promise<TrancheTotais> {
  return withCache(
    `comportamental-tranche:${JSON.stringify(filtros)}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<TrancheTotais>(QUERY, filtrosParams(filtros));
      return rows[0] ?? VAZIO;
    },
    { forceRefresh },
  );
}
