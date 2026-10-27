import Anthropic from "@anthropic-ai/sdk";
import { TEMPLATES } from "./templates";

// Roteador de intenção do módulo de IA — CLAUDE.md seção 12. Uma única
// chamada com Tool Use: cada grupo de métrica (TEMPLATES) vira uma "tool";
// a Claude decide qual delas (se alguma) responde a pergunta e já devolve
// os parâmetros extraídos (nomes citados, período) na mesma chamada — sem
// um passo de classificação separado do de extração.
//
// Modelo: claude-haiku-4-5 — decisão explícita do cliente em 2026-07-18
// (produto ainda em desenvolvimento, sem receita, prioridade é custo
// mínimo). É o modelo mais barato da família atual (US$ 1/US$ 5 por 1M
// tokens de entrada/saída, ~5x mais barato que Opus 4.8) — adequado aqui
// porque essa chamada é classificação + extração estruturada sobre um
// conjunto FIXO de tools (TEMPLATES), não raciocínio aberto. Reavaliar
// quando o caminho de "pergunta aberta" (SQL gerado) for implementado —
// gerar SQL corretamente exige mais capacidade de raciocínio do que rotear
// entre tools já mapeadas. Sem parâmetro `thinking`/`effort`: Haiku 4.5 não
// aceita `thinking: {type: "adaptive"}` nem `output_config.effort`
// (claude-api skill) — desnecessário de qualquer forma pra essa tarefa.
const MODEL = "claude-haiku-4-5";

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!cachedClient) cachedClient = new Anthropic();
  return cachedClient;
}

// Exportado (2026-07-19, POC "pergunta aberta" — CLAUDE.md seção 12):
// reaproveitado por src/lib/ia/open-sql/comissoes.ts, mesma instância de
// cliente (evita recriar a cada chamada).
export function getAnthropicClient(): Anthropic {
  return getClient();
}

export type RespostaRoteador =
  | { tipo: "comum"; templateSlug: string; params: Record<string, unknown> }
  // "aberta" (SQL livre restrito) e "conceitual" (busca na documentação)
  // são os outros 2 caminhos do desenho (CLAUDE.md 12) — ainda não
  // implementados nesta entrega (escopo: só perguntas comuns).
  | { tipo: "aberta" | "conceitual" };

// Turno anterior da conversa, na forma resumida que o cliente já guarda em
// `mensagens` (autor + texto simples) — nunca o objeto PerguntaResponse
// inteiro, só o suficiente pro modelo resolver pronomes/referências
// ("ela", "dessa comissão", "e em julho?").
export interface TurnoHistorico {
  autor: "usuario" | "assistente";
  texto: string;
}

// Quantos turnos anteriores mandar como contexto — pequeno de propósito
// (custo mínimo, CLAUDE.md seção 12/[[feedback_custo_ia_fase_dev]]): o
// roteador só precisa resolver referências recentes, não lembrar a
// conversa inteira.
const MAX_TURNOS_HISTORICO = 6;

function toolsFromTemplates(): Anthropic.Tool[] {
  return Object.values(TEMPLATES).map((t) => ({
    name: t.slug,
    description: t.descricaoParaLLM,
    input_schema: t.parametrosSchema as Anthropic.Tool.InputSchema,
  }));
}

