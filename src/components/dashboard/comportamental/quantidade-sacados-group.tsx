"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { useDataRefresh, useIsForcedRefresh } from "../refresh-context";
import { SingleMetricCard } from "./metric-group-card";
import { GroupExportMenu } from "./group-export-menu";
import type { ComportamentalFiltros } from "./comportamental-page";
import type { QuantidadeSacadosTotais } from "@/lib/db/queries/comportamental-quantidade-sacados";

export function QuantidadeSacadosGroup({
  filtros,
  resumoFiltros,
}: {
  filtros: ComportamentalFiltros;
  resumoFiltros?: string;
}) {
  const { token: refreshToken } = useDataRefresh();
  const forced = useIsForcedRefresh(refreshToken);
  const [totais, setTotais] = useState<QuantidadeSacadosTotais | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filtros.comercial) params.set("comercial", filtros.comercial);
    if (filtros.grupoEconomico) params.set("grupoEconomico", filtros.grupoEconomico);
    if (filtros.cedente) params.set("cedente", filtros.cedente);
    if (forced) params.set("refresh", "1");
    fetch(`/api/comportamental/quantidade-sacados?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setTotais(data as QuantidadeSacadosTotais);
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
    <SingleMetricCard
      icon={Users}
      title="Quantidade de Sacados"
      accent="azulMedio"
      delay={600}
      value={(totais?.quantidade ?? 0).toLocaleString("pt-BR")}
      isLoading={isLoading}
      exportMenu={
        <GroupExportMenu
          grupo="quantidade-sacados"
          titulo="Quantidade de Sacados"
          filtros={filtros}
          resumoFiltros={resumoFiltros}
        />
      }
    />
  );
}
