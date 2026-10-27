import sql from "mssql";
import { executeReadQuery } from "@/lib/db/query";
import { getGruposEconomicos, type GrupoEconomico } from "./grupos-economicos";
import { SIGFIDC_CODIGOS_FIDC, SIGBORS_OPERADOR_CTE } from "./sigfidc-shared";

// Efeito cascata: listas de Grupo Econômico Cedente/Sacado do Relatório
// Analítico de Títulos, filtradas pelo Comercial já selecionado
// (COD_OPERADOR_INDICANTE por borderô — único vínculo de comercial usado
// nesta tela). Mesmo cuidado de performance do CLAUDE.md 21.13: a busca dos
// IDs de grupo roda isolada (rápida) e o filtro na lista de 267 grupos
// (cacheada por getGruposEconomicos) acontece em JavaScript.
const IDGRUPO_CEDENTE_DO_COMERCIAL_QUERY = `
;WITH ${SIGBORS_OPERADOR_CTE}
SELECT DISTINCT GE.idgrupo
FROM SIGFIDC f
JOIN SigborsOperador SO ON SO.BORDERO = f.BORDERO
JOIN GrupoEmpresa GE ON GE.clifor = f.CLIFOR
WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC} AND SO.codigoComercial = @comercial
`;

const IDGRUPO_SACADO_DO_COMERCIAL_QUERY = `
;WITH ${SIGBORS_OPERADOR_CTE}
SELECT DISTINCT GE.idgrupo
FROM SIGFIDC f
JOIN SigborsOperador SO ON SO.BORDERO = f.BORDERO
JOIN GrupoEmpresa GE ON GE.clifor = f.SACADO
WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC} AND SO.codigoComercial = @comercial
`;

async function filtrarGruposPorComercial(
  comercial: string,
  query: string,
): Promise<GrupoEconomico[]> {
  const todosOsGrupos = await getGruposEconomicos();

  const comercialTrim = comercial.trim();
  if (!comercialTrim) return todosOsGrupos;

  const idsDoComercial = await executeReadQuery<{ idgrupo: number }>(query, [
    { name: "comercial", type: sql.VarChar(20), value: comercialTrim },
  ]);
  const idsPermitidos = new Set(idsDoComercial.map((r) => r.idgrupo));

  return todosOsGrupos.filter((g) => idsPermitidos.has(g.id));
}

export async function getGruposEconomicosCedenteTitulos(
  comercial: string,
): Promise<GrupoEconomico[]> {
  return filtrarGruposPorComercial(comercial, IDGRUPO_CEDENTE_DO_COMERCIAL_QUERY);
}

export async function getGruposEconomicosSacadoTitulos(
  comercial: string,
): Promise<GrupoEconomico[]> {
  return filtrarGruposPorComercial(comercial, IDGRUPO_SACADO_DO_COMERCIAL_QUERY);
}
