import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import Anthropic from "@anthropic-ai/sdk";
import { authOptions } from "@/lib/auth";
import { classificarPergunta, type TurnoHistorico } from "@/lib/ia/router";
import { TEMPLATES, type IaTemplateResultado } from "@/lib/ia/templates";
import { responderPerguntaAbertaComissoes } from "@/lib/ia/open-sql/comissoes";

// Rota da Interação por IA (CLAUDE.md seção 12) — "Interação por IA" não
// tem `permissionKey` no menu (dashboard-nav.ts), visível a qualquer
// usuário autenticado; aqui só exige sessão válida, mesmo padrão.
export interface PerguntaResponse {
  tipo: "comum" | "aberta" | "conceitual" | "erro" | "esclarecimento";
  resultado?: IaTemplateResultado;
  mensagem?: string;
  /** Preenchido quando `tipo` é "esclarecimento" — a UI mostra `mensagem`
   * como texto do assistente e os `opcoes` como botões de resposta rápida.
   * Ao clicar, o cliente reenvia `templateSlug`/`params` (com o campo
   * preenchido) direto pro POST, pulando o roteador — não precisa
   * reclassificar a pergunta, só completar o parâmetro que faltava. */
  esclarecimento?: {
    templateSlug: string;
    params: Record<string, unknown>;
    campo: string;
    opcoes: { valor: string; rotulo: string }[];
  };
}

interface PerguntaRequestBody {
  /** Fluxo normal — passa pelo roteador de intenção (Tool Use). */
  pergunta?: string;
  /** Últimos turnos da conversa atual (enviados pelo cliente a partir de
   * `mensagens`) — só pra resolver pronomes/referências ("ela", "e em
   * julho?"), nunca pra inventar dado que não foi dito. */
  historico?: TurnoHistorico[];
  /** Fluxo de retomada — usado quando o usuário responde a uma pergunta de
   * esclarecimento (ex: escolheu o eixo de data). Pula o roteador: executa
   * o template direto com os parâmetros já completos. */
  templateSlug?: string;
  params?: Record<string, unknown>;
}

async function executarTemplate(
  templateSlug: string,
  params: Record<string, unknown>,
  session: Session | null,
): Promise<PerguntaResponse> {
  const template = TEMPLATES[templateSlug];
  if (!template) {
    return {
      tipo: "erro",
      mensagem: "Encontrei um relatório correspondente, mas não consegui consultá-lo agora.",
    };
  }

  if (template.precisaEsclarecer?.(params) && template.esclarecimentoCampo && template.esclarecimentoOpcoes) {
    return {
      tipo: "esclarecimento",
      mensagem: template.esclarecimentoMensagem ?? "Com base em qual data você quer o resultado?",
      esclarecimento: {
        templateSlug,
        params,
        campo: template.esclarecimentoCampo,
        opcoes: template.esclarecimentoOpcoes,
      },
    };
  }

  const resultado = await template.resolverEExecutar(params, session);
  return { tipo: "comum", resultado };
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as PerguntaRequestBody | null;

  try {
    // Fluxo de retomada (resposta a um esclarecimento) — sem chamada à
    // Claude, pula direto pra execução do template já conhecido.
    if (body?.templateSlug && body.params) {
      const resposta = await executarTemplate(body.templateSlug, body.params, session);
      return NextResponse.json<PerguntaResponse>(resposta);
    }

    const pergunta = body?.pergunta?.trim();
    if (!pergunta) {
      return NextResponse.json({ error: "Informe uma pergunta." }, { status: 400 });
    }

    const roteamento = await classificarPergunta(pergunta, body?.historico ?? []);

    if (roteamento.tipo !== "comum") {
      // Caminho "pergunta aberta" (CLAUDE.md seção 12) — POC escopada só a
      // Comissões (2026-07-19): nenhum template fixo bateu com a pergunta,
      // então tenta gerar/executar SQL de verdade contra a view semântica
      // ComissoesEscopo antes de desistir. Se não for sobre Comissões (ou o
      // modelo não conseguir), volta pro "não sei responder" de sempre.
      const resultadoAberto = await responderPerguntaAbertaComissoes(pergunta, session, body?.historico ?? []);
      if (resultadoAberto) {
        return NextResponse.json<PerguntaResponse>({ tipo: "comum", resultado: resultadoAberto });
      }

      const resposta: PerguntaResponse = {
        tipo: roteamento.tipo,
        mensagem:
          "Ainda não sei responder esse tipo de pergunta — por enquanto só consigo consultar os relatórios já mapeados da plataforma (ex: comissão de um comercial, risco de um cedente). Tente reformular perguntando sobre um dado específico.",
      };
      return NextResponse.json(resposta);
    }

    const resposta = await executarTemplate(roteamento.templateSlug, roteamento.params, session);
    return NextResponse.json<PerguntaResponse>(resposta);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/ia/pergunta] falha ao processar pergunta", {
      timestamp: new Date().toISOString(),
      message: (error as Error).message,
    });

    // Chave da API ainda não configurada — mensagem clara em vez de erro
    // genérico 503, já que é um cenário esperado enquanto o cliente não
    // configura o ANTHROPIC_API_KEY (CLAUDE.md seção 12).
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json<PerguntaResponse>(
        {
          tipo: "erro",
          mensagem:
            "O módulo de IA ainda não está configurado — falta a chave da API da Anthropic. Fale com o administrador da plataforma.",
        },
        { status: 200 },
      );
    }

    return NextResponse.json<PerguntaResponse>(
      { tipo: "erro", mensagem: "Não foi possível processar sua pergunta agora. Tente novamente em instantes." },
      { status: 200 },
    );
  }
}
