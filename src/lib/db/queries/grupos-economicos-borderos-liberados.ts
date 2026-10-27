import sql from "mssql";
import { executeReadQuery } from "@/lib/db/query";
import { getGruposEconomicos, type GrupoEconomico } from "./grupos-economicos";

// Efeito cascata: Grupo Econômico do filtro de Borderôs Liberados,
// restringido pelo Comercial já escolhido — mesmo padrão de performance do
// CLAUDE.md 21.13 (busca os IDs isolada, filtra a lista cacheada de 267
// grupos em JavaScript). Comercial aqui vem direto de
// SIGBORS.INDICANTE/OPERADOR (a tabela-guia desta tela já é o SIGBORS).
const IDGRUPO_DO_COMERCIAL_QUERY = `
SELECT DISTINCT GE.idgrupo
FROM SIGBORS B
JOIN GrupoEmpresa GE ON GE.clifor = B.CLIFOR
WHERE B.LIBERADO = 'S'
  AND (
    CASE
        WHEN B.INDICANTE IS NOT NULL AND B.INDICANTE <> '' THEN B.INDICANTE
        WHEN B.OPERADOR IS NOT NULL AND B.OPERADOR <> '' THEN B.OPERADOR
        ELSE NULL
    END
  ) = @comercial
`;

export async function getGruposEconomicosBorderosLiberados(
  comercial: string,
): Promise<GrupoEconomico[]> {
  const todosOsGrupos = await getGruposEconomicos();

  const comercialTrim = comercial.trim();
  if (!comercialTrim) return todosOsGrupos;

  const idsDoComercial = await executeReadQuery<{ idgrupo: number }>(IDGRUPO_DO_COMERCIAL_QUERY, [
    { name: "comercial", type: sql.VarChar(20), value: comercialTrim },
  ]);
  const idsPermitidos = new Set(idsDoComercial.map((r) => r.idgrupo));

  return todosOsGrupos.filter((g) => idsPermitidos.has(g.id));
}
