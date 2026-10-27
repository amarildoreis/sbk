import type { Session } from "next-auth";
import { applyAccessScope, resolveComercialParam } from "@/lib/auth/access-scope";
import { getComissoes, getComissoesParaExportacao, getComissoesPorComercial } from "@/lib/db/queries/comissoes";
import { getRiscoCedente } from "@/lib/db/queries/risco-cedente";
import { getLimiteCreditoCedente } from "@/lib/db/queries/limite-credito-cedente";
import { getAVencerCedente } from "@/lib/db/queries/a-vencer-cedente";
import { getVencidoCedente } from "@/lib/db/queries/vencido-cedente";
import { getPrazoMedioEstoque } from "@/lib/db/queries/prazo-medio-estoque";
import { getTaxaMedia } from "@/lib/db/queries/taxa-media";
import { getTicketMedio } from "@/lib/db/queries/ticket-medio";
import { getQuantidadeCedentes } from "@/lib/db/queries/quantidade-cedentes";
import { getCarteiraClientes, getCarteiraClientesParaExportacao } from "@/lib/db/queries/carteira-clientes";
import { getTrancheTitulos, getTrancheParaExportacao } from "@/lib/db/queries/tranche";
import { getLiquidezPontual } from "@/lib/db/queries/comportamental-liquidez-pontual";
import { getRecompra } from "@/lib/db/queries/comportamental-recompra";
import { getVopCedente } from "@/lib/db/queries/comportamental-vop-cedente";
import { getVopSacado } from "@/lib/db/queries/comportamental-vop-sacado";
import { getGraficoVopCedenteMensal } from "@/lib/db/queries/graficos-vop-cedente";
import { getCarteiraSacados, getCarteiraSacadosParaExportacao } from "@/lib/db/queries/carteira-sacados";
import { getMaiorConcentracao } from "@/lib/db/queries/comportamental-maior-concentracao";
import { getQuantidadeSacados } from "@/lib/db/queries/comportamental-quantidade-sacados";
import { getTarifario } from "@/lib/db/queries/comportamental-tarifario";
import { getOperacoes } from "@/lib/db/queries/comportamental-operacoes";
import { getBorderosLiberados, getBorderosLiberadosParaExportacao } from "@/lib/db/queries/borderos-liberados";
import { getRelatorioTitulos, getRelatorioTitulosParaExportacao } from "@/lib/db/queries/relatorio-titulos";
import { getExposicaoCedente, getExposicaoCedenteParaExportacao } from "@/lib/db/queries/exposicao-cedente";
import { getGraficoTitulosMensal } from "@/lib/db/queries/graficos-titulos";
import { getGraficoDesagiosMensal } from "@/lib/db/queries/graficos-desagios";
import { getGraficoComissoesMensal } from "@/lib/db/queries/graficos-comissoes";
import { getGraficoVencidosMensal } from "@/lib/db/queries/graficos-vencidos";
import { getGraficoRecompraMensal } from "@/lib/db/queries/graficos-recompra";
import { getGraficoLiquidezPontualMensal } from "@/lib/db/queries/graficos-liquidez-pontual";
import { getGraficoVencidoPorMesMensal, getAnoMinimoVencido } from "@/lib/db/queries/graficos-vencido-por-mes";
import { getGraficoTotalPagoMensal } from "@/lib/db/queries/graficos-total-pago";
import { GRAFICO_ANO_MIN, GRAFICO_ANO_MAX, type PontoMensal } from "@/lib/db/queries/graficos-shared";
import {
  resolverComercialPorNome,
  resolverCliforPorNome,
  resolverGrupoEconomicoPorNome,
  type ResolucaoEntidade,
} from "./entity-resolver";

// Camada de tradução do módulo de IA (RAG) — CLAUDE.md seção 12, desenhada
// em 2026-07-18. "Pergunta comum" nunca gera SQL: mapeia pra um destes
// templates, que reaproveitam exatamente as mesmas funções de query já
// usadas pelas telas — nunca duplica lógica de negócio nem reimplementa
// STATUS_PAGTO/JUROS_MENSAL/etc.
//
// Mesmo padrão de registro central já usado em graficos-registry.ts e
// comportamental-grupos-registry.ts: um objeto por grupo de métrica,
// consultado tanto pelo roteador de intenção (pra montar as "tools" da
// chamada à Claude) quanto pela execução (resolverEExecutar).
//
// A trava de acesso (RLS) NUNCA é responsabilidade do template individual
// lembrar de aplicar — é estruturalmente obrigatória: toda função de query
// chamada aqui exige `Scoped<T>` (ver src/lib/auth/access-scope.ts), que só
// `applyAccessScope`/`resolveComercialParam` conseguem produzir. Um
// template que esquecesse a trava simplesmente não compilaria.
//
// Cobertura dos 17 grupos da seção 22 do CLAUDE.md (inventariados em
// 2026-07-18): consolidados em menos templates do que grupos, sempre que
// vários números vêm da MESMA tela com os MESMOS parâmetros — menos tools
// pro roteador escolher entre, mais fácil de acertar. "Grupo Econômico" e
// "Auxiliares" ficaram de fora de propósito: são dimensões de filtro/
// cascata (cadastro), não perguntas que alguém faz diretamente. "Comportamental
// (Acumulado)" também não virou template à parte — é o guarda-chuva dos
// grupos Tranche/Liquidez/Recompra/VOP/Tarifário/Operações, que já têm
// template próprio abaixo.
//
// Refino 2026-07-19 (pedido do cliente): a resposta padrão é SEMPRE um
// texto executivo direto (`resumo`, com os valores em **negrito** —
// markdown simples, renderizado pela UI) — nunca uma tabela/linha crua por
// padrão. `linhas`/`totais` só vêm preenchidos quando o parâmetro
// `detalhar` (extraído pelo roteador a partir de frases como "liste",
// "mostra a tabela", "detalhe por título") vem `true`. Templates cujo
// resultado envolve datas de título/deságio/comissão (só `comissoes` por
// enquanto) exigem que o usuário escolha o EIXO de data (compra/pagamento/
// vencimento, igual ao seletor do módulo Gráficos) antes de executar,
// sempre que um período foi mencionado sem deixar claro qual data usar —
// ver `precisaEsclarecer`/`esclarecimentoOpcoes` e o fluxo em
// src/app/api/ia/pergunta/route.ts. Mesmo mecanismo reaproveitado em 2026-07-19
// pro template `liquidez` (janela geral/30/60/90d, em vez de eixo de data).
export interface IaTemplateResultado {
  /** Resposta pronta pra exibir — frase(s) direta(s) em português, com os
   * valores já formatados e em **negrito** (markdown simples). SEMPRE
   * preenchida; é o que a UI mostra por padrão. */
  resumo: string;
  /** Linhas de detalhe (tabela) — só preenchidas quando o usuário pediu
   * detalhamento (`detalhar: true`); a UI só renderiza tabela quando isso
   * vier não-vazio. */
  linhas: Record<string, unknown>[];
  totais?: Record<string, number>;
  /** Preenchido só pelo template `graficos` — uma ou mais séries mensais
   * (jan-dez) pra render visual (Recharts) no chat, quando o usuário pediu
   * um gráfico. Nenhum outro template usa este campo. `unidade` diz como
   * formatar os valores da série — "moeda" (padrão, R$) ou "percentual"
   * (ex: Liquidez Pontual, valores já em escala 0-100). */
  graficos?: {
    titulo: string;
    cor: string;
    unidade?: "moeda" | "percentual";
    pontos: { mes: number; valor: number }[];
  }[];
  /** Gráfico de barras por CATEGORIA (ex: um comercial por barra), não por
   * mês — usado quando a pergunta pede um eixo X diferente de "mês"
   * (ex: "gráfico com o eixo X sendo os comerciais"). Só o template
   * `comissoes` usa este campo até agora (agrupar_por_comercial +
   * formato=grafico). */
  graficoCategorico?: {
    titulo: string;
    cor: string;
    unidade?: "moeda" | "percentual";
    itens: { rotulo: string; valor: number }[];
  };
  /** Rótulo pra citar a fonte na resposta final ("segundo o Relatório de
   * Comissões..."), nunca inventado pelo modelo. */
  fonte: string;
  /** Preenchido quando um nome citado na pergunta não foi encontrado ou é
   * ambíguo — a síntese da resposta deve pedir esclarecimento em vez de
   * adivinhar ou seguir com um código errado. */
  avisoResolucao?: string;
}

export interface IaTemplate {
  slug: string;
  grupo: string;
  /** Descrição em português, direcionada ao modelo — explica quando essa
   * tool deve ser escolhida. Vira o `description` da tool na chamada Tool
   * Use (ver router.ts). */
  descricaoParaLLM: string;
  /** JSON Schema dos parâmetros que o modelo deve extrair da pergunta —
   * vira o `input_schema` da tool. */
  parametrosSchema: Record<string, unknown>;
  resolverEExecutar: (
    params: Record<string, unknown>,
    session: Session | null,
  ) => Promise<IaTemplateResultado>;
  /** Mecanismo genérico de esclarecimento — usado sempre que um template
   * tem uma escolha ambígua que NUNCA deve ser assumida por conta própria
   * (eixo de data em título/deságio/comissão, janela de liquidez, etc. —
   * CLAUDE.md seção 12). Se `precisaEsclarecer` retornar true, a API
   * interrompe ANTES de `resolverEExecutar` e devolve uma pergunta de
   * esclarecimento com `esclarecimentoOpcoes` pro usuário escolher; a
   * escolha é gravada em `params[esclarecimentoCampo]` e a execução é
   * retomada sem passar pelo roteador de novo. */
  precisaEsclarecer?: (params: Record<string, unknown>) => boolean;
  esclarecimentoCampo?: string;
  esclarecimentoOpcoes?: { valor: string; rotulo: string }[];
  /** Texto da pergunta de esclarecimento exibida ao usuário — padrão é a
   * pergunta de eixo de data ("Com base em qual data...?") se omitido, já
   * que essa foi a primeira e ainda é a mais comum. */
  esclarecimentoMensagem?: string;
}

// Parâmetros de nome que praticamente todo template aceita — Comercial,
// Cedente, Sacado citados por nome na pergunta (nunca por código, o usuário
// não sabe o código). Reaproveitado no schema de cada template.
const PARAM_COMERCIAL_NOME = {
  type: "string",
  description:
    "Nome (ou parte do nome) do comercial/indicante/operador citado na pergunta, se houver. Ex: 'Loureiro', 'Tainá'.",
};
const PARAM_CEDENTE_NOME = {
  type: "string",
  description: "Nome (ou parte do nome) do cedente citado na pergunta, se houver.",
};
const PARAM_SACADO_NOME = {
  type: "string",
  description: "Nome (ou parte do nome) do sacado citado na pergunta, se houver.",
};
// Grupo Econômico (2026-07-19, correção de gap real: a IA não tinha NENHUM
// jeito de filtrar por grupo econômico, mesmo esse filtro existindo em
// quase toda tela da plataforma). Nome/código citado como "153", "Grupo
// Água Branca" ou "153 - Grupo Água Branca" (rótulo padrão da plataforma).
const PARAM_GRUPO_ECONOMICO_NOME = {
  type: "string",
  description: "Nome ou código do grupo econômico citado na pergunta (ex: '153', 'Grupo Água Branca'), se houver.",
};
// Templates de grão duplo (cedente E sacado, ex: comissões, títulos,
// carteira de sacados) têm DOIS grupos econômicos possíveis — nunca
// confundir um pelo outro.
const PARAM_GRUPO_CEDENTE_NOME = {
  type: "string",
  description: "Nome ou código do grupo econômico do CEDENTE citado na pergunta, se houver.",
};
const PARAM_GRUPO_SACADO_NOME = {
  type: "string",
  description: "Nome ou código do grupo econômico do SACADO citado na pergunta, se houver.",
};
// Teto de segurança pro detalhamento pedido na IA (2026-07-19, "retorne
// todas as linhas quando detalhar for pedido") — busca o universo INTEIRO
// filtrado (mesma função *ParaExportacao já usada pelos botões "Exportar"
// de cada tela, sem paginação), não só a página de 20/50 que a tela mostra.
// O teto aqui é só uma rede de segurança contra pergunta sem filtro nenhum
// (ex: "liste todos os títulos" sem comercial/cedente) — evita mandar
// centenas de milhares de linhas na resposta do chat; a exportação Excel em
// si (api/ia/exportar-excel) tem seu próprio teto de 10 mil linhas.
const MAX_LINHAS_DETALHE = 5000;

async function buscarLinhasDetalhadas<T>(exportar: () => Promise<T[]>): Promise<{
  linhas: T[];
  avisoTruncamento?: string;
}> {
  const todas = await exportar();
  if (todas.length > MAX_LINHAS_DETALHE) {
    return {
      linhas: todas.slice(0, MAX_LINHAS_DETALHE),
      avisoTruncamento: `O resultado tem ${todas.length.toLocaleString("pt-BR")} linhas — mostrando as primeiras ${MAX_LINHAS_DETALHE.toLocaleString("pt-BR")}. Adicione um filtro (comercial, cedente...) pra reduzir o universo.`,
    };
  }
  return { linhas: todas };
}

// Projeta só as colunas de identificação — usado quando `listar_simples`
// (não `detalhar`) foi pedido, pra devolver uma lista enxuta em vez do
// relatório financeiro completo.
function projetarColunasMinimas<T>(linhas: T[], colunas: (keyof T)[]): Record<string, unknown>[] {
  return linhas.map((linha) => {
    const projetada: Record<string, unknown> = {};
    for (const coluna of colunas) projetada[coluna as string] = linha[coluna];
    return projetada;
  });
}

const PARAM_DETALHAR = {
  type: "boolean",
  description:
    "true SOMENTE se o usuário pedir o relatório/tabela COMPLETA, com todas as colunas (ex: 'detalhe por título', 'mostra a tabela completa', 'exporta pra mim', 'quero todos os dados'). NÃO use pra uma pergunta simples de 'quais são eles?'/'quem são?' — nesse caso use listar_simples, não detalhar.",
};
// Pedido de LISTA SIMPLES (2026-07-19, pedido do cliente: "quais são
// eles?" depois de já saber a contagem — não precisa do relatório
// financeiro completo, só os nomes) — diferente de `detalhar`, que traz
// TODAS as colunas (limite, risco, taxa, método etc.). `listar_simples`
// devolve só as 2-3 colunas de identificação (código/título + cedente),
// sem os totais em pills.
const PARAM_LISTAR_SIMPLES = {
  type: "boolean",
  description:
    "true se o usuário pedir só a LISTA/NOMES dos itens, sem detalhamento financeiro (ex: 'quais são eles?', 'quem são?', 'liste os nomes', 'quais cedentes são esses?'). Retorna só as colunas de identificação — nunca os demais dados (limite, risco, valores, taxas etc.). Diferente de 'detalhar', que traz o relatório financeiro completo.",
};

// Formatação — valores sempre formatados como texto (nunca números crus),
// pra não depender de a UI adivinhar se um número é dinheiro, percentual ou
// dias (CLAUDE.md — cada grupo tem sua própria convenção de unidade,
// documentada nas interfaces XxxTotais de cada query file).
function fmtMoeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPercentFracao(v: number): string {
  return `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
function fmtDias(v: number): string {
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} dias`;
}
function fmtInt(v: number): string {
  return v.toLocaleString("pt-BR");
}

const MESES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function formatarDataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
}

