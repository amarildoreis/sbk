"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { findActiveNavItem } from "@/lib/dashboard-nav";
import { RefreshButton } from "./refresh-button";
import { UserMenu } from "./user-menu";

interface TopbarProps {
  onMenuClick: () => void;
  userLabel: string;
  initials: string;
  collapsed: boolean;
}

export function Topbar({
  onMenuClick,
  userLabel,
  initials,
  collapsed,
}: TopbarProps) {
  const pathname = usePathname();
  const active = findActiveNavItem(pathname);
  const ActiveIcon = active?.icon;

  return (
    <header className="sticky top-0 z-30 flex h-20 w-full shrink-0 border-b border-black/5 bg-white/80 backdrop-blur">
      <div
        className={`hidden shrink-0 items-center border-r border-black/5 px-6 transition-all duration-300 ease-out lg:flex ${
          collapsed ? "lg:w-20 lg:justify-center lg:px-0" : "lg:w-72"
        }`}
      >
        <Image
          src="/brand/logomarca-original.jpeg"
          alt="SBK Capital"
          width={112}
          height={112}
          priority
          className="h-12 w-12 rounded-xl object-cover"
        />
      </div>

      <div className="flex flex-1 items-center justify-between px-5 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            aria-label="Abrir menu"
            className="-ml-1.5 rounded-lg p-2 text-azul-escuro/60 transition hover:bg-azul-escuro/5 lg:hidden"
          >
            <Menu size={20} strokeWidth={1.75} />
          </button>
          <Image
            src="/brand/logomarca-original.jpeg"
            alt="SBK Capital"
            width={80}
            height={80}
            className="h-9 w-9 rounded-lg object-cover lg:hidden"
          />
          <h1 className="flex items-center gap-2 text-[15px] font-semibold text-azul-escuro">
            {ActiveIcon && (
              <ActiveIcon size={18} strokeWidth={1.75} className="text-azul-escuro/70" />
            )}
            {active?.label ?? "Dashboard"}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <RefreshButton />
          <UserMenu userLabel={userLabel} initials={initials} />
        </div>
      </div>
    </header>
  );
}
