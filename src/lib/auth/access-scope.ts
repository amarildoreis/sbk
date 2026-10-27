import type { Session } from "next-auth";

// Marca de tipo nominal — só existe em valores que passaram por
// applyAccessScope/resolveComercialParam. Toda função de query que lê dado
// sensível (SIGFIDC/SIGBORS/SIGCAD...) deve exigir `Scoped<T>` no parâmetro
// de filtros/comercial, nunca o tipo puro — isso transforma "esquecer de
// aplicar a trava antes de consultar" de um bug em runtime (silencioso, só
// aparece se alguém testar o cenário certo) pra um erro de compilação
// (`tsc` recusa passar um filtros que não passou pela trava). Endurecido em
// 2026-07-18 pensando no módulo de IA (RAG): o roteador de intenção da IA
// vai chamar essas mesmas funções de query direto, sem passar pela rota
// HTTP — sem essa marca, seria fácil um template novo esquecer de aplicar o
// RLS e vazar dado de outro comercial/cedente/sacado.
declare const SCOPE_APPLIED: unique symbol;
export type Scoped<T> = T & { readonly [SCOPE_APPLIED]: true };

// Trava de acesso por perfil (CLAUDE.md — implementada 2026-07-18): um
// usuário Comercial só pode ver os próprios títulos/dados (via
// COD_OPERADOR_INDICANTE, o mesmo código salvo em Usuario.comercialCodigo);
// um usuário Cedente/Sacado só pode ver os próprios (via CLIFOR/SACADO,
// salvo em Usuario.vinculo). Administrador e Operação não têm restrição.
export interface AccessScope {
  comercialCodigo: string | null;
  cedenteCodigo: string | null;
  sacadoCodigo: string | null;
}

function sessionUser(session: Session | null) {
  return session?.user as
    | {
        role?: string;
        comercialCodigo?: string | null;
        vinculoCodigo?: string | null;
      }
    | undefined;
}

// Código-sentinela usado quando o perfil EXIGE um vínculo (Comercial/
// Cedente/Sacado) mas o usuário não tem nenhum cadastrado (ex: criado via
// chamada direta na API, contornando a validação obrigatória do formulário
// de cadastro). Falha fechado: nunca bate com nenhum código real, então a
// consulta sempre volta vazia — a alternativa (deixar `null`, sem trava)
// abriria acesso total pra quem deveria ter o mínimo de acesso.
const SEM_VINCULO = "__sem_vinculo__";

export function getAccessScope(session: Session | null): AccessScope {
  const user = sessionUser(session);
  const perfil = user?.role;
  return {
    comercialCodigo: perfil === "Comercial" ? (user?.comercialCodigo ?? SEM_VINCULO) : null,
    cedenteCodigo: perfil === "Cedente" ? (user?.vinculoCodigo ?? SEM_VINCULO) : null,
    sacadoCodigo: perfil === "Sacado" ? (user?.vinculoCodigo ?? SEM_VINCULO) : null,
  };
}

// Aplica a trava sobre um objeto de filtros já parseado (comercial/cedente/
// sacado — os mesmos 3 nomes de campo usados em todo módulo, ver
// CLAUDE.md). SEMPRE sobrescreve o valor vindo do cliente (query string ou
// corpo do POST) — essa é a trava de verdade; o campo travado/desabilitado
// na tela é só cosmético e nunca a única defesa. Chamar logo depois de
// `parseFiltrosFromSearchParams`/receber o corpo do POST, antes de passar
// pra função de query.
export function applyAccessScope<T extends { comercial?: string; cedente?: string; sacado?: string }>(
  filtros: T,
  session: Session | null,
): Scoped<T> {
  const scope = getAccessScope(session);
  if (scope.comercialCodigo !== null) filtros.comercial = scope.comercialCodigo;
  if (scope.cedenteCodigo !== null) filtros.cedente = scope.cedenteCodigo;
  if (scope.sacadoCodigo !== null) filtros.sacado = scope.sacadoCodigo;
  return filtros as Scoped<T>;
}

// Variante pros 8 endpoints de card do Comercial - Visão Geral
// (src/app/api/comercial/*), que recebem "comercial" como string solta (não
// um objeto de filtros) — mesma trava, só a assinatura muda.
export function resolveComercialParam(raw: string, session: Session | null): Scoped<string> {
  const scope = getAccessScope(session);
  return (scope.comercialCodigo !== null ? scope.comercialCodigo : raw) as Scoped<string>;
}
