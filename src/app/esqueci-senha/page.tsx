import type { Metadata } from "next";
import { BrandPanel } from "@/components/login/brand-panel";
import { EsqueciSenhaForm } from "@/components/esqueci-senha/esqueci-senha-form";

export const metadata: Metadata = {
  title: "Esqueci minha senha | SBK Capital",
};

export default function EsqueciSenhaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-alt sm:p-6">
      <div className="grid min-h-screen w-full max-w-5xl overflow-hidden bg-white sm:min-h-0 sm:rounded-[28px] sm:border sm:border-black/5 sm:shadow-premium md:grid-cols-2">
        <BrandPanel />
        <EsqueciSenhaForm />
      </div>
    </main>
  );
}
