import { executeReadQuery } from "@/lib/db/query";
import { withCache } from "@/lib/db/cache";

export interface GrupoEconomico {
  id: number;
  nome: string | null;
}

const CACHE_KEY = "grupos-economicos";
const CACHE_TTL_MS = 15 * 60_000;

// Lista para os filtros "Grupo Econômico Cedente/Sacado" — cadGrupoEmpresarial
// tem só 267 linhas, cabe cacheada por inteiro (mesmo padrão de
// operadores-indicante).
const QUERY = `
SELECT ID AS id, NOME AS nome
FROM cadGrupoEmpresarial
ORDER BY NOME
`;

export async function getGruposEconomicos(): Promise<GrupoEconomico[]> {
  return withCache(CACHE_KEY, CACHE_TTL_MS, () => executeReadQuery<GrupoEconomico>(QUERY));
}
