"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { RefreshProvider } from "./refresh-context";
import { NavigationGuardProvider } from "./navigation-guard-context";

const COLLAPSE_STORAGE_KEY = "sbk-sidebar-collapsed";

function getInitials(label: string) {
  const clean = label.split("@")[0];
  const parts = clean.split(/[.\s]+/).filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return initials.toUpperCase() || "SB";
}

export function DashboardShell({
  userLabel,
  permissoes,
  children,
}: {
  userLabel: string;
  permissoes: Record<string, boolean>;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <NavigationGuardProvider>
    <RefreshProvider>
      <div className="min-h-screen bg-surface-alt">
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          userLabel={userLabel}
          initials={getInitials(userLabel)}
          collapsed={collapsed}
        />

        <div className="flex">
          <Sidebar
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapsed}
            userLabel={userLabel}
            permissoes={permissoes}
          />

          <div
            className={`flex min-h-[calc(100vh-5rem)] flex-1 flex-col transition-[padding] duration-300 ease-out ${
              collapsed ? "lg:pl-20" : "lg:pl-72"
            }`}
          >
            <main className="flex-1 px-5 py-8 lg:px-8">{children}</main>
          </div>
        </div>
      </div>
    </RefreshProvider>
    </NavigationGuardProvider>
  );
}
