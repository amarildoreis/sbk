import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";

// "Quantidade de Sacados" do módulo Comportamental. Medida DAX colada pelo
// cliente em 2026-07-15:
//
//   qtde_sacados = CALCULATE(
//       DISTINCTCOUNT(SIGFLS[SACADO]),
//       TREATAS(VALUES(CADCRED[CLIFOR]), SIGFLS[CLIFOR])
//   ) + 0
//
// Mesmo padrão de VOP Cedente/Sacado (comportamental-vop-cedente.ts):
// TREATAS a partir de CADCRED, então Comercial usa CADCRED.gerenteconta
// (CLAUDE.md 21.9), não COD_OPERADOR_INDICANTE. Sem filtro de `rejeitado`
// aqui — a DAX não menciona.
export interface QuantidadeSacadosFiltros {
  comercial?: string;
  grupoEconomico?: string;
  cedente?: string;
}

export function parseFiltrosFromSearchParams(
  searchParams: URLSearchParams,
): QuantidadeSacadosFiltros {
  return {
    comercial: searchParams.get("comercial") ?? "",
    grupoEconomico: searchParams.get("grupoEconomico") ?? "",
    cedente: searchParams.get("cedente") ?? "",
  };
}

export interface QuantidadeSacadosTotais {
  quantidade: number;
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
SELECT ISNULL(COUNT(DISTINCT SIGFLS.SACADO), 0) AS quantidade
FROM SIGFLS
INNER JOIN FiltroClifor ON FiltroClifor.clifor = SIGFLS.CLIFOR
`;

function filtrosParams(filtros: QuantidadeSacadosFiltros) {
  return [
    { name: "comercial", type: sql.VarChar(20), value: (filtros.comercial ?? "").trim() },
    { name: "grupoEconomico", type: sql.VarChar(20), value: (filtros.grupoEconomico ?? "").trim() },
    { name: "cedente", type: sql.VarChar(20), value: (filtros.cedente ?? "").trim() },
  ];
}

export async function getQuantidadeSacados(
  filtros: Scoped<QuantidadeSacadosFiltros>,
  forceRefresh = false,
): Promise<QuantidadeSacadosTotais> {
  return withCache(
    `comportamental-quantidade-sacados:${JSON.stringify(filtros)}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<QuantidadeSacadosTotais>(QUERY, filtrosParams(filtros));
      return rows[0] ?? { quantidade: 0 };
    },
    { forceRefresh },
  );
}
