import sql from "mssql";
import { executeReadQuery } from "@/lib/db/query";
import { withCache } from "@/lib/db/cache";
import { SIGFIDC_CODIGOS_FIDC, SIGBORS_OPERADOR_CTE } from "./sigfidc-shared";

export interface CedenteTitulo {
  codigo: string;
  nome: string | null;
  cgc: string | null;
}

const CACHE_KEY = "cedentes-titulos";
const CACHE_TTL_MS = 15 * 60_000;

// Lista para o filtro "Cedente" do Relatório Analítico de Títulos — só 823
// CLIFOR distintos aparecem em SIGFIDC (dentro do filtro de código padrão),
// cabe cacheada por inteiro (diferente da SIGCAD inteira, com 57 mil linhas,
// que usa busca sob demanda — ver clifor.ts).
const QUERY = `
SELECT
    CAST(F.CLIFOR AS VARCHAR) AS codigo,
    CED.NOME AS nome,
    CED.CGC AS cgc
FROM (SELECT DISTINCT CLIFOR FROM SIGFIDC WHERE CODIGO IN ${SIGFIDC_CODIGOS_FIDC}) F
LEFT JOIN SIGCAD CED ON CED.CODIGO = F.CLIFOR
ORDER BY CED.NOME
`;

export async function getCedentesTitulos(): Promise<CedenteTitulo[]> {
  return withCache(CACHE_KEY, CACHE_TTL_MS, () => executeReadQuery<CedenteTitulo>(QUERY));
}

// Efeito cascata (Comercial/Grupo Econômico Cedente já escolhidos na popup).
// Comercial aqui é COD_OPERADOR_INDICANTE por borderô (único vínculo usado
// em Títulos — diferente de Carteira de Clientes/Tarifário, que usam
// CADCRED.gerenteconta).
const QUERY_FILTRADA = `
;WITH ${SIGBORS_OPERADOR_CTE},
GrupoEmpresaUnico AS (
    SELECT clifor, idgrupo, ROW_NUMBER() OVER (PARTITION BY clifor ORDER BY clifor) AS RN
    FROM GrupoEmpresa
)
SELECT DISTINCT
    CAST(f.CLIFOR AS VARCHAR) AS codigo,
    CED.NOME AS nome,
    CED.CGC AS cgc
FROM SIGFIDC f
LEFT JOIN SigborsOperador SO ON SO.BORDERO = f.BORDERO
LEFT JOIN GrupoEmpresaUnico GEU ON GEU.clifor = f.CLIFOR AND GEU.RN = 1
LEFT JOIN SIGCAD CED ON CED.CODIGO = f.CLIFOR
WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
  AND (@comercial = '' OR SO.codigoComercial = @comercial)
  AND (@grupoCedente = '' OR CAST(GEU.idgrupo AS VARCHAR) = @grupoCedente)
ORDER BY CED.NOME
`;

export async function getCedentesTitulosFiltrado(
  comercial: string,
  grupoCedente: string,
): Promise<CedenteTitulo[]> {
  const comercialTrim = comercial.trim();
  const grupoTrim = grupoCedente.trim();
  if (!comercialTrim && !grupoTrim) return getCedentesTitulos();

  return executeReadQuery<CedenteTitulo>(QUERY_FILTRADA, [
    { name: "comercial", type: sql.VarChar(20), value: comercialTrim },
    { name: "grupoCedente", type: sql.VarChar(20), value: grupoTrim },
  ]);
}
