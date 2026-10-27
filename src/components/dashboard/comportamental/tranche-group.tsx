"use client";

import { useEffect, useState } from "react";
import { Database } from "lucide-react";
import { useDataRefresh, useIsForcedRefresh } from "../refresh-context";
import { MetricGroupCard, MetricTile } from "./metric-group-card";
import { GroupExportMenu } from "./group-export-menu";
import type { ComportamentalFiltros } from "./comportamental-page";
import type { TrancheTotais } from "@/lib/db/queries/comportamental-tranche";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function TrancheGroup({
  filtros,
  resumoFiltros,
}: {
  filtros: ComportamentalFiltros;
  resumoFiltros?: string;
}) {
  const { token: refreshToken } = useDataRefresh();
  const forced = useIsForcedRefresh(refreshToken);
  const [totais, setTotais] = useState<TrancheTotais | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filtros.comercial) params.set("comercial", filtros.comercial);
    if (filtros.grupoEconomico) params.set("grupoEconomico", filtros.grupoEconomico);
    if (filtros.cedente) params.set("cedente", filtros.cedente);
    if (forced) params.set("refresh", "1");
    fetch(`/api/comportamental/tranche?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setTotais(data as TrancheTotais);
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
      icon={Database}
      title="Tranche"
      accent="azulMedio"
      delay={60}
      exportMenu={
        <GroupExportMenu
          grupo="tranche"
          titulo="Tranche"
          filtros={filtros}
          resumoFiltros={resumoFiltros}
        />
      }
    >
      <MetricTile label="Limite" value={formatBRL(totais?.limite ?? 0)} isLoading={isLoading} />
      <MetricTile
        label="Tomada"
        value={formatBRL(totais?.tomada ?? 0)}
        badge={totais?.tomadaQtd}
        isLoading={isLoading}
      />
      <MetricTile
        label="Disponível"
        value={formatBRL(totais?.disponivel ?? 0)}
        isLoading={isLoading}
      />
      <MetricTile
        label="A Vencer"
        value={formatBRL(totais?.aVencer ?? 0)}
        badge={totais?.aVencerQtd}
        isLoading={isLoading}
      />
      <MetricTile
        label="Vencidos"
        value={formatBRL(totais?.vencida ?? 0)}
        badge={totais?.vencidaQtd}
        danger
        isLoading={isLoading}
      />
      <MetricTile
        label="Dias de Prazo"
        value={`${(totais?.diasPrazo ?? 0).toLocaleString("pt-BR")} dias`}
        isLoading={isLoading}
      />
    </MetricGroupCard>
  );
}