// Frase de período em português a partir de datas YYYY-MM-DD extraídas pelo
// roteador — detecta mês cheio ("em junho de 2026") pra soar natural no caso
// mais comum; cai pra intervalo explícito nos demais casos.
function formatarPeriodo(inicio: string | null, fim: string | null): string {
  if (!inicio && !fim) return "";
  if (inicio && fim) {
    const [anoI, mesI, diaI] = inicio.split("-").map(Number);
    const [anoF, mesF, diaF] = fim.split("-").map(Number);
    const ultimoDiaMes = new Date(anoF, mesF, 0).getDate();
    if (anoI === anoF && mesI === mesF && diaI === 1 && diaF === ultimoDiaMes) {
      return `em ${MESES_PT[mesI - 1]} de ${anoI}`;
    }
    if (inicio === fim) return `em ${formatarDataBR(inicio)}`;
    return `entre ${formatarDataBR(inicio)} e ${formatarDataBR(fim)}`;
  }
  return inicio ? `a partir de ${formatarDataBR(inicio)}` : `até ${formatarDataBR(fim as string)}`;
}

// true quando o intervalo cobre exatamente um ou mais meses inteiros (dia 1
// ao último dia do mês) — usado pra saber se dá pra responder um período
// customizado com precisão total ou só por aproximação de mês.
function ehIntervaloDeMesesCheios(inicio: string, fim: string): boolean {
  const [, , diaI] = inicio.split("-").map(Number);
  const [anoF, mesF, diaF] = fim.split("-").map(Number);
  const ultimoDiaMesFim = new Date(anoF, mesF, 0).getDate();
  return diaI === 1 && diaF === ultimoDiaMesFim;
}

