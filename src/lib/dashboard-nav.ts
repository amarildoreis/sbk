import {
  Compass,
  FileBarChart2,
  Users,
  Activity,
  Percent,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface DashboardNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const dashboardNav: DashboardNavItem[] = [
  { label: "Comercial - Visão Geral", href: "/dashboard", icon: Compass },
  {
    label: "Relatório Analítico de Títulos",
    href: "/dashboard/titulos",
    icon: FileBarChart2,
  },
  {
    label: "Carteira de Clientes",
    href: "/dashboard/carteira-clientes",
    icon: Users,
  },
  { label: "Comportamental", href: "/dashboard/comportamental", icon: Activity },
  { label: "Comissões", href: "/dashboard/comissoes", icon: Percent },
  { label: "Interação por IA", href: "/dashboard/ia", icon: Sparkles },
];
