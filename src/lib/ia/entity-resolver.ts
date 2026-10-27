import { getOperadoresIndicante } from "@/lib/db/queries/operadores-indicante";
import { searchClifor } from "@/lib/db/queries/clifor";
import { getGruposEconomicos } from "@/lib/db/queries/grupos-economicos";

// Traduz nomes soltos ditos em linguagem natural ("o Loureiro", "a Root
// Brasil") pros códigos que as queries de negócio realmente usam
// (COD_OPERADOR_INDICANTE / CLIFOR). Reaproveita exatamente as mesmas fontes
// já usadas nos filtros de tela — nenhuma lógica de busca nova.
export interface ResolucaoEntidade {
  status: "encontrado" | "ambiguo" | "nao_encontrado";
  codigo?: string;
  /** Nome de exibição do cadastro encontrado — usado pra montar a frase de
   * resposta ("A Tainá recebeu...") em vez do texto cru digitado na
   * pergunta, que pode ser só um apelido/parte do nome. */
  nome?: string | null;
  /** Preenchido quando `status` é "ambiguo" — pra pergunta de esclarecimento
   * na resposta ("Você quis dizer X ou Y?"), nunca escolhido às cegas. */
  opcoes?: { codigo: string; nome: string | null }[];
}

// Comercial (indicante/operador) — lista pequena (~100 linhas), já cacheada
// 15min por getOperadoresIndicante(). Match por código exato, ou por nome
// exigindo que TODAS as palavras do termo apareçam no cadastro (em
// qualquer ordem) — não a frase inteira como substring única. Corrigido em
// 2026-07-19: "Henrique Loureiro" não batia com o comercial 080 porque o
// match antigo (`nome.includes(fraseInteira)`) exige a ordem exata digitada;
// cadastros com nome/sobrenome invertido, nome do meio, ou qualquer ordem
// diferente da pergunta ficavam invisíveis pro resolvedor mesmo existindo.
export async function resolverComercialPorNome(nomeOuCodigo: string): Promise<ResolucaoEntidade> {
  const termo = nomeOuCodigo.trim().toLowerCase();
  if (!termo) return { status: "nao_encontrado" };

  const lista = await getOperadoresIndicante();
  const porCodigo = lista.find((o) => o.codigo.toLowerCase() === termo);
  if (porCodigo) return { status: "encontrado", codigo: porCodigo.codigo, nome: porCodigo.nome };

  const palavras = termo.split(/\s+/).filter(Boolean);
  const porNome = lista.filter((o) => {
    const nome = (o.nome ?? "").toLowerCase();
    return palavras.every((palavra) => nome.includes(palavra));
  });
  if (porNome.length === 0) return { status: "nao_encontrado" };
  if (porNome.length === 1) return { status: "encontrado", codigo: porNome[0].codigo, nome: porNome[0].nome };
  return {
    status: "ambiguo",
    opcoes: porNome.map((o) => ({ codigo: o.codigo, nome: o.nome })),
  };
}

// Cedente/Sacado (mesmo cadastro SIGCAD, CLAUDE.md 19.8) — busca sob
// demanda via searchClifor (mesma função já usada nos campos de busca de
// Cedente/Sacado em toda a plataforma).
export async function resolverCliforPorNome(nomeOuCodigo: string): Promise<ResolucaoEntidade> {
  const termo = nomeOuCodigo.trim();
  if (termo.length < 2) return { status: "nao_encontrado" };

  const lista = await searchClifor(termo);
  if (lista.length === 0) return { status: "nao_encontrado" };
  if (lista.length === 1) return { status: "encontrado", codigo: lista[0].clifor, nome: lista[0].nome };
  return {
    status: "ambiguo",
    opcoes: lista.map((c) => ({ codigo: c.clifor, nome: c.nome })),
  };
}

// Grupo Econômico (cadGrupoEmpresarial, CLAUDE.md seção 18) — lista
// completa já cacheada 15min por getGruposEconomicos() (mesma base usada
// nos filtros em cascata de Comercial → Grupo Econômico de toda a
// plataforma). Adicionado em 2026-07-19: até aqui a IA não tinha NENHUM
// jeito de resolver "grupo econômico 153"/"Grupo Água Branca" pra um
// filtro, mesmo o dado já existindo (mesma pergunta já respondida
// normalmente pela tela de Carteira de Clientes) — bug de cobertura, não
// de dado.
export async function resolverGrupoEconomicoPorNome(nomeOuCodigo: string): Promise<ResolucaoEntidade> {
  const termoOriginal = nomeOuCodigo.trim();
  if (!termoOriginal) return { status: "nao_encontrado" };

  const lista = await getGruposEconomicos();

  // Rótulo "código - nome" é o padrão em toda a plataforma (CLAUDE.md
  // 21.11) — se a pergunta citar o código no início (ex: "153 - Grupo Água
  // Branca", ou só "153"), bate direto pelo id antes de tentar por nome.
  const matchCodigo = termoOriginal.match(/^(\d+)/);
  if (matchCodigo) {
    const porId = lista.find((g) => String(g.id) === matchCodigo[1]);
    if (porId) return { status: "encontrado", codigo: String(porId.id), nome: porId.nome };
  }

  // Match por TODAS as palavras do termo (em qualquer ordem), ignorando
  // tokens puramente numéricos (já tentados acima) — mesma correção de
  // 2026-07-19 já aplicada a resolverComercialPorNome/searchClifor.
  const palavras = termoOriginal
    .toLowerCase()
    .split(/[\s\-+]+/)
    .filter((p) => p.length > 1 && !/^\d+$/.test(p));
  if (palavras.length === 0) return { status: "nao_encontrado" };

  const porNome = lista.filter((g) => {
    const nome = (g.nome ?? "").toLowerCase();
    return palavras.every((palavra) => nome.includes(palavra));
  });
  if (porNome.length === 0) return { status: "nao_encontrado" };
  if (porNome.length === 1) return { status: "encontrado", codigo: String(porNome[0].id), nome: porNome[0].nome };
  return {
    status: "ambiguo",
    opcoes: porNome.map((g) => ({ codigo: String(g.id), nome: g.nome })),
  };
}
