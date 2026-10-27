"use client";

import { RefreshCw } from "lucide-react";
import { useDataRefresh } from "./refresh-context";

export function RefreshButton() {
  const { isRefreshing, lastUpdated, triggerRefresh } = useDataRefresh();

  return (
    <div className="flex items-center gap-3">
      {lastUpdated && (
        <span className="text-xs text-azul-escuro/40">
          Atualizado em {lastUpdated.toLocaleDateString("pt-BR")}{" "}
          {lastUpdated.toLocaleTimeString("pt-BR")}
        </span>
      )}
      <button
        onClick={triggerRefresh}
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
