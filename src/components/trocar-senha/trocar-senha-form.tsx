"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Lock, Eye, EyeOff, ArrowRight, AlertTriangle } from "lucide-react";

export function TrocarSenhaForm() {
  const router = useRouter();
  const { update } = useSession();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/trocar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novaSenha, confirmarSenha }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Não foi possível trocar a senha.");
        setIsSubmitting(false);
        return;
      }

      await update();
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Não foi possível trocar a senha no momento. Tente novamente.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col justify-center px-8 py-12 sm:px-12 lg:px-16">
      <div className="mx-auto w-full max-w-sm animate-fade-in-up">
        <p className="text-sm font-medium tracking-wide text-azul-medio">
          Primeiro acesso
        </p>
        <h1 className="mt-1.5 text-2xl font-bold text-azul-escuro sm:text-[28px]">
          Troque sua senha para continuar
        </h1>
        <p className="mt-2 text-sm text-azul-escuro/50">
          Por segurança, você precisa definir uma nova senha antes de acessar
          a plataforma.
        </p>

        <form onSubmit={handleSubmit} className="mt-9 space-y-5">
          <div>
            <label
              htmlFor="novaSenha"
              className="mb-2 block text-sm font-medium text-azul-escuro/80"
            >
              Nova senha
            </label>
            <div className="relative">
              <Lock
                size={18}
                strokeWidth={1.75}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-azul-escuro/35"
              />
              <input
                id="novaSenha"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded-xl border border-cinza-prata/70 bg-white py-3 pl-11 pr-11 text-sm text-azul-escuro placeholder:text-azul-escuro/35 outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-azul-escuro/35 transition hover:text-azul-escuro/70"
              >
                {showPassword ? (
                  <EyeOff size={18} strokeWidth={1.75} />
                ) : (
                  <Eye size={18} strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirmarSenha"
              className="mb-2 block text-sm font-medium text-azul-escuro/80"
            >
              Confirmar nova senha
            </label>
            <div className="relative">
              <Lock
                size={18}
                strokeWidth={1.75}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-azul-escuro/35"
              />
              <input
                id="confirmarSenha"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full rounded-xl border border-cinza-prata/70 bg-white py-3 pl-11 pr-4 text-sm text-azul-escuro placeholder:text-azul-escuro/35 outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10"
              />
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-2 rounded-lg bg-vermelho-risco/10 px-3.5 py-2.5 text-sm text-vermelho-risco">
              <AlertTriangle size={16} className="shrink-0" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-azul-escuro py-3.5 text-sm font-semibold text-white shadow-premium-sm transition hover:bg-azul-medio active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Salvando..." : "Trocar senha e continuar"}
            <ArrowRight
              size={16}
              strokeWidth={2}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </button>
        </form>
      </div>
    </div>
  );
}
