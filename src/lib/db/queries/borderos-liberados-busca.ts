import sql from "mssql";
import { executeReadQuery } from "@/lib/db/query";

const MAX_RESULTS = 25;

// Busca sob demanda para o filtro "Borderô" de Borderôs Liberados — escopada
// à tabela-guia desta tela (SIGBORS com LIBERADO = 'S'), não a SIGFIDC como
// em Títulos/Comissões (universo diferente).
const QUERY = `
SELECT TOP (@maxResults) BORDERO
FROM (SELECT DISTINCT BORDERO FROM SIGBORS WHERE LIBERADO = 'S') B
WHERE CAST(BORDERO AS VARCHAR) LIKE @termo
ORDER BY BORDERO DESC
`;

export async function searchBorderosLiberados(termo: string): Promise<string[]> {
  const termoLimpo = termo.trim();
  if (termoLimpo.length < 1) return [];

  const rows = await executeReadQuery<{ BORDERO: number }>(QUERY, [
    { name: "termo", type: sql.VarChar(20), value: `${termoLimpo}%` },
    { name: "maxResults", type: sql.Int, value: MAX_RESULTS },
  ]);
  return rows.map((r) => String(r.BORDERO));
}
