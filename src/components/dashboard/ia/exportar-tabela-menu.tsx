"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, FileSpreadsheet, Loader2, AlertTriangle } from "lucide-react";

// Menu "..." de toda resposta da Interação por IA que vier com tabela
// (`linhas.length > 0`, ou seja, o usuário pediu detalhamento — CLAUDE.md
// seção 12) — mesmo padrão visual/portal de GroupExportMenu/
// ConversaItemMenu, só que com uma única ação (Baixar Excel), decisão do
// cliente em 2026-07-19: "padrão pra toda resposta que retornar uma
// tabela".
export function ExportarTabelaMenu({
  linhas,
  titulo,
}: {
  linhas: Record<string, unknown>[];
  titulo: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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

  async function handleExportar() {
    if (isExporting) return;
    setIsExporting(true);
    setErro(null);
    try {
      const res = await fetch("/api/ia/exportar-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linhas, titulo }),
      });
      if (!res.ok) throw new Error("export-failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch {
      setErro("Não foi possível exportar agora.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        title="Exportar"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-azul-escuro/40 transition hover:bg-azul-escuro/5 hover:text-azul-escuro"
      >
        <MoreVertical size={16} strokeWidth={1.75} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: position.top, right: position.right }}
            className="animate-fade-in-up fixed z-[70] w-56 overflow-hidden rounded-2xl border border-cinza-prata/40 bg-white py-1.5 shadow-premium"
          >
            <button
              role="menuitem"
              onClick={handleExportar}
              disabled={isExporting}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-azul-escuro/80 transition hover:bg-azul-medio/5 hover:text-azul-escuro disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isExporting ? (
                <Loader2 size={16} strokeWidth={1.75} className="shrink-0 animate-spin" />
              ) : (
                <FileSpreadsheet size={16} strokeWidth={1.75} className="shrink-0" />
              )}
              {isExporting ? "Exportando..." : "Baixar Excel"}
            </button>
            {erro && (
              <p className="flex items-center gap-1.5 border-t border-cinza-prata/30 px-4 py-2.5 text-xs text-vermelho-risco">
                <AlertTriangle size={13} strokeWidth={1.75} className="shrink-0" />
                {erro}
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