const SYSTEM_PROMPT = `Você é o roteador de intenção da plataforma SBK Capital (FIDC/Factoring).
Sua única tarefa é decidir se a pergunta do usuário bate com uma das ferramentas disponíveis (perguntas sobre dados concretos da carteira) e, se sim, extrair os parâmetros mencionados na pergunta (nomes de comercial/cedente/sacado, datas).

Regras:
- Só chame uma ferramenta quando a pergunta claramente pede um dado que ela cobre.
- O histórico da conversa (se houver) pode ser usado SÓ pra resolver pronomes e referências à pergunta atual ("ela", "dessa comissão", "e em julho?") — nunca pra inventar um nome/período que não foi dito em nenhum momento da conversa.
- Nunca invente um nome de comercial/cedente/sacado que não foi dito na pergunta atual nem no histórico — deixe o parâmetro de fora se não houver menção.
- Nunca invente ou deduza um período (datas) que não foi dito na pergunta atual nem no histórico.
- O parâmetro "detalhar" (quando a ferramenta tiver um) só deve ser true se o usuário pedir EXPLICITAMENTE o relatório/tabela COMPLETA, com todas as colunas (ex: "mostra a tabela completa", "exporta pra mim", "detalhe por título com todos os dados"). Por padrão, deixe false — a resposta padrão é sempre um resumo em texto, nunca uma lista.
- O parâmetro "listar_simples" (quando a ferramenta tiver um) deve ser true quando o usuário pedir só os NOMES/IDENTIFICAÇÃO dos itens, sem detalhamento financeiro — muito comum como pergunta de acompanhamento depois de uma contagem (ex: "quantos cedentes com risco temos?" → depois "quais são eles?"/"quem são?"). Nunca marque "detalhar" nesse caso — "quais são eles" pede uma lista simples, não o relatório completo.
- NUNCA marque "detalhar" ou "listar_simples" como atalho pra conseguir um número específico que não tem uma opção exata em "metrica" — isso despeja uma tabela inteira quando o usuário só queria um valor. Se a métrica pedida não existir no enum de "metrica" da ferramenta, prefira a opção mais próxima disponível (ou deixe "metrica" de fora pro panorama resumido em texto) — nunca "detalhar"/"listar_simples" como substituto. Uma pergunta que não pede lista, tabela nem gráfico NUNCA deve receber uma lista, tabela ou gráfico de volta — só o texto direto com o valor pedido.
- O mesmo vale pra ferramentas com gráfico (ex: "graficos"): se a pergunta pedir o valor de UM período específico (ex: "quanto de vencido em abril de 2026?") em vez de uma visualização/evolução, e a ferramenta tiver um parâmetro pra isso (ex: "mes"), use esse parâmetro — nunca devolva o gráfico inteiro só porque não tinha outra ferramenta com o dado. Gráfico/tabela é sempre a exceção, pedida explicitamente; texto direto é o padrão.
- Se a pergunta não corresponder a nenhuma ferramenta, não chame nenhuma — responda apenas com texto explicando que não há um relatório correspondente.`;

// Classifica a pergunta e, se ela bater com um template de "pergunta
// comum", devolve o slug e os parâmetros já extraídos. A execução em si
// (resolver nomes, aplicar RLS, chamar a query) fica em templates.ts —
// este roteador só decide QUAL template usar. `historico` (opcional) são os
// últimos turnos da conversa atual — só pra resolver referências como "ela"
// ou "e em julho?"; sem isso, cada pergunta era tratada isoladamente e
// perguntas de acompanhamento (que dependiam do contexto anterior) caíam
// em "não sei responder" mesmo quando o template certo existia.
export async function classificarPergunta(
  pergunta: string,
  historico: TurnoHistorico[] = [],
): Promise<RespostaRoteador> {
  const client = getClient();
  const turnosRecentes = historico.slice(-MAX_TURNOS_HISTORICO);
  const mensagens: Anthropic.MessageParam[] = [
    ...turnosRecentes.map((t) => ({
      role: t.autor === "usuario" ? ("user" as const) : ("assistant" as const),
      content: t.texto,
    })),
    { role: "user", content: pergunta },
  ];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    // Sem `thinking`/`output_config.effort` — Haiku 4.5 não aceita
    // thinking adaptativo nem effort (claude-api skill); desnecessário pra
    // classificação + extração sobre um conjunto fixo de tools.
    system: SYSTEM_PROMPT,
    tools: toolsFromTemplates(),
    messages: mensagens,
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (toolUse) {
    return {
      tipo: "comum",
      templateSlug: toolUse.name,
      params: toolUse.input as Record<string, unknown>,
    };
  }

  // Sem tool_use — a pergunta não bateu com nenhum template. Sem
  // diferenciar "aberta" de "conceitual" ainda (nenhuma das duas está
  // implementada); tratado como "aberta" genericamente por enquanto.
  return { tipo: "aberta" };
}
