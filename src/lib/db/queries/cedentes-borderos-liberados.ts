import sql from "mssql";
import { executeReadQuery } from "@/lib/db/query";
import { withCache } from "@/lib/db/cache";

export interface CedenteBorderoLiberado {
  codigo: string;
  nome: string | null;
  cgc: string | null;
}

const CACHE_KEY = "cedentes-borderos-liberados";
const CACHE_TTL_MS = 15 * 60_000;

// Lista para o filtro "Cedente" de Borderôs Liberados — só os CLIFOR
// distintos que aparecem em SIGBORS com LIBERADO = 'S' (mesmo padrão de
// cedentes-titulos.ts, escopado à tabela-guia desta tela).
const QUERY = `
SELECT
    CAST(B.CLIFOR AS VARCHAR) AS codigo,
    CAD.NOME AS nome,
    CAD.CGC AS cgc
FROM (SELECT DISTINCT CLIFOR FROM SIGBORS WHERE LIBERADO = 'S') B
LEFT JOIN SIGCAD CAD ON CAD.CODIGO = B.CLIFOR
ORDER BY CAD.NOME
`;

export async function getCedentesBorderosLiberados(): Promise<CedenteBorderoLiberado[]> {
  return withCache(CACHE_KEY, CACHE_TTL_MS, () => executeReadQuery<CedenteBorderoLiberado>(QUERY));
}

// Efeito cascata (Comercial/Grupo Econômico já escolhidos no painel).
const QUERY_FILTRADA = `
;WITH GrupoEmpresaUnico AS (
    SELECT clifor, idgrupo, ROW_NUMBER() OVER (PARTITION BY clifor ORDER BY clifor) AS RN
    FROM GrupoEmpresa
)
SELECT DISTINCT
    CAST(B.CLIFOR AS VARCHAR) AS codigo,
    CAD.NOME AS nome,
    CAD.CGC AS cgc
FROM SIGBORS B
LEFT JOIN GrupoEmpresaUnico GEU ON GEU.clifor = B.CLIFOR AND GEU.RN = 1
LEFT JOIN SIGCAD CAD ON CAD.CODIGO = B.CLIFOR
WHERE B.LIBERADO = 'S'
  AND (
    @comercial = '' OR (
        CASE
            WHEN B.INDICANTE IS NOT NULL AND B.INDICANTE <> '' THEN B.INDICANTE
            WHEN B.OPERADOR IS NOT NULL AND B.OPERADOR <> '' THEN B.OPERADOR
            ELSE NULL
        END
    ) = @comercial
  )
  AND (@grupoEconomico = '' OR CAST(GEU.idgrupo AS VARCHAR) = @grupoEconomico)
ORDER BY CAD.NOME
`;

export async function getCedentesBorderosLiberadosFiltrado(
  comercial: string,
  grupoEconomico: string,
): Promise<CedenteBorderoLiberado[]> {
  const comercialTrim = comercial.trim();
  const grupoTrim = grupoEconomico.trim();
  if (!comercialTrim && !grupoTrim) return getCedentesBorderosLiberados();

  return executeReadQuery<CedenteBorderoLiberado>(QUERY_FILTRADA, [
    { name: "comercial", type: sql.VarChar(20), value: comercialTrim },
    { name: "grupoEconomico", type: sql.VarChar(20), value: grupoTrim },
  ]);
}
