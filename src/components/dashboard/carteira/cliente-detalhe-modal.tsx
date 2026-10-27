"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Users } from "lucide-react";
import {
  formatBRL,
  formatPercent,
  formatDate,
  SITUACAO_STYLES,
  type ClienteCarteira,
} from "./carteira-clientes-table";

function Campo({
  label,
  children,
  danger = false,
}: {
  label: string;
  children: React.ReactNode;
  /** Realça o valor em vermelho — mesmo tom dos tiles "Vencidos" do
   * Comportamental, pra padronizar a cor de valores vencidos em toda a
   * plataforma. */
  danger?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-azul-escuro/45">{label}</dt>
      <dd
        className={`mt-0.5 text-sm font-medium ${danger ? "text-vermelho-risco" : "text-azul-escuro"}`}
      >
        {children}
      </dd>
    </div>
  );
}

// Só visualização — abre com duplo clique numa linha da tabela
// (carteira-clientes-table.tsx). Não faz nenhuma consulta nova.
export function ClienteDetalheModal({
  cliente,
  onClose,
}: {
  cliente: ClienteCarteira;
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
              <Users size={16} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-azul-escuro">
                {cliente.cedente ?? `Cedente ${cliente.codigo}`}
              </h2>
              <p className="text-xs text-azul-escuro/45">Código {cliente.codigo}</p>
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
          <Campo label="Comercial">{cliente.comercial ?? "—"}</Campo>
          <Campo label="Situação">
            {cliente.situacao && (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                  SITUACAO_STYLES[cliente.situacao] ?? "bg-cinza-prata/20 text-azul-escuro/70"
                }`}
              >
                {cliente.situacao}
              </span>
            )}
            {!cliente.situacao && "—"}
          </Campo>

          <Campo label="Limite de Crédito">{formatBRL(cliente.limiteCredito)}</Campo>
          <Campo label="Risco Cedente">{formatBRL(cliente.risco)}</Campo>
          <Campo label="Participação Cedente">{formatPercent(cliente.participacao)}</Campo>
          <Campo label="Limite Disponível">{formatBRL(cliente.limiteDisponivel)}</Campo>

          <Campo label="Vencido" danger>{formatBRL(cliente.vencido)}</Campo>
          <Campo label="A Vencer">{formatBRL(cliente.aVencer)}</Campo>
          <Campo label="Tranche">{formatBRL(cliente.tranche)}</Campo>
          <Campo label="Taxa">{cliente.taxa === null ? "—" : formatPercent(cliente.taxa * 100)}</Campo>

          <Campo label="Data do Último Borderô">{formatDate(cliente.ultimaData)}</Campo>
          <Campo label="Método">{cliente.metodo ?? "—"}</Campo>
        </dl>
      </div>
    </div>,
    document.body,
  );
}
