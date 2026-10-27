import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";

// Grupo "VOP Sacado" do módulo Comportamental. Medida DAX colada pelo
// cliente em 2026-07-15 — idêntica a VOP Cedente (comportamental-vop-
// cedente.ts), só troca `TREATAS(VALUES(CADCRED[CLIFOR]), SIGFLS[CLIFOR])`
// por `TREATAS(VALUES(CADCRED[CLIFOR]), SIGFLS[SACADO])`: filtra SIGFLS
// pelo SACADO estar no conjunto de CLIFOR já filtrado via CADCRED (mesmo
// vínculo de Comercial `CADCRED.gerenteconta`, não COD_OPERADOR_INDICANTE —
// CLAUDE.md 21.9).
export interface VopSacadoFiltros {
  comercial?: string;
  grupoEconomico?: string;
  cedente?: string;
}

export function parseFiltrosFromSearchParams(searchParams: URLSearchParams): VopSacadoFiltros {
  return {
    comercial: searchParams.get("comercial") ?? "",
    grupoEconomico: searchParams.get("grupoEconomico") ?? "",
    cedente: searchParams.get("cedente") ?? "",
  };
}

function filtrosParams(filtros: VopSacadoFiltros) {
  return [
    { name: "comercial", type: sql.VarChar(20), value: (filtros.comercial ?? "").trim() },
    { name: "grupoEconomico", type: sql.VarChar(20), value: (filtros.grupoEconomico ?? "").trim() },
    { name: "cedente", type: sql.VarChar(20), value: (filtros.cedente ?? "").trim() },
  ];
}

export interface VopSacadoTotais {
  geral: number;
  janela30d: number;
  janela60d: number;
  janela90d: number;
}

// Mesmas observações de comportamental-vop-cedente.ts: `rejeitado <> "X"`
// inclui brancos no DAX, "Geral" sem filtro de data, janelas por
// SIGFLS[EMISSAO], 4 janelas numa única passada (CLAUDE.md 21.12).
function janelaExpr(dias: number): string {
  const inicio = `DATEADD(DAY, -${dias + 1}, CAST(GETDATE() AS DATE))`;
  const fim = `DATEADD(DAY, -1, CAST(GETDATE() AS DATE))`;
  return `CASE WHEN CAST(EMISSAO AS DATE) BETWEEN ${inicio} AND ${fim} THEN VALOR ELSE 0 END`;
}

const QUERY = `
;WITH GrupoEmpresaUnico AS (
    SELECT clifor, idgrupo, ROW_NUMBER() OVER (PARTITION BY clifor ORDER BY clifor) AS RN
    FROM GrupoEmpresa
),
FiltroClifor AS (
    SELECT CADCRED.clifor
    FROM CADCRED
    LEFT JOIN GrupoEmpresaUnico GEU ON GEU.clifor = CADCRED.clifor AND GEU.RN = 1
    WHERE (@comercial = '' OR CADCRED.gerenteconta = @comercial)
      AND (@grupoEconomico = '' OR CAST(GEU.idgrupo AS VARCHAR) = @grupoEconomico)
      AND (@cedente = '' OR CAST(CADCRED.clifor AS VARCHAR) = @cedente)
)
SELECT
    ISNULL(SUM(VALOR), 0) AS geral,
    ISNULL(SUM(${janelaExpr(30)}), 0) AS janela30d,
    ISNULL(SUM(${janelaExpr(60)}), 0) AS janela60d,
    ISNULL(SUM(${janelaExpr(90)}), 0) AS janela90d
FROM SIGFLS
INNER JOIN FiltroClifor ON FiltroClifor.clifor = SIGFLS.SACADO
WHERE (SIGFLS.rejeitado IS NULL OR SIGFLS.rejeitado <> 'X')
`;

const VAZIO: VopSacadoTotais = {
  geral: 0,
  janela30d: 0,
  janela60d: 0,
  janela90d: 0,
};

export async function getVopSacado(
  filtros: Scoped<VopSacadoFiltros>,
  forceRefresh = false,
): Promise<VopSacadoTotais> {
  return withCache(
    `comportamental-vop-sacado:${JSON.stringify(filtros)}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<VopSacadoTotais>(QUERY, filtrosParams(filtros));
      return rows[0] ?? VAZIO;
    },
    { forceRefresh },
  );
}
