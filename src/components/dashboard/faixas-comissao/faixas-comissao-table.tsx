"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  X,
  Percent,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface FaixaComissao {
  id: string;
  jurosMin: number;
  jurosMax: number | null;
  taxa: number;
}

function formatPct(value: number) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function jurosLabel(f: FaixaComissao) {
  return f.jurosMax === null
    ? `acima de ${formatPct(f.jurosMin)}`
    : `${formatPct(f.jurosMin)} a ${formatPct(f.jurosMax)}`;
}

function sortFaixas(faixas: FaixaComissao[]) {
  return [...faixas].sort((a, b) => a.jurosMin - b.jurosMin);
}

interface FaixaFormValues {
  jurosMin: string;
  jurosMax: string;
  semLimite: boolean;
  taxa: string;
}

function emptyForm(): FaixaFormValues {
  return { jurosMin: "", jurosMax: "", semLimite: false, taxa: "" };
}

function formFromFaixa(f: FaixaComissao): FaixaFormValues {
  return {
    jurosMin: String(f.jurosMin),
    jurosMax: f.jurosMax === null ? "" : String(f.jurosMax),
    semLimite: f.jurosMax === null,
    taxa: String(f.taxa),
  };
}

export function FaixasComissaoTable() {
  const [faixas, setFaixas] = useState<FaixaComissao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<FaixaFormValues>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const res = await fetch("/api/faixas-comissao");
        if (!res.ok) throw new Error("request-failed");
        const data = await res.json();
        if (!cancelled) setFaixas(data.faixas);
      } catch {
        if (!cancelled) {
          setLoadError(
            "Não foi possível carregar as faixas agora. Tente novamente em instantes.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = sortFaixas(faixas);
  const isModalOpen = isCreating || editingId !== null;

  function openCreate() {
    setForm(emptyForm());
    setFormError(null);
    setIsCreating(true);
    setEditingId(null);
  }

  function openEdit(f: FaixaComissao) {
    setForm(formFromFaixa(f));
    setFormError(null);
    setEditingId(f.id);
    setIsCreating(false);
  }

  function closeModal() {
    if (isSaving) return;
    setIsCreating(false);
    setEditingId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);

    const payload = {
      jurosMin: Number(form.jurosMin),
      jurosMax: form.semLimite ? null : Number(form.jurosMax),
      taxa: Number(form.taxa),
    };

    try {
      const res = await fetch(
        editingId ? `/api/faixas-comissao/${editingId}` : "/api/faixas-comissao",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar a faixa.");

      if (editingId) {
        setFaixas((prev) => prev.map((f) => (f.id === editingId ? data.faixa : f)));
      } else {
        setFaixas((prev) => [...prev, data.faixa]);
      }
      setIsCreating(false);
      setEditingId(null);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Não foi possível salvar a faixa.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/faixas-comissao/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível excluir a faixa.");
      setFaixas((prev) => prev.filter((f) => f.id !== id));
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Não foi possível excluir a faixa.",
      );
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-cinza-prata/40 bg-white p-5 shadow-premium-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-azul-escuro/5 text-azul-escuro">
            <Layers size={20} strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-azul-escuro">
              Faixas de Comissões
            </h2>
            <p className="text-sm text-azul-escuro/50">
              Taxa de comissão automática por faixa de juros, aplicada a
              todos os comerciais Internos.
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="group flex shrink-0 items-center justify-center gap-2 rounded-xl bg-azul-escuro px-4 py-2.5 text-sm font-semibold text-white shadow-premium-sm transition hover:bg-azul-medio active:scale-[0.99]"
        >
          <Plus
            size={16}
            strokeWidth={2.25}
            className="transition-transform group-hover:rotate-90"
          />
          Nova Faixa
        </button>
      </div>

      {deleteError && (
        <p className="flex items-center gap-2 rounded-xl bg-vermelho-risco/10 px-4 py-3 text-sm text-vermelho-risco">
          <AlertTriangle size={16} className="shrink-0" />
          {deleteError}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-cinza-prata/40 bg-white shadow-premium-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-b border-cinza-prata/40 bg-surface-alt/60">
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-azul-escuro/50">
                  Faixa
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-azul-escuro/50">
                  Juros Mensal
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-azul-escuro/50">
                  Taxa de Comissão
                </th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-azul-escuro/50">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-sm text-azul-escuro/45">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Carregando faixas...
                    </span>
                  </td>
                </tr>
              )}

              {!isLoading && loadError && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-sm text-vermelho-risco">
                    <span className="inline-flex items-center gap-2">
                      <AlertTriangle size={16} />
                      {loadError}
                    </span>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !loadError &&
                sorted.map((f, idx) => (
                  <tr
                    key={f.id}
                    className="border-b border-cinza-prata/25 transition-colors last:border-0 hover:bg-azul-medio/5"
                  >
                    <td className="px-5 py-3.5">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-azul-escuro/8 text-sm font-semibold text-azul-escuro">
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-azul-escuro">
                      {jurosLabel(f)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-verde-escuro/10 px-2.5 py-1 text-xs font-semibold text-verde-escuro">
                        <Percent size={11} strokeWidth={2.5} />
                        {formatPct(f.taxa)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {confirmDeleteId === f.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-azul-escuro/50">
                            Excluir?
                          </span>
                          <button
                            onClick={() => handleDelete(f.id)}
                            disabled={deletingId === f.id}
                            className="rounded-lg bg-vermelho-risco px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-vermelho-risco/90 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {deletingId === f.id ? "Excluindo..." : "Sim"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={deletingId === f.id}
                            className="rounded-lg border border-cinza-prata/60 px-2.5 py-1.5 text-xs font-medium text-azul-escuro transition hover:bg-surface-alt"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            title="Editar"
                            aria-label={`Editar faixa ${idx + 1}`}
                            onClick={() => openEdit(f)}
                            className="rounded-lg p-2 text-azul-escuro/50 transition hover:bg-azul-medio/10 hover:text-azul-escuro"
                          >
                            <Pencil size={16} strokeWidth={1.75} />
                          </button>
                          <button
                            title="Excluir"
                            aria-label={`Excluir faixa ${idx + 1}`}
                            onClick={() => setConfirmDeleteId(f.id)}
                            className="rounded-lg p-2 text-azul-escuro/50 transition hover:bg-vermelho-risco/10 hover:text-vermelho-risco"
                          >
                            <Trash2 size={16} strokeWidth={1.75} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}

              {!isLoading && !loadError && sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-12 text-center text-sm text-azul-escuro/45"
                  >
                    Nenhuma faixa cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-azul-marca/40 p-4 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md animate-fade-in-up rounded-2xl bg-white p-6 shadow-premium"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-azul-escuro">
                {editingId ? "Editar Faixa" : "Nova Faixa"}
              </h3>
              <button
                onClick={closeModal}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-azul-escuro/50 transition hover:bg-surface-alt hover:text-azul-escuro"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-azul-escuro/80">
                    Juros mínimo (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.jurosMin}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, jurosMin: e.target.value }))
                    }
                    className="w-full rounded-xl border border-cinza-prata/70 bg-white px-3.5 py-2.5 text-sm text-azul-escuro outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-azul-escuro/80">
                    Juros máximo (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required={!form.semLimite}
                    disabled={form.semLimite}
                    value={form.jurosMax}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, jurosMax: e.target.value }))
                    }
                    className="w-full rounded-xl border border-cinza-prata/70 bg-white px-3.5 py-2.5 text-sm text-azul-escuro outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10 disabled:bg-surface-alt disabled:text-azul-escuro/40"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-azul-escuro/70">
                <input
                  type="checkbox"
                  checked={form.semLimite}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      semLimite: e.target.checked,
                      jurosMax: e.target.checked ? "" : p.jurosMax,
                    }))
                  }
                  className="h-4 w-4 rounded border-cinza-prata/70 text-azul-escuro focus:ring-azul-medio"
                />
                Sem limite superior (última faixa)
              </label>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-azul-escuro/80">
                  Taxa de Comissão (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.taxa}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, taxa: e.target.value }))
                  }
                  className="w-full rounded-xl border border-cinza-prata/70 bg-white px-3.5 py-2.5 text-sm text-azul-escuro outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10"
                />
              </div>

              {formError && (
                <p className="flex items-center gap-2 rounded-lg bg-vermelho-risco/10 px-3.5 py-2.5 text-sm text-vermelho-risco">
                  <AlertTriangle size={15} className="shrink-0" />
                  {formError}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSaving}
                  className="rounded-xl border border-cinza-prata/60 px-4 py-2.5 text-sm font-medium text-azul-escuro transition hover:bg-surface-alt"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-azul-escuro px-4 py-2.5 text-sm font-semibold text-white shadow-premium-sm transition hover:bg-azul-medio active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSaving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
