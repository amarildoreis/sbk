import sql from "mssql";
import { executeReadQuery } from "@/lib/db/query";
import { withCache } from "@/lib/db/cache";
import { SIGFIDC_CODIGOS_FIDC } from "./sigfidc-shared";

export interface CedenteCarteira {
  codigo: string;
  nome: string | null;
  cgc: string | null;
}

const CACHE_KEY = "cedentes-carteira";
const CACHE_TTL_MS = 15 * 60_000;

// Lista para o filtro "Cedente" da Carteira de Clientes — universo é
// CADCRED ∪ quem tem título em SIGFIDC (mesmo "Universo" da query principal,
// carteira-clientes.ts), não só SIGFIDC.CLIFOR como em cedentes-titulos.ts —
// senão os 2 cedentes órfãos (sem CADCRED) ficariam de fora do próprio
// filtro que deveria conseguir achá-los.
const QUERY = `
WITH RiscoPorClifor AS (
    SELECT DISTINCT f.CLIFOR
    FROM SIGFIDC f
    WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
),
Universo AS (
    SELECT clifor FROM CADCRED
    UNION
    SELECT CLIFOR FROM RiscoPorClifor
)
SELECT
    CAST(U.clifor AS VARCHAR) AS codigo,
    SIGCAD.NOME AS nome,
    SIGCAD.CGC AS cgc
FROM Universo U
LEFT JOIN SIGCAD ON SIGCAD.CODIGO = U.clifor
ORDER BY SIGCAD.NOME
`;

export async function getCedentesCarteira(): Promise<CedenteCarteira[]> {
  return withCache(CACHE_KEY, CACHE_TTL_MS, () => executeReadQuery<CedenteCarteira>(QUERY));
}

// Efeito cascata (Comercial/Grupo Econômico já escolhidos na popup de
// filtros) — igual em espírito ao Universo acima, mas com os dois filtros
// aplicados. Comercial aqui é só CADCRED.gerenteconta (grão por cedente,
// único vínculo usado em Carteira de Clientes — diferente do Comportamental,
// que também usa COD_OPERADOR_INDICANTE); por isso cedentes órfãos (sem
// CADCRED) somem automaticamente assim que um Comercial é escolhido, o que é
// correto (não têm gerente de conta configurado).
const QUERY_FILTRADA = `
WITH RiscoPorClifor AS (
    SELECT DISTINCT f.CLIFOR
    FROM SIGFIDC f
    WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
),
Universo AS (
    SELECT clifor FROM CADCRED
    UNION
    SELECT CLIFOR FROM RiscoPorClifor
),
GrupoEmpresaUnico AS (
    SELECT clifor, idgrupo, ROW_NUMBER() OVER (PARTITION BY clifor ORDER BY clifor) AS RN
    FROM GrupoEmpresa
)
SELECT
    CAST(U.clifor AS VARCHAR) AS codigo,
    SIGCAD.NOME AS nome,
    SIGCAD.CGC AS cgc
FROM Universo U
LEFT JOIN SIGCAD ON SIGCAD.CODIGO = U.clifor
LEFT JOIN CADCRED ON CADCRED.clifor = U.clifor
LEFT JOIN GrupoEmpresaUnico GEU ON GEU.clifor = U.clifor AND GEU.RN = 1
WHERE (@comercial = '' OR CADCRED.gerenteconta = @comercial)
  AND (@grupoEconomico = '' OR CAST(GEU.idgrupo AS VARCHAR) = @grupoEconomico)
ORDER BY SIGCAD.NOME
`;

export async function getCedentesCarteiraFiltrado(
  comercial: string,
  grupoEconomico: string,
): Promise<CedenteCarteira[]> {
  const comercialTrim = comercial.trim();
  const grupoTrim = grupoEconomico.trim();
  if (!comercialTrim && !grupoTrim) return getCedentesCarteira();

  return executeReadQuery<CedenteCarteira>(QUERY_FILTRADA, [
    { name: "comercial", type: sql.VarChar(20), value: comercialTrim },
    { name: "grupoEconomico", type: sql.VarChar(20), value: grupoTrim },
  ]);
}
