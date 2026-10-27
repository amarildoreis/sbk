import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import { STATUS_PAGTO_CASE, SIGFIDC_CODIGOS_FIDC } from "./sigfidc-shared";

export interface QuantidadeCedentes {
  comRisco: number;
  semRisco: number;
}

// Card "Quantidade de Cedentes - Com Risco / Sem Risco" (Visão Geral).
// Reaproveita as mesmas variáveis CedentesComRisco/CedentesSemRisco já
// usadas nas fórmulas de Risco, A Vencer e Vencido (mesmo critério: CLIFOR
// com soma de títulos em aberto > 0). Diferente daquelas, aqui o universo é
// sempre CADCRED (mesmo padrão de CedentesSemRisco no DAX original) — cada
// cedente de CADCRED cai em exatamente um dos dois grupos, o que também é o
// que permite aplicar o filtro de Comercial (CADCRED.gerenteconta) da mesma
// forma nos dois lados.
const QUERY = `
WITH TitulosClassificados AS (
    SELECT
        f.CLIFOR,
        f.VALOR_,
        ${STATUS_PAGTO_CASE} AS STATUS_PAGTO
    FROM SIGFIDC f
    WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
),
RiscoPorClifor AS (
    SELECT CLIFOR, SUM(VALOR_) AS somaRisco
    FROM TitulosClassificados
    WHERE STATUS_PAGTO NOT IN ('Pago Em Dia', 'Pago Vencido')
    GROUP BY CLIFOR
    HAVING SUM(VALOR_) > 0
)
SELECT
    SUM(CASE WHEN r.CLIFOR IS NOT NULL THEN 1 ELSE 0 END) AS comRisco,
    SUM(CASE WHEN r.CLIFOR IS NULL THEN 1 ELSE 0 END) AS semRisco
FROM CADCRED cc
LEFT JOIN RiscoPorClifor r ON r.CLIFOR = cc.clifor
WHERE (@comercial = '' OR cc.gerenteconta = @comercial)
`;

export async function getQuantidadeCedentes(
  comercialCodigo: Scoped<string>,
  forceRefresh = false,
): Promise<QuantidadeCedentes> {
  return withCache(
    `quantidade-cedentes:${comercialCodigo}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<QuantidadeCedentes>(QUERY, [
        { name: "comercial", type: sql.VarChar(20), value: comercialCodigo.trim() },
      ]);
      return rows[0] ?? { comRisco: 0, semRisco: 0 };
    },
    { forceRefresh },
  );
}