// Lista os pares {ano, mes} cobertos pelo intervalo — usado pra somar
// valores de gráficos mensualizados (ex: VOP Cedente) num período
// customizado pedido na pergunta ("em junho", "no 2º trimestre").
function mesesNoIntervalo(inicio: string, fim: string): { ano: number; mes: number }[] {
  const [anoI, mesI] = inicio.split("-").map(Number);
  const [anoF, mesF] = fim.split("-").map(Number);
  const resultado: { ano: number; mes: number }[] = [];
  let ano = anoI;
  let mes = mesI;
  while (ano < anoF || (ano === anoF && mes <= mesF)) {
    resultado.push({ ano, mes });
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  return resultado;
}

// Sujeito da frase — sempre usa o substantivo comum ("o comercial"/"o
// cedente"/"o sacado") como núcleo do artigo em vez do nome próprio citado
// (que pode ser de gênero indeterminável pro sistema), evitando concordância
// errada tipo "A Loureiro" quando "Loureiro" é sobrenome masculino.
function sujeitoComercial(nome: string | null): string {
  return nome ? `O comercial ${nome}` : "A carteira";
}
function sujeitoCedente(nome: string | null): string {
  return nome ? `O cedente ${nome}` : "A carteira";
}
function sujeitoSacado(nome: string | null): string {
  return nome ? `O sacado ${nome}` : "A carteira";
}
function sujeitoGrupoEconomico(nome: string | null): string {
  return nome ? `O grupo econômico ${nome}` : "A carteira";
}
// Prioridade cedente > comercial > grupo econômico > carteira — usado nos
// templates que aceitam os 3 filtros ao mesmo tempo (a maioria dos grupos
// do Comportamental). `min` é a versão minúscula pra meio de frase, `entidade`
// é null quando nenhum filtro específico foi citado (pra resumoContagem
// cair no "Atualmente temos" em vez de "A carteira tem").
function sujeitoComGrupo(
  cedenteNome: string | null,
  comercialNome: string | null,
  grupoNome: string | null,
): { min: string; nominativo: string; entidade: string | null } {
  if (cedenteNome) return { min: sujeitoCedenteMin(cedenteNome), nominativo: sujeitoCedente(cedenteNome), entidade: sujeitoCedente(cedenteNome) };
  if (comercialNome) return { min: sujeitoComercialMin(comercialNome), nominativo: sujeitoComercial(comercialNome), entidade: sujeitoComercial(comercialNome) };
  if (grupoNome) return { min: `o grupo econômico ${grupoNome}`, nominativo: sujeitoGrupoEconomico(grupoNome), entidade: sujeitoGrupoEconomico(grupoNome) };
  return { min: "a carteira", nominativo: "A carteira", entidade: null };
}
// Prioridade comercial > cedente > sacado > carteira — usado nos templates
// que aceitam mais de um tipo de entidade ao mesmo tempo (ex: comissões).
function sujeitoGenerico(
  comercial: string | null,
  cedente: string | null,
  sacado: string | null,
): string {
  if (comercial) return `O comercial ${comercial}`;
  if (cedente) return `O cedente ${cedente}`;
  if (sacado) return `O sacado ${sacado}`;
  return "A carteira";
}
// Versão minúscula (meio de frase, "Nesse filtro, o cedente X...") — nunca
// usar `.toLowerCase()` no resultado de sujeitoCedente/sujeitoComercial pra
// isso: derrubaria o nome próprio junto (bug corrigido em 2026-07-19, ex:
// "potenza industria..." em vez de "Potenza Industria...").
function sujeitoCedenteMin(nome: string | null): string {
  return nome ? `o cedente ${nome}` : "a carteira";
}
function sujeitoComercialMin(nome: string | null): string {
  return nome ? `o comercial ${nome}` : "a carteira";
}
// Contexto genitivo ("Liquidez pontual {contextoDe}") — cedente tem
// prioridade sobre comercial (mais específico), igual à prioridade já usada
// nos outros helpers de sujeito.
function contextoDe(comercialNome: string | null, cedenteNome: string | null): string {
  if (cedenteNome) return `do cedente ${cedenteNome}`;
  if (comercialNome) return `do comercial ${comercialNome}`;
  return "da carteira";
}

// Resumo de um único valor: "{sujeito} {predicado} **{valor}**."
function resumoValorUnico(sujeito: string, predicado: string, valor: string): string {
  return `${sujeito} ${predicado} **${valor}**.`;
}
// Resumo de múltiplos indicadores relacionados: "{intro}: rótulo: **valor**; rótulo: **valor**."
function resumoMultiplo(intro: string, itens: { rotulo: string; valor: string }[]): string {
  return `${intro}: ${itens.map((i) => `${i.rotulo}: **${i.valor}**`).join("; ")}.`;
}

// Templates com vários indicadores relacionados (Operações, Tarifário,
// Liquidez, Recompra, VOP) SEMPRE devolviam TODOS os campos de uma vez,
// mesmo quando a pergunta pedia só um ("Qual o Prazo Médio Geral das
// operações?" retornava os 8 campos do grupo) — corrigido em 2026-07-19
// (pedido do cliente: "sintetizar os textos... retornar somente o que foi
// solicitado"). Quando o roteador extrai um `metrica` específico e ele bate
// com uma chave em `porMetrica`, devolve só aquele valor (frase única, como
// os demais templates); sem `metrica` (pergunta genérica, "como estão as
// operações do cedente X"), continua devolvendo o panorama completo.
function resumoComMetrica(
  metricaParam: unknown,
  porMetrica: Record<string, { predicado: string; valor: string }>,
  sujeitoNominativo: string,
  intro: string,
  todosItens: { rotulo: string; valor: string }[],
): string {
  const chave = typeof metricaParam === "string" ? metricaParam : null;
  if (chave && porMetrica[chave]) {
    return resumoValorUnico(sujeitoNominativo, porMetrica[chave].predicado, porMetrica[chave].valor);
  }
  return resumoMultiplo(intro, todosItens);
}

// Resposta pra "quantos X temos" — pedido do cliente em 2026-07-19: uma
// pergunta de contagem sem entidade específica ("Quantos títulos vencidos
// temos atualmente?") não deve soar como "A carteira tem 597 títulos" (frio,
// e sem citar o filtro aplicado) — deve ser direta, na primeira pessoa do
// plural, e sempre carregar o qualificador do filtro quando houver (ex:
// "vencidos", "a vencer", "em tranche vencida") em vez de deixá-lo de fora
// da frase. Com uma entidade específica citada (comercial/cedente/sacado),
// mantém a 3ª pessoa ("O cedente X tem..."), que já lê bem.
function resumoContagem(
  sujeitoEntidade: string | null,
  itemPlural: string,
  quantidade: number,
  qualificador?: string,
): string {
  const qualifTexto = qualificador ? ` ${qualificador}` : "";
  const contagem = `${fmtInt(quantidade)} ${itemPlural}${qualifTexto}`;
  return sujeitoEntidade
    ? `${sujeitoEntidade} tem **${contagem}**.`
    : `Atualmente temos **${contagem}**.`;
}

// Traduz o valor cru de STATUS_PAGTO (19.1) pro adjetivo plural usado na
// frase de contagem — "vencidos", "a vencer" etc.
const QUALIFICADOR_STATUS_PAGAMENTO: Record<string, string> = {
  Vencido: "vencidos",
  "A Vencer": "a vencer",
  "Pago Em Dia": "pagos em dia",
  "Pago Vencido": "pagos com atraso",
};

// Resolve um parâmetro de nome (vindo do tool call) pro código + nome de
// exibição reais, registrando um aviso em vez de travar quando o nome não é
// encontrado ou é ambíguo — a síntese da resposta decide como comunicar isso
// ao usuário, nunca segue adiante com um código adivinhado.
async function resolveNomeParaCodigo(
  nomeParam: unknown,
  resolver: (nome: string) => Promise<ResolucaoEntidade>,
  avisos: string[],
  rotulo: string,
): Promise<{ codigo: string | null; nome: string | null }> {
  if (typeof nomeParam !== "string" || !nomeParam.trim()) return { codigo: null, nome: null };
  const resultado = await resolver(nomeParam);
  if (resultado.status === "encontrado") {
    return { codigo: resultado.codigo ?? null, nome: resultado.nome ?? nomeParam };
  }
  if (resultado.status === "ambiguo") {
    const nomes = (resultado.opcoes ?? []).map((o) => o.nome).join(", ");
    avisos.push(`"${nomeParam}" bateu com mais de um ${rotulo} (${nomes}) — preciso que você especifique qual.`);
    return { codigo: null, nome: null };
  }
  avisos.push(`Não encontrei nenhum ${rotulo} chamado "${nomeParam}".`);
  return { codigo: null, nome: null };
}

// Extrai comercial/cedente/sacado dos parâmetros do tool call de uma vez só
// — repetido em quase todo template.
async function resolverEscopoComum(
  params: Record<string, unknown>,
  avisos: string[],
  opcoes: {
    comercial?: boolean;
    cedente?: boolean;
    sacado?: boolean;
    /** Opt-in (padrão false) — só os templates com filtro de grupo
     * econômico pedem, evita a consulta extra nos demais. */
    grupoEconomico?: boolean;
    grupoCedente?: boolean;
    grupoSacado?: boolean;
  } = {},
) {
  const vazio = { codigo: null, nome: null };
  const comercial =
    opcoes.comercial === false
      ? vazio
      : await resolveNomeParaCodigo(params.comercial_nome, resolverComercialPorNome, avisos, "comercial");
  const cedente =
    opcoes.cedente === false
      ? vazio
      : await resolveNomeParaCodigo(params.cedente_nome, resolverCliforPorNome, avisos, "cedente");
  const sacado =
    opcoes.sacado === false
      ? vazio
      : await resolveNomeParaCodigo(params.sacado_nome, resolverCliforPorNome, avisos, "sacado");
  const grupoEconomico = opcoes.grupoEconomico
    ? await resolveNomeParaCodigo(params.grupo_economico_nome, resolverGrupoEconomicoPorNome, avisos, "grupo econômico")
    : vazio;
  const grupoCedente = opcoes.grupoCedente
    ? await resolveNomeParaCodigo(params.grupo_cedente_nome, resolverGrupoEconomicoPorNome, avisos, "grupo econômico do cedente")
    : vazio;
  const grupoSacado = opcoes.grupoSacado
    ? await resolveNomeParaCodigo(params.grupo_sacado_nome, resolverGrupoEconomicoPorNome, avisos, "grupo econômico do sacado")
    : vazio;
  return { comercial, cedente, sacado, grupoEconomico, grupoCedente, grupoSacado };
}

// Eixo de data pro grupo Comissões (título/deságio/comissão) — mesmas 3
// variações do módulo Gráficos (CLAUDE.md seção 23, "Gráficos"): compra
// (DIGITACAO), pagamento (DTPGTO) e vencimento (DATA). Perguntado ao usuário
// (nunca adivinhado) sempre que um período foi mencionado sem deixar claro
// qual data usar.
const EIXO_OPCOES_COMISSOES = [
  { valor: "compra", rotulo: "Data de Compra" },
  { valor: "pagamento", rotulo: "Data de Pagamento" },
  { valor: "vencimento", rotulo: "Data de Vencimento" },
];
const EIXO_LABEL_COMISSOES: Record<string, string> = {
  compra: "data de compra",
  pagamento: "data de pagamento",
  vencimento: "data de vencimento",
};
const METRICA_VERBO_COMISSOES: Record<string, string> = {
  comissao: "recebeu de comissão",
  valor_titulo: "movimentou em valor de títulos",
  desagio: "teve de deságio",
};
// Verbo no "tempo futuro" — usado quando o período pedido ainda não
// aconteceu (CLAUDE.md seção 12, pedido do cliente em 2026-07-19: "Quanto
// de comissão está previsto o Agenor receber em agosto de 2026?" não pode
// responder "recebeu" pra um mês que ainda não chegou). Ver `periodoNoFuturo`.
const METRICA_VERBO_COMISSOES_FUTURO: Record<string, string> = {
  comissao: "tem previsão de comissão",
  valor_titulo: "tem previsão de movimentação em valor de títulos",
  desagio: "tem previsão de deságio",
};

// true quando o período pedido (início) ainda não começou — usado pra
// escolher tempo verbal (passado/presente "recebeu" vs. futuro "tem
// previsão de") na síntese da resposta. Só considera "futuro" se o INÍCIO
// do período for depois de hoje — um período que já começou (mesmo que
// termine no futuro) usa o tempo verbal normal, já está em andamento.
function periodoNoFuturo(periodoInicio: string | null): boolean {
  if (!periodoInicio) return false;
  const hojeISO = new Date().toISOString().slice(0, 10);
  return periodoInicio > hojeISO;
}

export const TEMPLATES: Record<string, IaTemplate> = {
  // Grupo 17 (Comissões) — CLAUDE.md 19.6. Reaproveita getComissoes tal e
  // qual a tela usa, só que sem paginação/ordenação explícita (a IA não
  // precisa de página 2 — pede um recorte razoável e soma os totais).
  comissoes: {
    slug: "comissoes",
    grupo: "Comissões",
    descricaoParaLLM:
      "Perguntas sobre comissão de comerciais, valor de títulos ou deságio: valor de comissão, faixa de comissão, deságio, títulos que geraram comissão, OU um relatório/lista/GRÁFICO com a comissão de VÁRIOS comerciais ao mesmo tempo (ex: 'todos os comerciais internos', 'gráfico com um comercial em cada barra'). Sem `metrica` especificada, devolve os 3 valores de uma vez (título, deságio, comissão) — use assim quando a pergunta pedir mais de um desses 3 dados juntos, inclusive pra um DIA específico (`periodo_inicio`=`periodo_fim`=aquele dia) ou qualquer intervalo exato de datas — esta ferramenta aceita qualquer período (dia, semana, mês, intervalo customizado), nunca só o mês inteiro. ESTA é a ferramenta certa (agrupar_por_comercial=true, formato='grafico') sempre que a pergunta pedir um gráfico com eixo X = nomes de comerciais/uma barra por comercial — NUNCA a ferramenta `graficos` nesse caso, que é só pra eixo X = mês/ano. Ex: 'quanto o Loureiro recebeu de comissão em janeiro?', 'qual a comissão total do mês?', 'qual o deságio do cedente X em junho?', 'valor de títulos, deságio e comissão do dia 17/07/2026', 'faça um relatório das comissões de todos os comerciais internos em junho', 'gráfico com o eixo X sendo os comerciais internos e o valor de comissão de junho de 2026'.",
    parametrosSchema: {
      type: "object",
      properties: {
        comercial_nome: PARAM_COMERCIAL_NOME,
        cedente_nome: PARAM_CEDENTE_NOME,
        sacado_nome: PARAM_SACADO_NOME,
        grupo_cedente_nome: PARAM_GRUPO_CEDENTE_NOME,
        grupo_sacado_nome: PARAM_GRUPO_SACADO_NOME,
        metrica: {
          type: "string",
          enum: ["comissao", "valor_titulo", "desagio"],
          description: "Qual valor a pergunta pede: comissão, valor do título, ou deságio. Padrão: comissao.",
        },
        periodo_inicio: {
          type: "string",
          description: "Início do período mencionado na pergunta, formato YYYY-MM-DD, se houver.",
        },
        periodo_fim: {
          type: "string",
          description: "Fim do período mencionado na pergunta, formato YYYY-MM-DD, se houver.",
        },
        eixo_data: {
          type: "string",
          enum: ["compra", "pagamento", "vencimento"],
          description:
            "Qual data usar pro período: 'compra' (data de compra/digitação), 'pagamento' (data de recebimento/pagamento), ou 'vencimento' (data de vencimento do título). SÓ preencha se a pergunta deixar isso EXPLÍCITO (ex: 'pago em junho' = pagamento, 'comprado em junho' = compra, 'vence em junho' = vencimento) — se a pergunta só disser um período sem indicar qual data, deixe este campo de fora.",
        },
        agrupar_por_comercial: {
          type: "boolean",
          description:
            "true se a pergunta pedir um relatório/lista/gráfico com VÁRIOS comerciais ao mesmo tempo (ex: 'todos os comerciais', 'cada comercial interno', 'relatório por comercial', 'gráfico com um comercial em cada barra') — retorna uma linha (ou barra) por comercial. Não confundir com 'detalhar', que lista títulos individuais de UM comercial/cedente.",
        },
        tipo_comercial: {
          type: "string",
          enum: ["interno", "externo", "todos"],
          description:
            "Filtro de tipo de comercial — só relevante junto com agrupar_por_comercial. Ex: 'comerciais internos' = interno. Padrão: todos.",
        },
        formato: {
          type: "string",
          enum: ["tabela", "grafico"],
          description:
            "Só relevante junto com agrupar_por_comercial: 'tabela' (padrão) pra relatório/lista, ou 'grafico' se a pergunta pedir explicitamente um gráfico/visualização/barras/eixo X por comercial.",
        },
        detalhar: PARAM_DETALHAR,
        listar_simples: PARAM_LISTAR_SIMPLES,
      },
      additionalProperties: false,
    },
    // Período mencionado sem eixo explícito = ambíguo, precisa perguntar
    // (CLAUDE.md seção 12, pedido do cliente em 2026-07-19) — nunca assume
    // um eixo padrão silenciosamente.
    precisaEsclarecer: (params) => {
      const temPeriodo = typeof params.periodo_inicio === "string" && params.periodo_inicio.trim() !== "";
      const eixo = params.eixo_data;
      return temPeriodo && eixo !== "compra" && eixo !== "pagamento" && eixo !== "vencimento";
    },
    esclarecimentoCampo: "eixo_data",
    esclarecimentoOpcoes: EIXO_OPCOES_COMISSOES,
    resolverEExecutar: async (params, session) => {
      const avisos: string[] = [];
      const { comercial, cedente, sacado, grupoCedente, grupoSacado } = await resolverEscopoComum(params, avisos, {
        grupoCedente: true,
        grupoSacado: true,
      });

      const periodoInicio = typeof params.periodo_inicio === "string" ? params.periodo_inicio : null;
      const periodoFim = typeof params.periodo_fim === "string" ? params.periodo_fim : null;
      const eixo: "compra" | "pagamento" | "vencimento" =
        params.eixo_data === "compra" || params.eixo_data === "vencimento" ? params.eixo_data : "pagamento";

      const filtros = applyAccessScope(
        {
          comercial: comercial.codigo ?? "",
          cedente: cedente.codigo ?? "",
          sacado: sacado.codigo ?? "",
          grupoCedente: grupoCedente.codigo ?? "",
          grupoSacado: grupoSacado.codigo ?? "",
          bordero: "",
          titulo: "",
          situacao: "",
          statusPagamento: "",
          tipoPagamento: "",
          dataCompraInicio: eixo === "compra" ? periodoInicio : null,
          dataCompraFim: eixo === "compra" ? periodoFim : null,
          dataPagamentoInicio: eixo === "pagamento" ? periodoInicio : null,
          dataPagamentoFim: eixo === "pagamento" ? periodoFim : null,
          vencimentoInicio: eixo === "vencimento" ? periodoInicio : null,
          vencimentoFim: eixo === "vencimento" ? periodoFim : null,
        },
        session,
      );

      // Relatório agrupado por comercial (pedido do cliente em 2026-07-19,
      // "faça um relatório das comissões de todos os comerciais internos")
      // — grão COMERCIAL, não título; sempre volta como tabela (é
      // literalmente o que foi pedido), independente do `detalhar`.
      if (params.agrupar_por_comercial === true) {
        const tipoComercial: "interno" | "externo" | "todos" =
          params.tipo_comercial === "interno" || params.tipo_comercial === "externo" ? params.tipo_comercial : "todos";
        const porComercial = await getComissoesPorComercial(filtros, tipoComercial);
        const totalGeral = porComercial.reduce((soma, r) => soma + r.comissao, 0);
        const tipoLabel = tipoComercial === "interno" ? " internos" : tipoComercial === "externo" ? " externos" : "";
        const periodoFraseRel = formatarPeriodo(periodoInicio, periodoFim);
        const resumoRel = `Relatório de comissão por comercial${tipoLabel}${periodoFraseRel ? ` ${periodoFraseRel}` : ""}: **${porComercial.length}** comerciais, total de **${fmtMoeda(totalGeral)}**.`;
        const fonteRel = periodoFraseRel ? `Relatório de Comissões — ${EIXO_LABEL_COMISSOES[eixo]}` : "Relatório de Comissões";

        // Gráfico por comercial (eixo X = comercial, não mês) — pedido do
        // cliente em 2026-07-19: "gráfico onde o eixo X seja os nomes dos
        // comerciais". Reaproveita a MESMA consulta agrupada por comercial
        // já usada no relatório em tabela, só muda a forma de exibir.
        if (params.formato === "grafico") {
          return {
            resumo: resumoRel,
            linhas: [],
            graficoCategorico: {
              titulo: `Comissão por Comercial${tipoLabel}${periodoFraseRel ? ` — ${periodoFraseRel}` : ""}`,
              cor: "#2D5C3A",
              itens: porComercial
                .slice()
                .sort((a, b) => b.comissao - a.comissao)
                .map((r) => ({ rotulo: r.comercial ?? r.codigoComercial ?? "—", valor: r.comissao })),
            },
            fonte: fonteRel,
            avisoResolucao: avisos.length ? avisos.join(" ") : undefined,
          };
        }

        return {
          resumo: resumoRel,
          linhas: porComercial.map((r) => ({ comercial: r.comercial, tipo: r.tipo, comissao: r.comissao })),
          totais: { comissao: totalGeral },
          fonte: fonteRel,
          avisoResolucao: avisos.length ? avisos.join(" ") : undefined,
        };
      }

      const pagina = await getComissoes(1, 50, "comissao", "desc", filtros);

      const sujeitoGrupoComissoes = grupoCedente.nome
        ? `O grupo econômico ${grupoCedente.nome} (cedente)`
        : grupoSacado.nome
          ? `O grupo econômico ${grupoSacado.nome} (sacado)`
          : null;
      const sujeito = sujeitoGenerico(comercial.nome, cedente.nome, sacado.nome) === "A carteira" && sujeitoGrupoComissoes
        ? sujeitoGrupoComissoes
        : sujeitoGenerico(comercial.nome, cedente.nome, sacado.nome);
      const periodoFrase = formatarPeriodo(periodoInicio, periodoFim);
      const futuro = periodoNoFuturo(periodoInicio);
      // Sem `metrica` explícito, a pergunta pediu o panorama (ex: "títulos,
      // deságio e comissão do dia X") — corrigido em 2026-07-19: antes
      // sempre caía só em "comissao" por padrão, então uma pergunta pedindo
      // os 3 valores de uma vez não tinha como ser atendida por este
      // template e o roteador escolhia `graficos` como alternativa — mas
      // `graficos` só tem granularidade de MÊS (parâmetro `mes`), nunca um
      // dia específico, então a resposta vinha errada (mês inteiro em vez
      // do dia pedido). Mesmo padrão de fallback pra panorama já usado em
      // `tarifario`/`operacoes` (resumoComMetrica).
      const porMetrica: Record<string, { predicado: string; valor: string }> = {
        comissao: {
          predicado: `${(futuro ? METRICA_VERBO_COMISSOES_FUTURO : METRICA_VERBO_COMISSOES).comissao}${periodoFrase ? ` ${periodoFrase}` : ""} o total de`,
          valor: fmtMoeda(pagina.totais.comissao),
        },
        valor_titulo: {
          predicado: `${(futuro ? METRICA_VERBO_COMISSOES_FUTURO : METRICA_VERBO_COMISSOES).valor_titulo}${periodoFrase ? ` ${periodoFrase}` : ""} o total de`,
          valor: fmtMoeda(pagina.totais.valorTitulo),
        },
        desagio: {
          predicado: `${(futuro ? METRICA_VERBO_COMISSOES_FUTURO : METRICA_VERBO_COMISSOES).desagio}${periodoFrase ? ` ${periodoFrase}` : ""} o total de`,
          valor: fmtMoeda(pagina.totais.desagio),
        },
      };
      const resumo = resumoComMetrica(
        params.metrica,
        porMetrica,
        sujeito,
        `${sujeito}${periodoFrase ? `, ${periodoFrase}` : ""}`,
        [
          { rotulo: "valor de títulos", valor: fmtMoeda(pagina.totais.valorTitulo) },
          { rotulo: "deságio", valor: fmtMoeda(pagina.totais.desagio) },
          { rotulo: "comissão", valor: fmtMoeda(pagina.totais.comissao) },
        ],
      );

      const detalhar = params.detalhar === true;
      const listarSimples = params.listar_simples === true;
      let linhas: Record<string, unknown>[] = [];
      if (detalhar || listarSimples) {
        const { linhas: todas, avisoTruncamento } = await buscarLinhasDetalhadas(() =>
          getComissoesParaExportacao("comissao", "desc", filtros),
        );
        linhas = detalhar
          ? (todas as unknown as Record<string, unknown>[])
          : projetarColunasMinimas(todas, ["titulo", "cedente"]);
        if (avisoTruncamento) avisos.push(avisoTruncamento);
      }

      return {
        resumo,
        linhas,
        totais: detalhar ? (pagina.totais as unknown as Record<string, number>) : undefined,
        fonte: periodoFrase ? `Relatório de Comissões — ${EIXO_LABEL_COMISSOES[eixo]}` : "Relatório de Comissões",
        avisoResolucao: avisos.length ? avisos.join(" ") : undefined,
      };
    },
  },

  // Grupo 1 (Valores e Totais) + parte dos grupos 3 (Contagens), 5 (Taxas e
  // Prazos) e 6 (Tickets) — todos vêm do MESMO card set (Comercial - Visão
  // Geral) com o MESMO parâmetro único (comercial). Consolidado num só
  // template com uma métrica à escolha, em vez de 8 tools quase idênticas.
  comercial_visao_geral: {
    slug: "comercial_visao_geral",
    grupo: "Valores e Totais / Taxas e Prazos / Tickets / Contagens (Comercial - Visão Geral)",
    descricaoParaLLM:
      "Perguntas sobre indicadores gerais de um comercial (ou da carteira toda, se nenhum comercial for citado): limite de crédito, risco/exposição, limite disponível, valor a vencer, valor/títulos vencidos (quanto está vencido HOJE, um número único), prazo médio, taxa média, ticket médio, ou quantidade de cedentes. Pra 'títulos vencidos'/'valor vencido' SEM pedido de gráfico/mês a mês, esta é a ferramenta certa (metrica=vencido) — se a pergunta pedir um GRÁFICO de vencidos, use a ferramenta graficos (metrica 'vencido') em vez desta. Ex: 'qual o risco do Loureiro?', 'qual a taxa média da carteira?', 'quantos cedentes com risco a Tainá tem?', 'quanto temos de títulos vencidos?', 'qual o valor vencido do cedente X?'.",
    parametrosSchema: {
      type: "object",
      properties: {
        comercial_nome: PARAM_COMERCIAL_NOME,
        metrica: {
          type: "string",
          enum: [
            "limite_credito",
            "risco",
            "limite_disponivel",
            "a_vencer",
            "vencido",
            "prazo_medio",
            "taxa_media",
            "ticket_medio",
            "quantidade_cedentes",
          ],
          description: "Qual indicador a pergunta pede.",
        },
      },
      required: ["metrica"],
      additionalProperties: false,
    },
    resolverEExecutar: async (params, session) => {
      const avisos: string[] = [];
      const { comercial } = await resolverEscopoComum(params, avisos, { cedente: false, sacado: false });
      const comercialEscopado = resolveComercialParam(comercial.codigo ?? "", session);
      const metrica = typeof params.metrica === "string" ? params.metrica : "risco";
      const sujeito = sujeitoComercial(comercial.nome);

      let resumo: string;
      switch (metrica) {
        case "limite_credito":
          resumo = resumoValorUnico(sujeito, "tem limite de crédito de", fmtMoeda(await getLimiteCreditoCedente(comercialEscopado)));
          break;
        case "limite_disponivel": {
          const [limite, risco] = await Promise.all([
            getLimiteCreditoCedente(comercialEscopado),
            getRiscoCedente(comercialEscopado),
          ]);
          resumo = resumoValorUnico(sujeito, "tem limite disponível de", fmtMoeda(limite - risco));
          break;
        }
        case "a_vencer":
          resumo = resumoValorUnico(sujeito, "tem, a vencer,", fmtMoeda(await getAVencerCedente(comercialEscopado)));
          break;
        case "vencido":
          resumo = resumoValorUnico(sujeito, "tem vencido", fmtMoeda(await getVencidoCedente(comercialEscopado)));
          break;
        case "prazo_medio":
          resumo = resumoValorUnico(sujeito, "tem prazo médio de", fmtDias(await getPrazoMedioEstoque(comercialEscopado)));
          break;
        case "taxa_media": {
          const t = await getTaxaMedia(comercialEscopado);
          resumo = resumoMultiplo(sujeito, [
            { rotulo: "taxa média geral", valor: fmtPercentFracao(t.geral) },
            { rotulo: "taxa média do estoque", valor: fmtPercentFracao(t.estoque) },
          ]);
          break;
        }
        case "ticket_medio": {
          const t = await getTicketMedio(comercialEscopado);
          resumo = resumoMultiplo(sujeito, [
            { rotulo: "ticket médio geral", valor: fmtMoeda(t.geral) },
            { rotulo: "ticket médio do estoque", valor: fmtMoeda(t.estoque) },
          ]);
          break;
        }
        case "quantidade_cedentes": {
          const q = await getQuantidadeCedentes(comercialEscopado);
          resumo = resumoMultiplo(sujeito, [
            { rotulo: "cedentes com risco", valor: fmtInt(q.comRisco) },
            { rotulo: "cedentes sem risco", valor: fmtInt(q.semRisco) },
          ]);
          break;
        }
        case "risco":
        default:
          resumo = resumoValorUnico(sujeito, "tem risco de", fmtMoeda(await getRiscoCedente(comercialEscopado)));
          break;
      }

      return {
        resumo,
        linhas: [],
        fonte: "Comercial - Visão Geral",
        avisoResolucao: avisos.length ? avisos.join(" ") : undefined,
      };
    },
  },

  // Grupos 2 (Cards de Risco) e 4 (Cedentes) — Carteira de Clientes.
  carteira_clientes: {
    slug: "carteira_clientes",
    grupo: "Carteira de Clientes",
    descricaoParaLLM:
      "Perguntas sobre a lista de cedentes (clientes) e seus limites/risco individuais: quais cedentes têm risco, situação de um cedente, limite de crédito, limite disponível, vencido, a vencer, tranche — total ou por cedente. Ex: 'quais cedentes do Loureiro têm risco?', 'liste os cedentes sem risco', 'qual o limite de crédito total dos clientes sem risco?'.",
    parametrosSchema: {
      type: "object",
      properties: {
        comercial_nome: PARAM_COMERCIAL_NOME,
        cedente_nome: PARAM_CEDENTE_NOME,
        grupo_economico_nome: PARAM_GRUPO_ECONOMICO_NOME,
        visao: {
          type: "string",
          enum: ["todos", "com-risco", "sem-risco"],
          description: "Filtro de visão: todos os cedentes, só com risco, ou só sem risco. Padrão: todos.",
        },
        metrica: {
          type: "string",
          enum: ["quantidade", "risco", "limite_credito", "limite_disponivel", "vencido", "a_vencer", "tranche"],
          description:
            "Se a pergunta pede um número específico, qual — senão deixe de fora pra ver o panorama completo.",
        },
        detalhar: PARAM_DETALHAR,
        listar_simples: PARAM_LISTAR_SIMPLES,
      },
      additionalProperties: false,
    },
    resolverEExecutar: async (params, session) => {
      const avisos: string[] = [];
      const { comercial, cedente, grupoEconomico } = await resolverEscopoComum(params, avisos, {
        sacado: false,
        grupoEconomico: true,
      });
      const filtros = applyAccessScope(
        {
          comercial: comercial.codigo ?? "",
          cedente: cedente.codigo ?? "",
          grupoEconomico: grupoEconomico.codigo ?? "",
          visao: typeof params.visao === "string" ? params.visao : "todos",
        },
        session,
      );
      const pagina = await getCarteiraClientes(1, 20, "risco", "desc", filtros);
      const sujeitoMin = cedente.nome
        ? sujeitoCedenteMin(cedente.nome)
        : comercial.nome
          ? sujeitoComercialMin(comercial.nome)
          : grupoEconomico.nome
            ? `o grupo econômico ${grupoEconomico.nome}`
            : "a carteira";
      const sujeitoNominativo = cedente.nome
        ? sujeitoCedente(cedente.nome)
        : comercial.nome
          ? sujeitoComercial(comercial.nome)
          : sujeitoGrupoEconomico(grupoEconomico.nome);
      const sujeitoEntidade = cedente.nome
        ? sujeitoCedente(cedente.nome)
        : comercial.nome
          ? sujeitoComercial(comercial.nome)
          : grupoEconomico.nome
            ? sujeitoGrupoEconomico(grupoEconomico.nome)
            : null;
      const visao = typeof params.visao === "string" ? params.visao : "todos";
      const qualificadorVisao = visao === "com-risco" ? "com risco" : visao === "sem-risco" ? "sem risco" : undefined;
      const sufixoVisao = qualificadorVisao ? ` dos clientes ${qualificadorVisao}` : "";

      let resumo: string;
      if (params.metrica === "quantidade") {
        resumo = resumoContagem(sujeitoEntidade, "cedentes", pagina.total, qualificadorVisao);
      } else {
        const porMetrica: Record<string, { predicado: string; valor: string }> = {
          risco: { predicado: `tem risco total${sufixoVisao} de`, valor: fmtMoeda(pagina.totais.risco) },
          limite_credito: { predicado: `tem limite de crédito total${sufixoVisao} de`, valor: fmtMoeda(pagina.totais.limiteCredito) },
          limite_disponivel: { predicado: `tem limite disponível total${sufixoVisao} de`, valor: fmtMoeda(pagina.totais.limiteDisponivel) },
          vencido: { predicado: `tem vencido, no total${sufixoVisao},`, valor: fmtMoeda(pagina.totais.vencido) },
          a_vencer: { predicado: `tem a vencer, no total${sufixoVisao},`, valor: fmtMoeda(pagina.totais.aVencer) },
          tranche: { predicado: `tem em tranche, no total${sufixoVisao},`, valor: fmtMoeda(pagina.totais.tranche) },
        };
        resumo = resumoComMetrica(
          params.metrica,
          porMetrica,
          sujeitoNominativo,
          sujeitoMin === "a carteira" ? "A carteira" : `Nesse filtro, ${sujeitoMin}`,
          [
            { rotulo: "cedentes encontrados", valor: fmtInt(pagina.total) },
            { rotulo: "risco total", valor: fmtMoeda(pagina.totais.risco) },
          ],
        );
      }

      const detalhar = params.detalhar === true;
      const listarSimples = params.listar_simples === true;
      let linhas: Record<string, unknown>[] = [];
      if (detalhar || listarSimples) {
        const { linhas: todas, avisoTruncamento } = await buscarLinhasDetalhadas(() =>
          getCarteiraClientesParaExportacao("risco", "desc", filtros),
        );
        linhas = detalhar
          ? (todas as unknown as Record<string, unknown>[])
          : projetarColunasMinimas(todas, ["codigo", "cedente"]);
        if (avisoTruncamento) avisos.push(avisoTruncamento);
      }

      return {
        resumo,
        linhas,
        totais: detalhar ? (pagina.totais as unknown as Record<string, number>) : undefined,
        fonte: "Carteira de Clientes",
        avisoResolucao: avisos.length ? avisos.join(" ") : undefined,
      };
    },
  },

  // Grupo 8 (Tranche).
  tranche: {
    slug: "tranche",
    grupo: "Tranche",
    descricaoParaLLM:
      "Perguntas sobre tranche de títulos (títulos tomados/a confirmar): valor em tranche, títulos tomados, a vencer ou vencidos na tranche. Ex: 'quanto tem em tranche vencida do cedente X?'.",
    parametrosSchema: {
      type: "object",
      properties: {
        comercial_nome: PARAM_COMERCIAL_NOME,
        cedente_nome: PARAM_CEDENTE_NOME,
        grupo_economico_nome: PARAM_GRUPO_ECONOMICO_NOME,
        visao: {
          type: "string",
          enum: ["tomada", "avencer", "vencida"],
          description: "Estado da tranche. Padrão: tomada (todo o universo, sem filtrar por status).",
        },
        metrica: {
          type: "string",
          enum: ["quantidade", "valor"],
          description:
            "Se a pergunta pede um número específico (ex: só a quantidade de títulos, ou só o valor total), qual — senão deixe de fora pra ver o panorama completo.",
        },
        detalhar: PARAM_DETALHAR,
        listar_simples: PARAM_LISTAR_SIMPLES,
      },
      additionalProperties: false,
    },
    resolverEExecutar: async (params, session) => {
      const avisos: string[] = [];
      const { comercial, cedente, grupoEconomico } = await resolverEscopoComum(params, avisos, {
        sacado: false,
        grupoEconomico: true,
      });
      const visao: "tomada" | "avencer" | "vencida" =
        params.visao === "avencer" || params.visao === "vencida" ? params.visao : "tomada";
      const filtros = applyAccessScope(
        {
          comercial: comercial.codigo ?? "",
          cedente: cedente.codigo ?? "",
          grupoEconomico: grupoEconomico.codigo ?? "",
          visao,
        },
        session,
      );
      const pagina = await getTrancheTitulos(1, 20, "vencimento", "asc", filtros);
      const { min: sujeitoMin, nominativo: sujeitoNominativo, entidade: sujeitoEntidade } = sujeitoComGrupo(
        cedente.nome,
        comercial.nome,
        grupoEconomico.nome,
      );
      const visaoLabel = visao === "tomada" ? "tomada" : visao === "avencer" ? "a vencer" : "vencida";

      let resumo: string;
      if (params.metrica === "quantidade") {
        resumo = resumoContagem(sujeitoEntidade, "títulos", pagina.total, `em tranche ${visaoLabel}`);
      } else {
        const porMetrica: Record<string, { predicado: string; valor: string }> = {
          valor: { predicado: `tem, em tranche ${visaoLabel}, valor total de`, valor: fmtMoeda(pagina.totais.valor) },
        };
        resumo = resumoComMetrica(
          params.metrica,
          porMetrica,
          sujeitoNominativo,
          `Em tranche ${visaoLabel}, ${sujeitoMin}`,
          [
            { rotulo: "títulos", valor: fmtInt(pagina.total) },
            { rotulo: "valor total", valor: fmtMoeda(pagina.totais.valor) },
          ],
        );
      }

      const detalhar = params.detalhar === true;
      const listarSimples = params.listar_simples === true;
      let linhas: Record<string, unknown>[] = [];
      if (detalhar || listarSimples) {
        const { linhas: todas, avisoTruncamento } = await buscarLinhasDetalhadas(() =>
          getTrancheParaExportacao("vencimento", "asc", filtros),
        );
        linhas = detalhar
          ? (todas as unknown as Record<string, unknown>[])
          : projetarColunasMinimas(todas, ["titulo", "cedente"]);
        if (avisoTruncamento) avisos.push(avisoTruncamento);
      }

      return {
        resumo,
        linhas,
        totais: detalhar ? (pagina.totais as unknown as Record<string, number>) : undefined,
        fonte: "Tranche",
        avisoResolucao: avisos.length ? avisos.join(" ") : undefined,
      };
    },
  },

  // Grupo 9 (Liquidez) — Pontual e com Atraso (1 - pontual), mesma query.
  liquidez: {
    slug: "liquidez",
    grupo: "Liquidez",
    descricaoParaLLM:
      "Perguntas sobre liquidez de pagamento (% pago em dia sobre total pago), geral ou nos últimos 30/60/90 dias — pontual ou com atraso. Ex: 'qual a liquidez do cedente X nos últimos 30 dias?', 'qual a liquidez geral da carteira?'.",
    parametrosSchema: {
      type: "object",
      properties: {
        comercial_nome: PARAM_COMERCIAL_NOME,
        cedente_nome: PARAM_CEDENTE_NOME,
        grupo_economico_nome: PARAM_GRUPO_ECONOMICO_NOME,
        tipo_liquidez: {
          type: "string",
          enum: ["pontual", "atraso"],
          description:
            "Se a pergunta é sobre liquidez PONTUAL (pago em dia) ou COM ATRASO. Se não ficar claro, deixe de fora (assume pontual).",
        },
        janela: {
          type: "string",
          enum: ["geral", "30d", "60d", "90d"],
          description:
            "Qual janela a pergunta pede: geral ou uma das janelas de dias. SÓ preencha se a pergunta deixar isso EXPLÍCITO (ex: 'nos últimos 30 dias') — se a pergunta só disser 'liquidez pontual'/'liquidez com atraso' sem especificar qual janela, deixe este campo de fora.",
        },
      },
      additionalProperties: false,
    },
    // Sempre que a janela não vier explícita na pergunta, pergunta ao
    // usuário (geral/30/60/90 dias) — igual ao eixo de data em Comissões,
    // nunca assume um padrão silenciosamente (pedido do cliente em
    // 2026-07-19).
    precisaEsclarecer: (params) => {
      const janela = params.janela;
      return janela !== "geral" && janela !== "30d" && janela !== "60d" && janela !== "90d";
    },
    esclarecimentoCampo: "janela",
    esclarecimentoOpcoes: [
      { valor: "geral", rotulo: "Geral" },
      { valor: "30d", rotulo: "Últimos 30 dias" },
      { valor: "60d", rotulo: "Últimos 60 dias" },
      { valor: "90d", rotulo: "Últimos 90 dias" },
    ],
    esclarecimentoMensagem: "Qual janela de liquidez você quer ver?",
    resolverEExecutar: async (params, session) => {
      const avisos: string[] = [];
      const { comercial, cedente, grupoEconomico } = await resolverEscopoComum(params, avisos, {
        sacado: false,
        grupoEconomico: true,
      });
      const filtros = applyAccessScope(
        { comercial: comercial.codigo ?? "", cedente: cedente.codigo ?? "", grupoEconomico: grupoEconomico.codigo ?? "" },
        session,
      );
      const t = await getLiquidezPontual(filtros);
      const { nominativo: sujeito } = sujeitoComGrupo(cedente.nome, comercial.nome, grupoEconomico.nome);

      const tipo: "pontual" | "atraso" = params.tipo_liquidez === "atraso" ? "atraso" : "pontual";
      const janela: "geral" | "30d" | "60d" | "90d" =
        params.janela === "30d" || params.janela === "60d" || params.janela === "90d" ? params.janela : "geral";
      const pontualPorJanela: Record<typeof janela, number> = {
        geral: t.geral,
        "30d": t.janela30d,
        "60d": t.janela60d,
        "90d": t.janela90d,
      };
      const valorFracao = tipo === "pontual" ? pontualPorJanela[janela] : 1 - pontualPorJanela[janela];
      const JANELA_FRASE: Record<typeof janela, string> = {
        geral: "geral de",
        "30d": "nos últimos 30 dias de",
        "60d": "nos últimos 60 dias de",
        "90d": "nos últimos 90 dias de",
      };
      const predicado = `tem liquidez ${tipo === "pontual" ? "pontual" : "com atraso"} ${JANELA_FRASE[janela]}`;
      const resumo = resumoValorUnico(sujeito, predicado, fmtPercentFracao(valorFracao));

      return {
        resumo,
        linhas: [],
        fonte: "Comportamental — Liquidez",
        avisoResolucao: avisos.length ? avisos.join(" ") : undefined,
      };
    },
  },

  // Grupo 10 (Recompra).
  recompra: {
    slug: "recompra",
    grupo: "Recompra",
    descricaoParaLLM:
      "Perguntas sobre valor de recompra (títulos recomprados, BANCO='01'), geral ou nos últimos 30/60/90 dias. Ex: 'quanto foi recomprado do cedente X esse mês?', 'qual o total de recompra da carteira?'.",
    parametrosSchema: {
      type: "object",
      properties: {
        comercial_nome: PARAM_COMERCIAL_NOME,
        cedente_nome: PARAM_CEDENTE_NOME,
        grupo_economico_nome: PARAM_GRUPO_ECONOMICO_NOME,
        metrica: {
          type: "string",
          enum: ["total", "30d", "60d", "90d"],
          description: "Qual janela a pergunta pede — geral (total) ou uma das janelas de dias.",
        },
      },
      additionalProperties: false,
    },
    // Sempre pergunta a janela quando não vier explícita — mesmo padrão de
    // Liquidez (CLAUDE.md seção 12, pedido do cliente em 2026-07-19:
    // "VOP Cedente, VOP Sacado e Recompra também precisa aparecer a
    // resposta rápida").
    precisaEsclarecer: (params) => {
      const metrica = params.metrica;
      return metrica !== "total" && metrica !== "30d" && metrica !== "60d" && metrica !== "90d";
    },
    esclarecimentoCampo: "metrica",
    esclarecimentoOpcoes: [
      { valor: "total", rotulo: "Geral" },
      { valor: "30d", rotulo: "Últimos 30 dias" },
      { valor: "60d", rotulo: "Últimos 60 dias" },
      { valor: "90d", rotulo: "Últimos 90 dias" },
    ],
    esclarecimentoMensagem: "Qual janela de recompra você quer ver?",
    resolverEExecutar: async (params, session) => {
      const avisos: string[] = [];
      const { comercial, cedente, grupoEconomico } = await resolverEscopoComum(params, avisos, {
        sacado: false,
        grupoEconomico: true,
      });
      const filtros = applyAccessScope(
        { comercial: comercial.codigo ?? "", cedente: cedente.codigo ?? "", grupoEconomico: grupoEconomico.codigo ?? "" },
        session,
      );
      const t = await getRecompra(filtros);
      const { nominativo: sujeito } = sujeitoComGrupo(cedente.nome, comercial.nome, grupoEconomico.nome);
      const porMetrica: Record<string, { predicado: string; valor: string }> = {
        total: { predicado: "teve, no total, de recompra", valor: fmtMoeda(t.total) },
        "30d": { predicado: "teve, de recompra nos últimos 30 dias,", valor: fmtMoeda(t.janela30d) },
        "60d": { predicado: "teve, de recompra nos últimos 60 dias,", valor: fmtMoeda(t.janela60d) },
        "90d": { predicado: "teve, de recompra nos últimos 90 dias,", valor: fmtMoeda(t.janela90d) },
      };
      const resumo = resumoComMetrica(
        params.metrica,
        porMetrica,
        sujeito,
        `Recompra ${contextoDe(comercial.nome, cedente.nome)}`,
        [
          { rotulo: "total", valor: fmtMoeda(t.total) },
          { rotulo: "últimos 30 dias", valor: fmtMoeda(t.janela30d) },
          { rotulo: "últimos 60 dias", valor: fmtMoeda(t.janela60d) },
          { rotulo: "últimos 90 dias", valor: fmtMoeda(t.janela90d) },
        ],
      );
      return {
        resumo,
        linhas: [],
        fonte: "Comportamental — Recompra",
        avisoResolucao: avisos.length ? avisos.join(" ") : undefined,
      };
    },
  },

  // Grupo 11 (VOP — Volume de Operações), Cedente ou Sacado conforme a
  // pergunta (universo via CADCRED, comercial por CADCRED.gerenteconta —
  // CLAUDE.md 21.9 — nunca confundir com COD_OPERADOR_INDICANTE).
  vop: {
    slug: "vop",
    grupo: "VOP (Volume de Operações)",
    descricaoParaLLM:
      "Perguntas sobre Volume de Operações (VOP) de um cedente ou sacado — geral, nos últimos 30/60/90 dias, ou num período/mês específico ('em junho', 'no mês passado'). Ex: 'qual o VOP do cedente X?', 'volume de operações do sacado Y nos últimos 60 dias', 'quanto o cedente Z operou em junho de 2026?'.",
    parametrosSchema: {
      type: "object",
      properties: {
        comercial_nome: PARAM_COMERCIAL_NOME,
        cedente_nome: PARAM_CEDENTE_NOME,
        grupo_economico_nome: PARAM_GRUPO_ECONOMICO_NOME,
        tipo: {
          type: "string",
          enum: ["cedente", "sacado"],
          description: "Se o VOP é sobre o cedente ou sobre o sacado. Padrão: cedente.",
        },
        periodo_inicio: {
          type: "string",
          description:
            "Início do período mencionado na pergunta, formato YYYY-MM-DD, se houver (ex: pergunta cita um mês/intervalo específico em vez de 'últimos N dias').",
        },
        periodo_fim: {
          type: "string",
          description: "Fim do período mencionado na pergunta, formato YYYY-MM-DD, se houver.",
        },
        metrica: {
          type: "string",
          enum: ["geral", "30d", "60d", "90d"],
          description:
            "Qual janela a pergunta pede — geral ou uma das janelas de dias. Não usado junto com período customizado (periodo_inicio/periodo_fim).",
        },
      },
      additionalProperties: false,
    },
    // Sempre pergunta a janela quando não vier explícita — mesmo padrão de
    // Liquidez/Recompra (pedido do cliente em 2026-07-19). Só NÃO pergunta
    // quando a pergunta já tem um período customizado (ex: "em junho") —
    // esse caminho não usa janela fixa nenhuma, é outro conceito.
    precisaEsclarecer: (params) => {
      const temPeriodoCustomizado =
        typeof params.periodo_inicio === "string" &&
        params.periodo_inicio.trim() !== "" &&
        typeof params.periodo_fim === "string" &&
        params.periodo_fim.trim() !== "";
      if (temPeriodoCustomizado) return false;
      const metrica = params.metrica;
      return metrica !== "geral" && metrica !== "30d" && metrica !== "60d" && metrica !== "90d";
    },
    esclarecimentoCampo: "metrica",
    esclarecimentoOpcoes: [
      { valor: "geral", rotulo: "Geral" },
      { valor: "30d", rotulo: "Últimos 30 dias" },
      { valor: "60d", rotulo: "Últimos 60 dias" },
      { valor: "90d", rotulo: "Últimos 90 dias" },
    ],
    esclarecimentoMensagem: "Qual janela de VOP você quer ver?",
    resolverEExecutar: async (params, session) => {
      const avisos: string[] = [];
      const { comercial, cedente, grupoEconomico } = await resolverEscopoComum(params, avisos, {
        sacado: false,
        grupoEconomico: true,
      });
      const tipo = params.tipo === "sacado" ? "sacado" : "cedente";
      const periodoInicio = typeof params.periodo_inicio === "string" ? params.periodo_inicio : null;
      const periodoFim = typeof params.periodo_fim === "string" ? params.periodo_fim : null;

      // Período customizado (ex: "em junho") — só suportado pra VOP Cedente,
      // reaproveitando a MESMA query mensualizada do gráfico "VOP Cedente"
      // (graficos-vop-cedente.ts, eixo SIGFLS.DTBORDERO), nunca duplicando a
      // regra de negócio. O grupo Comportamental (getVopCedente) só calcula
      // janelas fixas (geral/30/60/90d, eixo SIGFLS.EMISSAO) — não serve pra
      // período arbitrário, CLAUDE.md seção 23 ("VOP Cedente" do
      // Comportamental x gráfico "VOP Cedente" usam eixos de data diferentes
      // de propósito).
      if (periodoInicio && periodoFim && tipo === "cedente") {
        const meses = mesesNoIntervalo(periodoInicio, periodoFim);
        const mesesPorAno = new Map<number, number[]>();
        for (const { ano, mes } of meses) {
          if (!mesesPorAno.has(ano)) mesesPorAno.set(ano, []);
          mesesPorAno.get(ano)!.push(mes);
        }

        let total = 0;
        for (const [ano, mesesDoAno] of mesesPorAno) {
          const filtrosMensal = applyAccessScope(
            {
              ano,
              comercial: comercial.codigo ?? "",
              cedente: cedente.codigo ?? "",
              grupoEconomico: grupoEconomico.codigo ?? "",
            },
            session,
          );
          const pontos = await getGraficoVopCedenteMensal(filtrosMensal);
          total += pontos
            .filter((p) => mesesDoAno.includes(p.mes))
            .reduce((soma, p) => soma + p.valor, 0);
        }

        if (!ehIntervaloDeMesesCheios(periodoInicio, periodoFim)) {
          avisos.push(
            "O VOP por período customizado só é calculado por mês completo — o valor mostrado é do(s) mês(es) que contêm o período pedido.",
          );
        }

        const periodoFrase = formatarPeriodo(periodoInicio, periodoFim);
        const predicadoVop = periodoNoFuturo(periodoInicio)
          ? `tem previsão de volume de operações (VOP), ${periodoFrase}, de`
          : `teve, ${periodoFrase}, volume de operações (VOP) de`;
        const resumo = resumoValorUnico(
          sujeitoComGrupo(cedente.nome, comercial.nome, grupoEconomico.nome).nominativo,
          predicadoVop,
          fmtMoeda(total),
        );
        return {
          resumo,
          linhas: [],
          fonte: "Gráficos — VOP Cedente",
          avisoResolucao: avisos.length ? avisos.join(" ") : undefined,
        };
      }

      const filtros = applyAccessScope(
        { comercial: comercial.codigo ?? "", cedente: cedente.codigo ?? "", grupoEconomico: grupoEconomico.codigo ?? "" },
        session,
      );
      const t = tipo === "sacado" ? await getVopSacado(filtros) : await getVopCedente(filtros);
      const tipoLabel = tipo === "sacado" ? "Sacado" : "Cedente";
      const { nominativo: sujeito } = sujeitoComGrupo(cedente.nome, comercial.nome, grupoEconomico.nome);
      const porMetrica: Record<string, { predicado: string; valor: string }> = {
        geral: { predicado: `teve, de VOP ${tipoLabel}, o total de`, valor: fmtMoeda(t.geral) },
        "30d": { predicado: `teve, de VOP ${tipoLabel} nos últimos 30 dias, o total de`, valor: fmtMoeda(t.janela30d) },
        "60d": { predicado: `teve, de VOP ${tipoLabel} nos últimos 60 dias, o total de`, valor: fmtMoeda(t.janela60d) },
        "90d": { predicado: `teve, de VOP ${tipoLabel} nos últimos 90 dias, o total de`, valor: fmtMoeda(t.janela90d) },
      };
      const resumo = resumoComMetrica(
        params.metrica,
        porMetrica,
        sujeito,
        `VOP ${tipoLabel} ${contextoDe(comercial.nome, cedente.nome)}`,
        [
          { rotulo: "geral", valor: fmtMoeda(t.geral) },
          { rotulo: "últimos 30 dias", valor: fmtMoeda(t.janela30d) },
          { rotulo: "últimos 60 dias", valor: fmtMoeda(t.janela60d) },
          { rotulo: "últimos 90 dias", valor: fmtMoeda(t.janela90d) },
        ],
      );
      return {
        resumo,
        linhas: [],
        fonte: `Comportamental — VOP ${tipoLabel}`,
        avisoResolucao: avisos.length ? avisos.join(" ") : undefined,
      };
    },
  },

  // Grupo 13 (Risco Sacado e Concentração) — Carteira de Sacados + Maior
  // Concentração + Quantidade de Sacados (grupo 3, parte 2).
  carteira_sacados: {
    slug: "carteira_sacados",
    grupo: "Risco Sacado e Concentração",
    descricaoParaLLM:
      "Perguntas sobre risco de sacados (quem deve pra qual cedente), concentração de risco em um sacado específico, ou quantidade de sacados. Ex: 'qual o risco do sacado X?', 'qual a maior concentração de risco do cedente Y?', 'quantos sacados o comercial Z tem?'.",
    parametrosSchema: {
      type: "object",
      properties: {
        comercial_nome: PARAM_COMERCIAL_NOME,
        cedente_nome: PARAM_CEDENTE_NOME,
        sacado_nome: PARAM_SACADO_NOME,
        grupo_cedente_nome: PARAM_GRUPO_CEDENTE_NOME,
        grupo_sacado_nome: PARAM_GRUPO_SACADO_NOME,
        metrica: {
          type: "string",
          enum: ["quantidade_combinacoes", "risco_total", "maior_concentracao", "quantidade_sacados"],
          description:
            "Se a pergunta pede um número específico, qual — senão deixe de fora pra ver o panorama completo. 'maior_concentracao' só existe quando um cedente é citado na pergunta.",
        },
        detalhar: PARAM_DETALHAR,
        listar_simples: PARAM_LISTAR_SIMPLES,
      },
      additionalProperties: false,
    },
    resolverEExecutar: async (params, session) => {
      const avisos: string[] = [];
      const { comercial, cedente, sacado, grupoCedente, grupoSacado } = await resolverEscopoComum(params, avisos, {
        grupoCedente: true,
        grupoSacado: true,
      });

      const filtrosCarteira = applyAccessScope(
        {
          comercial: comercial.codigo ?? "",
          grupoCedente: grupoCedente.codigo ?? "",
          grupoSacado: grupoSacado.codigo ?? "",
          cedente: cedente.codigo ?? "",
          sacado: sacado.codigo ?? "",
        },
        session,
      );
      const pagina = await getCarteiraSacados(1, 20, "riscoSacado", "desc", filtrosCarteira);

      const itens: { rotulo: string; valor: string }[] = [
        { rotulo: "combinações sacado/cedente", valor: fmtInt(pagina.total) },
        { rotulo: "risco sacado total", valor: fmtMoeda(pagina.totais.riscoSacado) },
      ];
      const porMetrica: Record<string, { predicado: string; valor: string }> = {
        risco_total: { predicado: "tem risco sacado total de", valor: fmtMoeda(pagina.totais.riscoSacado) },
      };

      // Concentração e quantidade de sacados só fazem sentido com um
      // cedente selecionado (a medida original usa ALL(SIGFIDC), zera sem
      // filtro de cedente — CLAUDE.md, comportamental-maior-concentracao.ts).
      if (cedente.codigo) {
        const filtrosConcentracao = applyAccessScope({ cedente: cedente.codigo }, session);
        const concentracao = await getMaiorConcentracao(filtrosConcentracao);
        itens.push({ rotulo: "maior concentração de risco", valor: fmtMoeda(concentracao.valor) });
        porMetrica.maior_concentracao = { predicado: "tem maior concentração de risco de", valor: fmtMoeda(concentracao.valor) };
      }

      const filtrosQtd = applyAccessScope(
        { comercial: comercial.codigo ?? "", cedente: cedente.codigo ?? "", grupoEconomico: grupoCedente.codigo ?? "" },
        session,
      );
      const qtd = await getQuantidadeSacados(filtrosQtd);
      itens.push({ rotulo: "quantidade de sacados", valor: fmtInt(qtd.quantidade) });

      const sujeitoGrupo = grupoCedente.nome
        ? `O grupo econômico ${grupoCedente.nome} (cedente)`
        : grupoSacado.nome
          ? `O grupo econômico ${grupoSacado.nome} (sacado)`
          : null;
      const sujeito = sujeitoGenerico(comercial.nome, cedente.nome, sacado.nome) === "A carteira" && sujeitoGrupo
        ? sujeitoGrupo
        : sujeitoGenerico(comercial.nome, cedente.nome, sacado.nome);
      const sujeitoEntidade = comercial.nome
        ? sujeitoComercial(comercial.nome)
        : cedente.nome
          ? sujeitoCedente(cedente.nome)
          : sacado.nome
            ? sujeitoSacado(sacado.nome)
            : sujeitoGrupo;

      let resumo: string;
      if (params.metrica === "quantidade_combinacoes") {
        resumo = resumoContagem(sujeitoEntidade, "combinações sacado/cedente", pagina.total);
      } else if (params.metrica === "quantidade_sacados") {
        resumo = resumoContagem(sujeitoEntidade, "sacados", qtd.quantidade);
      } else {
        resumo = resumoComMetrica(params.metrica, porMetrica, sujeito, sujeito, itens);
      }

      const detalhar = params.detalhar === true;
      const listarSimples = params.listar_simples === true;
      let linhas: Record<string, unknown>[] = [];
      if (detalhar || listarSimples) {
        const { linhas: todas, avisoTruncamento } = await buscarLinhasDetalhadas(() =>
          getCarteiraSacadosParaExportacao("riscoSacado", "desc", filtrosCarteira),
        );
        linhas = detalhar
          ? (todas as unknown as Record<string, unknown>[])
          : projetarColunasMinimas(todas, ["sacado", "cedente"]);
        if (avisoTruncamento) avisos.push(avisoTruncamento);
      }

      return {
        resumo,
        linhas,
        totais: detalhar ? (pagina.totais as unknown as Record<string, number>) : undefined,
        fonte: "Carteira de Sacados",
        avisoResolucao: avisos.length ? avisos.join(" ") : undefined,
      };
    },
  },

  // Grupo 14 (Tarifário).
  tarifario: {
    slug: "tarifario",
    grupo: "Tarifário",
    descricaoParaLLM:
      "Perguntas sobre tarifas/taxas de um cedente: taxa, ad valorem, tarifa de borderô, protesto, TED, cheque, título. Ex: 'qual a tarifa de borderô do cedente X?', 'qual a taxa do cedente Y?'.",
    parametrosSchema: {
      type: "object",
      properties: {
        comercial_nome: PARAM_COMERCIAL_NOME,
        cedente_nome: PARAM_CEDENTE_NOME,
        grupo_economico_nome: PARAM_GRUPO_ECONOMICO_NOME,
        metrica: {
          type: "string",
          enum: ["taxa", "tipo_de_taxa", "ad_valorem", "bordero", "protesto", "ted", "cheque", "titulo"],
          description:
            "Se a pergunta pede um número específico (ex: só a tarifa de TED), qual — senão deixe de fora pra ver o panorama completo.",
        },
      },
      additionalProperties: false,
    },
    resolverEExecutar: async (params, session) => {
      const avisos: string[] = [];
      const { comercial, cedente, grupoEconomico } = await resolverEscopoComum(params, avisos, {
        sacado: false,
        grupoEconomico: true,
      });
      const filtros = applyAccessScope(
        { comercial: comercial.codigo ?? "", cedente: cedente.codigo ?? "", grupoEconomico: grupoEconomico.codigo ?? "" },
        session,
      );
      const t = await getTarifario(filtros);
      const { nominativo: sujeito } = sujeitoComGrupo(cedente.nome, comercial.nome, grupoEconomico.nome);
      const porMetrica: Record<string, { predicado: string; valor: string }> = {
        taxa: { predicado: "tem taxa de", valor: fmtPercentFracao(t.taxa) },
        tipo_de_taxa: { predicado: "tem tipo de taxa", valor: t.tipoDeTaxa },
        ad_valorem: { predicado: "tem ad valorem de", valor: fmtPercentFracao(t.adValorem) },
        bordero: { predicado: "tem tarifa de borderô de", valor: fmtMoeda(t.bordero) },
        protesto: { predicado: "tem tarifa de protesto de", valor: fmtMoeda(t.protec) },
        ted: { predicado: "tem tarifa de TED de", valor: fmtMoeda(t.ted) },
        cheque: { predicado: "tem tarifa de cheque de", valor: fmtMoeda(t.cheque) },
        titulo: { predicado: "tem tarifa de título de", valor: fmtMoeda(t.titulo) },
      };
      const resumo = resumoComMetrica(
        params.metrica,
        porMetrica,
        sujeito,
        `Tarifário ${contextoDe(comercial.nome, cedente.nome)}`,
        [
          { rotulo: "taxa", valor: fmtPercentFracao(t.taxa) },
          { rotulo: "tipo de taxa", valor: t.tipoDeTaxa },
          { rotulo: "ad valorem", valor: fmtPercentFracao(t.adValorem) },
          { rotulo: "borderô", valor: fmtMoeda(t.bordero) },
          { rotulo: "protesto", valor: fmtMoeda(t.protec) },
          { rotulo: "TED", valor: fmtMoeda(t.ted) },
          { rotulo: "cheque", valor: fmtMoeda(t.cheque) },
          { rotulo: "título", valor: fmtMoeda(t.titulo) },
        ],
      );
      return {
        resumo,
        linhas: [],
        fonte: "Comportamental — Tarifário",
        avisoResolucao: avisos.length ? avisos.join(" ") : undefined,
      };
    },
  },

  // Grupo 15 (Operações Bordero) — Operações (prazos/ticket, agregado) +
  // Borderôs Liberados (lista de borderôs).
  operacoes: {
    slug: "operacoes",
    grupo: "Operações",
    descricaoParaLLM:
      "Perguntas sobre prazo (mínimo, médio, máximo), ticket médio ou borderô médio de operações. Ex: 'qual o prazo médio do cedente X nos últimos 30 dias?', 'qual o ticket médio da carteira?', 'qual o prazo médio geral das operações?'.",
    parametrosSchema: {
      type: "object",
      properties: {
        comercial_nome: PARAM_COMERCIAL_NOME,
        cedente_nome: PARAM_CEDENTE_NOME,
        grupo_economico_nome: PARAM_GRUPO_ECONOMICO_NOME,
        metrica: {
          type: "string",
          enum: [
            "prazo_minimo", "prazo_medio_geral", "prazo_medio_30d", "prazo_medio_60d",
            "prazo_medio_90d", "prazo_maximo", "ticket_medio", "bordero_medio",
          ],
          description:
            "Se a pergunta pede um número específico (ex: só o prazo médio geral), qual — senão deixe de fora pra ver o panorama completo.",
        },
      },
      additionalProperties: false,
    },
    resolverEExecutar: async (params, session) => {
      const avisos: string[] = [];
      const { comercial, cedente, grupoEconomico } = await resolverEscopoComum(params, avisos, {
        sacado: false,
        grupoEconomico: true,
      });
      const filtros = applyAccessScope(
        { comercial: comercial.codigo ?? "", cedente: cedente.codigo ?? "", grupoEconomico: grupoEconomico.codigo ?? "" },
        session,
      );
      const t = await getOperacoes(filtros);
      const { nominativo: sujeito } = sujeitoComGrupo(cedente.nome, comercial.nome, grupoEconomico.nome);
      const porMetrica: Record<string, { predicado: string; valor: string }> = {
        prazo_minimo: { predicado: "tem prazo mínimo de", valor: fmtDias(t.prazoMinimo) },
        prazo_medio_geral: { predicado: "tem prazo médio geral de", valor: fmtDias(t.prazoMedioGeral) },
        prazo_medio_30d: { predicado: "tem prazo médio, nos últimos 30 dias, de", valor: fmtDias(t.prazoMedio30d) },
        prazo_medio_60d: { predicado: "tem prazo médio, nos últimos 60 dias, de", valor: fmtDias(t.prazoMedio60d) },
        prazo_medio_90d: { predicado: "tem prazo médio, nos últimos 90 dias, de", valor: fmtDias(t.prazoMedio90d) },
        prazo_maximo: { predicado: "tem prazo máximo de", valor: fmtDias(t.prazoMaximo) },
        ticket_medio: { predicado: "tem ticket médio de", valor: fmtMoeda(t.ticketMedio) },
        bordero_medio: { predicado: "tem borderô médio de", valor: fmtMoeda(t.borderoMedio) },
      };
      const resumo = resumoComMetrica(
        params.metrica,
        porMetrica,
        sujeito,
        `Operações ${contextoDe(comercial.nome, cedente.nome)}`,
        [
          { rotulo: "prazo mínimo", valor: fmtDias(t.prazoMinimo) },
          { rotulo: "prazo médio geral", valor: fmtDias(t.prazoMedioGeral) },
          { rotulo: "prazo médio 30d", valor: fmtDias(t.prazoMedio30d) },
          { rotulo: "prazo médio 60d", valor: fmtDias(t.prazoMedio60d) },
          { rotulo: "prazo médio 90d", valor: fmtDias(t.prazoMedio90d) },
          { rotulo: "prazo máximo", valor: fmtDias(t.prazoMaximo) },
          { rotulo: "ticket médio", valor: fmtMoeda(t.ticketMedio) },
          { rotulo: "borderô médio", valor: fmtMoeda(t.borderoMedio) },
        ],
      );
      return {
        resumo,
        linhas: [],
        fonte: "Comportamental — Operações",
        avisoResolucao: avisos.length ? avisos.join(" ") : undefined,
      };
    },
  },

  borderos_liberados: {
    slug: "borderos_liberados",
    grupo: "Borderôs Liberados",
    descricaoParaLLM:
      "Perguntas sobre borderôs liberados: quais borderôs, quando foram liberados, valor total dos borderôs. Ex: 'quais borderôs do cedente X foram liberados em julho?'.",
    parametrosSchema: {
      type: "object",
      properties: {
        comercial_nome: PARAM_COMERCIAL_NOME,
        cedente_nome: PARAM_CEDENTE_NOME,
        grupo_economico_nome: PARAM_GRUPO_ECONOMICO_NOME,
        data_liberacao_inicio: {
          type: "string",
          description: "Início do período de liberação, formato YYYY-MM-DD, se a pergunta mencionar um período.",
        },
        data_liberacao_fim: {
          type: "string",
          description: "Fim do período de liberação, formato YYYY-MM-DD, se a pergunta mencionar um período.",
        },
        metrica: {
          type: "string",
          enum: ["quantidade", "valor"],
          description:
            "Se a pergunta pede um número específico (ex: só a quantidade de borderôs, ou só o valor total), qual — senão deixe de fora pra ver o panorama completo.",
        },
        detalhar: PARAM_DETALHAR,
        listar_simples: PARAM_LISTAR_SIMPLES,
      },
      additionalProperties: false,
    },
    resolverEExecutar: async (params, session) => {
      const avisos: string[] = [];
      const { comercial, cedente, grupoEconomico } = await resolverEscopoComum(params, avisos, {
        sacado: false,
        grupoEconomico: true,
      });
      const dataInicio = typeof params.data_liberacao_inicio === "string" ? params.data_liberacao_inicio : null;
      const dataFim = typeof params.data_liberacao_fim === "string" ? params.data_liberacao_fim : null;
      const filtros = applyAccessScope(
        {
          comercial: comercial.codigo ?? "",
          cedente: cedente.codigo ?? "",
          grupoEconomico: grupoEconomico.codigo ?? "",
          bordero: "",
          dataLiberacaoInicio: dataInicio,
          dataLiberacaoFim: dataFim,
          metodo: "",
        },
        session,
      );
      const pagina = await getBorderosLiberados(1, 20, "dataLiberacao", "desc", filtros);
      const periodoFrase = formatarPeriodo(dataInicio, dataFim);
      const { nominativo: sujeitoNominativo, entidade: sujeitoEntidade } = sujeitoComGrupo(
        cedente.nome,
        comercial.nome,
        grupoEconomico.nome,
      );
      const prefixoPeriodo = periodoFrase ? `, ${periodoFrase},` : "";

      let resumo: string;
      if (params.metrica === "quantidade") {
        resumo = resumoContagem(sujeitoEntidade, "borderôs liberados", pagina.total, periodoFrase || undefined);
      } else {
        const porMetrica: Record<string, { predicado: string; valor: string }> = {
          valor: { predicado: `teve${prefixoPeriodo} valor total de`, valor: fmtMoeda(pagina.totais.valorBordero) },
        };
        resumo = resumoComMetrica(
          params.metrica,
          porMetrica,
          sujeitoNominativo,
          `Borderôs liberados${periodoFrase ? ` ${periodoFrase}` : ""} ${contextoDe(comercial.nome, cedente.nome)}`,
          [
            { rotulo: "borderôs", valor: fmtInt(pagina.total) },
            { rotulo: "valor total", valor: fmtMoeda(pagina.totais.valorBordero) },
          ],
        );
      }

      const detalhar = params.detalhar === true;
      const listarSimples = params.listar_simples === true;
      let linhas: Record<string, unknown>[] = [];
      if (detalhar || listarSimples) {
        const { linhas: todas, avisoTruncamento } = await buscarLinhasDetalhadas(() =>
          getBorderosLiberadosParaExportacao("dataLiberacao", "desc", filtros),
        );
        linhas = detalhar
          ? (todas as unknown as Record<string, unknown>[])
          : projetarColunasMinimas(todas, ["bordero", "cedente"]);
        if (avisoTruncamento) avisos.push(avisoTruncamento);
      }

      return {
        resumo,
        linhas,
        totais: detalhar ? (pagina.totais as unknown as Record<string, number>) : undefined,
        fonte: "Borderôs Liberados",
        avisoResolucao: avisos.length ? avisos.join(" ") : undefined,
      };
    },
  },

  // Módulo Gráficos (CLAUDE.md seção 9/23) — pedido do cliente em 2026-07-19:
  // "retornar gráficos quando solicitado". Reaproveita os 7 gráficos
  // mensualizados já existentes (Títulos, Deságios, Comissões, Vencidos,
  // VOP Cedente, Recompra, Total Pago — mesmas funções de query da tela
  // /dashboard/graficos, nunca duplicadas), permitindo pedir mais de um ao
  // mesmo tempo (ex: "gráfico com valor e comissões" → 2 séries). O
  // resultado vem em `graficos` (IaTemplateResultado) — a UI renderiza cada
  // série como um mini gráfico de barras (Recharts), o `resumo` só cita o
  // total anual de cada série em texto (a leitura mês a mês é visual).
  graficos: {
    slug: "graficos",
    grupo: "Gráficos",
    descricaoParaLLM:
      "Perguntas que pedem um GRÁFICO/TABELA MÊS A MÊS OU ANO A ANO — eixo X sempre é TEMPO (mês ou ano), pra UM comercial/cedente/sacado ou a carteira toda (qualquer módulo: valor de títulos, deságios, comissões, VOP cedente, recompra, total pago, liquidez pontual, vencido). Só use esta ferramenta quando a pergunta pedir explicitamente uma visualização/evolução/quebra por período (mensal ou anual) — perguntas por um número único devem usar as ferramentas de relatório normais. Se a pergunta pedir gráfico/tabela de algo que NÃO está na lista de métricas (ex: tarifário, operações), NÃO chame esta ferramenta. **NUNCA use esta ferramenta se a pergunta pedir um gráfico com UMA BARRA POR COMERCIAL/CEDENTE (eixo X = nomes de entidades, não tempo) — ex: 'gráfico com o eixo X sendo os comerciais', 'uma barra pra cada comercial', 'compare os comerciais num gráfico' — isso é a ferramenta `comissoes` (agrupar_por_comercial=true, formato='grafico'), não esta.** Use `granularidade: 'anual'` pra pedidos como 'tabela com o valor por ano', 'quanto foi cada ano', 'ano a ano' — nesse caso o retorno é uma TABELA (ano + valor), não um gráfico de barras mensal. TAMBÉM use esta ferramenta (sem gráfico nenhum, resposta em texto) quando a pergunta pedir o valor de UM MÊS específico de uma dessas métricas (ex: 'quanto de vencido em abril de 2026?', 'quanto de comissão em junho?') — preencha o parâmetro `mes` nesse caso, NUNCA devolva o gráfico do ano inteiro pra uma pergunta de um mês só. **Esta ferramenta só tem granularidade de MÊS/ANO — se a pergunta pedir um DIA específico ou um intervalo de datas exato (ex: 'títulos, deságio e comissão do dia 17/07/2026', 'entre 10 e 15 de julho'), NÃO use esta ferramenta (o parâmetro `mes` sempre devolve o MÊS INTEIRO, nunca um dia) — use a ferramenta `comissoes` (periodo_inicio/periodo_fim) pra Títulos/Deságios/Comissões com data exata, que aceita qualquer período.** ATENÇÃO especial pra 'vencidos' — existem DUAS métricas bem diferentes: 'vencido' (o valor de 'títulos vencidos'/'valor vencido' de sempre — mesma base de Comercial - Visão Geral/Exposição Cedente — quebrado por mês/ano de VENCIMENTO do título; use esta pra QUALQUER pedido de gráfico/tabela de vencidos, é o padrão) e 'vencidos_geral'/'vencidos_atraso' (evolução ACUMULADA do saldo em aberto — um conceito diferente, só use se a pergunta pedir EXPLICITAMENTE 'evolução'/'acumulado'). Ex: 'me mostra um gráfico de comissões do Loureiro em 2026', 'gráfico mês a mês de valor e comissões do Henrique em 2026', 'gráfico de vencidos mês a mês em 2026' (métrica 'vencido'), 'tabela com o valor dos títulos vencidos por ano' (métrica 'vencido', granularidade 'anual'), 'como evoluiu o saldo vencido esse ano' (vencidos_geral), 'gráfico de liquidez pontual em 2026'.",
    parametrosSchema: {
      type: "object",
      properties: {
        comercial_nome: PARAM_COMERCIAL_NOME,
        cedente_nome: PARAM_CEDENTE_NOME,
        grupo_economico_nome: PARAM_GRUPO_ECONOMICO_NOME,
        metricas: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "titulos",
              "desagios",
              "comissoes",
              "vencido",
              "vencidos_geral",
              "vencidos_atraso",
              "vop_cedente",
              "recompra",
              "total_pago",
              "liquidez_pontual",
            ],
          },
          description:
            "Quais gráficos/tabelas mostrar — pode ter mais de um (ex: pergunta pede 'valor e comissões' → ['titulos','comissoes']). 'titulos' = valor de títulos. 'vencido' = valor de títulos vencidos por mês/ano de VENCIMENTO (mesma base de Comercial - Visão Geral/Exposição Cedente — use este pra qualquer 'gráfico/tabela de vencidos', é o padrão). 'vencidos_geral'/'vencidos_atraso' = evolução ACUMULADA do saldo em aberto ao longo do ano (conceito diferente de 'vencido' — só use se a pergunta pedir 'evolução'/'acumulado' explicitamente). 'liquidez_pontual' = % pago em dia sobre total pago. NUNCA escolha uma métrica só por ser a mais parecida — se nenhuma bater com o que foi pedido, não chame esta ferramenta.",
        },
        granularidade: {
          type: "string",
          enum: ["mensal", "anual"],
          description:
            "'mensal' (padrão) = gráfico de barras mês a mês de UM ano. 'anual' = TABELA com uma linha por ano (ex: 'valor dos títulos vencidos por ano', 'quanto foi cada ano'). Use 'anual' sempre que a pergunta pedir a quebra POR ANO em vez de por mês.",
        },
        ano: {
          type: "number",
          description: `Só relevante com granularidade 'mensal': ano do gráfico (${GRAFICO_ANO_MIN}-${GRAFICO_ANO_MAX}). Se a pergunta não mencionar, deixe de fora (usa o ano atual).`,
        },
        ano_inicio: {
          type: "number",
          description: `Só relevante com granularidade 'anual': primeiro ano do período (${GRAFICO_ANO_MIN}-${GRAFICO_ANO_MAX}). Se a pergunta não mencionar, deixe de fora.`,
        },
        ano_fim: {
          type: "number",
          description: `Só relevante com granularidade 'anual': último ano do período (${GRAFICO_ANO_MIN}-${GRAFICO_ANO_MAX}). Se a pergunta não mencionar, deixe de fora (usa o ano atual).`,
        },
        eixo_data: {
          type: "string",
          enum: ["compra", "pagamento", "vencimento"],
          description:
            "Só relevante se 'metricas' incluir 'titulos'/'desagios'/'comissoes': qual data usar. SÓ preencha se a pergunta deixar isso EXPLÍCITO — senão deixe de fora.",
        },
        mes: {
          type: "number",
          description:
            "Preencha SOMENTE se a pergunta pedir o valor de UM MÊS INTEIRO específico (ex: 'quanto de vencido em abril de 2026?', 'quanto de comissão em junho?') — a resposta vem em TEXTO com o valor daquele mês, sem gráfico. Se a pergunta pedir um gráfico/visualização/evolução mês a mês, NÃO preencha este campo. ATENÇÃO: esta ferramenta só tem granularidade de MÊS — se a pergunta pedir um DIA específico ou um intervalo de datas exato (ex: 'títulos, deságio e comissão do dia 17/07/2026'), NÃO use esta ferramenta (ela devolveria o mês inteiro, não o dia pedido); use a ferramenta `comissoes` (periodo_inicio/periodo_fim) em vez disso, que aceita qualquer período exato.",
        },
      },
      additionalProperties: false,
    },
    precisaEsclarecer: (params) => {
      const metricas = Array.isArray(params.metricas) ? params.metricas : [];
      const precisaEixo = metricas.some((m) => m === "titulos" || m === "desagios" || m === "comissoes");
      const eixo = params.eixo_data;
      return precisaEixo && eixo !== "compra" && eixo !== "pagamento" && eixo !== "vencimento";
    },
    esclarecimentoCampo: "eixo_data",
    esclarecimentoOpcoes: EIXO_OPCOES_COMISSOES,
    resolverEExecutar: async (params, session) => {
      const avisos: string[] = [];
      const { comercial, cedente, grupoEconomico } = await resolverEscopoComum(params, avisos, {
        sacado: false,
        grupoEconomico: true,
      });

      const anoBruto = typeof params.ano === "number" ? params.ano : Number(params.ano);
      const ano =
        Number.isInteger(anoBruto) && anoBruto >= GRAFICO_ANO_MIN && anoBruto <= GRAFICO_ANO_MAX
          ? anoBruto
          : new Date().getFullYear();
      const eixo: "compra" | "pagamento" | "vencimento" =
        params.eixo_data === "pagamento" || params.eixo_data === "vencimento" ? params.eixo_data : "compra";

      const metricasValidas = [
        "titulos",
        "desagios",
        "comissoes",
        "vencido",
        "vencidos_geral",
        "vencidos_atraso",
        "vop_cedente",
        "recompra",
        "total_pago",
        "liquidez_pontual",
      ] as const;
      type Metrica = (typeof metricasValidas)[number];
      const metricasPedidas = Array.isArray(params.metricas)
        ? params.metricas.filter((m): m is Metrica => metricasValidas.includes(m as Metrica))
        : [];
      const metricas: Metrica[] = metricasPedidas.length > 0 ? metricasPedidas : ["titulos"];

      const METRICA_INFO: Record<Metrica, { titulo: string; cor: string; unidade?: "moeda" | "percentual" }> = {
        titulos: { titulo: "Valor de Títulos", cor: "#2E3F7F" },
        desagios: { titulo: "Deságios", cor: "#C99A3E" },
        comissoes: { titulo: "Comissões", cor: "#2D5C3A" },
        vencido: { titulo: "Vencido — por mês de vencimento do título", cor: "#B3495A" },
        vencidos_geral: { titulo: "Vencidos — Evolução Geral", cor: "#B3495A" },
        vencidos_atraso: { titulo: "Vencidos — Evolução Vencidos", cor: "#B3495A" },
        vop_cedente: { titulo: "VOP Cedente", cor: "#4A8C5C" },
        recompra: { titulo: "Recompra", cor: "#1A2347" },
        total_pago: { titulo: "Total Pago", cor: "#C8CDD6" },
        liquidez_pontual: { titulo: "Liquidez Pontual (%)", cor: "#2E3F7F", unidade: "percentual" },
      };
      // Substantivo curto pra frase de UM mês específico (sem gráfico) —
      // diferente de METRICA_INFO.titulo, que é o título do gráfico
      // (verboso demais pra caber numa frase corrida).
      const METRICA_SUBSTANTIVO: Record<Metrica, string> = {
        titulos: "títulos",
        desagios: "deságio",
        comissoes: "comissão",
        vencido: "títulos vencidos",
        vencidos_geral: "vencidos (evolução geral)",
        vencidos_atraso: "vencidos (evolução em atraso)",
        vop_cedente: "volume de operações (VOP) Cedente",
        recompra: "recompra",
        total_pago: "total pago",
        liquidez_pontual: "liquidez pontual",
      };

      const filtrosBase = {
        comercial: comercial.codigo ?? "",
        cedente: cedente.codigo ?? "",
        grupoEconomico: grupoEconomico.codigo ?? "",
      };

      // Busca os 12 pontos mensais de UMA métrica pra UM ano — reaproveitada
      // tanto pelo caminho "mensal" (gráfico de barras, ano único) quanto
      // pelo "anual" (soma/agrega os 12 meses de CADA ano do período), sem
      // duplicar a regra de negócio de cada métrica.
      async function buscarPontosDaMetrica(metrica: Metrica, anoConsulta: number): Promise<PontoMensal[]> {
        switch (metrica) {
          case "titulos":
            return getGraficoTitulosMensal(applyAccessScope({ ...filtrosBase, ano: anoConsulta, eixo }, session));
          case "desagios":
            return getGraficoDesagiosMensal(applyAccessScope({ ...filtrosBase, ano: anoConsulta, eixo }, session));
          case "comissoes":
            return getGraficoComissoesMensal(applyAccessScope({ ...filtrosBase, ano: anoConsulta, eixo }, session));
          case "vencido":
            return getGraficoVencidoPorMesMensal(applyAccessScope({ ...filtrosBase, ano: anoConsulta }, session));
          case "vencidos_geral":
            return getGraficoVencidosMensal(
              applyAccessScope({ ...filtrosBase, ano: anoConsulta, eixo: "geral" as const }, session),
            );
          case "vencidos_atraso":
            return getGraficoVencidosMensal(
              applyAccessScope({ ...filtrosBase, ano: anoConsulta, eixo: "vencidos" as const }, session),
            );
          case "vop_cedente":
            return getGraficoVopCedenteMensal(applyAccessScope({ ...filtrosBase, ano: anoConsulta }, session));
          case "recompra":
            return getGraficoRecompraMensal(applyAccessScope({ ...filtrosBase, ano: anoConsulta }, session));
          case "liquidez_pontual":
            return getGraficoLiquidezPontualMensal(applyAccessScope({ ...filtrosBase, ano: anoConsulta }, session));
          case "total_pago":
          default:
            return getGraficoTotalPagoMensal(applyAccessScope({ ...filtrosBase, ano: anoConsulta }, session));
        }
      }

      const sujeito = comercial.nome
        ? sujeitoComercial(comercial.nome)
        : cedente.nome
          ? sujeitoCedente(cedente.nome)
          : sujeitoGrupoEconomico(grupoEconomico.nome);
      const granularidade: "mensal" | "anual" = params.granularidade === "anual" ? "anual" : "mensal";

      // "vencidos_geral"/"vencidos_atraso" são saldo ACUMULADO mês a mês —
      // o "valor do ano" correto é o saldo no último mês com dado (não a
      // soma dos 12 meses, que somaria acumulados sobre acumulados). As
      // demais métricas de valor são somadas normalmente; liquidez_pontual
      // (percentual) usa a média dos meses com dado, mesmo critério já
      // usado no resumo mensal.
      function agregarAno(pontos: PontoMensal[], metrica: Metrica): number {
        if (metrica === "vencidos_geral" || metrica === "vencidos_atraso") {
          const comDado = pontos.filter((p) => p.valor !== 0);
          return comDado.length > 0 ? comDado[comDado.length - 1].valor : 0;
        }
        if (METRICA_INFO[metrica].unidade === "percentual") {
          const comDado = pontos.filter((p) => p.valor > 0);
          return comDado.length > 0 ? comDado.reduce((soma, p) => soma + p.valor, 0) / comDado.length : 0;
        }
        return pontos.reduce((soma, p) => soma + p.valor, 0);
      }

      // Granularidade ANUAL (2026-07-19, pedido do cliente: "tabela com o
      // ano e o valor total dos títulos vencidos") — reaproveita a MESMA
      // consulta mensal já usada pro gráfico, só que chamada uma vez por
      // ano do período e agregada em JS (sem SQL novo) — devolve uma
      // TABELA (ano + valor), não um gráfico de barras.
      if (granularidade === "anual") {
        const anoAtual = new Date().getFullYear();
        const anoInicioBruto = typeof params.ano_inicio === "number" ? params.ano_inicio : Number(params.ano_inicio);
        const anoFimBruto = typeof params.ano_fim === "number" ? params.ano_fim : Number(params.ano_fim);
        const anoInicioInformado =
          Number.isInteger(anoInicioBruto) && anoInicioBruto >= GRAFICO_ANO_MIN && anoInicioBruto <= GRAFICO_ANO_MAX
            ? anoInicioBruto
            : null;
        let anoInicioValido = anoInicioInformado ?? GRAFICO_ANO_MIN;
        const anoFimValido =
          Number.isInteger(anoFimBruto) && anoFimBruto >= GRAFICO_ANO_MIN && anoFimBruto <= GRAFICO_ANO_MAX
            ? anoFimBruto
            : anoAtual;

        // "vencido" pode incluir dívidas antigas com vencimento anterior a
        // GRAFICO_ANO_MIN (2023 — só o primeiro ano listado no seletor da
        // tela de Gráficos, não um limite real dos dados). Sem isso, a
        // tabela somava menos que o total real de "Vencido" de Comercial -
        // Visão Geral/Exposição Cedente (bug real, corrigido em 2026-07-19)
        // — busca o ano de vencimento mais antigo entre os títulos hoje
        // vencidos e usa como início, a menos que o usuário já tenha
        // pedido um ano_inicio explícito.
        if (metricas.includes("vencido" as Metrica) && anoInicioInformado === null) {
          const anoMinimoVencido = await getAnoMinimoVencido(applyAccessScope({ ...filtrosBase }, session));
          if (anoMinimoVencido !== null && anoMinimoVencido < anoInicioValido) {
            avisos.push(
              `O período foi ampliado para começar em ${anoMinimoVencido} — existem títulos vencidos com vencimento anterior a ${GRAFICO_ANO_MIN}.`,
            );
            anoInicioValido = anoMinimoVencido;
          }
        }

        const anoDe = Math.min(anoInicioValido, anoFimValido);
        const anoAte = Math.max(anoInicioValido, anoFimValido);
        const anos: number[] = [];
        for (let a = anoDe; a <= anoAte; a++) anos.push(a);

        const valoresPorMetricaEAno = new Map<Metrica, Map<number, number>>();
        for (const metrica of metricas) {
          const porAno = new Map<number, number>();
          for (const anoIter of anos) {
            const pontos = await buscarPontosDaMetrica(metrica, anoIter);
            porAno.set(anoIter, agregarAno(pontos, metrica));
          }
          valoresPorMetricaEAno.set(metrica, porAno);
        }

        const linhas: Record<string, unknown>[] = anos.map((anoIter) => {
          const linha: Record<string, unknown> = { ano: anoIter };
          for (const metrica of metricas) {
            const chave = metricas.length > 1 ? metrica : "valor";
            const bruto = valoresPorMetricaEAno.get(metrica)!.get(anoIter) ?? 0;
            linha[chave] =
              METRICA_INFO[metrica].unidade === "percentual"
                ? `${bruto.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                : bruto;
          }
          return linha;
        });

        const totaisResumo = metricas.map((metrica) => {
          const valores = [...valoresPorMetricaEAno.get(metrica)!.values()];
          const agregadoTotal =
            METRICA_INFO[metrica].unidade === "percentual"
              ? valores.reduce((soma, v) => soma + v, 0) / (valores.length || 1)
              : valores.reduce((soma, v) => soma + v, 0);
          const valorFormatado =
            METRICA_INFO[metrica].unidade === "percentual"
              ? `${agregadoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
              : fmtMoeda(agregadoTotal);
          return { rotulo: METRICA_INFO[metrica].titulo, valor: valorFormatado };
        });
        const resumo = resumoMultiplo(`${sujeito}, entre ${anoDe} e ${anoAte}`, totaisResumo);

        return {
          resumo,
          linhas,
          fonte: "Gráficos — por ano",
          avisoResolucao: avisos.length ? avisos.join(" ") : undefined,
        };
      }

      // Pedido de UM MÊS específico, sem gráfico (2026-07-19, pedido do
      // cliente: "Quanto eu tenho de títulos vencidos que são do mês de
      // abril de 2026?" não pode devolver o gráfico do ano inteiro) —
      // reaproveita a MESMA consulta mensal já usada no gráfico, só que
      // pega o valor de um único mês e devolve como TEXTO, nunca gráfico.
      const mesBruto = typeof params.mes === "number" ? params.mes : Number(params.mes);
      const mesValido = Number.isInteger(mesBruto) && mesBruto >= 1 && mesBruto <= 12 ? mesBruto : null;
      if (mesValido !== null) {
        const itensMes = await Promise.all(
          metricas.map(async (metrica) => {
            const pontos = await buscarPontosDaMetrica(metrica, ano);
            const valorBruto = pontos.find((p) => p.mes === mesValido)?.valor ?? 0;
            const valorFormatado =
              METRICA_INFO[metrica].unidade === "percentual"
                ? `${valorBruto.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                : fmtMoeda(valorBruto);
            return { rotulo: METRICA_SUBSTANTIVO[metrica], valor: valorFormatado };
          }),
        );
        const mesFrase = `${MESES_PT[mesValido - 1]} de ${ano}`;
        const resumoMes =
          itensMes.length === 1
            ? `Existe de ${itensMes[0].rotulo} em ${mesFrase} o valor de **${itensMes[0].valor}**.`
            : resumoMultiplo(`${sujeito}, em ${mesFrase}`, itensMes);
        return {
          resumo: resumoMes,
          linhas: [],
          fonte: "Gráficos",
          avisoResolucao: avisos.length ? avisos.join(" ") : undefined,
        };
      }

      // Granularidade MENSAL (padrão) — gráfico de barras de um único ano.
      const graficos: { titulo: string; cor: string; unidade?: "moeda" | "percentual"; pontos: PontoMensal[] }[] = [];
      for (const metrica of metricas) {
        const pontos = await buscarPontosDaMetrica(metrica, ano);
        graficos.push({
          titulo: METRICA_INFO[metrica].titulo,
          cor: METRICA_INFO[metrica].cor,
          unidade: METRICA_INFO[metrica].unidade,
          pontos,
        });
      }

      const totaisItens = graficos.map((g) => {
        if (g.unidade === "percentual") {
          const mesesComDado = g.pontos.filter((p) => p.valor > 0);
          const media =
            mesesComDado.length > 0
              ? mesesComDado.reduce((soma, p) => soma + p.valor, 0) / mesesComDado.length
              : 0;
          return { rotulo: `${g.titulo} (média)`, valor: `${media.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` };
        }
        return { rotulo: g.titulo, valor: fmtMoeda(g.pontos.reduce((soma, p) => soma + p.valor, 0)) };
      });
      const resumo = resumoMultiplo(`${sujeito} em ${ano}`, totaisItens);

      return {
        resumo,
        linhas: [],
        graficos,
        fonte: "Gráficos",
        avisoResolucao: avisos.length ? avisos.join(" ") : undefined,
      };
    },
  },

  // Relatório Analítico de Títulos (CLAUDE.md seção 23) — última das 10
  // telas com dado próprio sem template de IA, adicionada em 2026-07-19 a
  // pedido do cliente ("implemente tudo que falta"). Grão de título, os
  // mesmos 11 filtros da tela (mesma popup/painel retrátil de Comissões) —
  // aqui os 3 pares de data são independentes entre si (não um "eixo" só),
  // então cada um mapeia pro seu próprio filtro sem precisar de
  // esclarecimento — a própria tela permite os 3 ao mesmo tempo.
  titulos: {
    slug: "titulos",
    grupo: "Relatório Analítico de Títulos",
    descricaoParaLLM:
      "Perguntas gerais sobre títulos do FIDC — buscar por borderô/número do título, status de pagamento, situação, ou títulos que vencem/foram comprados/foram pagos num período. Ex: 'quais títulos do cedente X vencem essa semana?', 'títulos do borderô 12345', 'títulos pendentes de pagamento do comercial Y'.",
    parametrosSchema: {
      type: "object",
      properties: {
        comercial_nome: PARAM_COMERCIAL_NOME,
        cedente_nome: PARAM_CEDENTE_NOME,
        sacado_nome: PARAM_SACADO_NOME,
        grupo_cedente_nome: PARAM_GRUPO_CEDENTE_NOME,
        grupo_sacado_nome: PARAM_GRUPO_SACADO_NOME,
        bordero: { type: "string", description: "Número do borderô, se mencionado." },
        titulo: { type: "string", description: "Número/identificação do título, se mencionado." },
        situacao: {
          type: "string",
          description: "Situação de confirmação do título (ex: 'A Confirmar'), se mencionada.",
        },
        status_pagamento: {
          type: "string",
          enum: ["A Vencer", "Vencido", "Pago Em Dia", "Pago Vencido"],
          description: "Status de pagamento, se a pergunta pedir um status específico.",
        },
        tipo_pagamento: {
          type: "string",
          enum: ["Pagamento Pendente", "Pagamento Parcial", "Pagamento Total"],
          description: "Tipo de pagamento, se mencionado.",
        },
        data_compra_inicio: { type: "string", description: "Início do período de compra/digitação, YYYY-MM-DD." },
        data_compra_fim: { type: "string", description: "Fim do período de compra/digitação, YYYY-MM-DD." },
        data_pagamento_inicio: { type: "string", description: "Início do período de pagamento, YYYY-MM-DD." },
        data_pagamento_fim: { type: "string", description: "Fim do período de pagamento, YYYY-MM-DD." },
        vencimento_inicio: { type: "string", description: "Início do período de vencimento, YYYY-MM-DD." },
        vencimento_fim: { type: "string", description: "Fim do período de vencimento, YYYY-MM-DD." },
        metrica: {
          type: "string",
          enum: ["quantidade", "valor", "valor_pagamento", "saldo"],
          description:
            "Se a pergunta pede um número específico, qual — senão deixe de fora pra ver o panorama completo.",
        },
        detalhar: PARAM_DETALHAR,
        listar_simples: PARAM_LISTAR_SIMPLES,
      },
      additionalProperties: false,
    },
    resolverEExecutar: async (params, session) => {
      const avisos: string[] = [];
      const { comercial, cedente, sacado, grupoCedente, grupoSacado } = await resolverEscopoComum(params, avisos, {
        grupoCedente: true,
        grupoSacado: true,
      });
      const str = (v: unknown) => (typeof v === "string" ? v : "");
      const dataOuNull = (v: unknown) => (typeof v === "string" ? v : null);

      const filtros = applyAccessScope(
        {
          comercial: comercial.codigo ?? "",
          grupoCedente: grupoCedente.codigo ?? "",
          grupoSacado: grupoSacado.codigo ?? "",
          bordero: str(params.bordero),
          titulo: str(params.titulo),
          cedente: cedente.codigo ?? "",
          sacado: sacado.codigo ?? "",
          situacao: str(params.situacao),
          statusPagamento: str(params.status_pagamento),
          tipoPagamento: str(params.tipo_pagamento),
          dataCompraInicio: dataOuNull(params.data_compra_inicio),
          dataCompraFim: dataOuNull(params.data_compra_fim),
          dataPagamentoInicio: dataOuNull(params.data_pagamento_inicio),
          dataPagamentoFim: dataOuNull(params.data_pagamento_fim),
          vencimentoInicio: dataOuNull(params.vencimento_inicio),
          vencimentoFim: dataOuNull(params.vencimento_fim),
        },
        session,
      );

      const pagina = await getRelatorioTitulos(1, 50, "vencimento", "desc", filtros);
      const sujeitoGrupo = grupoCedente.nome
        ? `O grupo econômico ${grupoCedente.nome} (cedente)`
        : grupoSacado.nome
          ? `O grupo econômico ${grupoSacado.nome} (sacado)`
          : null;
      const sujeito = sujeitoGenerico(comercial.nome, cedente.nome, sacado.nome) === "A carteira" && sujeitoGrupo
        ? sujeitoGrupo
        : sujeitoGenerico(comercial.nome, cedente.nome, sacado.nome);
      const sujeitoEntidade = comercial.nome
        ? sujeitoComercial(comercial.nome)
        : cedente.nome
          ? sujeitoCedente(cedente.nome)
          : sacado.nome
            ? sujeitoSacado(sacado.nome)
            : sujeitoGrupo;
      const qualificadorStatus =
        typeof params.status_pagamento === "string" ? QUALIFICADOR_STATUS_PAGAMENTO[params.status_pagamento] : undefined;

      let resumo: string;
      if (params.metrica === "quantidade") {
        resumo = resumoContagem(sujeitoEntidade, "títulos", pagina.total, qualificadorStatus);
      } else {
        const porMetrica: Record<string, { predicado: string; valor: string }> = {
          valor: { predicado: "tem valor total de", valor: fmtMoeda(pagina.totais.valorTitulo) },
          valor_pagamento: { predicado: "tem valor total pago de", valor: fmtMoeda(pagina.totais.valorPagamento) },
          saldo: { predicado: "tem saldo total de", valor: fmtMoeda(pagina.totais.saldoTitulo) },
        };
        resumo = resumoComMetrica(params.metrica, porMetrica, sujeito, sujeito, [
          { rotulo: "títulos encontrados", valor: fmtInt(pagina.total) },
          { rotulo: "valor total", valor: fmtMoeda(pagina.totais.valorTitulo) },
          { rotulo: "saldo total", valor: fmtMoeda(pagina.totais.saldoTitulo) },
        ]);
      }

      const detalhar = params.detalhar === true;
      const listarSimples = params.listar_simples === true;
      let linhas: Record<string, unknown>[] = [];
      if (detalhar || listarSimples) {
        const { linhas: todas, avisoTruncamento } = await buscarLinhasDetalhadas(() =>
          getRelatorioTitulosParaExportacao("vencimento", "desc", filtros),
        );
        linhas = detalhar
          ? (todas as unknown as Record<string, unknown>[])
          : projetarColunasMinimas(todas, ["titulo", "cedente"]);
        if (avisoTruncamento) avisos.push(avisoTruncamento);
      }

      return {
        resumo,
        linhas,
        totais: detalhar ? (pagina.totais as unknown as Record<string, number>) : undefined,
        fonte: "Relatório Analítico de Títulos",
        avisoResolucao: avisos.length ? avisos.join(" ") : undefined,
      };
    },
  },

  // Exposição Cedente (CLAUDE.md seção 23) — grão de título, toggle "A
  // Vencer"/"Vencido". Adicionada em 2026-07-19 junto com `titulos`, mesmo
  // pedido do cliente. Não confundir com o grupo homônimo do Comportamental
  // (comportamental-exposicao-cedente.ts, grão CEDENTE) — essa é a tela
  // própria /dashboard/exposicao-cedente, referenciada pelo cliente como um
  // dos 10 módulos que a IA deveria cobrir.
  exposicao_cedente: {
    slug: "exposicao_cedente",
    grupo: "Exposição Cedente",
    descricaoParaLLM:
      "Perguntas sobre títulos a vencer ou vencidos de um cedente (grão de título — data de vencimento, vencimento da tranche, data do borderô). Ex: 'quais títulos do cedente X estão vencidos?', 'títulos a vencer do comercial Y'.",
    parametrosSchema: {
      type: "object",
      properties: {
        comercial_nome: PARAM_COMERCIAL_NOME,
        cedente_nome: PARAM_CEDENTE_NOME,
        grupo_economico_nome: PARAM_GRUPO_ECONOMICO_NOME,
        visao: {
          type: "string",
          enum: ["avencer", "vencido"],
          description: "A Vencer ou Vencido. Padrão: avencer.",
        },
        metrica: {
          type: "string",
          enum: ["quantidade", "valor"],
          description:
            "Se a pergunta pede um número específico (ex: só a quantidade de títulos, ou só o valor total), qual — senão deixe de fora pra ver o panorama completo.",
        },
        detalhar: PARAM_DETALHAR,
        listar_simples: PARAM_LISTAR_SIMPLES,
      },
      additionalProperties: false,
    },
    resolverEExecutar: async (params, session) => {
      const avisos: string[] = [];
      const { comercial, cedente, grupoEconomico } = await resolverEscopoComum(params, avisos, {
        sacado: false,
        grupoEconomico: true,
      });
      const visao: "avencer" | "vencido" = params.visao === "vencido" ? "vencido" : "avencer";
      const filtros = applyAccessScope(
        {
          comercial: comercial.codigo ?? "",
          grupoEconomico: grupoEconomico.codigo ?? "",
          cedente: cedente.codigo ?? "",
          visao,
        },
        session,
      );
      const pagina = await getExposicaoCedente(1, 20, "vencimento", "asc", filtros);
      const { min: sujeitoMin, nominativo: sujeitoNominativo, entidade: sujeitoEntidade } = sujeitoComGrupo(
        cedente.nome,
        comercial.nome,
        grupoEconomico.nome,
      );
      const visaoLabel = visao === "avencer" ? "a vencer" : "vencidos";

      let resumo: string;
      if (params.metrica === "quantidade") {
        resumo = resumoContagem(sujeitoEntidade, "títulos", pagina.total, visaoLabel);
      } else {
        const porMetrica: Record<string, { predicado: string; valor: string }> = {
          valor: { predicado: `tem, ${visaoLabel}, valor total de`, valor: fmtMoeda(pagina.totais.valor) },
        };
        resumo = resumoComMetrica(
          params.metrica,
          porMetrica,
          sujeitoNominativo,
          `Títulos ${visaoLabel}, ${sujeitoMin}`,
          [
            { rotulo: "títulos", valor: fmtInt(pagina.total) },
            { rotulo: "valor total", valor: fmtMoeda(pagina.totais.valor) },
          ],
        );
      }

      const detalhar = params.detalhar === true;
      const listarSimples = params.listar_simples === true;
      let linhas: Record<string, unknown>[] = [];
      if (detalhar || listarSimples) {
        const { linhas: todas, avisoTruncamento } = await buscarLinhasDetalhadas(() =>
          getExposicaoCedenteParaExportacao("vencimento", "asc", filtros),
        );
        linhas = detalhar
          ? (todas as unknown as Record<string, unknown>[])
          : projetarColunasMinimas(todas, ["titulo", "cedente"]);
        if (avisoTruncamento) avisos.push(avisoTruncamento);
      }

      return {
        resumo,
        linhas,
        totais: detalhar ? (pagina.totais as unknown as Record<string, number>) : undefined,
        fonte: "Exposição Cedente",
        avisoResolucao: avisos.length ? avisos.join(" ") : undefined,
      };
    },
  },
};
