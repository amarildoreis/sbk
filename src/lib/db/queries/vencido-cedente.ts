import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import { STATUS_PAGTO_CASE, SIGFIDC_CODIGOS_FIDC } from "./sigfidc-shared";

// Card "Vencido - Cedente" (Dashboard > Comercial - Visão Geral). Soma
// SIGFIDC.VALOR_ dos títulos com STATUS_PAGTO = 'Vencido'. Mesmo vínculo de
// Comercial dos demais cards: CADCRED.gerenteconta via CLIFOR.
const QUERY = `
WITH TitulosClassificados AS (
    SELECT
        f.CLIFOR,
        f.VALOR_,
        ${STATUS_PAGTO_CASE} AS STATUS_PAGTO
    FROM SIGFIDC f
    WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
)
SELECT ISNULL(SUM(t.VALOR_), 0) AS vencido
FROM TitulosClassificados t
LEFT JOIN CADCRED cc ON cc.clifor = t.CLIFOR
WHERE t.STATUS_PAGTO = 'Vencido'
  AND (@comercial = '' OR cc.gerenteconta = @comercial)
`;

export async function getVencidoCedente(
  comercialCodigo: Scoped<string>,
  forceRefresh = false,
): Promise<number> {
  return withCache(
    `vencido-cedente:${comercialCodigo}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<{ vencido: number }>(QUERY, [
        { name: "comercial", type: sql.VarChar(20), value: comercialCodigo.trim() },
      ]);
      return rows[0]?.vencido ?? 0;
    },
    { forceRefresh },
  );
}
