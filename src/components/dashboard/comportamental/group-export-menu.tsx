"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MoreVertical,
  FileText,
  Mail,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import type { ComportamentalFiltros } from "./comportamental-page";

// Menu "..." de cada grupo de cards do Comportamental — mesmo padrão visual
// de CarteiraExportMenu/TitulosExportMenu, mas exporta PDF (um grupo por
// vez) em vez de Excel (uma tabela inteira).
//
// O dropdown é renderizado via createPortal em document.body (não como
// filho normal do card) porque MetricGroupCard usa animate-fade-in-up, cuja
// keyframe final deixa `transform: translateY(0)` aplicado em repouso —
// isso cria um novo contexto de empilhamento no card, e um z-index alto no
// dropdown não basta pra ele aparecer por cima do PRÓXIMO card do grid
// (mesmo problema já resolvido em titulo-detalhe-modal.tsx/
// cliente-detalhe-modal.tsx pro mesmo motivo).
export function GroupExportMenu({
  grupo,
  titulo,
  filtros,
  resumoFiltros,
}: {
  grupo: string;
  titulo: string;
  filtros: ComportamentalFiltros;
  resumoFiltros?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [emailMode, setEmailMode] = useState(false);
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function handleToggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setEmailMode(false);
      setTo("");
      setMessage("");
      setEmailError(null);
      setEmailSent(false);
    }
  }, [open]);

  function buildParams() {
    const params = new URLSearchParams({ grupo });
    if (filtros.comercial) params.set("comercial", filtros.comercial);
    if (filtros.grupoEconomico) params.set("grupoEconomico", filtros.grupoEconomico);
    if (filtros.cedente) params.set("cedente", filtros.cedente);
    if (resumoFiltros) params.set("resumo", resumoFiltros);
    return params;
  }

  async function handleExport() {
    if (isExporting) return;
    setIsExporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/comportamental/exportar-pdf?${buildParams().toString()}`);
      if (!res.ok) throw new Error("export-failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `comportamental-${grupo}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch {
      setError("Não foi possível exportar agora.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleSendEmail() {
    if (isSendingEmail || !to.trim()) return;
    setIsSendingEmail(true);
    setEmailError(null);
    try {
      const res = await fetch("/api/comportamental/exportar-pdf/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          message,
          grupo,
          filtros,
          resumoFiltros,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível enviar o e-mail agora.");
      setEmailSent(true);
    } catch (err) {
      setEmailError(
        err instanceof Error ? err.message : "Não foi possível enviar o e-mail agora.",
      );
    } finally {
      setIsSendingEmail(false);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        title={`Exportar ${titulo}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-azul-escuro/40 transition hover:bg-azul-escuro/5 hover:text-azul-escuro"
      >
        <MoreVertical size={17} strokeWidth={1.75} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: position.top, right: position.right }}
            className="animate-fade-in-up fixed z-50 w-72 overflow-hidden rounded-2xl border border-cinza-prata/40 bg-white py-1.5 shadow-premium"
          >
            {!emailMode ? (
              <>
                <button
                  role="menuitem"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex w-full items-start gap-2.5 px-4 py-3 text-left text-sm font-medium text-azul-escuro/80 transition hover:bg-azul-medio/5 hover:text-azul-escuro disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isExporting ? (
                    <Loader2 size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 animate-spin" />
                  ) : (
                    <FileText size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                  )}
                  <span>
                    <span className="block">
                      {isExporting ? "Exportando..." : "Exportar para PDF"}
                    </span>
                    <span className="mt-0.5 block text-xs font-normal text-azul-escuro/45">
                      {titulo}
                    </span>
                  </span>
                </button>

                <button
                  role="menuitem"
                  onClick={() => setEmailMode(true)}
                  className="flex w-full items-start gap-2.5 px-4 py-3 text-left text-sm font-medium text-azul-escuro/80 transition hover:bg-azul-medio/5 hover:text-azul-escuro"
                >
                  <Mail size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                  <span>
                    <span className="block">Enviar por e-mail</span>
                    <span className="mt-0.5 block text-xs font-normal text-azul-escuro/45">
                      PDF anexado, direto pela plataforma
                    </span>
                  </span>
                </button>

                {error && (
                  <p className="flex items-center gap-1.5 border-t border-cinza-prata/30 px-4 py-2.5 text-xs text-vermelho-risco">
                    <AlertTriangle size={13} strokeWidth={1.75} className="shrink-0" />
                    {error}
                  </p>
                )}
              </>
            ) : emailSent ? (
              <div className="flex flex-col items-center gap-2 px-5 py-6 text-center">
                <CheckCircle2 size={28} strokeWidth={1.75} className="text-verde-escuro" />
                <p className="text-sm font-medium text-azul-escuro">E-mail enviado!</p>
                <p className="text-xs text-azul-escuro/45">
                  O PDF foi enviado para {to}, com cópia pra você.
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="mt-2 rounded-lg border border-cinza-prata/60 px-3 py-1.5 text-xs font-medium text-azul-escuro/70 transition hover:bg-surface-alt"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <div className="px-4 py-3">
                <button
                  onClick={() => setEmailMode(false)}
                  className="mb-2 flex items-center gap-1 text-xs font-medium text-azul-escuro/50 transition hover:text-azul-escuro"
                >
                  <ArrowLeft size={13} strokeWidth={2} />
                  Voltar
                </button>

                <label className="mb-2 block">
                  <span className="mb-1 block text-xs text-azul-escuro/50">
                    Para (separe vários e-mails por vírgula)
                  </span>
                  <input
                    type="text"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="nome@empresa.com.br"
                    autoComplete="off"
                    className="w-full rounded-lg border border-cinza-prata/70 bg-white px-3 py-2 text-sm text-azul-escuro placeholder:text-azul-escuro/35 outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10"
                  />
                </label>

                <label className="mb-3 block">
                  <span className="mb-1 block text-xs text-azul-escuro/50">
                    Mensagem (opcional)
                  </span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    placeholder="Segue o resumo..."
                    className="w-full resize-none rounded-lg border border-cinza-prata/70 bg-white px-3 py-2 text-sm text-azul-escuro placeholder:text-azul-escuro/35 outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10"
                  />
                </label>

                {emailError && (
                  <p className="mb-3 flex items-center gap-1.5 text-xs text-vermelho-risco">
                    <AlertTriangle size={13} strokeWidth={1.75} className="shrink-0" />
                    {emailError}
                  </p>
                )}

                <button
                  onClick={handleSendEmail}
                  disabled={isSendingEmail || !to.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-azul-escuro px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-azul-medio disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSendingEmail ? (
                    <Loader2 size={15} strokeWidth={2} className="animate-spin" />
                  ) : (
                    <Mail size={15} strokeWidth={2} />
                  )}
                  {isSendingEmail ? "Enviando..." : "Enviar"}
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
