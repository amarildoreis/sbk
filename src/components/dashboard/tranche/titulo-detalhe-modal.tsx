"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, FileText } from "lucide-react";
import type { TituloTranche } from "./tranche-table";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-azul-escuro/45">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-azul-escuro">{children}</dd>
    </div>
  );
}

// Só visualização — abre com duplo clique numa linha da tabela
// (tranche-table.tsx). Não faz nenhuma consulta nova: usa os dados da linha
// já carregada na página atual. Mesmo padrão de
// titulo-detalhe-modal.tsx (Exposição Cedente/Títulos).
export function TituloDetalheModal({
  titulo,
  onClose,
}: {
  titulo: TituloTranche;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-azul-escuro/40 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-fade-in-up max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cinza-prata/40 bg-white shadow-premium"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-cinza-prata/40 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-azul-escuro/5 text-azul-escuro">
              <FileText size={16} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-azul-escuro">
                Título {titulo.titulo}
              </h2>
              <p className="text-xs text-azul-escuro/45">
                Vencimento em {formatDate(titulo.vencimento)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Fechar"
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-azul-escuro/40 transition hover:bg-azul-escuro/5 hover:text-azul-escuro"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 px-6 py-6">
          <div className="col-span-2">
            <Campo label="Cedente">{titulo.cedente ?? "—"}</Campo>
          </div>
          <div className="col-span-2">
            <Campo label="Sacado">{titulo.sacado ?? "—"}</Campo>
          </div>

          <Campo label="Valor">{formatBRL(titulo.valor)}</Campo>
          <Campo label="Vencimento do Título">{formatDate(titulo.vencimento)}</Campo>

          <Campo label="Vencimento da Tranche">{formatDate(titulo.vencimentoTranche)}</Campo>
          <Campo label="Data do Borderô">{formatDate(titulo.dataBordero)}</Campo>
        </dl>
      </div>
    </div>,
    document.body,
  );
}
