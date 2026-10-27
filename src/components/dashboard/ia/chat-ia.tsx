"use client";

import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  AlertTriangle,
  Database,
  User as UserIcon,
  Save,
} from "lucide-react";
import type { IaTemplateResultado } from "@/lib/ia/templates";
import type { PerguntaResponse } from "@/app/api/ia/pergunta/route";
import { ExportarTabelaMenu } from "./exportar-tabela-menu";
import { MiniGraficoMensal } from "./mini-grafico-mensal";
import { MiniGraficoCategorico } from "./mini-grafico-categorico";

export interface MensagemUsuario {
  autor: "usuario";
  texto: string;
}

export interface MensagemAssistente {
  autor: "assistente";
  isLoading?: boolean;
  resposta?: PerguntaResponse;
  erro?: string;
}

export type Mensagem = MensagemUsuario | MensagemAssistente;

// Perguntas de exemplo (CLAUDE.md seção 12) — atalhos pra quem ainda não
// sabe o que perguntar.
const SUGESTOES = [
  "Qual o valor total de comissão do comercial X neste mês?",
  "Qual o risco do cedente Y hoje?",
];

// Resposta padrão do módulo é sempre um texto com os valores em **negrito**
// (markdown simples, nunca a biblioteca inteira de markdown) — CLAUDE.md
// seção 12, pedido do cliente em 2026-07-19. Só interpreta `**texto**`.
function renderComNegrito(texto: string): ReactNode[] {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g);
  return partes.map((parte, i) => {
    if (parte.startsWith("**") && parte.endsWith("**")) {
      return <strong key={i}>{parte.slice(2, -2)}</strong>;
    }
    return <span key={i}>{parte}</span>;
  });
}

function formatValor(valor: unknown): string {
  if (typeof valor === "number") {
    return valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  }
  if (valor === null || valor === undefined) return "—";
  return String(valor);
}

