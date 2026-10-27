"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Pencil, Trash2, Loader2, ArrowLeft, AlertTriangle } from "lucide-react";

// Menu "..." de cada conversa salva (Interação por IA) — Alterar nome /
// Excluir. Portal em document.body pelo mesmo motivo já documentado em
// GroupExportMenu/GraficoExportMenu: o item vive numa lista com
// `overflow-y-auto`, que cortaria um dropdown posicionado como filho normal.
export function ConversaItemMenu({
  tituloAtual,
  onRenomear,
  onExcluir,
}: {
  tituloAtual: string;
  onRenomear: (novoTitulo: string) => Promise<boolean>;
  onExcluir: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const [modo, setModo] = useState<"menu" | "renomear" | "excluir">("menu");
  const [novoTitulo, setNovoTitulo] = useState(tituloAtual);
  const [isSalvando, setIsSalvando] = useState(false);
  const [isExcluindo, setIsExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      setModo("menu");
      setNovoTitulo(tituloAtual);
      setErro(null);
      return;
    }
    if (modo === "renomear") {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [open, modo, tituloAtual]);

  async function handleConfirmarRenomear() {
    const titulo = novoTitulo.trim();
    if (!titulo || isSalvando) return;
    setIsSalvando(true);
    setErro(null);
    const ok = await onRenomear(titulo);
    setIsSalvando(false);
    if (ok) setOpen(false);
    else setErro("Não foi possível renomear a conversa.");
  }

  async function handleConfirmarExcluir() {
    if (isExcluindo) return;
    setIsExcluindo(true);
    await onExcluir();
    setIsExcluindo(false);
    setOpen(false);
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          handleToggle();
        }}
        title="Mais opções"
        aria-label="Mais opções"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`shrink-0 rounded-lg p-1.5 text-azul-escuro/35 transition hover:bg-azul-escuro/5 hover:text-azul-escuro ${
          open ? "bg-azul-escuro/5 text-azul-escuro" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <MoreVertical size={15} strokeWidth={1.75} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: position.top, right: position.right }}
            className="animate-fade-in-up fixed z-[60] w-64 overflow-hidden rounded-2xl border border-cinza-prata/40 bg-white py-1.5 shadow-premium"
            onClick={(e) => e.stopPropagation()}
          >
            {modo === "menu" && (
              <>
                <button
                  role="menuitem"
                  onClick={() => setModo("renomear")}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-azul-escuro/80 transition hover:bg-azul-medio/5 hover:text-azul-escuro"
                >
                  <Pencil size={15} strokeWidth={1.75} />
                  Alterar nome
                </button>
                <button
                  role="menuitem"
                  onClick={() => setModo("excluir")}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-vermelho-risco transition hover:bg-vermelho-risco/5"
                >
                  <Trash2 size={15} strokeWidth={1.75} />
                  Excluir
                </button>
              </>
            )}

            {modo === "renomear" && (
              <div className="px-4 py-3">
                <button
                  onClick={() => setModo("menu")}
                  className="mb-2 flex items-center gap-1 text-xs font-medium text-azul-escuro/50 transition hover:text-azul-escuro"
                >
                  <ArrowLeft size={13} strokeWidth={2} />
                  Voltar
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmarRenomear();
                  }}
                  maxLength={120}
                  className="w-full rounded-lg border border-cinza-prata/70 bg-white px-3 py-2 text-sm text-azul-escuro outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10"
                />
                {erro && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-vermelho-risco">
                    <AlertTriangle size={13} strokeWidth={1.75} className="shrink-0" />
                    {erro}
                  </p>
                )}
                <button
                  onClick={handleConfirmarRenomear}
                  disabled={!novoTitulo.trim() || isSalvando}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-azul-escuro px-3 py-2 text-sm font-semibold text-white transition hover:bg-azul-medio disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSalvando && <Loader2 size={14} className="animate-spin" />}
                  Salvar
                </button>
              </div>
            )}

            {modo === "excluir" && (
              <div className="px-4 py-3">
                <p className="text-sm text-azul-escuro/80">
                  Excluir <span className="font-semibold">"{tituloAtual}"</span>? Essa ação não pode ser
                  desfeita.
                </p>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setModo("menu")}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-azul-escuro/60 transition hover:bg-surface-alt"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmarExcluir}
                    disabled={isExcluindo}
                    className="flex items-center gap-1.5 rounded-lg bg-vermelho-risco px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-vermelho-risco/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isExcluindo && <Loader2 size={13} className="animate-spin" />}
                    Excluir
                  </button>
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
