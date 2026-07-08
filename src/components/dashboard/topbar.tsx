"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { dashboardNav } from "@/lib/dashboard-nav";
import { RefreshButton } from "./refresh-button";

interface TopbarProps {
  onMenuClick: () => void;
  userLabel: string;
  initials: string;
}

export function Topbar({ onMenuClick, userLabel, initials }: TopbarProps) {
  const pathname = usePathname();
  const active = dashboardNav.find((item) => pathname === item.href);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-black/5 bg-white/80 px-5 backdrop-blur lg:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="-ml-1.5 rounded-lg p-2 text-azul-escuro/60 transition hover:bg-azul-escuro/5 lg:hidden"
        >
          <Menu size={20} strokeWidth={1.75} />
        </button>
        <h1 className="text-[15px] font-semibold text-azul-escuro">
          {active?.label ?? "Dashboard"}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <RefreshButton />
        <div
          title={userLabel}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-azul-escuro text-xs font-semibold text-white"
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
