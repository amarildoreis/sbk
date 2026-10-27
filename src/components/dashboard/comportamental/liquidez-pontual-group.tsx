"use client";

import { useEffect, useState } from "react";
import { Droplets } from "lucide-react";
import { useDataRefresh, useIsForcedRefresh } from "../refresh-context";
import { MetricGroupCard, MetricTile } from "./metric-group-card";
import { GroupExportMenu } from "./group-export-menu";
import type { ComportamentalFiltros } from "./comportamental-page";
import type { LiquidezPontualTotais } from "@/lib/db/queries/comportamental-liquidez-pontual";

function formatPercent(fracao: number) {
  return `${(fracao * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function LiquidezPontualGroup({
  filtros,
  resumoFiltros,
}: {
  filtros: ComportamentalFiltros;
  resumoFiltros?: string;
}) {
  const { token: refreshToken } = useDataRefresh();
  const forced = useIsForcedRefresh(refreshToken);
  const [totais, setTotais] = useState<LiquidezPontualTotais | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filtros.comercial) params.set("comercial", filtros.comercial);
    if (filtros.grupoEconomico) params.set("grupoEconomico", filtros.grupoEconomico);
    if (filtros.cedente) params.set("cedente", filtros.cedente);
    if (forced) params.set("refresh", "1");
    fetch(`/api/comportamental/liquidez-pontual?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setTotais(data as LiquidezPontualTotais);
      })
      .catch(() => {
        if (!cancelled) setTotais(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filtros.comercial, filtros.grupoEconomico, filtros.cedente, refreshToken, forced]);

  return (
    <MetricGroupCard
      icon={Droplets}
      title="Liquidez Pontual"
      accent="verde"
      delay={240}
      columns={4}
      exportMenu={
        <GroupExportMenu
          grupo="liquidez-pontual"
          titulo="Liquidez Pontual"
          filtros={filtros}
          resumoFiltros={resumoFiltros}
        />
      }
    >
      <MetricTile
        label="Geral"
        value={formatPercent(totais?.geral ?? 0)}
        isLoading={isLoading}
        tall
      />
      <MetricTile
        label="Últimos 30 dias"
        value={formatPercent(totais?.janela30d ?? 0)}
        isLoading={isLoading}
        tall
      />
      <MetricTile
        label="Últimos 60 dias"
        value={formatPercent(totais?.janela60d ?? 0)}
        isLoading={isLoading}
        tall
      />
      <MetricTile
        label="Últimos 90 dias"
        value={formatPercent(totais?.janela90d ?? 0)}
        isLoading={isLoading}
        tall
      />
    </MetricGroupCard>
  );
}
