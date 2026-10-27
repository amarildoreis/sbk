"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useDataRefresh, useIsForcedRefresh } from "../refresh-context";
import { MetricGroupCard, MetricTile } from "./metric-group-card";
import { GroupExportMenu } from "./group-export-menu";
import type { ComportamentalFiltros } from "./comportamental-page";
import type { ExposicaoCedenteTotais } from "@/lib/db/queries/comportamental-exposicao-cedente";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ExposicaoCedenteGroup({
  filtros,
  resumoFiltros,
}: {
  filtros: ComportamentalFiltros;
  resumoFiltros?: string;
}) {
  const { token: refreshToken } = useDataRefresh();
  const forced = useIsForcedRefresh(refreshToken);
  const [totais, setTotais] = useState<ExposicaoCedenteTotais | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filtros.comercial) params.set("comercial", filtros.comercial);
    if (filtros.grupoEconomico) params.set("grupoEconomico", filtros.grupoEconomico);
    if (filtros.cedente) params.set("cedente", filtros.cedente);
    if (forced) params.set("refresh", "1");
    fetch(`/api/comportamental/exposicao-cedente?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setTotais(data as ExposicaoCedenteTotais);
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
      icon={ShieldCheck}
      title="Exposição Cedente"
      accent="verde"
      delay={0}
      exportMenu={
        <GroupExportMenu
          grupo="exposicao-cedente"
          titulo="Exposição Cedente"
          filtros={filtros}
          resumoFiltros={resumoFiltros}
        />
      }
    >
      <MetricTile
        label="Limite Cedente"
        value={formatBRL(totais?.limiteCredito ?? 0)}
        isLoading={isLoading}
      />
      <MetricTile
        label="Limite Grupo Cedente"
        value={formatBRL(totais?.limiteGrupoCedente ?? 0)}
        isLoading={isLoading}
      />
      <MetricTile label="Risco" value={formatBRL(totais?.risco ?? 0)} isLoading={isLoading} />
      <MetricTile
        label="Disponível"
        value={formatBRL(totais?.limiteDisponivel ?? 0)}
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
        value={formatBRL(totais?.vencido ?? 0)}
        badge={totais?.vencidoQtd}
        danger
        isLoading={isLoading}
      />
    </MetricGroupCard>
  );
}
