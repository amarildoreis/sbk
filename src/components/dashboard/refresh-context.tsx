"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// Sinal de "atualizar dados" compartilhado por toda a plataforma — o botão
// "Atualizar" do topbar vive fora da árvore de qualquer tela específica, mas
// os cards de dados (SQL Server) estão espalhados por vários componentes.
// Em vez de cada tela implementar seu próprio botão/lógica, qualquer
// componente que busca dados só precisa observar `token` (via
// useDataRefresh) e incluí-lo nas dependências do seu fetch — o clique no
// topbar propaga pra tudo que está montado na tela atual, sem prop drilling.
//
// Proteção de banco/performance:
// - Cooldown mínimo entre cliques (evita spam de queries).
// - O refresh só afeta o que está montado agora (tela atual) — não existe
//   endpoint "atualizar tudo" que dispare todas as queries do sistema de
//   uma vez, então o custo escala com o que o usuário está vendo, não com o
//   tamanho da plataforma.
interface RefreshContextValue {
  token: number;
  isRefreshing: boolean;
  lastUpdated: Date | null;
  triggerRefresh: () => void;
}

const RefreshContext = createContext<RefreshContextValue | null>(null);

const COOLDOWN_MS = 8_000;
const SPINNER_MIN_MS = 700;

// Data/hora da última atualização precisa sobreviver a fechar o navegador e
// voltar depois — por isso localStorage, não só estado em memória (que reseta
// a cada reload). Só é atualizado pelo clique em "Atualizar" — decisão do
// cliente em 2026-07-16: marcar esse timestamp também em toda navegação entre
// telas dava a falsa impressão de que o banco era consultado a cada troca de
// menu, quando na prática a navegação só bate no banco se o cache (2 min, ver
// src/lib/db/cache.ts) já tiver expirado para aquela combinação de tela e
// filtros. O indicador reflete "última atualização manual", com a garantia
// implícita de que os dados exibidos nunca têm mais de 2 minutos de idade.
const LAST_UPDATED_STORAGE_KEY = "sbk:last-updated";

function readStoredLastUpdated(): Date | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(LAST_UPDATED_STORAGE_KEY);
  if (!stored) return null;
  const parsed = new Date(stored);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const lastTriggeredAtRef = useRef(0);

  const markUpdated = useCallback(() => {
    const now = new Date();
    setLastUpdated(now);
    window.localStorage.setItem(LAST_UPDATED_STORAGE_KEY, now.toISOString());
  }, []);

  // Restaura do localStorage assim que monta no cliente (evita mismatch de
  // hidratação — não dá pra ler localStorage durante o render do servidor).
  useEffect(() => {
    setLastUpdated(readStoredLastUpdated());
  }, []);

  const triggerRefresh = useCallback(() => {
    const now = Date.now();
    if (isRefreshing || now - lastTriggeredAtRef.current < COOLDOWN_MS) return;

    lastTriggeredAtRef.current = now;
    setIsRefreshing(true);
    setToken((t) => t + 1);

    setTimeout(() => {
      setIsRefreshing(false);
      markUpdated();
    }, SPINNER_MIN_MS);
  }, [isRefreshing, markUpdated]);

  return (
    <RefreshContext.Provider value={{ token, isRefreshing, lastUpdated, triggerRefresh }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useDataRefresh() {
  const ctx = useContext(RefreshContext);
  if (!ctx) {
    throw new Error("useDataRefresh precisa estar dentro de um RefreshProvider.");
  }
  return ctx;
}

// true só no ciclo de fetch imediatamente seguinte a um clique em
// "Atualizar" (refreshToken mudou desde a última vez que este componente
// rodou seu efeito de busca) — nunca na montagem inicial nem quando só o
// filtro mudou. Usado pra mandar `?refresh=1` na requisição e pedir bypass
// do cache curto no servidor (src/lib/db/cache.ts) só nesse caso.
export function useIsForcedRefresh(refreshToken: number): boolean {
  const prevTokenRef = useRef(refreshToken);
  const isFirstRef = useRef(true);
  const forced = !isFirstRef.current && refreshToken !== prevTokenRef.current;

  useEffect(() => {
    prevTokenRef.current = refreshToken;
    isFirstRef.current = false;
  }, [refreshToken]);

  return forced;
}
