"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ConfirmarSaidaModalProps {
  isSalvando: boolean;
  onSalvar: () => void;
  onDescartar: () => void;
  onCancelar: () => void;
}

export function ConfirmarSaidaModal({
  isSalvando,
  onSalvar,
  onDescartar,
  onCancelar,
}: ConfirmarSaidaModalProps) {
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onCancelar();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onCancelar]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-azul-escuro/40 px-4 backdrop-blur-sm"
      onClick={onCancelar}
    >
      <div
        className="animate-fade-in-up w-full max-w-md overflow-hidden rounded-2xl border border-cinza-prata/40 bg-white shadow-premium"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5 px-6 pb-2 pt-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ambar-alerta/10 text-ambar-alerta">
            <AlertTriangle size={18} strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-azul-escuro">Conversa não salva</h3>
            <p className="mt-1 text-sm leading-relaxed text-azul-escuro/60">
              Você tem alterações não salvas nesta conversa. Deseja salvar antes de sair?
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-6 pb-6 pt-4">
          <button
            onClick={onCancelar}
            className="rounded-xl border border-cinza-prata/60 px-4 py-2.5 text-sm font-medium text-azul-escuro/70 transition hover:bg-surface-alt"
          >
            Cancelar
          </button>
          <button
            onClick={onDescartar}
            className="rounded-xl border border-vermelho-risco/30 px-4 py-2.5 text-sm font-medium text-vermelho-risco transition hover:bg-vermelho-risco/5"
          >
            Descartar
          </button>
          <button
            onClick={onSalvar}
            disabled={isSalvando}
            className="flex items-center gap-2 rounded-xl bg-azul-escuro px-4 py-2.5 text-sm font-medium text-white transition hover:bg-azul-medio disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSalvando && <Loader2 size={15} className="animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
