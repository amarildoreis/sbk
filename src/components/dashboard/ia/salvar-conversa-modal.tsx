"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Save, X } from "lucide-react";

interface SalvarConversaModalProps {
  isSalvando: boolean;
  erro: string | null;
  onConfirmar: (nome: string) => void;
  onCancelar: () => void;
}

export function SalvarConversaModal({
  isSalvando,
  erro,
  onConfirmar,
  onCancelar,
}: SalvarConversaModalProps) {
  const [nome, setNome] = useState("");

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
        <div className="flex items-center justify-between border-b border-cinza-prata/40 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-azul-escuro/5 text-azul-escuro">
              <Save size={16} strokeWidth={1.75} />
            </div>
            <h3 className="text-sm font-semibold text-azul-escuro">Salvar conversa</h3>
          </div>
          <button
            onClick={onCancelar}
            title="Fechar"
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-azul-escuro/40 transition hover:bg-azul-escuro/5 hover:text-azul-escuro"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (nome.trim()) onConfirmar(nome.trim());
          }}
          className="space-y-4 px-6 py-5"
        >
          <div>
            <label htmlFor="nome-conversa" className="mb-1.5 block text-xs font-medium text-azul-escuro/60">
              Nome da conversa
            </label>
            <input
              id="nome-conversa"
              type="text"
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Comissões do comercial Loureiro"
              maxLength={120}
              className="w-full rounded-xl border border-cinza-prata/70 bg-white px-4 py-2.5 text-sm text-azul-escuro placeholder:text-azul-escuro/35 outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10"
            />
          </div>

          {erro && <p className="text-sm text-vermelho-risco">{erro}</p>}

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCancelar}
              className="rounded-xl border border-cinza-prata/60 px-4 py-2.5 text-sm font-medium text-azul-escuro/70 transition hover:bg-surface-alt"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!nome.trim() || isSalvando}
              className="flex items-center gap-2 rounded-xl bg-azul-escuro px-4 py-2.5 text-sm font-medium text-white transition hover:bg-azul-medio disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSalvando && <Loader2 size={15} className="animate-spin" />}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
