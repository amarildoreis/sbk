// Ordem alinhada ao menu lateral (src/lib/dashboard-nav.ts) — cada entrada
// aqui corresponde a um item real do menu, na mesma sequência em que
// aparecem lá. "Interação por IA" não tem entrada própria porque não usa
// permissionKey (visível a qualquer usuário autenticado).
export const PERMISSOES = [
  {
    key: "cadastrar_usuarios",
    label: "Cadastrar outros Usuários",
    description:
      "Permite criar e gerenciar acessos de outros usuários da plataforma.",
    internalOnly: true,
    adminOnly: true,
  },
  {
    key: "gerenciar_faixas_comissao",
    label: "Gerenciar Faixas de Comissões",
    description:
      "Cria e edita as faixas de comissão usadas no cálculo automático de todos os comerciais internos.",
    internalOnly: true,
    adminOnly: true,
  },
  {
    key: "ver_comercial",
    label: "Ver Comercial",
    description: "Acesso à visão geral comercial e indicadores de carteira.",
    internalOnly: true,
    adminOnly: false,
  },
  {
    key: "ver_titulos",
    label: "Ver Relatório Analítico de Títulos",
    description:
      "Consulta detalhada de títulos, vencimentos e status de pagamento.",
    internalOnly: false,
    adminOnly: false,
  },
  {
    key: "ver_carteira_clientes",
    label: "Ver Carteira de Clientes",
    description: "Acesso à listagem e exposição de cedentes.",
    internalOnly: false,
    adminOnly: false,
  },
  {
    key: "ver_comportamental",
    label: "Ver Comportamental",
    description: "Indicadores de comportamento de pagamento acumulado.",
    internalOnly: false,
    adminOnly: false,
  },
  {
    key: "ver_borderos_liberados",
    label: "Ver Borderôs Liberados",
    description: "Consulta de borderôs liberados e indicadores relacionados.",
    internalOnly: true,
    adminOnly: false,
  },
  {
    key: "ver_carteira_sacados",
    label: "Ver Carteira de Sacados",
    description: "Consulta de sacados e indicadores relacionados.",
    internalOnly: true,
    adminOnly: false,
  },
  {
    key: "ver_exposicao_cedente",
    label: "Ver Exposição Cedente",
    description: "Risco e limite de crédito consolidado por cedente.",
    internalOnly: true,
    adminOnly: false,
  },
  {
    key: "ver_tranche",
    label: "Ver Tranche",
    description: "Limite, tomada, disponível e prazos de tranche por cedente.",
    internalOnly: true,
    adminOnly: false,
  },
  {
    key: "ver_comissoes",
    label: "Ver Comissões",
    description: "Consulta de comissões por comercial e operador.",
    internalOnly: true,
    adminOnly: false,
  },
  {
    key: "ver_graficos",
    label: "Ver Gráficos",
    description: "Visão gráfica consolidada dos indicadores da plataforma.",
    internalOnly: true,
    adminOnly: false,
  },
] as const;

export type PermissaoKey = (typeof PERMISSOES)[number]["key"];

/** Chaves que só fazem sentido para o perfil Administrador — nunca visíveis
 * nem concedíveis para outros perfis, mesmo internos. */
export const ADMIN_ONLY_PERMISSAO_KEYS: PermissaoKey[] = PERMISSOES.filter(
  (p) => p.adminOnly,
).map((p) => p.key);

export const EMPTY_PERMISSOES = PERMISSOES.reduce(
  (acc, p) => ({ ...acc, [p.key]: false }),
  {} as Record<PermissaoKey, boolean>,
);

export const DEFAULT_PERMISSOES_BY_PERFIL: Record<string, PermissaoKey[]> = {
  Administrador: PERMISSOES.map((p) => p.key),
  Comercial: [
    "ver_comercial",
    "ver_titulos",
    "ver_carteira_clientes",
    "ver_comportamental",
    "ver_borderos_liberados",
    "ver_carteira_sacados",
    "ver_exposicao_cedente",
    "ver_tranche",
    "ver_comissoes",
    "ver_graficos",
  ],
  Operação: [
    "ver_comercial",
    "ver_titulos",
    "ver_carteira_clientes",
    "ver_comportamental",
    "ver_borderos_liberados",
    "ver_carteira_sacados",
    "ver_exposicao_cedente",
    "ver_tranche",
    "ver_graficos",
  ],
  Cedente: ["ver_titulos", "ver_carteira_clientes"],
  Sacado: ["ver_titulos"],
};

export function permissoesFromDefaults(
  perfil: string,
): Record<PermissaoKey, boolean> {
  const defaults = DEFAULT_PERMISSOES_BY_PERFIL[perfil] ?? [];
  return PERMISSOES.reduce(
    (acc, p) => ({ ...acc, [p.key]: defaults.includes(p.key) }),
    {} as Record<PermissaoKey, boolean>,
  );
}
