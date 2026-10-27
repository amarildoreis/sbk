import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import { SIGFIDC_CODIGOS_FIDC } from "./sigfidc-shared";

// "Maior Concentração" do módulo Comportamental. Medida DAX colada pelo
// cliente em 2026-07-15:
//
//   maior_concentracao = CALCULATE(
//       MAXX(SIGFIDC, SIGFIDC[VALOR_]),
//       SIGFIDC[SACADO] = SELECTEDVALUE(SIGFIDC[CLIFOR]),
//       ALL(SIGFIDC)
//   ) + 0
//
// `ALL(SIGFIDC)` limpa qualquer filtro de relatório sobre SIGFIDC — ou seja,
// ignora Comercial e Grupo Econômico (que cruzam SIGFIDC via SIGBORS/
// GrupoEmpresa) de propósito; só o filtro de Cedente sobrevive, porque
// `SELECTEDVALUE(SIGFIDC[CLIFOR])` é avaliado no contexto ORIGINAL (antes do
// ALL entrar em vigor) — semântica de CALCULATE em que todo argumento de
// filtro é resolvido contra o contexto de fora, não em sequência. O filtro
// padrão `CODIGO IN (...)` continua valendo (é restrição da fonte de dados,
// não um filtro de relatório que ALL() limpa — CLAUDE.md 21.3).
//
// ATENÇÃO — 2026-07-15: essa medida foi trocada por engano pra "maior
// título dentro da carteira do cedente" (CLIFOR = cedente) depois de uma
// suposição errada de que o cruzamento SACADO=cedente seria bug. O cliente
// validou contra o Power BI ao vivo com o cedente 6237 (AGUA BRANCA) e
// confirmou: o valor certo é R$ 193.864,07 (SACADO=6237), não R$ 96.674,60
// (CLIFOR=6237). A regra literal original está correta — mantida assim.
// Sem Cedente selecionado, a medida é sempre 0 (mesma regra "só faz sentido
// com cedente filtrado" dos demais cards de CADCRED/SIGFLS).
export interface MaiorConcentracaoFiltros {
  cedente?: string;
}

export function parseFiltrosFromSearchParams(
  searchParams: URLSearchParams,
): MaiorConcentracaoFiltros {
  return {
    cedente: searchParams.get("cedente") ?? "",
  };
}

export interface MaiorConcentracaoTotais {
  valor: number;
}

const QUERY = `
SELECT ISNULL(MAX(VALOR_), 0) AS valor
FROM SIGFIDC
WHERE CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
  AND @cedente <> ''
  AND CAST(SACADO AS VARCHAR) = @cedente
`;

export async function getMaiorConcentracao(
  filtros: Scoped<MaiorConcentracaoFiltros>,
  forceRefresh = false,
): Promise<MaiorConcentracaoTotais> {
  return withCache(
    `comportamental-maior-concentracao:${JSON.stringify(filtros)}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<MaiorConcentracaoTotais>(QUERY, [
        { name: "cedente", type: sql.VarChar(20), value: (filtros.cedente ?? "").trim() },
      ]);
      return rows[0] ?? { valor: 0 };
    },
    { forceRefresh },
  );
}
