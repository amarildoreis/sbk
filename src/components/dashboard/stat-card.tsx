"use client";

import type { LucideIcon } from "lucide-react";
import { AlertCircle, Loader2 } from "lucide-react";

// Card premium padrão de indicador numérico — usado na Visão Geral
// Comercial, no Relatório Analítico de Títulos e em qualquer tela futura que
// precise do mesmo "efeito UAU" consistente (ícone, barra de destaque que
// cresce no hover, elevação sutil, loading/erro embutidos).
export const STAT_CARD_ACCENTS = {
  azul: { icon: "text-azul-escuro", bg: "bg-azul-escuro/10", bar: "bg-azul-escuro" },
  azulMedio: { icon: "text-azul-medio", bg: "bg-azul-medio/10", bar: "bg-azul-medio" },
  verde: { icon: "text-verde-escuro", bg: "bg-verde-escuro/10", bar: "bg-verde-escuro" },
  ambar: { icon: "text-ambar-alerta", bg: "bg-ambar-alerta/10", bar: "bg-ambar-alerta" },
  vermelho: {
    icon: "text-vermelho-risco",
    bg: "bg-vermelho-risco/10",
    bar: "bg-vermelho-risco",
  },
} as const;

export type StatCardAccent = keyof typeof STAT_CARD_ACCENTS;

export function StatCard({
  title,
  value,
  suffix,
  icon: Icon,
  accent,
  delay = 0,
  isLoading,
  error,
  compact = false,
  danger = false,
}: {
  title: string;
  value: string;
  suffix?: string;
  icon: LucideIcon;
  accent: StatCardAccent;
  delay?: number;
  isLoading?: boolean;
  error?: string;
  /** Card mais enxuto — pra grades que precisam caber sempre na mesma
   * linha (ex: 3 cards lado a lado mesmo em notebook), sem quebrar. */
  compact?: boolean;
  /** Realça o valor em vermelho — mesmo tom usado nos tiles "Vencidos" do
   * Comportamental (MetricTile), pra padronizar a cor de valores vencidos
   * em todos os cards da plataforma. */
  danger?: boolean;
}) {
  const a = STAT_CARD_ACCENTS[accent];
  return (
    <div
      className={`group animate-fade-in-up rounded-2xl border border-cinza-prata/40 bg-white shadow-premium-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-surface-alt hover:shadow-premium ${
        compact ? "p-4" : "p-5"
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <p
        className={`font-semibold text-azul-escuro ${compact ? "truncate text-xs" : "text-sm"}`}
      >
        {title}
      </p>
      <div
        className={`mt-1.5 h-0.5 w-16 rounded-full ${a.bar} transition-all duration-300 group-hover:w-44`}
      />
      <div className={`flex items-start ${compact ? "mt-3 gap-2.5" : "mt-4 gap-3.5"}`}>
        <div
          className={`flex shrink-0 items-center justify-center rounded-xl ${a.bg} ${a.icon} transition-transform duration-300 group-hover:scale-105 ${
            compact ? "h-9 w-9" : "h-11 w-11"
          }`}
        >
          <Icon size={compact ? 16 : 20} strokeWidth={1.75} />
        </div>
        {isLoading ? (
          <div className="flex h-8 min-w-0 flex-1 items-center">
            <Loader2 size={18} strokeWidth={2} className="animate-spin text-azul-escuro/25" />
          </div>
        ) : error ? (
          <p className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-vermelho-risco">
            <AlertCircle size={14} strokeWidth={1.75} className="shrink-0" />
            {error}
          </p>
        ) : (
          <p
            className={`min-w-0 flex-1 break-words font-bold leading-tight tabular-nums ${
              danger ? "text-vermelho-risco" : "text-azul-escuro"
            } ${compact ? "text-base xl:text-lg" : "text-xl xl:text-2xl"}`}
          >
            {value}
            {suffix && (
              <span className="ml-1 text-sm font-medium text-azul-escuro/40">{suffix}</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
