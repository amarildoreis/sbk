"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatIA, type Mensagem } from "./chat-ia";
import { ConversasPanel, type ConversaResumo } from "./conversas-panel";
import { SalvarConversaModal } from "./salvar-conversa-modal";
import { ConfirmarSaidaModal } from "./confirmar-saida-modal";
import { useRegisterNavigationGuard } from "../navigation-guard-context";

// Orquestra o módulo de Interação por IA (CLAUDE.md seção 12): painel de
// conversas salvas à esquerda + chat à direita, com o fluxo de
// salvar/descartar exigido ao sair da tela com alterações não salvas — nunca
// perde silenciosamente o que o usuário digitou.
export function IaWorkspace() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [conversaAtualId, setConversaAtualId] = useState<string | null>(null);
  const [conversaAtualTitulo, setConversaAtualTitulo] = useState<string | null>(null);

  const [conversas, setConversas] = useState<ConversaResumo[]>([]);
  const [isLoadingConversas, setIsLoadingConversas] = useState(true);

  const [showConfirmSaida, setShowConfirmSaida] = useState(false);
  const [showSalvarModal, setShowSalvarModal] = useState(false);
  const [isSalvando, setIsSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  // Snapshot (JSON) do estado da conversa no momento do último save/load —
  // comparado contra `mensagens` atual pra saber se há algo pra perguntar
  // antes de sair. "" = nunca salva/carregada (conversa nova e vazia).
  const savedSnapshotRef = useRef<string>("");
  const pendingProceedRef = useRef<(() => void) | null>(null);

  const hasUnsavedChanges = useCallback(() => {
    if (mensagens.length === 0) return false;
    return JSON.stringify(mensagens) !== savedSnapshotRef.current;
  }, [mensagens]);

  const carregarListaConversas = useCallback(async () => {
    try {
      const res = await fetch("/api/ia/conversas");
      if (!res.ok) return;
      const data = (await res.json()) as { conversas: ConversaResumo[] };
      setConversas(data.conversas);
    } finally {
      setIsLoadingConversas(false);
    }
  }, []);

  useEffect(() => {
    carregarListaConversas();
  }, [carregarListaConversas]);

  // Ponto único de decisão: qualquer saída da conversa atual (navegação pro
  // resto do dashboard, "Nova conversa", trocar de conversa salva) passa por
  // aqui. Sem alterações pendentes, segue direto — com alterações, abre o
  // modal de confirmação e só chama `proceed` depois da escolha do usuário.
  const solicitarSaida = useCallback(
    (proceed: () => void) => {
      if (!hasUnsavedChanges()) {
        proceed();
        return;
      }
      pendingProceedRef.current = proceed;
      setShowConfirmSaida(true);
    },
    [hasUnsavedChanges],
  );

  useRegisterNavigationGuard(solicitarSaida);

  // Best-effort pra fechar aba/atualizar página — o navegador mostra seu
  // próprio diálogo nativo (não dá pra customizar o texto).
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  async function salvarConversa(nome?: string): Promise<boolean> {
    setIsSalvando(true);
    setErroSalvar(null);
    try {
      if (conversaAtualId) {
        const res = await fetch(`/api/ia/conversas/${conversaAtualId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mensagens }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErroSalvar(data.error ?? "Não foi possível salvar a conversa.");
          return false;
        }
        savedSnapshotRef.current = JSON.stringify(mensagens);
        await carregarListaConversas();
        return true;
      }

      const res = await fetch("/api/ia/conversas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: nome, mensagens }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErroSalvar(data.error ?? "Não foi possível salvar a conversa.");
        return false;
      }
      setConversaAtualId(data.conversa.id);
      setConversaAtualTitulo(data.conversa.titulo);
      savedSnapshotRef.current = JSON.stringify(mensagens);
      await carregarListaConversas();
      return true;
    } catch {
      setErroSalvar("Não foi possível conectar com o servidor.");
      return false;
    } finally {
      setIsSalvando(false);
    }
  }

  function resetParaNovaConversa() {
    setMensagens([]);
    setConversaAtualId(null);
    setConversaAtualTitulo(null);
    savedSnapshotRef.current = "";
  }

  async function carregarConversa(id: string) {
    const res = await fetch(`/api/ia/conversas/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      conversa: { id: string; titulo: string; mensagens: Mensagem[] };
    };
    setMensagens(data.conversa.mensagens);
    setConversaAtualId(data.conversa.id);
    setConversaAtualTitulo(data.conversa.titulo);
    savedSnapshotRef.current = JSON.stringify(data.conversa.mensagens);
  }

  function handleSelecionarConversa(id: string) {
    if (id === conversaAtualId) return;
    solicitarSaida(() => carregarConversa(id));
  }

  async function handleExcluirConversa(id: string) {
    const res = await fetch(`/api/ia/conversas/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setConversas((prev) => prev.filter((c) => c.id !== id));
    if (id === conversaAtualId) resetParaNovaConversa();
  }

  async function handleRenomearConversa(id: string, novoTitulo: string): Promise<boolean> {
    const res = await fetch(`/api/ia/conversas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: novoTitulo }),
    });
    if (!res.ok) return false;
    setConversas((prev) =>
      prev.map((c) => (c.id === id ? { ...c, titulo: novoTitulo } : c)),
    );
    if (id === conversaAtualId) setConversaAtualTitulo(novoTitulo);
    return true;
  }

  // Botão "Salvar" no cabeçalho do chat — salva sem precisar sair da tela.
  // Conversa já carregada: atualiza direto ("Atualiza a mesma", decisão do
  // cliente). Conversa nova: pede o nome antes.
  function handleSalvarManual() {
    if (conversaAtualId) {
      salvarConversa();
    } else {
      setErroSalvar(null);
      setShowSalvarModal(true);
    }
  }

  function handleSalvarNaSaida() {
    if (conversaAtualId) {
      salvarConversa().then((ok) => {
        if (ok) {
          setShowConfirmSaida(false);
          const proceed = pendingProceedRef.current;
          pendingProceedRef.current = null;
          proceed?.();
        }
      });
    } else {
      setShowConfirmSaida(false);
      setErroSalvar(null);
      setShowSalvarModal(true);
    }
  }

  function handleDescartarNaSaida() {
    setShowConfirmSaida(false);
    const proceed = pendingProceedRef.current;
    pendingProceedRef.current = null;
    resetParaNovaConversa();
    proceed?.();
  }

  function handleCancelarSaida() {
    setShowConfirmSaida(false);
    pendingProceedRef.current = null;
  }

  async function handleConfirmarNome(nome: string) {
    const ok = await salvarConversa(nome);
    if (ok) {
      setShowSalvarModal(false);
      const proceed = pendingProceedRef.current;
      pendingProceedRef.current = null;
      proceed?.();
    }
  }

  function handleCancelarNome() {
    setShowSalvarModal(false);
    // Cancelar aqui cancela a saída inteira (o usuário recuou de "salvar"
    // sem escolher um nome) — não perde a conversa nem navega.
    pendingProceedRef.current = null;
  }

  return (
    <div className="flex gap-6">
      <ConversasPanel
        conversas={conversas}
        conversaAtualId={conversaAtualId}
        isLoading={isLoadingConversas}
        onSelecionar={handleSelecionarConversa}
        onRenomear={handleRenomearConversa}
        onExcluir={handleExcluirConversa}
      />

      <div className="min-w-0 flex-1">
        <ChatIA
          mensagens={mensagens}
          setMensagens={setMensagens}
          tituloConversa={conversaAtualTitulo}
          podeSalvar={mensagens.length > 0}
          isSalvando={isSalvando}
          onSalvarClick={handleSalvarManual}
        />
      </div>

      {showConfirmSaida && (
        <ConfirmarSaidaModal
          isSalvando={isSalvando}
          onSalvar={handleSalvarNaSaida}
          onDescartar={handleDescartarNaSaida}
          onCancelar={handleCancelarSaida}
        />
      )}

      {showSalvarModal && (
        <SalvarConversaModal
          isSalvando={isSalvando}
          erro={erroSalvar}
          onConfirmar={handleConfirmarNome}
          onCancelar={handleCancelarNome}
        />
      )}
    </div>
  );
}
