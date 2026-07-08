"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="inline-flex w-full items-center gap-2.5 rounded-xl border border-white/10 px-3.5 py-2.5 text-sm font-medium text-cinza-prata transition hover:border-white/20 hover:bg-white/5 hover:text-white"
    >
      <LogOut size={16} strokeWidth={1.75} />
      Sair
    </button>
  );
}
