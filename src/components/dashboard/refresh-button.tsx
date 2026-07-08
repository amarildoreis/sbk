"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function RefreshButton() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Stub visual: ainda não chama o SQL Server (10.0.0.213/FACTORING).
  // Quando a integração existir, troque o setTimeout por uma chamada real
  // à API que dispara o refresh e aguarda a conclusão.
  function handleClick() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastUpdated(new Date());
    }, 900);
  }

  return (
    <div className="flex items-center gap-3">
      {lastUpdated && (
        <span className="hidden text-xs text-azul-escuro/40 sm:inline">
          Atualizado às{" "}
          {lastUpdated.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      )}
      <button
        onClick={handleClick}
        disabled={isRefreshing}
        className="flex items-center gap-2 rounded-lg border border-cinza-prata/60 px-3 py-2 text-sm font-medium text-azul-escuro/70 transition hover:border-azul-medio/40 hover:bg-azul-medio/5 hover:text-azul-escuro disabled:cursor-not-allowed disabled:opacity-70"
      >
        <RefreshCw
          size={16}
          strokeWidth={1.75}
          className={isRefreshing ? "animate-spin" : ""}
        />
        <span className="hidden sm:inline">
          {isRefreshing ? "Atualizando..." : "Atualizar"}
        </span>
      </button>
    </div>
  );
}
