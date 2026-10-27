import sql from "mssql";
import { executeReadQuery } from "@/lib/db/query";
import { getGruposEconomicos, type GrupoEconomico } from "./grupos-economicos";

// Efeito cascata: lista de Grupo Econômico da Carteira de Clientes filtrada
// pelo Comercial já selecionado (CADCRED.gerenteconta — único vínculo usado
// nesta tela). Mesmo cuidado de performance do CLAUDE.md 21.13: a busca dos
// IDs de grupo roda isolada (rápida) e o filtro na lista de 267 grupos
// (cacheada por getGruposEconomicos) acontece em JavaScript — nunca deixar o
// SQL Server juntar as duas coisas numa query só.
const IDGRUPO_DO_COMERCIAL_QUERY = `
SELECT DISTINCT GE.idgrupo
FROM GrupoEmpresa GE
JOIN CADCRED C ON C.clifor = GE.clifor
WHERE C.gerenteconta = @comercial
`;

export async function getGruposEconomicosCarteira(
  comercial: string,
): Promise<GrupoEconomico[]> {
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
