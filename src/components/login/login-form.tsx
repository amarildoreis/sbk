"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
  }

  return (
    <div className="flex flex-col justify-center px-8 py-12 sm:px-12 lg:px-16">
      <div className="mx-auto w-full max-w-sm animate-fade-in-up">
        <div className="mb-10 md:mb-14">
          <Image
            src="/brand/logomarca-original.jpeg"
            alt="SBK Capital"
            width={64}
            height={64}
            className="h-16 w-16 rounded-2xl"
            priority
          />
        </div>

        <p className="text-sm font-medium tracking-wide text-azul-medio">
          Bem-vindo de volta
        </p>
        <h1 className="mt-1.5 text-2xl font-bold text-azul-escuro sm:text-[28px]">
          Entrar na sua conta
        </h1>

        <form onSubmit={handleSubmit} className="mt-9 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-azul-escuro/80"
            >
              E-mail corporativo
            </label>
            <div className="relative">
              <Mail
                size={18}
                strokeWidth={1.75}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-azul-escuro/35"
              />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="nome@empresa.com.br"
                className="w-full rounded-xl border border-cinza-prata/70 bg-white py-3 pl-11 pr-4 text-sm text-azul-escuro placeholder:text-azul-escuro/35 outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-azul-escuro/80"
            >
              Senha
            </label>
            <div className="relative">
              <Lock
                size={18}
                strokeWidth={1.75}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-azul-escuro/35"
              />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="••••••••"
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

          <div className="flex justify-end">
            <a
              href="#"
              className="text-sm font-medium text-azul-medio transition hover:text-azul-escuro hover:underline underline-offset-4"
            >
              Esqueci minha senha
            </a>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-azul-escuro py-3.5 text-sm font-semibold text-white shadow-premium-sm transition hover:bg-azul-medio active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
            <ArrowRight
              size={16}
              strokeWidth={2}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-azul-escuro/40">
          Acesso exclusivo para clientes SBK Capital
        </p>
      </div>
    </div>
  );
}
