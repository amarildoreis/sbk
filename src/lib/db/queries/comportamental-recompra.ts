import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import {
  SIGFIDC_CODIGOS_FIDC,
  SIGBORS_OPERADOR_CTE,
  VALOR_PAGAMENTO_EXPR,
} from "./sigfidc-shared";

// Grupo "Recompra" do módulo Comportamental. Medida DAX colada pelo cliente
// em 2026-07-15 (Visão sempre "Todos"). Fonte é SIGFIDC diretamente (não
// SIGFLS/TREATAS via CADCRED como em VOP) — por isso Comercial usa o mesmo
// vínculo COD_OPERADOR_INDICANTE por borderô dos demais grupos SIGFIDC-based
// (Exposição Cedente, Tranche, Operações, Liquidez — CLAUDE.md 21.9), e
// herda o filtro padrão CODIGO IN (040,041,042,046) (CLAUDE.md 21.3).
export interface RecompraFiltros {
  comercial?: string;
  grupoEconomico?: string;
  cedente?: string;
}

export function parseFiltrosFromSearchParams(searchParams: URLSearchParams): RecompraFiltros {
  return {
    comercial: searchParams.get("comercial") ?? "",
    grupoEconomico: searchParams.get("grupoEconomico") ?? "",
    cedente: searchParams.get("cedente") ?? "",
  };
}

function filtrosParams(filtros: RecompraFiltros) {
  return [
    { name: "comercial", type: sql.VarChar(20), value: (filtros.comercial ?? "").trim() },
    { name: "grupoEconomico", type: sql.VarChar(20), value: (filtros.grupoEconomico ?? "").trim() },
    { name: "cedente", type: sql.VarChar(20), value: (filtros.cedente ?? "").trim() },
  ];
}

export interface RecompraTotais {
  total: number;
  janela30d: number;
  janela60d: number;
  janela90d: number;
}

// recompra_total: SUM(VALOR_PAGAMENTO) WHERE BANCO='01', sem filtro de
// data. Janelas 30/60/90d: mesma condição + SIGFIDC[DTPGTO] na janela.
// 4 janelas numa única passada sobre SIGFIDC (CLAUDE.md 21.12).
function janelaExpr(dias: number): string {
  const inicio = `DATEADD(DAY, -${dias + 1}, CAST(GETDATE() AS DATE))`;
  const fim = `DATEADD(DAY, -1, CAST(GETDATE() AS DATE))`;
  return `CASE WHEN CAST(f.DTPGTO AS DATE) BETWEEN ${inicio} AND ${fim} THEN ${VALOR_PAGAMENTO_EXPR} ELSE 0 END`;
}

const QUERY = `
;WITH ${SIGBORS_OPERADOR_CTE},
GrupoEmpresaUnico AS (
    SELECT clifor, idgrupo, ROW_NUMBER() OVER (PARTITION BY clifor ORDER BY clifor) AS RN
    FROM GrupoEmpresa
)
SELECT
    ISNULL(SUM(${VALOR_PAGAMENTO_EXPR}), 0) AS total,
    ISNULL(SUM(${janelaExpr(30)}), 0) AS janela30d,
    ISNULL(SUM(${janelaExpr(60)}), 0) AS janela60d,
    ISNULL(SUM(${janelaExpr(90)}), 0) AS janela90d
FROM SIGFIDC f
LEFT JOIN SigborsOperador SO ON SO.BORDERO = f.BORDERO
LEFT JOIN GrupoEmpresaUnico GEU ON GEU.clifor = f.CLIFOR AND GEU.RN = 1
WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
  AND f.BANCO = '01'
  AND (@comercial = '' OR SO.codigoComercial = @comercial)
  AND (@grupoEconomico = '' OR CAST(GEU.idgrupo AS VARCHAR) = @grupoEconomico)
  AND (@cedente = '' OR CAST(f.CLIFOR AS VARCHAR) = @cedente)
`;

const VAZIO: RecompraTotais = {
  total: 0,
  janela30d: 0,
  janela60d: 0,
  janela90d: 0,
};

export async function getRecompra(
  filtros: Scoped<RecompraFiltros>,
  forceRefresh = false,
): Promise<RecompraTotais> {
  return withCache(
    `comportamental-recompra:${JSON.stringify(filtros)}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<RecompraTotais>(QUERY, filtrosParams(filtros));
      return rows[0] ?? VAZIO;
    },
    { forceRefresh },
  );
}
