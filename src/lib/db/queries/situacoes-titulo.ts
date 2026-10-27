import { executeReadQuery } from "@/lib/db/query";
import { withCache } from "@/lib/db/cache";

const CACHE_KEY = "situacoes-titulo";
const CACHE_TTL_MS = 15 * 60_000;

// Lista para o filtro "Situação" — ESTADOCONFIRMACAOTITULO.DESCRICAO tem só
// 11 valores distintos, cabe cacheada por inteiro.
const QUERY = `
SELECT DISTINCT DESCRICAO AS descricao
FROM ESTADOCONFIRMACAOTITULO
WHERE DESCRICAO IS NOT NULL AND DESCRICAO <> ''
ORDER BY DESCRICAO
`;

export async function getSituacoesTitulo(): Promise<string[]> {
  const rows = await withCache(CACHE_KEY, CACHE_TTL_MS, () =>
    executeReadQuery<{ descricao: string }>(QUERY),
  );
  return rows.map((r) => r.descricao);
}
