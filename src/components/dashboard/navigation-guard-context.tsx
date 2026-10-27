"use client";

import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Permite que uma tela com estado não salvo (hoje só Interação por IA, ver
// CLAUDE.md seção 12) intercepte qualquer navegação disparada pelo shell do
// dashboard (Sidebar, menu do usuário, logout) e pergunte se o usuário quer
// salvar ou descartar antes de sair. App Router não tem um hook nativo de
// "cancelar navegação" (diferente do Pages Router) — por isso o shell nunca
// navega direto, sempre passa pelo guard registrado (se houver) primeiro.
interface NavigationGuardContextValue {
  guardRef: React.MutableRefObject<((proceed: () => void) => void) | null>;
}

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(null);

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const guardRef = useRef<((proceed: () => void) => void) | null>(null);
  return (
    <NavigationGuardContext.Provider value={{ guardRef }}>
      {children}
    </NavigationGuardContext.Provider>
  );
}

function useNavigationGuardContext() {
  const ctx = useContext(NavigationGuardContext);
  if (!ctx) {
    throw new Error("Precisa estar dentro de um NavigationGuardProvider.");
  }
  return ctx;
}

// Chamado pela tela que precisa proteger a saída (ex: workspace da IA) —
// registra o handler enquanto ela está montada, remove ao desmontar/trocar.
export function useRegisterNavigationGuard(handler: ((proceed: () => void) => void) | null) {
  const { guardRef } = useNavigationGuardContext();
  useEffect(() => {
    guardRef.current = handler;
    return () => {
      guardRef.current = null;
    };
  }, [guardRef, handler]);
}

// Usado por qualquer ponto de navegação do shell (Sidebar, UserMenu...) — se
// não houver guard ativo, navega direto; se houver, delega a decisão pra ele
// (que normalmente abre um modal e só chama `proceed` depois da escolha do
// usuário).
export function useGuardedNavigate() {
  const { guardRef } = useNavigationGuardContext();
  const router = useRouter();
  return useCallback(
    (href: string) => {
      const proceed = () => router.push(href);
      if (guardRef.current) {
        guardRef.current(proceed);
      } else {
        proceed();
      }
    },
    [guardRef, router],
  );
}

// Mesma ideia, mas pra ações que não são navegação de rota (ex: logout via
// signOut do NextAuth).
export function useGuardedAction() {
  const { guardRef } = useNavigationGuardContext();
  return useCallback(
    (action: () => void) => {
      if (guardRef.current) {
        guardRef.current(action);
      } else {
        action();
      }
    },
    [guardRef],
  );
}
