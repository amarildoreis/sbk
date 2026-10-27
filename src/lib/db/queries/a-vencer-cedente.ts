import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import { STATUS_PAGTO_CASE, SIGFIDC_CODIGOS_FIDC } from "./sigfidc-shared";

// Card "A Vencer - Cedente" (Dashboard > Comercial - Visão Geral). Soma
// SIGFIDC.VALOR_ dos títulos com STATUS_PAGTO = 'A Vencer'. Mesmo vínculo de
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
SELECT ISNULL(SUM(t.VALOR_), 0) AS aVencer
FROM TitulosClassificados t
LEFT JOIN CADCRED cc ON cc.clifor = t.CLIFOR
WHERE t.STATUS_PAGTO = 'A Vencer'
  AND (@comercial = '' OR cc.gerenteconta = @comercial)
`;

export async function getAVencerCedente(
  comercialCodigo: Scoped<string>,
  forceRefresh = false,
): Promise<number> {
  return withCache(
    `a-vencer-cedente:${comercialCodigo}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<{ aVencer: number }>(QUERY, [
        { name: "comercial", type: sql.VarChar(20), value: comercialCodigo.trim() },
      ]);
      return rows[0]?.aVencer ?? 0;
    },
    { forceRefresh },
  );
}
