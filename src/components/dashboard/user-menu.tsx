"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { User, LogOut } from "lucide-react";
import { useGuardedAction, useGuardedNavigate } from "./navigation-guard-context";

export function UserMenu({
  userLabel,
  initials,
}: {
  userLabel: string;
  initials: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const guardedNavigate = useGuardedNavigate();
  const guardedAction = useGuardedAction();

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={userLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-azul-escuro text-xs font-semibold text-white transition hover:bg-azul-medio"
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          className="animate-fade-in-up absolute right-0 top-11 z-40 w-56 overflow-hidden rounded-2xl border border-cinza-prata/40 bg-white py-1.5 shadow-premium"
        >
          <div className="border-b border-cinza-prata/30 px-4 py-3">
            <p className="truncate text-sm font-medium text-azul-escuro">
              {userLabel}
            </p>
          </div>

          <Link
            href="/dashboard/perfil"
            role="menuitem"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) {
                setOpen(false);
                return;
              }
              e.preventDefault();
              setOpen(false);
              guardedNavigate("/dashboard/perfil");
            }}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-azul-escuro/80 transition hover:bg-azul-medio/5 hover:text-azul-escuro"
          >
            <User size={16} strokeWidth={1.75} />
            Ver meu perfil
          </Link>

          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              guardedAction(() => signOut({ callbackUrl: "/login" }));
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-vermelho-risco transition hover:bg-vermelho-risco/5"
          >
            <LogOut size={16} strokeWidth={1.75} />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
