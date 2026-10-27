"use client";

import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { STAT_CARD_ACCENTS, type StatCardAccent } from "../stat-card";

// Card de grupo do módulo Comportamental — um bloco com ícone + título +
// barra de destaque, contendo uma grade de MetricTile dentro. Cada grupo da
// tela (Exposição Cedente, Tranche, Tarifário, Operações...) usa este mesmo
// wrapper, só muda o ícone/cor/conteúdo.
export function MetricGroupCard({
  icon: Icon,
  title,
  accent = "azul",
  delay = 0,
  columns = 3,
  exportMenu,
  children,
}: {
  icon: LucideIcon;
  title: string;
  accent?: StatCardAccent;
  delay?: number;
  /** Quantas colunas a grade de tiles usa em telas largas (o grupo em si não
   * muda de tamanho, só a divisão interna). Padrão 3 (6 tiles = 3x2). */
  columns?: 3 | 4;
  /** Menu "..." no canto do card (ex: GroupExportMenu) — exportar/enviar
   * este grupo específico. Opcional pra não travar o wrapper a essa ação. */
  exportMenu?: React.ReactNode;
  children: React.ReactNode;
}) {
  const a = STAT_CARD_ACCENTS[accent];
  const gridCols = columns === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3";
  return (
    <div
      className="group animate-fade-in-up rounded-2xl border border-cinza-prata/40 bg-white p-5 shadow-premium-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-azul-medio/30 hover:shadow-premium"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${a.bg} ${a.icon} transition-transform duration-300 group-hover:scale-105`}
          >
            <Icon size={18} strokeWidth={1.75} />
          </div>
          <h3 className="text-base font-semibold text-azul-escuro">{title}</h3>
        </div>
        {exportMenu}
      </div>
      <div
        className={`mt-2.5 h-0.5 w-16 rounded-full ${a.bar} transition-all duration-300 group-hover:w-44`}
      />
      <div className={`mt-5 grid grid-cols-2 gap-3 ${gridCols}`}>{children}</div>
    </div>
  );
}

// Card compacto de valor único — pra métricas que não têm janelas de tempo
// (ex: Maior Concentração, Quantidade de Sacados). Mesmo visual do
// MetricGroupCard (ícone, título, barra, hover, menu de exportação), mas
// sem a grade de tiles — só um número grande. Pensado pra caber lado a lado
// (2 por linha) ocupando o espaço de um grupo normal no grid da tela.
export function SingleMetricCard({
  icon: Icon,
  title,
  accent = "azul",
  delay = 0,
  value,
  isLoading = false,
  exportMenu,
}: {
  icon: LucideIcon;
  title: string;
  accent?: StatCardAccent;
  delay?: number;
  value: string;
  isLoading?: boolean;
  exportMenu?: React.ReactNode;
}) {
  const a = STAT_CARD_ACCENTS[accent];
  return (
    <div
      className="group animate-fade-in-up rounded-2xl border border-cinza-prata/40 bg-white p-5 shadow-premium-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-azul-medio/30 hover:shadow-premium"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${a.bg} ${a.icon} transition-transform duration-300 group-hover:scale-105`}
          >
            <Icon size={18} strokeWidth={1.75} />
          </div>
          <h3 className="text-sm font-semibold text-azul-escuro">{title}</h3>
        </div>
        {exportMenu}
      </div>
      <div
        className={`mt-2.5 h-0.5 w-16 rounded-full ${a.bar} transition-all duration-300 group-hover:w-44`}
      />
      <div className="mt-5 flex min-h-[152px] items-center justify-center rounded-xl bg-surface-alt px-4">
        {isLoading ? (
          <Loader2 size={20} strokeWidth={2} className="animate-spin text-azul-escuro/25" />
        ) : (
          <p className="truncate text-3xl font-bold tabular-nums text-azul-escuro">{value}</p>
        )}
      </div>
    </div>
  );
}

export function MetricTile({
  label,
  value,
  badge,
  danger = false,
  isLoading = false,
  compact = false,
  tall = false,
}: {
  label: string;
  value: string;
  /** Contador exibido no canto do tile (ex: quantidade de títulos). Só
   * exibição por enquanto — o drill-down pro relatório analítico é uma
   * etapa futura, ainda não implementada. */
  badge?: number;
  /** Realça o valor em vermelho (ex: Vencidos). */
  danger?: boolean;
  isLoading?: boolean;
  /** Tile mais enxuto — pra grades de 4 colunas (ex: Tarifário), onde o
   * grupo mantém o mesmo tamanho mas cabem mais tiles por linha. */
  compact?: boolean;
  /** Tile com o dobro da altura — pra grupos de 1 linha só (ex: Liquidez
   * Pontual, 4 tiles em 4 colunas), onde o grupo precisa manter a mesma
   * altura dos grupos de 2 linhas mesmo tendo só 1 linha de conteúdo. */
  tall?: boolean;
}) {
  return (
    <div
      className={`relative rounded-xl bg-surface-alt transition-all duration-300 hover:-translate-y-0.5 hover:bg-azul-medio/5 hover:shadow-premium-sm ${
        tall
          ? "flex min-h-[152px] flex-col justify-center p-3.5"
          : compact
            ? "p-3"
            : "p-3.5"
      }`}
    >
      {badge != null && badge > 0 && (
        <span className="absolute right-2.5 top-2.5 rounded-full bg-azul-medio/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-azul-medio">
          {badge.toLocaleString("pt-BR")}
        </span>
      )}
      <p className="truncate pr-6 text-sm font-semibold text-azul-medio">{label}</p>
      {isLoading ? (
        <div className={`flex items-center ${compact ? "mt-1.5 h-5" : "mt-2 h-6"}`}>
          <Loader2 size={14} strokeWidth={2} className="animate-spin text-azul-escuro/25" />
        </div>
      ) : (
        <p
          className={`mt-1 truncate text-base font-bold tabular-nums ${
            danger ? "text-vermelho-risco" : "text-azul-escuro"
          }`}
        >
          {value}
        </p>
      )}
    </div>
  );
}
