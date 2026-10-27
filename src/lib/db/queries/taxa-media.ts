import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import {
  STATUS_PAGTO_CASE,
  TIPO_PAGAMENTO_CASE,
  JUROS_MENSAL_CASE,
  SIGFIDC_CODIGOS_FIDC,
} from "./sigfidc-shared";

export interface TaxaMedia {
  geral: number;
  estoque: number;
}

// Cards "Taxa Média - Geral / Do Estoque" (Visão Geral). Média de
// JUROS_MENSAL ponderada por VALOR_. "Geral" considera todos os títulos;
// "Do Estoque" só os ainda em aberto (A Vencer/Vencido) ou com pagamento
// parcial. Mesmo vínculo de Comercial dos demais cards.
const QUERY = `
WITH TitulosClassificados AS (
    SELECT
        f.CLIFOR,
        f.VALOR_,
        ${STATUS_PAGTO_CASE} AS STATUS_PAGTO,
        ${TIPO_PAGAMENTO_CASE} AS TIPO_PAGAMENTO,
        ${JUROS_MENSAL_CASE} AS JUROS_MENSAL
    FROM SIGFIDC f
    LEFT JOIN SIGFLS fl ON fl.ctrl_id = f.SIGFLS
    WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
),
Filtrado AS (
    SELECT t.*
    FROM TitulosClassificados t
    LEFT JOIN CADCRED cc ON cc.clifor = t.CLIFOR
    WHERE (@comercial = '' OR cc.gerenteconta = @comercial)
)
SELECT
    CASE WHEN SUM(VALOR_) = 0 THEN 0
         ELSE SUM(VALOR_ * ISNULL(JUROS_MENSAL, 0)) / SUM(VALOR_)
    END AS geral,
    CASE
        WHEN SUM(CASE WHEN STATUS_PAGTO IN ('A Vencer', 'Vencido') OR TIPO_PAGAMENTO = 'Pagamento Parcial' THEN VALOR_ ELSE 0 END) = 0 THEN 0
        ELSE SUM(CASE WHEN STATUS_PAGTO IN ('A Vencer', 'Vencido') OR TIPO_PAGAMENTO = 'Pagamento Parcial' THEN VALOR_ * ISNULL(JUROS_MENSAL, 0) ELSE 0 END)
             / SUM(CASE WHEN STATUS_PAGTO IN ('A Vencer', 'Vencido') OR TIPO_PAGAMENTO = 'Pagamento Parcial' THEN VALOR_ ELSE 0 END)
    END AS estoque
FROM Filtrado
`;

export async function getTaxaMedia(
  comercialCodigo: Scoped<string>,
  forceRefresh = false,
): Promise<TaxaMedia> {
  return withCache(
    `taxa-media:${comercialCodigo}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<TaxaMedia>(QUERY, [
        { name: "comercial", type: sql.VarChar(20), value: comercialCodigo.trim() },
      ]);
      return rows[0] ?? { geral: 0, estoque: 0 };
    },
    { forceRefresh },
  );
}
