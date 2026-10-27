import sql from "mssql";
import { executeReadQuery } from "@/lib/db/query";
import { SIGFIDC_CODIGOS_FIDC } from "./sigfidc-shared";

const MAX_RESULTS = 25;

// Busca sob demanda para o filtro "Borderô" — 15.100 valores distintos em
// SIGFIDC, grande demais pra cachear a lista inteira. Ordenado do mais
// recente pro mais antigo (número de borderô decrescente — cresce ao longo
// do tempo, então é equivalente a ordenar por data sem precisar juntar
// SIGBORS só pra isso).
// Ordena por BORDERO numérico (não pelo texto), senão "9" ficaria depois de
// "10" na ordenação alfabética.
const QUERY = `
SELECT TOP (@maxResults) BORDERO
FROM (SELECT DISTINCT BORDERO FROM SIGFIDC WHERE CODIGO IN ${SIGFIDC_CODIGOS_FIDC}) B
WHERE CAST(BORDERO AS VARCHAR) LIKE @termo
ORDER BY BORDERO DESC
`;

export async function searchBorderos(termo: string): Promise<string[]> {
  const termoLimpo = termo.trim();
  if (termoLimpo.length < 1) return [];

  const rows = await executeReadQuery<{ BORDERO: number }>(QUERY, [
    { name: "termo", type: sql.VarChar(20), value: `${termoLimpo}%` },
    { name: "maxResults", type: sql.Int, value: MAX_RESULTS },
  ]);
  return rows.map((r) => String(r.BORDERO));
}
