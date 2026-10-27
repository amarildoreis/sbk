import { executeReadQuery } from "@/lib/db/query";
import { withCache } from "@/lib/db/cache";
import type { OperadorIndicante } from "./operadores-indicante";

const CACHE_KEY = "comerciais-filtro";
const CACHE_TTL_MS = 15 * 60_000;

// Lista para o filtro "Comercial" dos cards de CADCRED (Visão Geral). É
// DIFERENTE da lista de "Comercial do Sistema" do cadastro de usuários
// (getOperadoresIndicante): aquela é só SIGBORS (identidades reais de
// operador/indicante, usada para vincular um usuário do sistema). Esta
// precisa cobrir também os códigos que só existem em CADCRED.gerenteconta —
// sem isso, "Todos" soma cedentes cujo código nunca aparece como opção no
// dropdown, e a soma dos filtros individuais nunca bate com "Todos".
const QUERY = `
WITH Codigos AS (
    SELECT DISTINCT
        CASE
            WHEN INDICANTE IS NOT NULL AND INDICANTE <> '' THEN INDICANTE
            WHEN OPERADOR IS NOT NULL AND OPERADOR <> '' THEN OPERADOR
        END AS CODIGO
    FROM SIGBORS
    UNION
    SELECT DISTINCT gerenteconta AS CODIGO
    FROM CADCRED
    WHERE gerenteconta IS NOT NULL AND gerenteconta <> ''
)
SELECT
    c.CODIGO AS codigo,
    v.NOME   AS nome,
    v.email  AS email
FROM Codigos c
LEFT JOIN SIGVEN v ON v.CODIGO = c.CODIGO
WHERE c.CODIGO IS NOT NULL AND c.CODIGO <> ''
ORDER BY c.CODIGO
`;

export async function getComerciaisFiltro(): Promise<OperadorIndicante[]> {
  return withCache(CACHE_KEY, CACHE_TTL_MS, () =>
    executeReadQuery<OperadorIndicante>(QUERY),
  );
}
