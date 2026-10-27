"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { dashboardNav, findActiveNavItem } from "@/lib/dashboard-nav";
import { useGuardedNavigate } from "./navigation-guard-context";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  userLabel: string;
  permissoes: Record<string, boolean>;
}

export function Sidebar({
  open,
  onClose,
  collapsed,
  onToggleCollapse,
  userLabel,
  permissoes,
}: SidebarProps) {
  const pathname = usePathname();
  const guardedNavigate = useGuardedNavigate();
  const activeHref = findActiveNavItem(pathname)?.href;
  const visibleNav = dashboardNav.filter(
    (item) => !item.permissionKey || permissoes[item.permissionKey],
  );

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
        className={`sbk-sidebar-glow-edge fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-azul-escuro px-5 py-6 transition-all duration-300 ease-out lg:top-20 lg:translate-x-0 lg:animate-fade-in-left ${
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

        <div className="flex items-center justify-end px-1 lg:hidden">
          <button
            onClick={onClose}
            aria-label="Fechar menu"
            className="rounded-lg p-1.5 text-cinza-prata transition hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sbk-nav-scroll mt-2 flex flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto lg:mt-8">
          {visibleNav.map((item) => {
            const isActive = item.href === activeHref;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  onClose();
                  guardedNavigate(item.href);
                }}
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
                  className={`sbk-nav-label min-w-0 flex-1 truncate leading-snug ${
                    collapsed ? "lg:hidden" : ""
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 border-t border-white/10 pt-5">
          <p
            className={`truncate px-1 text-xs text-cinza-prata/70 ${
              collapsed ? "lg:hidden" : ""
            }`}
          >
            {userLabel}
          </p>
        </div>
      </aside>
    </>
  );
}
