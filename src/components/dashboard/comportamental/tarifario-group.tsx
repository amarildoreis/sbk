"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { useDataRefresh, useIsForcedRefresh } from "../refresh-context";
import { MetricGroupCard, MetricTile } from "./metric-group-card";
import { GroupExportMenu } from "./group-export-menu";
import type { ComportamentalFiltros } from "./comportamental-page";
import type { TarifarioTotais } from "@/lib/db/queries/comportamental-tarifario";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(fracao: number) {
  return `${(fracao * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function TarifarioGroup({
  filtros,
  resumoFiltros,
}: {
  filtros: ComportamentalFiltros;
  resumoFiltros?: string;
}) {
  const { token: refreshToken } = useDataRefresh();
  const forced = useIsForcedRefresh(refreshToken);
  const [totais, setTotais] = useState<TarifarioTotais | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filtros.comercial) params.set("comercial", filtros.comercial);
    if (filtros.grupoEconomico) params.set("grupoEconomico", filtros.grupoEconomico);
    if (filtros.cedente) params.set("cedente", filtros.cedente);
    if (forced) params.set("refresh", "1");
    fetch(`/api/comportamental/tarifario?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setTotais(data as TarifarioTotais);
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
      icon={FileText}
      title="Tarifário"
      accent="azul"
      delay={120}
      columns={4}
      exportMenu={
        <GroupExportMenu
          grupo="tarifario"
          titulo="Tarifário"
          filtros={filtros}
          resumoFiltros={resumoFiltros}
        />
      }
    >
      <MetricTile
        label="Taxa"
        value={formatPercent(totais?.taxa ?? 0)}
        isLoading={isLoading}
        compact
      />
      <MetricTile
        label="Tipo de Taxa"
        value={totais?.tipoDeTaxa ?? "-"}
        isLoading={isLoading}
        compact
      />
      <MetricTile
        label="Ad Valorem"
        value={formatPercent(totais?.adValorem ?? 0)}
        isLoading={isLoading}
        compact
      />
      <MetricTile
        label="Borderô"
        value={formatBRL(totais?.bordero ?? 0)}
        isLoading={isLoading}
        compact
      />
      <MetricTile
        label="Protec"
        value={formatBRL(totais?.protec ?? 0)}
        isLoading={isLoading}
        compact
      />
      <MetricTile label="TED" value={formatBRL(totais?.ted ?? 0)} isLoading={isLoading} compact />
      <MetricTile
        label="Cheque"
        value={formatBRL(totais?.cheque ?? 0)}
        isLoading={isLoading}
        compact
      />
      <MetricTile
        label="Título"
        value={formatBRL(totais?.titulo ?? 0)}
        isLoading={isLoading}
        compact
      />
    </MetricGroupCard>
  );
}
