"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Image as ImageIcon, FileText, Loader2, AlertTriangle } from "lucide-react";

function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Menu "..." de cada mini gráfico da Interação por IA — Baixar Imagem
// (PNG, o gráfico exatamente como aparece na tela) ou Baixar PDF (relatório
// com os 12 valores mensais, mesmo builder/estilo já usado em
// Comportamental/Gráficos). CLAUDE.md seção 12, pedido do cliente em
// 2026-07-19.
export function GraficoIaExportMenu({
  titulo,
  pontos,
  itens,
  containerRef,
}: {
  titulo: string;
  /** Gráfico mensal (jan-dez) — informe este OU `itens`, nunca os dois. */
  pontos?: { mes: number; valor: number }[];
  /** Gráfico categórico (ex: um comercial por barra) — informe este OU `pontos`. */
  itens?: { rotulo: string; valor: number }[];
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const [isExportingImagem, setIsExportingImagem] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
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

  // Exporta o SVG que o Recharts já desenhou na tela pra um PNG — sem
  // biblioteca extra: serializa o <svg>, desenha num <canvas> (escala 2x
  // pra ficar nítido) e baixa o resultado. É literalmente o gráfico como
  // está na tela, não uma reconstrução a partir dos dados brutos.
  async function handleExportarImagem() {
    if (isExportingImagem || !containerRef.current) return;
    setIsExportingImagem(true);
    setErro(null);
    try {
      const svg = containerRef.current.querySelector("svg");
      if (!svg) throw new Error("sem-svg");

      let svgStr = new XMLSerializer().serializeToString(svg);
      if (!svgStr.includes("xmlns=")) {
        svgStr = svgStr.replace("<svg", `<svg xmlns="http://www.w3.org/2000/svg"`);
      }
      const width = svg.clientWidth || 600;
      const height = svg.clientHeight || 200;

      const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("falha-carregar-svg"));
        img.src = url;
      });

      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("sem-canvas-context");
      ctx.scale(scale, scale);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      await new Promise<void>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("sem-blob"));
            return;
          }
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `${slugify(titulo)}-${new Date().toISOString().slice(0, 10)}.png`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          resolve();
        }, "image/png");
      });
      setOpen(false);
    } catch {
      setErro("Não foi possível exportar a imagem agora.");
    } finally {
      setIsExportingImagem(false);
    }
  }

  async function handleExportarPdf() {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    setErro(null);
    try {
      const res = await fetch("/api/ia/exportar-grafico-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itens ? { titulo, itens } : { titulo, pontos }),
      });
      if (!res.ok) throw new Error("export-failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slugify(titulo)}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch {
      setErro("Não foi possível exportar o PDF agora.");
    } finally {
      setIsExportingPdf(false);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        title="Exportar gráfico"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-azul-escuro/40 transition hover:bg-azul-escuro/5 hover:text-azul-escuro"
      >
        <MoreVertical size={15} strokeWidth={1.75} />
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
              onClick={handleExportarImagem}
              disabled={isExportingImagem}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-azul-escuro/80 transition hover:bg-azul-medio/5 hover:text-azul-escuro disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isExportingImagem ? (
                <Loader2 size={16} strokeWidth={1.75} className="shrink-0 animate-spin" />
              ) : (
                <ImageIcon size={16} strokeWidth={1.75} className="shrink-0" />
              )}
              {isExportingImagem ? "Exportando..." : "Baixar imagem (PNG)"}
            </button>
            <button
              role="menuitem"
              onClick={handleExportarPdf}
              disabled={isExportingPdf}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-azul-escuro/80 transition hover:bg-azul-medio/5 hover:text-azul-escuro disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isExportingPdf ? (
                <Loader2 size={16} strokeWidth={1.75} className="shrink-0 animate-spin" />
              ) : (
                <FileText size={16} strokeWidth={1.75} className="shrink-0" />
              )}
              {isExportingPdf ? "Exportando..." : "Baixar PDF"}
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
