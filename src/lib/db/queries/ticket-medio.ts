import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import {
  STATUS_PAGTO_CASE,
  TIPO_PAGAMENTO_CASE,
  SIGFIDC_CODIGOS_FIDC,
} from "./sigfidc-shared";

export interface TicketMedio {
  geral: number;
  estoque: number;
}

// Cards "Ticket Médio - Geral / Do Estoque" (Visão Geral). Média simples de
// VALOR_ por título — "Geral" sobre todos os títulos, "Do Estoque" só os
// ainda em aberto (A Vencer/Vencido) ou com pagamento parcial. Mesmo vínculo
// de Comercial dos demais cards.
const QUERY = `
WITH TitulosClassificados AS (
    SELECT
        f.CLIFOR,
        f.VALOR_,
        ${STATUS_PAGTO_CASE} AS STATUS_PAGTO,
        ${TIPO_PAGAMENTO_CASE} AS TIPO_PAGAMENTO
    FROM SIGFIDC f
    WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
),
Filtrado AS (
    SELECT t.*
    FROM TitulosClassificados t
    LEFT JOIN CADCRED cc ON cc.clifor = t.CLIFOR
    WHERE (@comercial = '' OR cc.gerenteconta = @comercial)
)
SELECT
    ISNULL(AVG(VALOR_), 0) AS geral,
    ISNULL(AVG(CASE WHEN STATUS_PAGTO IN ('A Vencer', 'Vencido') OR TIPO_PAGAMENTO = 'Pagamento Parcial' THEN VALOR_ END), 0) AS estoque
FROM Filtrado
`;

export async function getTicketMedio(
  comercialCodigo: Scoped<string>,
  forceRefresh = false,
): Promise<TicketMedio> {
  return withCache(
    `ticket-medio:${comercialCodigo}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<TicketMedio>(QUERY, [
        { name: "comercial", type: sql.VarChar(20), value: comercialCodigo.trim() },
      ]);
      return rows[0] ?? { geral: 0, estoque: 0 };
    },
    { forceRefresh },
  );
}
