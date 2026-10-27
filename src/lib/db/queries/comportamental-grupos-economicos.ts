import sql from "mssql";
import { executeReadQuery } from "@/lib/db/query";
import { getGruposEconomicos, type GrupoEconomico } from "./grupos-economicos";
import { SIGFIDC_CODIGOS_FIDC, SIGBORS_OPERADOR_CTE } from "./sigfidc-shared";

export type GrupoEconomicoComportamental = GrupoEconomico;

// IMPORTANTE — performance: uma CTE baseada em UNION, quando referenciada
// por outra query (ex.: JOIN ou IN-subquery a partir de cadGrupoEmpresarial,
// 267 linhas), gera um plano catastrófico no SQL Server 2008 — medido em
// 2026-07-15: a UNION isolada roda em ~380ms, mas ao virar uma CTE
// referenciada por fora vira 11-14s (timeout em produção). Mesma família de
// problema do CLAUDE.md 21.12, variante nova: aqui não é "referenciada
// múltiplas vezes", é "UNION‑CTE referenciada uma vez só, mas por uma query
// externa" — já basta pra confundir o otimizador. Correção: roda a UNION
// isolada (rápida) pra pegar só os IDs de grupo, e filtra a lista de
// cadGrupoEmpresarial (267 linhas, já cacheada por getGruposEconomicos) em
// JavaScript — nunca deixa o SQL Server juntar as duas coisas na mesma query.
const IDGRUPO_DO_COMERCIAL_QUERY = `
;WITH ${SIGBORS_OPERADOR_CTE}
SELECT DISTINCT GE.idgrupo
FROM GrupoEmpresa GE
JOIN CADCRED C ON C.clifor = GE.clifor
WHERE C.gerenteconta = @comercial
UNION
SELECT DISTINCT GE.idgrupo
FROM GrupoEmpresa GE
JOIN SIGFIDC f ON f.CLIFOR = GE.clifor
JOIN SigborsOperador SO ON SO.BORDERO = f.BORDERO
WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC} AND SO.codigoComercial = @comercial
`;

export async function getGruposEconomicosComportamental(
  comercial: string,
): Promise<GrupoEconomicoComportamental[]> {
  const todosOsGrupos = await getGruposEconomicos();

  const comercialTrim = comercial.trim();
  if (!comercialTrim) return todosOsGrupos;

  const idsDoComercial = await executeReadQuery<{ idgrupo: number }>(
    IDGRUPO_DO_COMERCIAL_QUERY,
    [{ name: "comercial", type: sql.VarChar(20), value: comercialTrim }],
  );
  const idsPermitidos = new Set(idsDoComercial.map((r) => r.idgrupo));

  return todosOsGrupos.filter((g) => idsPermitidos.has(g.id));
}
