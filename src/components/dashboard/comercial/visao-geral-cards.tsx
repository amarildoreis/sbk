"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Wallet,
  AlertTriangle,
  PlusCircle,
  CalendarClock,
  CalendarX,
  Timer,
  Percent,
  Users,
  UserCheck,
  Tag,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  ComercialSistemaSelect,
  type ComercialSistema,
} from "../comercial-sistema-select";
import { useComercialMetric } from "./use-comercial-metric";
import { useComercialSplitMetric } from "./use-comercial-split-metric";
import { useDataRefresh, useIsForcedRefresh } from "../refresh-context";
import { StatCard, STAT_CARD_ACCENTS, type StatCardAccent } from "../stat-card";
import { useAccessScope } from "../use-access-scope";
import { LockedFiltroField } from "../locked-filtro-field";

const TODOS: ComercialSistema = { codigo: "", nome: "Todos", email: null };

const ACCENTS = STAT_CARD_ACCENTS;
type Accent = StatCardAccent;

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatPercent(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}


function SplitStatCard({
  title,
  delay,
  items,
  isLoading,
  error,
}: {
  title: string;
  delay: number;
  items: { label: string; value: string; icon: LucideIcon; accent: Accent }[];
  isLoading?: boolean;
  error?: string;
}) {
  return (
    <div
      className="group animate-fade-in-up rounded-2xl border border-cinza-prata/40 bg-white p-5 shadow-premium-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-surface-alt hover:shadow-premium sm:col-span-2"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-sm font-semibold text-azul-escuro">{title}</p>
      <div className="mt-1.5 h-0.5 w-10 rounded-full bg-azul-medio transition-all duration-300 group-hover:w-32" />
      {isLoading ? (
        <div className="mt-4 flex h-16 items-center">
          <Loader2 size={18} strokeWidth={2} className="animate-spin text-azul-escuro/25" />
        </div>
      ) : error ? (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-vermelho-risco">
          <AlertCircle size={14} strokeWidth={1.75} className="shrink-0" />
          {error}
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {items.map((item) => {
            const a = ACCENTS[item.accent];
            return (
              <div
                key={item.label}
                className="rounded-xl bg-surface-alt p-3.5 transition-colors duration-300 group-hover:bg-azul-medio/5"
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${a.bg} ${a.icon}`}
                >
                  <item.icon size={16} strokeWidth={1.75} />
                </div>
                <p className="mt-2.5 truncate text-sm font-semibold text-azul-medio">
                  {item.label}
                </p>
                <p className="break-words text-base font-bold leading-tight tabular-nums text-azul-escuro sm:text-lg">
                  {item.value}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function VisaoGeralCards() {
  const { token: refreshToken } = useDataRefresh();
  const forcedRefresh = useIsForcedRefresh(refreshToken);
  const scope = useAccessScope();
  const [comercialCodigo, setComercialCodigo] = useState("");
  const [comerciais, setComerciais] = useState<ComercialSistema[]>([TODOS]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Trava de acesso por perfil (CLAUDE.md, 2026-07-18) — Comercial só vê os
  // próprios dados; força o campo pro próprio valor. A trava de verdade é
  // sempre no servidor (applyAccessScope), isto é só a pré-seleção/UX.
  useEffect(() => {
    if (scope.comercial.locked) setComercialCodigo(scope.comercial.codigo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.comercial.locked]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/comercial/lista-filtro")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setComerciais([TODOS, ...(data.operadores as ComercialSistema[])]);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar a lista de comerciais.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    value: limiteCredito,
    isLoading: isLoadingLimiteCredito,
    error: limiteCreditoError,
  } = useComercialMetric("/api/comercial/limite-credito", comercialCodigo);

  const {
    value: risco,
    isLoading: isLoadingRisco,
    error: riscoError,
  } = useComercialMetric("/api/comercial/risco-cedente", comercialCodigo);

  const {
    value: aVencer,
    isLoading: isLoadingAVencer,
    error: aVencerError,
  } = useComercialMetric("/api/comercial/a-vencer-cedente", comercialCodigo);

  const {
    value: vencido,
    isLoading: isLoadingVencido,
    error: vencidoError,
  } = useComercialMetric("/api/comercial/vencido-cedente", comercialCodigo);

  // limite_disponivel = limite_credito - risco (mesma fórmula do Power BI) —
  // derivado no cliente a partir dos dois cards acima, sem query própria.
  const isLoadingLimiteDisponivel = isLoadingLimiteCredito || isLoadingRisco;
  const limiteDisponivelError = limiteCreditoError ?? riscoError;
  const limiteDisponivel =
    limiteCredito !== null && risco !== null ? limiteCredito - risco : null;

  const {
    value: prazoMedio,
    isLoading: isLoadingPrazoMedio,
    error: prazoMedioError,
  } = useComercialMetric("/api/comercial/prazo-medio-estoque", comercialCodigo);

  const {
    geral: taxaGeral,
    estoque: taxaEstoque,
    isLoading: isLoadingTaxaMedia,
    error: taxaMediaError,
  } = useComercialSplitMetric("/api/comercial/taxa-media", comercialCodigo);

  const {
    geral: ticketGeral,
    estoque: ticketEstoque,
    isLoading: isLoadingTicketMedio,
    error: ticketMedioError,
  } = useComercialSplitMetric("/api/comercial/ticket-medio", comercialCodigo);

  const [qtdCedentes, setQtdCedentes] = useState<{ comRisco: number; semRisco: number } | null>(null);
  const [isLoadingQtdCedentes, setIsLoadingQtdCedentes] = useState(true);
  const [qtdCedentesError, setQtdCedentesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingQtdCedentes(true);
    setQtdCedentesError(null);
    const params = new URLSearchParams({ comercial: comercialCodigo });
    if (forcedRefresh) params.set("refresh", "1");
    fetch(`/api/comercial/quantidade-cedentes?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setQtdCedentes({ comRisco: data.comRisco, semRisco: data.semRisco });
      })
      .catch(() => {
        if (!cancelled) setQtdCedentesError("Indisponível no momento.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingQtdCedentes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [comercialCodigo, refreshToken, forcedRefresh]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-cinza-prata/40 bg-white p-5 shadow-premium-sm">
        <div className="w-full sm:w-[26rem]">
          <label
            htmlFor="comercial-filter"
            className="mb-2 block text-sm font-medium text-azul-escuro/80"
          >
            Comercial
          </label>
          {scope.comercial.locked ? (
            <LockedFiltroField label={scope.comercial.label} />
          ) : (
            <ComercialSistemaSelect
              id="comercial-filter"
              value={comercialCodigo}
              onChange={setComercialCodigo}
              options={comerciais}
              isLoading={isLoading}
              placeholder="Todos"
            />
          )}
          {error && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-vermelho-risco">
              <AlertCircle size={13} strokeWidth={1.75} />
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard
          title="Limite de Crédito - Cedente"
          value={formatBRL(limiteCredito ?? 0)}
          icon={Wallet}
          accent="azul"
          delay={0}
          isLoading={isLoadingLimiteCredito}
          error={limiteCreditoError ?? undefined}
        />
        <StatCard
          title="Risco - Cedente"
          value={formatBRL(risco ?? 0)}
          icon={AlertTriangle}
          accent="ambar"
          delay={60}
          isLoading={isLoadingRisco}
          error={riscoError ?? undefined}
        />
        <StatCard
          title="Limite Disponível - Cedente"
          value={formatBRL(limiteDisponivel ?? 0)}
          icon={PlusCircle}
          accent="verde"
          delay={120}
          isLoading={isLoadingLimiteDisponivel}
          error={limiteDisponivelError ?? undefined}
        />
        <StatCard
          title="A Vencer - Cedente"
          value={formatBRL(aVencer ?? 0)}
          icon={CalendarClock}
          accent="azulMedio"
          delay={180}
          isLoading={isLoadingAVencer}
          error={aVencerError ?? undefined}
        />

        <StatCard
          title="Vencido - Cedente"
          value={formatBRL(vencido ?? 0)}
          icon={CalendarX}
          accent="vermelho"
          delay={240}
          isLoading={isLoadingVencido}
          error={vencidoError ?? undefined}
          danger
        />
        <StatCard
          title="Prazo Médio do Estoque"
          value={(prazoMedio ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          suffix="dias"
          icon={Timer}
          accent="azulMedio"
          delay={300}
          isLoading={isLoadingPrazoMedio}
          error={prazoMedioError ?? undefined}
        />
        <SplitStatCard
          title="Taxa Média"
          delay={360}
          isLoading={isLoadingTaxaMedia}
          error={taxaMediaError ?? undefined}
          items={[
            { label: "Geral", value: formatPercent(taxaGeral ?? 0), icon: Percent, accent: "verde" },
            {
              label: "Do Estoque",
              value: formatPercent(taxaEstoque ?? 0),
              icon: Percent,
              accent: "azulMedio",
            },
          ]}
        />

        <SplitStatCard
          title="Quantidade de Cedentes"
          delay={420}
          isLoading={isLoadingQtdCedentes}
          error={qtdCedentesError ?? undefined}
          items={[
            {
              label: "Com Risco",
              value: (qtdCedentes?.comRisco ?? 0).toLocaleString("pt-BR"),
              icon: Users,
              accent: "ambar",
            },
            {
              label: "Sem Risco",
              value: (qtdCedentes?.semRisco ?? 0).toLocaleString("pt-BR"),
              icon: UserCheck,
              accent: "verde",
            },
          ]}
        />
        <SplitStatCard
          title="Ticket Médio"
          delay={480}
          isLoading={isLoadingTicketMedio}
          error={ticketMedioError ?? undefined}
          items={[
            {
              label: "Geral",
              value: formatBRL(ticketGeral ?? 0),
              icon: Tag,
              accent: "azul",
            },
            {
              label: "Do Estoque",
              value: formatBRL(ticketEstoque ?? 0),
              icon: Tag,
              accent: "azulMedio",
            },
          ]}
        />
      </div>
    </div>
  );
}
