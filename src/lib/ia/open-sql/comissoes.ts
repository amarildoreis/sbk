import type { Session } from "next-auth";
import Anthropic from "@anthropic-ai/sdk";
import { executeReadQuery, ReadOnlyViolationError, type QueryParam } from "@/lib/db/query";
import { applyAccessScope } from "@/lib/auth/access-scope";
import {
  FILTROS_CTE,
  FILTROS_JOINS,
  FILTROS_WHERE,
  filtrosParams,
  buildFaixaComissaoExpr,
  buildInternoCondicao,
  getFaixasOrdenadas,
  getTipoComercialMap,
  internoCodigosFromMap,
  type ComissoesFiltros,
} from "@/lib/db/queries/comissoes";
import { STATUS_PAGTO_CASE, TIPO_PAGAMENTO_CASE, JUROS_MENSAL_CASE } from "@/lib/db/queries/sigfidc-shared";
import { getAnthropicClient } from "@/lib/ia/router";
import type { TurnoHistorico } from "@/lib/ia/router";
import type { IaTemplateResultado } from "@/lib/ia/templates";

// Caminho "pergunta aberta" (CLAUDE.md seção 12) — PROVA DE CONCEITO
// (2026-07-19), escopada só ao módulo Comissões, a pedido do cliente ("ver
// uma prova de conceito pequena somente com Comissões... depois estendemos
// pra tudo"). Diferente dos templates de `templates.ts` (que mapeiam pra uma
// query fixa por trás), aqui o próprio modelo escreve o SQL — mas NUNCA
// contra o schema bruto (SIGFIDC/SIGCAD/SIGBORS...): só contra uma view
// semântica somente-leitura (`ComissoesEscopo`), montada em código
// reaproveitando EXATAMENTE os mesmos fragmentos de SQL já usados pela tela
// de Comissões (FILTROS_CTE/FILTROS_JOINS/FILTROS_WHERE, STATUS_PAGTO_CASE,
// JUROS_MENSAL_CASE, faixas de comissão dinâmicas) — nenhuma regra de
// negócio duplicada ou reinventada pelo modelo.
//
// RLS (CLAUDE.md 21.17): a `ComissoesEscopo` já nasce filtrada pelo escopo
// da sessão (comercial/cedente/sacado, via applyAccessScope) ANTES do modelo
// ver qualquer coisa — o modelo nunca decide o que o usuário pode ver, só
// filtra/agrupa dentro do que já foi liberado.
//
// Modelo: claude-sonnet-5 (não Haiku) — diferente do roteador de intenção
// (classificação sobre um conjunto fixo de tools), aqui é geração de SQL de
// verdade, que exige raciocínio real sobre schema/sintaxe/agregação.
const MODEL_ABERTA = "claude-sonnet-5";

const MAX_TENTATIVAS = 3;
const MAX_LINHAS_RETORNO = 300;
const MAX_LINHAS_PARA_MODELO = 50;
const QUERY_TIMEOUT_MS = 15_000;

