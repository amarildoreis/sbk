"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

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

  return (
    <div className="min-h-screen bg-surface-alt">
      <Sidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        userLabel={userLabel}
      />

      <div className="flex min-h-screen flex-col lg:pl-72">
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
