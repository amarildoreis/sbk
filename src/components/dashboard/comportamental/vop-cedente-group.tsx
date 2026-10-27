"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { useDataRefresh, useIsForcedRefresh } from "../refresh-context";
import { MetricGroupCard, MetricTile } from "./metric-group-card";
import { GroupExportMenu } from "./group-export-menu";
import type { ComportamentalFiltros } from "./comportamental-page";
import type { VopCedenteTotais } from "@/lib/db/queries/comportamental-vop-cedente";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function VopCedenteGroup({
  filtros,
  resumoFiltros,
}: {
  filtros: ComportamentalFiltros;
  resumoFiltros?: string;
}) {
  const { token: refreshToken } = useDataRefresh();
  const forced = useIsForcedRefresh(refreshToken);
  const [totais, setTotais] = useState<VopCedenteTotais | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filtros.comercial) params.set("comercial", filtros.comercial);
    if (filtros.grupoEconomico) params.set("grupoEconomico", filtros.grupoEconomico);
    if (filtros.cedente) params.set("cedente", filtros.cedente);
    if (forced) params.set("refresh", "1");
    fetch(`/api/comportamental/vop-cedente?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setTotais(data as VopCedenteTotais);
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
      icon={TrendingUp}
      title="VOP Cedente"
      accent="azul"
      delay={360}
      columns={4}
      exportMenu={
        <GroupExportMenu
          grupo="vop-cedente"
          titulo="VOP Cedente"
          filtros={filtros}
          resumoFiltros={resumoFiltros}
        />
      }
    >
      <MetricTile label="Geral" value={formatBRL(totais?.geral ?? 0)} isLoading={isLoading} tall />
      <MetricTile
        label="Últimos 30 dias"
        value={formatBRL(totais?.janela30d ?? 0)}
        isLoading={isLoading}
        tall
      />
      <MetricTile
        label="Últimos 60 dias"
        value={formatBRL(totais?.janela60d ?? 0)}
        isLoading={isLoading}
        tall
      />
      <MetricTile
        label="Últimos 90 dias"
        value={formatBRL(totais?.janela90d ?? 0)}
        isLoading={isLoading}
        tall
      />
    </MetricGroupCard>
  );
}
