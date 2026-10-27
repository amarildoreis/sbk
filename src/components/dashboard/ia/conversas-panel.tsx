"use client";

import { MessageSquareText, Loader2 } from "lucide-react";
import { ConversaItemMenu } from "./conversa-item-menu";

export interface ConversaResumo {
  id: string;
  titulo: string;
  updatedAt: string;
}

const MAX_CONVERSAS = 20;

function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ConversasPanelProps {
  conversas: ConversaResumo[];
  conversaAtualId: string | null;
  isLoading: boolean;
  onSelecionar: (id: string) => void;
  onRenomear: (id: string, novoTitulo: string) => Promise<boolean>;
  onExcluir: (id: string) => Promise<void> | void;
}

export function ConversasPanel({
  conversas,
  conversaAtualId,
  isLoading,
  onSelecionar,
  onRenomear,
  onExcluir,
}: ConversasPanelProps) {
  return (
    <div className="flex h-[calc(100vh-11rem)] w-72 shrink-0 flex-col rounded-2xl border border-cinza-prata/40 bg-white shadow-premium-sm">
      <div className="border-b border-cinza-prata/40 px-5 py-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-azul-escuro">Conversas salvas</h3>
          <span className="text-xs font-medium text-azul-escuro/40">
            {conversas.length}/{MAX_CONVERSAS}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-azul-escuro/40">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : conversas.length === 0 ? (
          <p className="px-2.5 py-6 text-center text-xs leading-relaxed text-azul-escuro/40">
            Nenhuma conversa salva ainda. Salve uma conversa para reaproveitá-la depois.
          </p>
        ) : (
          <ul className="space-y-1">
            {conversas.map((c) => {
              const isActive = c.id === conversaAtualId;
              return (
                <li key={c.id}>
                  <div
                    className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 transition ${
                      isActive ? "bg-azul-escuro/8" : "hover:bg-surface-alt"
                    }`}
                  >
                    <button
                      onClick={() => onSelecionar(c.id)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <MessageSquareText
                        size={15}
                        strokeWidth={1.75}
                        className={`shrink-0 ${isActive ? "text-azul-medio" : "text-azul-escuro/40"}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-sm ${
                            isActive ? "font-semibold text-azul-escuro" : "font-medium text-azul-escuro/80"
                          }`}
                        >
                          {c.titulo}
                        </span>
                        <span className="block text-[11px] text-azul-escuro/40">
                          {formatData(c.updatedAt)}
                        </span>
                      </span>
                    </button>

                    <ConversaItemMenu
                      tituloAtual={c.titulo}
                      onRenomear={(novoTitulo) => onRenomear(c.id, novoTitulo)}
                      onExcluir={() => onExcluir(c.id)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
