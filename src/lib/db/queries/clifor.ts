import sql from "mssql";
import { executeReadQuery } from "@/lib/db/query";

export interface Clifor {
  clifor: string;
  nome: string;
  cgc: string | null;
}

const MAX_RESULTS = 25;

// SIGCAD é o cadastro de cedentes E sacados — é a mesma tabela para os dois
// perfis (CLAUDE.md seção 17/20), o que muda é só o papel na operação, não
// o cadastro em si. CODIGO aqui é o CLIFOR (termo de negócio usado em toda
// a documentação — SIGFIDC.CLIFOR -> SIGCAD.CODIGO).
//
// 57.458 linhas na tabela — grande demais pra carregar tudo no navegador
// (diferente da lista de comerciais, com ~100 linhas). Por isso é busca sob
// demanda, com termo mínimo e resultado limitado, não uma lista cacheada
// inteira como fizemos para COD_OPERADOR_INDICANTE.
//
// NOME exige TODAS as palavras do termo (AND, em qualquer ordem) — não a
// frase inteira como um único LIKE. Mesma correção de 2026-07-19 aplicada
// em resolverComercialPorNome (entity-resolver.ts): um termo digitado fora
// da ordem do cadastro (ex: nome/sobrenome invertido, razão social com nome
// do meio) não deve ficar invisível pra busca. CODIGO/CGC continuam
// comparados contra o termo completo (não fazem sentido "quebrados" em
// palavras).
function buildNomeCondicao(palavras: string[]): string {
  return palavras.map((_, i) => `NOME LIKE @nomeTermo${i}`).join(" AND ");
}

export async function searchClifor(termo: string): Promise<Clifor[]> {
  const termoLimpo = termo.trim();
  if (termoLimpo.length < 2) return [];

  const palavras = termoLimpo.split(/\s+/).filter(Boolean);
  const query = `
SELECT TOP (@maxResults)
    CAST(CODIGO AS VARCHAR(20)) AS clifor,
    NOME                        AS nome,
    CGC                         AS cgc
FROM SIGCAD
WHERE
    CAST(CODIGO AS VARCHAR(20)) LIKE @termoCompleto
    OR CGC LIKE @termoCompleto
    OR (${buildNomeCondicao(palavras)})
ORDER BY NOME
`;

  return executeReadQuery<Clifor>(query, [
    { name: "termoCompleto", type: sql.VarChar(120), value: `%${termoLimpo}%` },
    { name: "maxResults", type: sql.Int, value: MAX_RESULTS },
    ...palavras.map((p, i) => ({ name: `nomeTermo${i}`, type: sql.VarChar(120), value: `%${p}%` })),
  ]);
}
