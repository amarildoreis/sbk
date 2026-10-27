"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, FileCheck2 } from "lucide-react";
import {
  formatBRL,
  formatDate,
  formatDias,
  formatFator,
  type BorderoLiberado,
} from "./borderos-liberados-table";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-azul-escuro/45">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-azul-escuro">{children}</dd>
    </div>
  );
}

// Só visualização — abre com duplo clique numa linha da tabela
// (borderos-liberados-table.tsx). Não faz nenhuma consulta nova: usa os
// dados da linha já carregada na página atual. Mesmo padrão de
// titulo-detalhe-modal.tsx/cliente-detalhe-modal.tsx.
export function BorderoDetalheModal({
  bordero,
  onClose,
}: {
  bordero: BorderoLiberado;
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
              <FileCheck2 size={16} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-azul-escuro">
                Borderô {bordero.bordero}
              </h2>
              <p className="text-xs text-azul-escuro/45">
                Liberado em {formatDate(bordero.dataLiberacao)}
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
            <Campo label="Cedente">{bordero.cedente ?? "—"}</Campo>
          </div>

          <Campo label="Método">{bordero.metodo ?? "—"}</Campo>
          <Campo label="Valor do Borderô">{formatBRL(bordero.titulosFidc)}</Campo>

          <Campo label="Prazo Médio">{formatDias(bordero.prazoMedio)}</Campo>
          <Campo label="Fator">{formatFator(bordero.fator)}</Campo>

          <Campo label="Data de Liberação">{formatDate(bordero.dataLiberacao)}</Campo>
        </dl>
      </div>
    </div>,
    document.body,
  );
}
