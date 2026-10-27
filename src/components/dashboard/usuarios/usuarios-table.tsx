"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Users,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { STATUS_STYLES, type Status } from "./constants";
import { ResetSenhaButton } from "./reset-senha-button";

interface UsuarioListItem {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  status: Status;
  fotoBase64: string | null;
  permissoes: Record<string, boolean>;
  /** Só preenchido pra perfil Comercial ("Interno"/"Externo") — demais
   * perfis ficam null, exibido como "—" na listagem. */
  comercialTipo: string | null;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  return initials.toUpperCase() || "SB";
}

function permissoesAtivasCount(permissoes: Record<string, boolean>) {
  return Object.values(permissoes).filter(Boolean).length;
}

export function UsuariosTable() {
  const [query, setQuery] = useState("");
  const [usuarios, setUsuarios] = useState<UsuarioListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/usuarios");
        if (!res.ok) throw new Error("request-failed");
        const data = await res.json();
        if (!cancelled) setUsuarios(data.usuarios);
      } catch {
        if (!cancelled) {
          setError(
            "Não foi possível carregar os usuários agora. Tente novamente em instantes.",
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

  async function handleDelete(id: string) {
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/usuarios/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível excluir.");
      setUsuarios((prev) => prev.filter((u) => u.id !== id));
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Não foi possível excluir.",
      );
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  const filtered = usuarios.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      u.nome.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.perfil.toLowerCase().includes(q)
    );
  });

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-cinza-prata/40 bg-white p-5 shadow-premium-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-azul-escuro/5 text-azul-escuro">
            <Users size={20} strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-azul-escuro">
              Usuários cadastrados
            </h2>
            <p className="text-sm text-azul-escuro/50">
              {isLoading
                ? "Carregando..."
                : `${usuarios.length} usuários com acesso à plataforma.`}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search
              size={16}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-azul-escuro/35"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, e-mail ou perfil..."
              className="w-full rounded-xl border border-cinza-prata/70 bg-white py-2.5 pl-10 pr-4 text-sm text-azul-escuro placeholder:text-azul-escuro/35 outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10 sm:w-72"
            />
          </div>
          <Link
            href="/dashboard/usuarios/novo"
            className="group flex items-center justify-center gap-2 rounded-xl bg-azul-escuro px-4 py-2.5 text-sm font-semibold text-white shadow-premium-sm transition hover:bg-azul-medio active:scale-[0.99]"
          >
            <Plus
              size={16}
              strokeWidth={2.25}
              className="transition-transform group-hover:rotate-90"
            />
            Novo
          </Link>
        </div>
      </div>

      {deleteError && (
        <p className="flex items-center gap-2 rounded-xl bg-vermelho-risco/10 px-4 py-3 text-sm text-vermelho-risco">
          <AlertTriangle size={16} className="shrink-0" />
          {deleteError}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-cinza-prata/40 bg-white shadow-premium-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-b border-cinza-prata/40 bg-surface-alt/60">
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-azul-escuro/50">
                  Usuário
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-azul-escuro/50">
                  Perfil
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-azul-escuro/50">
                  Tipo
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-azul-escuro/50">
                  Status
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-azul-escuro/50">
                  Permissões
                </th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-azul-escuro/50">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-azul-escuro/45">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Carregando usuários...
                    </span>
                  </td>
                </tr>
              )}

              {!isLoading && error && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-vermelho-risco">
                    <span className="inline-flex items-center gap-2">
                      <AlertTriangle size={16} />
                      {error}
                    </span>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !error &&
                filtered.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-cinza-prata/25 transition-colors last:border-0 hover:bg-azul-medio/5"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {user.fotoBase64 ? (
                          <Image
                            src={user.fotoBase64}
                            alt={user.nome}
                            width={36}
                            height={36}
                            unoptimized
                            className="h-9 w-9 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-azul-escuro text-xs font-semibold text-white">
                            {getInitials(user.nome)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-azul-escuro">
                            {user.nome}
                          </p>
                          <p className="truncate text-xs text-azul-escuro/50">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center rounded-full bg-azul-escuro/8 px-2.5 py-1 text-xs font-medium text-azul-escuro">
                        {user.perfil}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-azul-escuro/70">
                      {user.comercialTipo ?? "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[user.status]}`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-azul-escuro/70">
                      {permissoesAtivasCount(user.permissoes)}{" "}
                      {permissoesAtivasCount(user.permissoes) === 1
                        ? "permissão"
                        : "permissões"}
                    </td>
                    <td className="px-5 py-3.5">
                      {confirmDeleteId === user.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-azul-escuro/50">
                            Excluir {user.nome.split(" ")[0]}?
                          </span>
                          <button
                            onClick={() => handleDelete(user.id)}
                            disabled={deletingId === user.id}
                            className="rounded-lg bg-vermelho-risco px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-vermelho-risco/90 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {deletingId === user.id ? "Excluindo..." : "Sim"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={deletingId === user.id}
                            className="rounded-lg border border-cinza-prata/60 px-2.5 py-1.5 text-xs font-medium text-azul-escuro transition hover:bg-surface-alt"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/dashboard/usuarios/${user.id}`}
                            title="Ver detalhes"
                            aria-label={`Ver detalhes de ${user.nome}`}
                            className="rounded-lg p-2 text-azul-escuro/50 transition hover:bg-azul-medio/10 hover:text-azul-escuro"
                          >
                            <Eye size={16} strokeWidth={1.75} />
                          </Link>
                          <Link
                            href={`/dashboard/usuarios/${user.id}/editar`}
                            title="Editar"
                            aria-label={`Editar ${user.nome}`}
                            className="rounded-lg p-2 text-azul-escuro/50 transition hover:bg-azul-medio/10 hover:text-azul-escuro"
                          >
                            <Pencil size={16} strokeWidth={1.75} />
                          </Link>
                          <ResetSenhaButton usuarioId={user.id} nome={user.nome} />
                          <button
                            onClick={() => setConfirmDeleteId(user.id)}
                            title="Excluir"
                            aria-label={`Excluir ${user.nome}`}
                            className="rounded-lg p-2 text-azul-escuro/50 transition hover:bg-vermelho-risco/10 hover:text-vermelho-risco"
                          >
                            <Trash2 size={16} strokeWidth={1.75} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}

              {!isLoading && !error && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-sm text-azul-escuro/45"
                  >
                    {usuarios.length === 0
                      ? "Nenhum usuário cadastrado ainda."
                      : `Nenhum usuário encontrado para "${query}".`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
