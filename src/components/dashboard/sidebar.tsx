"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { dashboardNav } from "@/lib/dashboard-nav";
import { SignOutButton } from "./sign-out-button";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  userLabel: string;
}

export function Sidebar({
  open,
  onClose,
  collapsed,
  onToggleCollapse,
  userLabel,
}: SidebarProps) {
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
        className={`sbk-sidebar-glow-edge fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-azul-escuro px-5 py-6 transition-all duration-300 ease-out lg:translate-x-0 lg:animate-fade-in-left ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-20 lg:px-3" : ""}`}
      >
        <button
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className="absolute -right-3 top-8 hidden h-6 w-6 items-center justify-center rounded-full border border-cinza-prata/60 bg-white text-azul-escuro shadow-premium-sm transition hover:bg-surface-alt lg:flex"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div
          className={`flex items-center justify-between px-1 ${
            collapsed ? "lg:justify-center" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <span className="sbk-brand-glow animate-brand-pulse" aria-hidden />
              <Image
                src="/brand/sbk-icon.png"
                alt="SBK Capital"
                width={36}
                height={36}
                className="relative h-9 w-9 rounded-xl"
              />
            </div>
            <span
              className={`text-[15px] font-semibold text-white ${
                collapsed ? "lg:hidden" : ""
              }`}
            >
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
                title={item.label}
                className={`sbk-nav-item flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-cinza-prata ${
                  collapsed ? "lg:justify-center lg:px-0" : ""
                } ${isActive ? "is-active" : ""}`}
              >
                <Icon
                  size={18}
                  strokeWidth={1.75}
                  className={`sbk-nav-icon shrink-0 ${
                    isActive ? "text-verde-claro" : "text-cinza-prata/70"
                  }`}
                />
                <span
                  className={`sbk-nav-label leading-snug ${
                    collapsed ? "lg:hidden" : ""
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 space-y-4 border-t border-white/10 pt-5">
          <p
            className={`truncate px-1 text-xs text-cinza-prata/70 ${
              collapsed ? "lg:hidden" : ""
            }`}
          >
            {userLabel}
          </p>
          <SignOutButton collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
}
