"use client";

import { useEffect, useState } from "react";
import { useDataRefresh, useIsForcedRefresh } from "../refresh-context";

// Hook compartilhado por todos os cards numéricos da Visão Geral que
// dependem do filtro de Comercial da tela — cada endpoint retorna
// `{ value: number }` e reage à troca de `comercialCodigo` (vazio = Todos)
// e ao botão "Atualizar" do topbar (refreshToken).
export function useComercialMetric(endpoint: string, comercialCodigo: string) {
  const { token: refreshToken } = useDataRefresh();
  const forced = useIsForcedRefresh(refreshToken);
  const [value, setValue] = useState<number | null>(null);
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
        if (!cancelled) setValue(data.value as number);
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

  return { value, isLoading, error };
}
