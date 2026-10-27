import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import {
  STATUS_PAGTO_CASE,
  VENCIMENTO_EFETIVO,
  SIGFIDC_CODIGOS_FIDC,
} from "./sigfidc-shared";

// Card "Prazo Médio do Estoque" (Visão Geral). Média de dias até o
// vencimento dos títulos "A Vencer", ponderada por VALOR_ — mesma fórmula do
// Power BI (DATEDIFF(hoje, VENCIMENTO) * VALOR_, dividido pela soma de
// VALOR_). VENCIMENTO usa novadata quando preenchida (ver sigfidc-shared).
// Mesmo vínculo de Comercial dos demais cards.
const QUERY = `
WITH TitulosClassificados AS (
    SELECT
        f.CLIFOR,
        f.VALOR_,
        DATEDIFF(DAY, CAST(GETDATE() AS DATE), ${VENCIMENTO_EFETIVO}) AS diasAteVencimento,
        ${STATUS_PAGTO_CASE} AS STATUS_PAGTO
    FROM SIGFIDC f
    WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
)
SELECT
    CASE
        WHEN SUM(CASE WHEN t.STATUS_PAGTO = 'A Vencer' THEN t.VALOR_ ELSE 0 END) = 0 THEN 0
        ELSE SUM(CASE WHEN t.STATUS_PAGTO = 'A Vencer' THEN t.diasAteVencimento * t.VALOR_ ELSE 0 END)
             / SUM(CASE WHEN t.STATUS_PAGTO = 'A Vencer' THEN t.VALOR_ ELSE 0 END)
    END AS prazoMedio
FROM TitulosClassificados t
LEFT JOIN CADCRED cc ON cc.clifor = t.CLIFOR
WHERE (@comercial = '' OR cc.gerenteconta = @comercial)
`;

export async function getPrazoMedioEstoque(
  comercialCodigo: Scoped<string>,
  forceRefresh = false,
): Promise<number> {
  return withCache(
    `prazo-medio-estoque:${comercialCodigo}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<{ prazoMedio: number }>(QUERY, [
        { name: "comercial", type: sql.VarChar(20), value: comercialCodigo.trim() },
      ]);
      return rows[0]?.prazoMedio ?? 0;
    },
    { forceRefresh },
  );
}
