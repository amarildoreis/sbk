"use client";

import { useEffect, useState } from "react";
import { Crosshair } from "lucide-react";
import { useDataRefresh, useIsForcedRefresh } from "../refresh-context";
import { SingleMetricCard } from "./metric-group-card";
import { GroupExportMenu } from "./group-export-menu";
import type { ComportamentalFiltros } from "./comportamental-page";
import type { MaiorConcentracaoTotais } from "@/lib/db/queries/comportamental-maior-concentracao";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Só o filtro de Cedente importa aqui — a DAX (ALL(SIGFIDC)) ignora
// Comercial/Grupo Econômico de propósito (ver comportamental-maior-
// concentracao.ts). Sem Cedente selecionado, o valor é sempre 0.
export function MaiorConcentracaoGroup({
  filtros,
  resumoFiltros,
}: {
  filtros: ComportamentalFiltros;
  resumoFiltros?: string;
}) {
  const { token: refreshToken } = useDataRefresh();
  const forced = useIsForcedRefresh(refreshToken);
  const [totais, setTotais] = useState<MaiorConcentracaoTotais | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filtros.cedente) params.set("cedente", filtros.cedente);
    if (forced) params.set("refresh", "1");
    fetch(`/api/comportamental/maior-concentracao?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setTotais(data as MaiorConcentracaoTotais);
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
  }, [filtros.cedente, refreshToken, forced]);

  return (
    <SingleMetricCard
      icon={Crosshair}
      title="Maior Concentração"
      accent="vermelho"
      delay={540}
      value={formatBRL(totais?.valor ?? 0)}
      isLoading={isLoading}
      exportMenu={
        <GroupExportMenu
          grupo="maior-concentracao"
          titulo="Maior Concentração"
          filtros={filtros}
          resumoFiltros={resumoFiltros}
        />
      }
    />
  );
}
