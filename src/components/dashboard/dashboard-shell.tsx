"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

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
  children,
}: {
  userLabel: string;
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
    <div className="min-h-screen bg-surface-alt">
      <Sidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        userLabel={userLabel}
      />

      <div
        className={`flex min-h-screen flex-col transition-[padding] duration-300 ease-out ${
          collapsed ? "lg:pl-20" : "lg:pl-72"
        }`}
      >
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          userLabel={userLabel}
          initials={getInitials(userLabel)}
        />
        <main className="flex-1 px-5 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