function formatColuna(chave: string): string {
  return chave
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

// A resposta padrão é só o resumo em texto — `linhas`/`totais` só vêm
// preenchidos pelo backend quando o usuário pediu detalhamento explícito
// ("liste", "mostra a tabela"), então a tabela só aparece nesse caso.
function ResultadoTemplate({ resultado }: { resultado: IaTemplateResultado }) {
  const colunas = resultado.linhas.length > 0 ? Object.keys(resultado.linhas[0]) : [];
  const linhasVisiveis = resultado.linhas.slice(0, 10);

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-azul-escuro/85">{renderComNegrito(resultado.resumo)}</p>

      {resultado.graficos && resultado.graficos.length > 0 && (
        <div className="grid gap-3">
          {resultado.graficos.map((g, i) => (
            <MiniGraficoMensal key={i} titulo={g.titulo} cor={g.cor} unidade={g.unidade} pontos={g.pontos} />
          ))}
        </div>
      )}

      {resultado.graficoCategorico && (
        <MiniGraficoCategorico
          titulo={resultado.graficoCategorico.titulo}
          cor={resultado.graficoCategorico.cor}
          unidade={resultado.graficoCategorico.unidade}
          itens={resultado.graficoCategorico.itens}
        />
      )}

      {resultado.avisoResolucao && (
        <p className="flex items-start gap-2 rounded-xl bg-ambar-alerta/10 px-3.5 py-2.5 text-sm text-ambar-alerta">
          <AlertTriangle size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          {resultado.avisoResolucao}
        </p>
      )}

      {resultado.totais && Object.keys(resultado.totais).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(resultado.totais).map(([chave, valor]) => (
            <span
              key={chave}
              className="inline-flex items-center gap-1.5 rounded-full bg-azul-escuro/5 px-3 py-1.5 text-xs font-medium text-azul-escuro"
            >
              {formatColuna(chave)}:{" "}
              <span className="font-semibold">
                {valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </span>
          ))}
        </div>
      )}

      {linhasVisiveis.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-cinza-prata/40">
          <div className="flex items-center justify-between border-b border-cinza-prata/40 bg-surface-alt/60 px-3 py-1.5">
            <span className="text-xs font-medium text-azul-escuro/45">
              {resultado.linhas.length} {resultado.linhas.length === 1 ? "linha" : "linhas"}
            </span>
            <ExportarTabelaMenu linhas={resultado.linhas} titulo={resultado.fonte} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-cinza-prata/40 bg-surface-alt/60">
                  {colunas.map((c) => (
                    <th
                      key={c}
                      className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wide text-azul-escuro/50"
                    >
                      {formatColuna(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhasVisiveis.map((linha, i) => (
                  <tr key={i} className="border-b border-cinza-prata/20 last:border-0">
                    {colunas.map((c) => (
                      <td key={c} className="whitespace-nowrap px-3 py-2 text-azul-escuro/80">
                        {formatValor(linha[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {resultado.linhas.length > linhasVisiveis.length && (
            <p className="border-t border-cinza-prata/40 bg-surface-alt/60 px-3 py-2 text-xs text-azul-escuro/45">
              Mostrando {linhasVisiveis.length} de {resultado.linhas.length} linhas.
            </p>
          )}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-azul-escuro/40">
        <Database size={12} strokeWidth={1.75} />
        Fonte: {resultado.fonte}
      </p>
    </div>
  );
}

function BolhaAssistente({
  msg,
  onEscolherEsclarecimento,
}: {
  msg: MensagemAssistente;
  onEscolherEsclarecimento: (
    esclarecimento: NonNullable<PerguntaResponse["esclarecimento"]>,
    opcao: { valor: string; rotulo: string },
  ) => void;
}) {
  // Bolhas com gráfico usam largura maior que o texto puro (max-w-2xl) pra
  // caber o rótulo de valor por extenso em cima de cada barra — mas 40%
  // menor que o máximo disponível (pedido do cliente em 2026-07-19: a
  // largura total ficava boa na tela, mas ruim na exportação de imagem).
  const temGraficos = Boolean(
    msg.resposta?.tipo === "comum" &&
      (msg.resposta.resultado?.graficos?.length || msg.resposta.resultado?.graficoCategorico),
  );

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-azul-escuro text-white">
        <Sparkles size={15} strokeWidth={1.75} />
      </div>
      <div
        className={`${temGraficos ? "max-w-[60%]" : "max-w-2xl"} flex-1 rounded-2xl rounded-tl-sm border border-cinza-prata/40 bg-white p-4 shadow-premium-sm`}
      >
        {msg.isLoading ? (
          <span className="inline-flex items-center gap-2 text-sm text-azul-escuro/45">
            <Loader2 size={15} className="animate-spin" />
            Consultando...
          </span>
        ) : msg.erro ? (
          <p className="flex items-start gap-2 text-sm text-vermelho-risco">
            <AlertTriangle size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            {msg.erro}
          </p>
        ) : msg.resposta?.tipo === "comum" && msg.resposta.resultado ? (
          <ResultadoTemplate resultado={msg.resposta.resultado} />
        ) : msg.resposta?.tipo === "esclarecimento" && msg.resposta.esclarecimento ? (
          <div className="space-y-3">
            <p className="text-sm text-azul-escuro/80">{msg.resposta.mensagem}</p>
            <div className="flex flex-wrap gap-2">
              {msg.resposta.esclarecimento.opcoes.map((opcao) => (
                <button
                  key={opcao.valor}
                  onClick={() => onEscolherEsclarecimento(msg.resposta!.esclarecimento!, opcao)}
                  className="rounded-full border border-azul-medio/40 bg-azul-medio/5 px-3.5 py-2 text-xs font-medium text-azul-escuro transition hover:border-azul-medio hover:bg-azul-medio/10"
                >
                  {opcao.rotulo}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-azul-escuro/80">{msg.resposta?.mensagem}</p>
        )}
      </div>
    </div>
  );
}

interface ChatIAProps {
  mensagens: Mensagem[];
  setMensagens: Dispatch<SetStateAction<Mensagem[]>>;
  tituloConversa: string | null;
  podeSalvar: boolean;
  isSalvando: boolean;
  onSalvarClick: () => void;
}

export function ChatIA({
  mensagens,
  setMensagens,
  tituloConversa,
  podeSalvar,
  isSalvando,
  onSalvarClick,
}: ChatIAProps) {
  const [pergunta, setPergunta] = useState("");
  const [isEnviando, setIsEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  // Cursor já pronto pra digitar assim que a tela abre — sem precisar clicar
  // no campo primeiro.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Envia o corpo da requisição (pergunta nova OU retomada de
  // esclarecimento) e resolve a última mensagem (bolha de loading já
  // empurrada pelo chamador) com o resultado.
  async function postPergunta(body: Record<string, unknown>) {
    setIsEnviando(true);
    try {
      const res = await fetch("/api/ia/pergunta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as PerguntaResponse & { error?: string };

      setMensagens((prev) => {
        const copia = [...prev];
        const ultimoIndex = copia.length - 1;
        copia[ultimoIndex] = res.ok
          ? { autor: "assistente", resposta: data }
          : { autor: "assistente", erro: data.error ?? "Não foi possível processar sua pergunta agora." };
        return copia;
      });
    } catch {
      setMensagens((prev) => {
        const copia = [...prev];
        copia[copia.length - 1] = {
          autor: "assistente",
          erro: "Não foi possível conectar com o servidor. Tente novamente.",
        };
        return copia;
      });
    } finally {
      setIsEnviando(false);
    }
  }

  async function enviarPergunta(texto: string) {
    const perguntaLimpa = texto.trim();
    if (!perguntaLimpa || isEnviando) return;

    // Últimos turnos da conversa ATUAL (antes de empurrar a pergunta nova)
    // — mandados pro roteador só pra resolver pronomes/referências ("ela",
    // "e em julho?"). Mensagens ainda carregando/com erro não viram
    // contexto útil, ficam de fora.
    const historico = mensagens
      .map((msg): { autor: "usuario" | "assistente"; texto: string } | null => {
        if (msg.autor === "usuario") return { autor: "usuario", texto: msg.texto };
        if (msg.isLoading || msg.erro) return null;
        const texto = msg.resposta?.resultado?.resumo ?? msg.resposta?.mensagem;
        return texto ? { autor: "assistente", texto } : null;
      })
      .filter((t): t is { autor: "usuario" | "assistente"; texto: string } => t !== null);

    setMensagens((prev) => [
      ...prev,
      { autor: "usuario", texto: perguntaLimpa },
      { autor: "assistente", isLoading: true },
    ]);
    setPergunta("");
    await postPergunta({ pergunta: perguntaLimpa, historico });
  }

  // Resposta a uma pergunta de esclarecimento (ex: escolha do eixo de data)
  // — pula o roteador, reenvia o template já conhecido com o parâmetro
  // completado.
  async function escolherEsclarecimento(
    esclarecimento: NonNullable<PerguntaResponse["esclarecimento"]>,
    opcao: { valor: string; rotulo: string },
  ) {
    if (isEnviando) return;
    setMensagens((prev) => [
      ...prev,
      { autor: "usuario", texto: opcao.rotulo },
      { autor: "assistente", isLoading: true },
    ]);
    await postPergunta({
      templateSlug: esclarecimento.templateSlug,
      params: { ...esclarecimento.params, [esclarecimento.campo]: opcao.valor },
    });
  }

  return (
    <div className="flex h-[calc(100vh-11rem)] flex-col rounded-2xl border border-cinza-prata/40 bg-white shadow-premium-sm">
      <div className="flex items-center gap-3.5 border-b border-cinza-prata/40 px-6 py-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-azul-escuro/5 text-azul-escuro">
          <Sparkles size={20} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-azul-escuro">
            {tituloConversa ?? "Interação por IA"}
          </h2>
          <p className="text-sm text-azul-escuro/50">
            {tituloConversa
              ? "Alterando esta conversa salva — use Salvar para atualizar."
              : "Pergunte em linguagem natural sobre os dados da sua carteira."}
          </p>
        </div>
        <button
          onClick={onSalvarClick}
          disabled={!podeSalvar || isSalvando}
          title="Salvar conversa"
          className="flex shrink-0 items-center gap-2 rounded-xl border border-cinza-prata/60 px-3.5 py-2 text-sm font-medium text-azul-escuro/70 transition hover:border-azul-medio/40 hover:bg-azul-medio/5 hover:text-azul-escuro disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSalvando ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Save size={15} strokeWidth={1.75} />
          )}
          Salvar
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
        {mensagens.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-azul-escuro/5 text-azul-escuro">
              <Sparkles size={24} strokeWidth={1.5} />
            </div>
            <p className="mt-4 max-w-sm text-sm text-azul-escuro/50">
              Comece perguntando algo sobre comissões, risco de cedentes ou outros indicadores da carteira.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => enviarPergunta(s)}
                  className="rounded-full border border-cinza-prata/60 px-3.5 py-2 text-xs font-medium text-azul-escuro/70 transition hover:border-azul-medio/40 hover:bg-azul-medio/5 hover:text-azul-escuro"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensagens.map((msg, i) =>
          msg.autor === "usuario" ? (
            <div key={i} className="flex items-start justify-end gap-3">
              <div className="max-w-2xl rounded-2xl rounded-tr-sm bg-azul-escuro px-4 py-3 text-sm text-white">
                {msg.texto}
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-azul-escuro/10 text-azul-escuro">
                <UserIcon size={15} strokeWidth={1.75} />
              </div>
            </div>
          ) : (
            <BolhaAssistente key={i} msg={msg} onEscolherEsclarecimento={escolherEsclarecimento} />
          ),
        )}
        <div ref={fimRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviarPergunta(pergunta);
        }}
        className="flex items-center gap-3 border-t border-cinza-prata/40 px-6 py-4"
      >
        <input
          ref={inputRef}
          type="text"
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          placeholder="Pergunte algo sobre a carteira..."
          autoComplete="off"
          className="flex-1 rounded-xl border border-cinza-prata/70 bg-white px-4 py-2.5 text-sm text-azul-escuro placeholder:text-azul-escuro/35 outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10"
        />
        <button
          type="submit"
          disabled={isEnviando || !pergunta.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-azul-escuro text-white transition hover:bg-azul-medio active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isEnviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} strokeWidth={2} />}
        </button>
      </form>
    </div>
  );
}
