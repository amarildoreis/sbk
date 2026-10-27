"use client";

import { useEffect, useRef, useState } from "react";
import {
  MoreVertical,
  FileSpreadsheet,
  Mail,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import type { TrancheFiltros } from "./tranche-table";

// Mesmo padrão visual/comportamento de ExposicaoCedenteExportMenu/
// BorderosLiberadosExportMenu — Excel (download) ou envio por e-mail com
// Excel anexado.
export function TrancheExportMenu({
  sortKey,
  sortDir,
  filtros,
  visao,
  total,
}: {
  sortKey: string;
  sortDir: "asc" | "desc";
  filtros: TrancheFiltros;
  visao: string;
  total: number;
}) {
  const [open, setOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [emailMode, setEmailMode] = useState(false);
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
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

  function buildFiltrosParams() {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filtros)) {
      if (value) params.set(key, String(value));
    }
    if (visao) params.set("visao", visao);
    params.set("sort", sortKey);
    params.set("dir", sortDir);
    return params;
  }

  async function handleExport() {
    if (isExporting) return;
    setIsExporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tranche/export?${buildFiltrosParams().toString()}`);
      if (!res.ok) throw new Error("export-failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tranche-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
      const res = await fetch("/api/tranche/export/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          message,
          sort: sortKey,
          dir: sortDir,
          filtros: { ...filtros, visao },
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
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Mais ações"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-cinza-prata/60 text-azul-escuro/60 transition hover:border-azul-medio/40 hover:bg-azul-medio/5 hover:text-azul-escuro"
      >
        <MoreVertical size={18} strokeWidth={1.75} />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-fade-in-up absolute right-0 top-11 z-40 w-80 overflow-hidden rounded-2xl border border-cinza-prata/40 bg-white py-1.5 shadow-premium"
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
                  <FileSpreadsheet size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                )}
                <span>
                  <span className="block">
                    {isExporting ? "Exportando..." : "Exportar para Excel"}
                  </span>
                  <span className="mt-0.5 block text-xs font-normal text-azul-escuro/45">
                    {total.toLocaleString("pt-BR")} título{total === 1 ? "" : "s"} serão exportados
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
                    Excel anexado, direto pela plataforma
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
                O relatório foi enviado para {to}, com cópia pra você.
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
                  placeholder="Segue o relatório..."
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
        </div>
      )}
    </div>
  );
}
