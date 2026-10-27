"use client";

import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { useDataRefresh, useIsForcedRefresh } from "../refresh-context";
import { MetricGroupCard, MetricTile } from "./metric-group-card";
import { GroupExportMenu } from "./group-export-menu";
import type { ComportamentalFiltros } from "./comportamental-page";
import type { OperacoesTotais } from "@/lib/db/queries/comportamental-operacoes";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDias(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function OperacoesGroup({
  filtros,
  resumoFiltros,
}: {
  filtros: ComportamentalFiltros;
  resumoFiltros?: string;
}) {
  const { token: refreshToken } = useDataRefresh();
  const forced = useIsForcedRefresh(refreshToken);
  const [totais, setTotais] = useState<OperacoesTotais | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filtros.comercial) params.set("comercial", filtros.comercial);
    if (filtros.grupoEconomico) params.set("grupoEconomico", filtros.grupoEconomico);
    if (filtros.cedente) params.set("cedente", filtros.cedente);
    if (forced) params.set("refresh", "1");
    fetch(`/api/comportamental/operacoes?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setTotais(data as OperacoesTotais);
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
      icon={Settings2}
      title="Operações"
      accent="azulMedio"
      delay={180}
      columns={4}
      exportMenu={
        <GroupExportMenu
          grupo="operacoes"
          titulo="Operações"
          filtros={filtros}
          resumoFiltros={resumoFiltros}
        />
      }
    >
      <MetricTile
        label="Prazo Mínimo"
        value={formatDias(totais?.prazoMinimo ?? 0)}
        isLoading={isLoading}
        compact
      />
      <MetricTile
        label="Prazo Médio Geral"
        value={formatDias(totais?.prazoMedioGeral ?? 0)}
        isLoading={isLoading}
        compact
      />
      <MetricTile
        label="Prazo Médio 30 dias"
        value={formatDias(totais?.prazoMedio30d ?? 0)}
        isLoading={isLoading}
        compact
      />
      <MetricTile
        label="Prazo Médio 60 dias"
        value={formatDias(totais?.prazoMedio60d ?? 0)}
        isLoading={isLoading}
        compact
      />
      <MetricTile
        label="Prazo Médio 90 dias"
        value={formatDias(totais?.prazoMedio90d ?? 0)}
        isLoading={isLoading}
        compact
      />
      <MetricTile
        label="Prazo Máximo"
        value={formatDias(totais?.prazoMaximo ?? 0)}
        isLoading={isLoading}
        compact
      />
      <MetricTile
        label="Ticket Médio"
        value={formatBRL(totais?.ticketMedio ?? 0)}
        isLoading={isLoading}
        compact
      />
      <MetricTile
        label="Borderô Médio"
        value={formatBRL(totais?.borderoMedio ?? 0)}
        isLoading={isLoading}
        compact
      />
    </MetricGroupCard>
  );
}
