import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";

// Card "Limite de Crédito - Cedente" (Dashboard > Comercial - Visão Geral).
// Soma ConsLimCedFIDC em CADCRED, ligado a SIGCAD por CLIFOR (CLAUDE.md
// seção 20: SIGCAD.CODIGO = CADCRED.CLIFOR, 1:1). LEFT JOIN (não INNER):
// existe pelo menos um CLIFOR em CADCRED (18102) sem cadastro em SIGCAD, e o
// Power BI original (SUM direto em CADCRED, sem join nenhum) inclui esse
// valor — INNER JOIN excluía R$ 35.000 e quebrava a paridade com o Power BI.
// O JOIN com SIGCAD fica pronto para uso futuro (ex: nome/CGC do cedente),
// só não filtra mais a soma. O filtro de Comercial usa CADCRED.gerenteconta,
// que já guarda o mesmo código de COD_OPERADOR_INDICANTE/SIGVEN (seção 20:
// CADCRED.GERENTECONTA -> COD_OPERADOR_INDICANTE.CODIGO) — sem comercial
// selecionado, soma tudo.
const QUERY = `
SELECT ISNULL(SUM(cc.ConsLimCedFIDC), 0) AS limiteCredito
FROM CADCRED cc
LEFT JOIN SIGCAD sc ON sc.CODIGO = cc.clifor
WHERE (@comercial = '' OR cc.gerenteconta = @comercial)
`;

export async function getLimiteCreditoCedente(
  comercialCodigo: Scoped<string>,
  forceRefresh = false,
): Promise<number> {
  return withCache(
    `limite-credito-cedente:${comercialCodigo}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<{ limiteCredito: number }>(QUERY, [
        { name: "comercial", type: sql.VarChar(20), value: comercialCodigo.trim() },
      ]);
      return rows[0]?.limiteCredito ?? 0;
    },
    { forceRefresh },
  );
}
