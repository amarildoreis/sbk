"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="inline-flex items-center gap-2 rounded-xl bg-azul-escuro px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-azul-medio"
    >
      <LogOut size={16} strokeWidth={1.75} />
      Sair
    </button>
  );
}
