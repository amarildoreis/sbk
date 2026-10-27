"use client";

import { useEffect, useState } from "react";
import { useDataRefresh, useIsForcedRefresh } from "../refresh-context";

// Igual a useComercialMetric, mas para endpoints que retornam duas colunas
// (`{ geral, estoque }`) em uma única chamada — caso de Taxa Média e Ticket
// Médio, que compartilham a mesma base de títulos filtrada. Também reage ao
// botão "Atualizar" do topbar (refreshToken).
export function useComercialSplitMetric(endpoint: string, comercialCodigo: string) {
  const { token: refreshToken } = useDataRefresh();
  const forced = useIsForcedRefresh(refreshToken);
  const [geral, setGeral] = useState<number | null>(null);
  const [estoque, setEstoque] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams({ comercial: comercialCodigo });
    if (forced) params.set("refresh", "1");
    fetch(`${endpoint}?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setGeral(data.geral as number);
        setEstoque(data.estoque as number);
      })
      .catch(() => {
        if (!cancelled) setError("Indisponível no momento.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint, comercialCodigo, refreshToken, forced]);

  return { geral, estoque, isLoading, error };
}