const TOOL_EXECUTAR_SQL: Anthropic.Tool = {
  name: "executar_sql",
  description:
    "Executa uma única consulta SELECT contra a tabela ComissoesEscopo e devolve as linhas resultantes (ou uma mensagem de erro, se a consulta for inválida/malformada).",
  input_schema: {
    type: "object",
    properties: {
      sql: {
        type: "string",
        description:
          "Consulta SQL Server 2008 R2 — um único SELECT com TOP N, referenciando somente a tabela ComissoesEscopo.",
      },
    },
    required: ["sql"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `Você é o assistente de consulta SQL do módulo Comissões da plataforma SBK Capital (FIDC/Factoring). Sua tarefa é responder perguntas em português sobre comissão, valor de título e deságio, escrevendo consultas SQL contra UMA ÚNICA tabela disponível: ComissoesEscopo (uma linha por título, RLS/permissão do usuário já aplicado — você nunca precisa e nunca deve tentar filtrar por usuário/permissão).

Schema de ComissoesEscopo:
- titulo (varchar) — número/identificação do título
- cedente (varchar) — nome do cedente
- sacado (varchar) — nome do sacado
- bordero (int) — número do borderô
- indicanteOperador (varchar) — "código - nome" do comercial (indicante/operador) responsável pelo título
- comercialCodigo (varchar) — código cru do comercial, melhor pra GROUP BY do que indicanteOperador (evita ambiguidade de texto)
- tipo (varchar) — 'Interno' ou 'Externo'
- dataCompra (date) — data de digitação/compra do título
- valorTitulo (decimal) — valor do título
- statusPagamento (varchar) — 'A Vencer' | 'Vencido' | 'Pago Em Dia' | 'Pago Vencido'
- tipoPagamento (varchar) — 'Pagamento Pendente' | 'Pagamento Parcial' | 'Pagamento Total'
- desagio (decimal) — deságio (juros bruto) do título, em reais
- taxa (decimal) — taxa mensal do título, em FRAÇÃO (ex: 0.0226 = 2,26% — multiplique por 100 se for citar como percentual)
- faixaComissao (decimal) — faixa/percentual de comissão aplicado, já em ESCALA PERCENTUAL (ex: 3 = 3%, não precisa multiplicar)
- comissao (decimal) — valor da comissão em reais
- vencimento (date) — data de vencimento do título
- dataPagamento (date) — data em que foi pago (nulo se ainda não pago)

Regras rígidas sobre a consulta SQL:
- Dialeto SQL Server 2008 R2 (compatibility level 100): NÃO existe OFFSET/FETCH, STRING_AGG nem CONCAT — use + para concatenar texto se precisar.
- Só um único comando SELECT — sem ";", sem CTE própria (nunca escreva WITH), referenciando exclusivamente ComissoesEscopo. Nenhuma outra tabela existe pra você.
- Sempre inclua "TOP N" logo após o SELECT (ex: TOP 200) — nunca peça mais linhas do que precisa pra responder.
- Use SUM/COUNT/AVG/MIN/MAX + GROUP BY quando a pergunta pedir total/quantidade/média — não devolva linhas cruas pra perguntas de valor agregado.
- Pra filtrar por nome citado na pergunta (comercial, cedente, sacado), use LIKE '%termo%' nas colunas de texto (cedente, sacado, indicanteOperador) — não existe tabela de cadastro separada aqui, é só texto.
- Datas: compare com literais 'YYYY-MM-DD' (ex: dataCompra >= '2026-06-01' AND dataCompra <= '2026-06-30' pra junho de 2026). Nunca assuma um período que a pergunta não mencionou.
- Nunca invente uma coluna que não está no schema acima.

Depois de ver o resultado, responda a pergunta em português, no mesmo estilo do resto da plataforma: direto, sem preâmbulo, com os valores importantes em **negrito** (markdown simples, só ** **). Se a pergunta pede um número, dê só a frase com o número — nunca despeje uma lista/tabela se não foi pedido explicitamente. Se a consulta não trouxer nenhuma linha, diga isso claramente, nunca invente um valor.

Se a pergunta não tiver relação nenhuma com comissão/título/deságio do módulo Comissões, NÃO chame a ferramenta — responda só com uma frase curta dizendo que essa pergunta está fora do que você consegue consultar aqui.`;

function validarSqlAberto(sqlTexto: string): { ok: true } | { ok: false; motivo: string } {
  const semComentarios = sqlTexto
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();

  if (!semComentarios) return { ok: false, motivo: "a consulta veio vazia." };
  if (semComentarios.includes(";")) {
    return { ok: false, motivo: "não é permitido mais de uma instrução (encontrei um ';')." };
  }
  if (!/^SELECT\b/i.test(semComentarios)) {
    return { ok: false, motivo: "a consulta precisa começar com SELECT — nada de WITH/CTE própria." };
  }
  const proibidas =
    /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC|EXECUTE|MERGE|GRANT|REVOKE|DENY|TRUNCATE|WITH|INTO|OPENROWSET|OPENQUERY|BACKUP|RESTORE|WAITFOR|SHUTDOWN)\b/i;
  if (proibidas.test(semComentarios)) {
    return { ok: false, motivo: "a consulta contém uma palavra-chave não permitida." };
  }
  if (/\bsp_|\bxp_/i.test(semComentarios)) {
    return { ok: false, motivo: "procedures do sistema não são permitidas." };
  }
  const tabelasProibidas =
    /\b(SIGFIDC|SIGCAD|SIGFLS|SIGBORS|SIGVEN|CADCRED|GrupoEmpresa|cadGrupoEmpresarial|ESTADOCONFIRMACAOTITULO|cadtarfidc|usuarios|FaixaComissao|sys\.|INFORMATION_SCHEMA)\b/i;
  if (tabelasProibidas.test(semComentarios)) {
    return { ok: false, motivo: "só é permitido consultar a tabela ComissoesEscopo, nenhuma outra." };
  }
  if (!/\bComissoesEscopo\b/i.test(semComentarios)) {
    return { ok: false, motivo: "a consulta precisa referenciar a tabela ComissoesEscopo." };
  }
  if (!/\bTOP\s*\(?\s*\d+/i.test(semComentarios)) {
    return { ok: false, motivo: 'inclua "TOP N" (ex: TOP 200) logo após o SELECT pra limitar o resultado.' };
  }
  return { ok: true };
}

// Monta a CTE `ComissoesEscopo` — reaproveita EXATAMENTE os mesmos
// fragmentos SQL da tela de Comissões (comissoes.ts). O escopo de RLS é
// aplicado aqui, sobre um objeto de filtros vazio (só comercial/cedente/
// sacado, quando o perfil da sessão exigir) — todo filtro de negócio
// (período, nome citado, tipo) fica a cargo do SELECT que o modelo escreve
// por cima desta CTE.
async function buildComissoesEscopoCte(
  session: Session | null,
): Promise<{ sqlBase: string; params: QueryParam[] }> {
  const [faixas, tipoMap] = await Promise.all([getFaixasOrdenadas(), getTipoComercialMap()]);
  const codigosInterno = internoCodigosFromMap(tipoMap);

  const { expr: faixaComissaoExpr, params: faixaParams } = buildFaixaComissaoExpr(
    faixas,
    `(${JUROS_MENSAL_CASE}) * 100`,
    codigosInterno,
  );
  // Prefixo próprio ("tipoInterno") — buildFaixaComissaoExpr já gera
  // internamente seu próprio conjunto de parâmetros "internoCodigoN" (pra
  // decidir Interno/Externo na faixa de comissão); esta segunda chamada é
  // só pra expor a mesma classificação como coluna `tipo`, então precisa de
  // nomes de parâmetro diferentes pra não colidir na mesma query.
  const { condicao: internoCondicao, params: internoParams } = buildInternoCondicao(
    codigosInterno,
    "OC.codigoComercial",
    "tipoInterno",
  );
  const tipoExpr = `CASE WHEN ${internoCondicao} THEN 'Interno' ELSE 'Externo' END`;
  const comissaoExpr = `CASE WHEN OC.codigoComercial IS NULL THEN 0 ELSE ISNULL(fl.JUROS, 0) * (${faixaComissaoExpr}) / 100.0 END`;

  const filtrosVazios: ComissoesFiltros = {
    comercial: "",
    grupoCedente: "",
    grupoSacado: "",
    bordero: "",
    titulo: "",
    cedente: "",
    sacado: "",
    situacao: "",
    statusPagamento: "",
    tipoPagamento: "",
    dataCompraInicio: null,
    dataCompraFim: null,
    dataPagamentoInicio: null,
    dataPagamentoFim: null,
    vencimentoInicio: null,
    vencimentoFim: null,
  };
  const filtrosEscopados = applyAccessScope(filtrosVazios, session);

  const sqlBase = `
;WITH ${FILTROS_CTE},
ComissoesEscopo AS (
    SELECT
        F.DCTO AS titulo,
        CED.NOME AS cedente,
        SAC.NOME AS sacado,
        F.BORDERO AS bordero,
        OC.COD_COMERCIAL AS indicanteOperador,
        OC.codigoComercial AS comercialCodigo,
        ${tipoExpr} AS tipo,
        CAST(F.DIGITACAO AS DATE) AS dataCompra,
        ISNULL(F.VALOR_, 0) AS valorTitulo,
        ${STATUS_PAGTO_CASE} AS statusPagamento,
        ${TIPO_PAGAMENTO_CASE} AS tipoPagamento,
        ISNULL(fl.JUROS, 0) AS desagio,
        ${JUROS_MENSAL_CASE} AS taxa,
        ${faixaComissaoExpr} AS faixaComissao,
        ${comissaoExpr} AS comissao,
        CAST(F.DATA AS DATE) AS vencimento,
        CAST(F.DTPGTO AS DATE) AS dataPagamento
    FROM SIGFIDC F
    LEFT JOIN SIGCAD CED ON CED.CODIGO = F.CLIFOR
    LEFT JOIN SIGCAD SAC ON SAC.CODIGO = F.SACADO
    LEFT JOIN SIGFLS fl ON fl.ctrl_id = F.SIGFLS
    ${FILTROS_JOINS}
    ${FILTROS_WHERE}
)
`;

  return {
    sqlBase,
    params: [...faixaParams, ...internoParams, ...filtrosParams(filtrosEscopados)],
  };
}

// Serializa valores de volta pro modelo/UI — Date vira "YYYY-MM-DD" (o
// mssql devolve objetos Date nativos, que o JSON.stringify converteria pra
// ISO com horário, poluindo a leitura do modelo e a tabela da UI).
function serializarLinha(linha: Record<string, unknown>): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(linha)) {
    saida[chave] = valor instanceof Date ? valor.toISOString().slice(0, 10) : valor;
  }
  return saida;
}

/**
 * Executa o caminho "pergunta aberta" pra Comissões (POC). Devolve `null`
 * quando o modelo nunca chamou a ferramenta de SQL (pergunta fora do escopo
 * de Comissões, ou desistiu) — nesse caso o chamador deve cair no fallback
 * padrão ("não sei responder"), igual ao comportamento anterior.
 */
export async function responderPerguntaAbertaComissoes(
  pergunta: string,
  session: Session | null,
  historico: TurnoHistorico[] = [],
): Promise<IaTemplateResultado | null> {
  const client = getAnthropicClient();
  const { sqlBase, params: paramsBase } = await buildComissoesEscopoCte(session);

  const mensagens: Anthropic.MessageParam[] = [
    ...historico.slice(-6).map((t) => ({
      role: t.autor === "usuario" ? ("user" as const) : ("assistant" as const),
      content: t.texto,
    })),
    { role: "user", content: pergunta },
  ];

  let sqlGeradoFinal: string | undefined;
  let linhasFinal: Record<string, unknown>[] = [];

  for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
    const response = await client.messages.create({
      model: MODEL_ABERTA,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      tools: [TOOL_EXECUTAR_SQL],
      messages: mensagens,
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (!toolUse) {
      const textoBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === "text",
      );
      const texto = textoBlock?.text.trim() ?? "";

      // Já tínhamos um SQL executado com sucesso antes — este texto é a
      // síntese final da resposta.
      if (sqlGeradoFinal) {
        return {
          resumo: texto || "Não consegui montar uma resposta a partir do resultado da consulta.",
          linhas: linhasFinal.length > 1 ? linhasFinal.slice(0, MAX_LINHAS_RETORNO) : [],
          fonte: "Comissões — consulta aberta (IA, prova de conceito)",
          avisoResolucao:
            "Resposta gerada por consulta SQL automática (módulo em fase de validação) — confira o resultado antes de usar em decisões.",
        };
      }

      // Nunca chamou a ferramenta — pergunta fora do escopo de Comissões,
      // ou o modelo decidiu não prosseguir. Deixa o chamador cair no
      // fallback padrão.
      return null;
    }

    mensagens.push({ role: "assistant", content: response.content });

    const sqlPedido = String((toolUse.input as { sql?: string }).sql ?? "");
    const validacao = validarSqlAberto(sqlPedido);

    if (!validacao.ok) {
      mensagens.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Consulta rejeitada: ${validacao.motivo} Ajuste e tente de novo.`,
            is_error: true,
          },
        ],
      });
      continue;
    }

    try {
      const queryCompleta = `${sqlBase}\n${sqlPedido}`;
      const linhasBrutas = await executeReadQuery<Record<string, unknown>>(
        queryCompleta,
        paramsBase,
        { timeoutMs: QUERY_TIMEOUT_MS },
      );
      const linhas = linhasBrutas.map(serializarLinha);
      sqlGeradoFinal = sqlPedido;
      linhasFinal = linhas;

      mensagens.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({
              totalLinhas: linhas.length,
              linhas: linhas.slice(0, MAX_LINHAS_PARA_MODELO),
            }),
          },
        ],
      });
    } catch (error) {
      const motivo =
        error instanceof ReadOnlyViolationError
          ? "operação de escrita bloqueada — só SELECT é permitido."
          : `erro ao executar (${(error as Error).message}). Ajuste a sintaxe (SQL Server 2008 R2) e tente de novo.`;
      mensagens.push({
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: toolUse.id, content: `Erro: ${motivo}`, is_error: true },
        ],
      });
    }
  }

  // Esgotou as tentativas sem produzir uma síntese final em texto — se ao
  // menos alguma consulta rodou com sucesso, devolve um resumo genérico em
  // vez de descartar o resultado; senão, cai no fallback padrão.
  if (sqlGeradoFinal) {
    return {
      resumo:
        linhasFinal.length > 0
          ? `Encontrei **${linhasFinal.length}** linha(s) pra essa pergunta, mas não consegui montar um resumo executivo — veja a tabela abaixo.`
          : "A consulta não retornou nenhuma linha pra essa pergunta.",
      linhas: linhasFinal.slice(0, MAX_LINHAS_RETORNO),
      fonte: "Comissões — consulta aberta (IA, prova de conceito)",
      avisoResolucao: "Resposta gerada por consulta SQL automática (módulo em fase de validação).",
    };
  }
  return null;
}
