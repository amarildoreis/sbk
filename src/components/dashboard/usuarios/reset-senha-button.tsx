"use client";

import { useState } from "react";
import { KeyRound, X, Copy, Check, AlertTriangle, Mail } from "lucide-react";

interface ResetSenhaButtonProps {
  usuarioId: string;
  nome: string;
  variant?: "icon" | "button";
}

export function ResetSenhaButton({
  usuarioId,
  nome,
  variant = "icon",
}: ResetSenhaButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"confirm" | "result">("confirm");
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);

  function openModal() {
    setStep("confirm");
    setError(null);
    setSenhaGerada(null);
    setEmailSent(false);
    setEnviarEmail(true);
    setIsOpen(true);
  }

  async function handleConfirm() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/usuarios/${usuarioId}/reset-senha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enviarEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Não foi possível redefinir a senha.");
      }
      setSenhaGerada(data.senhaGerada);
      setEmailSent(Boolean(data.emailSent));
      setStep("result");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível redefinir a senha.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopy() {
    if (!senhaGerada) return;
    try {
      await navigator.clipboard.writeText(senhaGerada);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão de clipboard — a senha continua visível na tela.
    }
  }

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={openModal}
          title="Resetar senha"
          aria-label={`Resetar senha de ${nome}`}
          className="rounded-lg p-2 text-azul-escuro/50 transition hover:bg-azul-medio/10 hover:text-azul-escuro"
        >
          <KeyRound size={16} strokeWidth={1.75} />
        </button>
      ) : (
        <button
          type="button"
          onClick={openModal}
          className="flex items-center gap-2 rounded-xl border border-cinza-prata/60 px-4 py-2.5 text-sm font-medium text-azul-escuro transition hover:border-azul-medio/40 hover:bg-azul-medio/5"
        >
          <KeyRound size={15} strokeWidth={2} />
          Resetar senha
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-azul-marca/40 p-4 backdrop-blur-sm"
          onClick={() => !isLoading && setIsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md animate-fade-in-up rounded-2xl bg-white p-6 shadow-premium"
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-semibold text-azul-escuro">
                <KeyRound size={17} strokeWidth={2} />
                Resetar senha
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-azul-escuro/50 transition hover:bg-surface-alt hover:text-azul-escuro"
              >
                <X size={18} />
              </button>
            </div>

            {step === "confirm" ? (
              <>
                <p className="mt-3 text-sm text-azul-escuro/60">
                  Isso gera uma nova senha temporária para{" "}
                  <strong className="text-azul-escuro">{nome}</strong> e força
                  a troca dela no próximo acesso. A senha atual deixa de
                  funcionar imediatamente.
                </p>

                <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-azul-escuro/70">
                  <input
                    type="checkbox"
                    checked={enviarEmail}
                    onChange={(e) => setEnviarEmail(e.target.checked)}
                    className="h-4 w-4 rounded border-cinza-prata/70 text-azul-escuro focus:ring-azul-medio"
                  />
                  Enviar a nova senha por e-mail
                </label>

                {error && (
                  <p className="mt-3 flex items-center gap-2 rounded-lg bg-vermelho-risco/10 px-3.5 py-2.5 text-sm text-vermelho-risco">
                    <AlertTriangle size={16} className="shrink-0" />
                    {error}
                  </p>
                )}

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    disabled={isLoading}
                    className="rounded-xl border border-cinza-prata/60 px-4 py-2.5 text-sm font-medium text-azul-escuro transition hover:bg-surface-alt"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isLoading}
                    className="rounded-xl bg-azul-escuro px-4 py-2.5 text-sm font-semibold text-white shadow-premium-sm transition hover:bg-azul-medio active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isLoading ? "Gerando..." : "Confirmar reset"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm text-azul-escuro/60">
                  Nova senha temporária gerada para{" "}
                  <strong className="text-azul-escuro">{nome}</strong>.
                </p>

                <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-surface-alt px-3 py-2.5 ring-1 ring-cinza-prata/50">
                  <span className="font-mono text-sm font-semibold text-azul-escuro">
                    {senhaGerada}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-azul-medio transition hover:bg-azul-medio/10"
                  >
                    <Copy size={13} strokeWidth={2} />
                    {copied ? "Copiado!" : "Copiar"}
                  </button>
                </div>
                <p className="mt-2 text-xs text-azul-escuro/45">
                  Essa senha não será mostrada de novo — copie agora se
                  precisar repassar manualmente.
                </p>
                <p
                  className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${
                    emailSent ? "text-verde-escuro" : "text-azul-escuro/50"
                  }`}
                >
                  {emailSent ? (
                    <Check size={13} strokeWidth={2.5} />
                  ) : (
                    <Mail size={13} strokeWidth={2} />
                  )}
                  {emailSent
                    ? "E-mail enviado."
                    : "E-mail não enviado (opção desmarcada ou SMTP indisponível)."}
                </p>

                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl bg-azul-escuro px-4 py-2.5 text-sm font-semibold text-white shadow-premium-sm transition hover:bg-azul-medio active:scale-[0.99]"
                  >
                    Concluir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
