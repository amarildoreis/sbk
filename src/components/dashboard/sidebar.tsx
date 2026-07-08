"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { dashboardNav } from "@/lib/dashboard-nav";
import { SignOutButton } from "./sign-out-button";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  userLabel: string;
}

export function Sidebar({ open, onClose, userLabel }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div
          aria-hidden
          onClick={onClose}
          className="fixed inset-0 z-40 bg-azul-marca/40 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-azul-escuro px-5 py-6 transition-transform duration-300 ease-out lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/sbk-icon.png"
              alt="SBK Capital"
              width={36}
              height={36}
              className="h-9 w-9 rounded-xl"
            />
            <span className="text-[15px] font-semibold text-white">
              SBK Capital
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar menu"
            className="rounded-lg p-1.5 text-cinza-prata transition hover:bg-white/5 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="mt-9 flex flex-1 flex-col gap-1 overflow-y-auto">
          {dashboardNav.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-cinza-prata hover:bg-white/5 hover:text-white"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-verde-claro" />
                )}
                <Icon
                  size={18}
                  strokeWidth={1.75}
                  className={
                    isActive
                      ? "shrink-0 text-verde-claro"
                      : "shrink-0 text-cinza-prata/70 transition group-hover:text-white"
                  }
                />
                <span className="leading-snug">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 space-y-4 border-t border-white/10 pt-5">
          <p className="truncate px-1 text-xs text-cinza-prata/70">
            {userLabel}
          </p>
          <SignOutButton />
        </div>
      </aside>
    </>
  );
}
