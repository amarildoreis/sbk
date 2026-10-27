import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";

// Grupo "VOP Cedente" (Volume de Operações) do módulo Comportamental. Medida
// DAX colada pelo cliente em 2026-07-15 (Visão sempre "Todos"). Diferente
// dos grupos baseados em SIGFIDC/SIGBORS (Exposição Cedente, Tranche,
// Operações, Liquidez): aqui a DAX usa `TREATAS(VALUES(CADCRED[CLIFOR]),
// SIGFLS[CLIFOR])`, ou seja, filtra a partir de CADCRED — mesmo vínculo de
// Comercial (`CADCRED.gerenteconta`) usado em Tarifário e nas medidas de
// CADCRED de Exposição Cedente/Tranche (CLAUDE.md 21.9), não
// COD_OPERADOR_INDICANTE por borderô.
export interface VopCedenteFiltros {
  comercial?: string;
  grupoEconomico?: string;
  cedente?: string;
}

export function parseFiltrosFromSearchParams(searchParams: URLSearchParams): VopCedenteFiltros {
  return {
    comercial: searchParams.get("comercial") ?? "",
    grupoEconomico: searchParams.get("grupoEconomico") ?? "",
    cedente: searchParams.get("cedente") ?? "",
  };
}

function filtrosParams(filtros: VopCedenteFiltros) {
  return [
    { name: "comercial", type: sql.VarChar(20), value: (filtros.comercial ?? "").trim() },
    { name: "grupoEconomico", type: sql.VarChar(20), value: (filtros.grupoEconomico ?? "").trim() },
    { name: "cedente", type: sql.VarChar(20), value: (filtros.cedente ?? "").trim() },
  ];
}

export interface VopCedenteTotais {
  geral: number;
  janela30d: number;
  janela60d: number;
  janela90d: number;
}

// SIGFLS[rejeitado] <> "X" na DAX inclui linhas em branco (BLANK() <> "X" é
// TRUE no DAX) — em SQL, `<> 'X'` sozinho excluiria NULL (qualquer
// comparação com NULL é desconhecida), por isso o `OR rejeitado IS NULL`
// explícito abaixo. "Geral" não tem filtro de data (a DAX só ativa uma
// relação inativa via USERELATIONSHIP, sem slicer de data na tela pra
// propagar); as janelas 30/60/90d filtram por SIGFLS[EMISSAO].
//
// IMPORTANTE — performance: as 4 janelas são calculadas numa única passada
// sobre SIGFLS com SUM condicional (CLAUDE.md 21.12), não em CTEs somadas
// por CROSS JOIN.
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
INNER JOIN FiltroClifor ON FiltroClifor.clifor = SIGFLS.CLIFOR
WHERE (SIGFLS.rejeitado IS NULL OR SIGFLS.rejeitado <> 'X')
`;

const VAZIO: VopCedenteTotais = {
  geral: 0,
  janela30d: 0,
  janela60d: 0,
  janela90d: 0,
};

export async function getVopCedente(
  filtros: Scoped<VopCedenteFiltros>,
  forceRefresh = false,
): Promise<VopCedenteTotais> {
  return withCache(
    `comportamental-vop-cedente:${JSON.stringify(filtros)}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<VopCedenteTotais>(QUERY, filtrosParams(filtros));
      return rows[0] ?? VAZIO;
    },
    { forceRefresh },
  );
}
