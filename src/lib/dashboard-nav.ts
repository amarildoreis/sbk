import {
  Compass,
  FileBarChart2,
  Users,
  Users2,
  Activity,
  Percent,
  Layers,
  Layers3,
  ShieldCheck,
  Sparkles,
  UserCog,
  FileCheck2,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export interface DashboardNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Chave em PERMISSOES (src/components/dashboard/usuarios/permissoes.ts).
   * Sem isso, o item fica visível pra qualquer usuário autenticado. */
  permissionKey?: string;
}

export const dashboardNav: DashboardNavItem[] = [
  {
    label: "Cadastro de Usuários",
    href: "/dashboard/usuarios",
    icon: UserCog,
    permissionKey: "cadastrar_usuarios",
  },
  {
    label: "Faixas de Comissões",
    href: "/dashboard/faixas-comissao",
    icon: Layers,
    permissionKey: "gerenciar_faixas_comissao",
  },
  {
    label: "Comercial - Visão Geral",
    href: "/dashboard",
    icon: Compass,
    permissionKey: "ver_comercial",
  },
  {
    label: "Relatório Analítico de Títulos",
    href: "/dashboard/titulos",
    icon: FileBarChart2,
    permissionKey: "ver_titulos",
  },
  {
    label: "Carteira de Clientes",
    href: "/dashboard/carteira-clientes",
    icon: Users,
    permissionKey: "ver_carteira_clientes",
  },
  {
    label: "Comportamental",
    href: "/dashboard/comportamental",
    icon: Activity,
    permissionKey: "ver_comportamental",
  },
  {
    label: "Borderôs Liberados",
    href: "/dashboard/borderos-liberados",
    icon: FileCheck2,
    permissionKey: "ver_borderos_liberados",
  },
  {
    label: "Carteira de Sacados",
    href: "/dashboard/carteira-sacados",
    icon: Users2,
    permissionKey: "ver_carteira_sacados",
  },
  {
    label: "Exposição Cedente",
    href: "/dashboard/exposicao-cedente",
    icon: ShieldCheck,
    permissionKey: "ver_exposicao_cedente",
  },
  {
    label: "Tranche",
    href: "/dashboard/tranche",
    icon: Layers3,
    permissionKey: "ver_tranche",
  },
  {
    label: "Comissões",
    href: "/dashboard/comissoes",
    icon: Percent,
    permissionKey: "ver_comissoes",
  },
  {
    label: "Gráficos",
    href: "/dashboard/graficos",
    icon: BarChart3,
    permissionKey: "ver_graficos",
  },
  { label: "Interação por IA", href: "/dashboard/ia", icon: Sparkles },
];

export function findActiveNavItem(pathname: string): DashboardNavItem | undefined {
  return [...dashboardNav]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
