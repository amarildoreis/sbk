import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import { STATUS_PAGTO_CASE, SIGFIDC_CODIGOS_FIDC } from "./sigfidc-shared";

// Card "Risco - Cedente" (Dashboard > Comercial - Visão Geral). Soma
// SIGFIDC.VALOR_ dos títulos cujo STATUS_PAGTO ainda representa exposição em
// aberto (Vencido ou A Vencer — tudo que não é Pago Em Dia/Pago Vencido).
// O filtro de Comercial usa o mesmo vínculo do card Limite de Crédito:
// CADCRED.gerenteconta, ligado por CLIFOR (LEFT JOIN para não perder títulos
// de cedentes sem linha em CADCRED quando nenhum comercial está selecionado).
const QUERY = `
WITH TitulosClassificados AS (
    SELECT
        f.CLIFOR,
        f.VALOR_,
        ${STATUS_PAGTO_CASE} AS STATUS_PAGTO
    FROM SIGFIDC f
    WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
)
SELECT ISNULL(SUM(t.VALOR_), 0) AS risco
FROM TitulosClassificados t
LEFT JOIN CADCRED cc ON cc.clifor = t.CLIFOR
WHERE t.STATUS_PAGTO NOT IN ('Pago Em Dia', 'Pago Vencido')
  AND (@comercial = '' OR cc.gerenteconta = @comercial)
`;

export async function getRiscoCedente(
  comercialCodigo: Scoped<string>,
  forceRefresh = false,
): Promise<number> {
  return withCache(
    `risco-cedente:${comercialCodigo}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<{ risco: number }>(QUERY, [
        { name: "comercial", type: sql.VarChar(20), value: comercialCodigo.trim() },
      ]);
      return rows[0]?.risco ?? 0;
    },
    { forceRefresh },
  );
}
