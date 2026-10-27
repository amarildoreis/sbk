import sql from "mssql";
import { executeReadQuery } from "@/lib/db/query";
import { SIGFIDC_CODIGOS_FIDC, SIGBORS_OPERADOR_CTE } from "./sigfidc-shared";

export interface SacadoBusca {
  codigo: string;
  nome: string;
  cgc: string | null;
}

const MAX_RESULTS = 25;

// Busca sob demanda para o filtro "Sacado" — 16.938 SACADO distintos em
// SIGFIDC, grande demais pra cachear a lista inteira (mesmo padrão de
// clifor.ts, mas escopado só a quem de fato aparece como sacado em títulos
// dentro do filtro de código padrão — não a SIGCAD inteira).
//
// Efeito cascata: Comercial (COD_OPERADOR_INDICANTE por borderô) e Grupo
// Econômico Sacado, quando já escolhidos na popup, restringem a busca —
// mesmo vínculo de comercial usado em getCedentesTitulosFiltrado.
const QUERY = `
;WITH ${SIGBORS_OPERADOR_CTE},
GrupoEmpresaUnico AS (
    SELECT clifor, idgrupo, ROW_NUMBER() OVER (PARTITION BY clifor ORDER BY clifor) AS RN
    FROM GrupoEmpresa
)
SELECT DISTINCT TOP (@maxResults)
    CAST(f.SACADO AS VARCHAR) AS codigo,
    SAC.NOME AS nome,
    SAC.CGC AS cgc
FROM SIGFIDC f
INNER JOIN SIGCAD SAC ON SAC.CODIGO = f.SACADO
LEFT JOIN SigborsOperador SO ON SO.BORDERO = f.BORDERO
LEFT JOIN GrupoEmpresaUnico GEU ON GEU.clifor = f.SACADO AND GEU.RN = 1
WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
  AND (
    CAST(f.SACADO AS VARCHAR) LIKE @termo
    OR SAC.NOME LIKE @termo
    OR SAC.CGC LIKE @termo
  )
  AND (@comercial = '' OR SO.codigoComercial = @comercial)
  AND (@grupoSacado = '' OR CAST(GEU.idgrupo AS VARCHAR) = @grupoSacado)
ORDER BY SAC.NOME
`;

export async function searchSacados(
  termo: string,
  comercial: string = "",
  grupoSacado: string = "",
): Promise<SacadoBusca[]> {
  const termoLimpo = termo.trim();
  if (termoLimpo.length < 2) return [];

  return executeReadQuery<SacadoBusca>(QUERY, [
    { name: "termo", type: sql.VarChar(120), value: `%${termoLimpo}%` },
    { name: "maxResults", type: sql.Int, value: MAX_RESULTS },
    { name: "comercial", type: sql.VarChar(20), value: comercial.trim() },
    { name: "grupoSacado", type: sql.VarChar(20), value: grupoSacado.trim() },
  ]);
}
