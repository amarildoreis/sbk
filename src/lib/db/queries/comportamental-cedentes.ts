import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { SIGFIDC_CODIGOS_FIDC, SIGBORS_OPERADOR_CTE } from "./sigfidc-shared";

export interface CedenteComportamental {
  codigo: string;
  nome: string | null;
  cgc: string | null;
}

export interface CedentesComportamentalFiltros {
  comercial?: string;
  grupoEconomico?: string;
}

// Lista de cedentes para o select "Cedente" da popup de filtros do
// Comportamental — com efeito cascata: se Comercial e/ou Grupo Econômico já
// estiverem selecionados, só mostra cedentes compatíveis com esses filtros
// (em vez da lista completa do Universo). Sem filtro nenhum, retorna o
// Universo inteiro (CADCRED ∪ SIGFIDC.CLIFOR), igual à lista de Carteira de
// Clientes.
//
// Comercial usa os dois vínculos (CLAUDE.md 21.9): CADCRED.gerenteconta
// (cedentes com crédito configurado por esse comercial) OU
// COD_OPERADOR_INDICANTE por BORDERÔ (cedentes com pelo menos um título
// operado/indicado por esse comercial) — união dos dois, pra não esconder
// cedentes que só aparecem via um dos dois caminhos.
const QUERY = `
;WITH ${SIGBORS_OPERADOR_CTE},
GrupoEmpresaUnico AS (
    SELECT clifor, idgrupo, ROW_NUMBER() OVER (PARTITION BY clifor ORDER BY clifor) AS RN
    FROM GrupoEmpresa
),
RiscoPorClifor AS (
    SELECT DISTINCT f.CLIFOR FROM SIGFIDC f WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
),
Universo AS (
    SELECT clifor FROM CADCRED
    UNION
    SELECT CLIFOR FROM RiscoPorClifor
),
CedentesDoComercial AS (
    SELECT clifor FROM CADCRED WHERE gerenteconta = @comercial
    UNION
    SELECT DISTINCT f.CLIFOR
    FROM SIGFIDC f
    JOIN SigborsOperador SO ON SO.BORDERO = f.BORDERO
    WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC} AND SO.codigoComercial = @comercial
)
SELECT CAST(U.clifor AS VARCHAR) AS codigo, SIGCAD.NOME AS nome, SIGCAD.CGC AS cgc
FROM Universo U
LEFT JOIN SIGCAD ON SIGCAD.CODIGO = U.clifor
LEFT JOIN GrupoEmpresaUnico GEU ON GEU.clifor = U.clifor AND GEU.RN = 1
WHERE (@comercial = '' OR U.clifor IN (SELECT clifor FROM CedentesDoComercial))
  AND (@grupoEconomico = '' OR CAST(GEU.idgrupo AS VARCHAR) = @grupoEconomico)
ORDER BY SIGCAD.NOME
`;

export async function getCedentesComportamental(
  filtros: Scoped<CedentesComportamentalFiltros>,
): Promise<CedenteComportamental[]> {
  return executeReadQuery<CedenteComportamental>(QUERY, [
    { name: "comercial", type: sql.VarChar(20), value: (filtros.comercial ?? "").trim() },
    {
      name: "grupoEconomico",
      type: sql.VarChar(20),
      value: (filtros.grupoEconomico ?? "").trim(),
    },
  ]);
}
