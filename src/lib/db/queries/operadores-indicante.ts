import { executeReadQuery } from "@/lib/db/query";
import { withCache } from "@/lib/db/cache";

export interface OperadorIndicante {
  codigo: string;
  nome: string | null;
  email: string | null;
}

const CACHE_KEY = "operadores-indicante";
const CACHE_TTL_MS = 15 * 60_000; // 15min — cadastro de vendedores muda raramente.

// Fonte: SIGBORS (não SIGVEN direto) — um mesmo cliente pode ter borderôs
// operados por comerciais diferentes ao longo do tempo, então o código do
// operador/indicante só existe de fato no nível do borderô. Prioridade
// INDICANTE > OPERADOR, igual ao Power Query original (CLAUDE.md seção 18).
//
// Diferença proposital em relação ao Power Query original: aqui o CODIGO
// nunca é descartado, mesmo sem match na SIGVEN — o Power Query derrubava a
// coluna original depois do LEFT JOIN, perdendo o código de quem não tinha
// cadastro em SIGVEN. Corrigido via COALESCE.
//
// Nota: o Power Query original também trazia "COD_COMERCIAL" da SIGVEN, mas
// essa coluna não existe fisicamente na tabela (confirmado via
// INFORMATION_SCHEMA.COLUMNS em 2026-07-11) — provavelmente era algo
// calculado só dentro do modelo do Power BI. Removida daqui.
const QUERY = `
WITH OperadoresDistintos AS (
    SELECT DISTINCT
        CASE
            WHEN INDICANTE IS NOT NULL AND INDICANTE <> '' THEN INDICANTE
            WHEN OPERADOR IS NOT NULL AND OPERADOR <> '' THEN OPERADOR
        END AS CODIGO
    FROM SIGBORS
)
SELECT
    d.CODIGO AS codigo,
    v.NOME   AS nome,
    v.email  AS email
FROM OperadoresDistintos d
LEFT JOIN SIGVEN v ON v.CODIGO = d.CODIGO
WHERE d.CODIGO IS NOT NULL AND d.CODIGO <> ''
ORDER BY d.CODIGO
`;

export async function getOperadoresIndicante(): Promise<OperadorIndicante[]> {
  return withCache(CACHE_KEY, CACHE_TTL_MS, () =>
    executeReadQuery<OperadorIndicante>(QUERY),
  );
}
