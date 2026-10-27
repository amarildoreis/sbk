"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  User as UserIcon,
  Mail,
  Check,
  AlertTriangle,
} from "lucide-react";
import { STATUS_STYLES, type Status } from "./constants";
import { type ComercialSistema } from "../comercial-sistema-select";
import { PERMISSOES } from "./permissoes";
import { ResetSenhaButton } from "./reset-senha-button";

export interface UsuarioDetailData {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  status: string;
  vinculo: string | null;
  comercialTipo: string | null;
  comercialCodigo: string | null;
  fotoBase64: string | null;
  permissoes: unknown;
}

export function UsuarioDetail({ usuario }: { usuario: UsuarioDetailData }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível excluir.");
      router.push("/dashboard/usuarios");
      router.refresh();
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Não foi possível excluir.",
      );
      setIsDeleting(false);
    }
  }

  const permissoes = (usuario.permissoes ?? {}) as Record<string, boolean>;
  const checkedPermissoes = PERMISSOES.filter((p) => permissoes[p.key]);
  const isExternalProfile = usuario.perfil === "Cedente" || usuario.perfil === "Sacado";
  const isComercial = usuario.perfil === "Comercial";
  const statusStyle = STATUS_STYLES[usuario.status as Status] ?? "";

  const [comerciaisSistema, setComerciaisSistema] = useState<ComercialSistema[]>([]);
  useEffect(() => {
    if (!isComercial) return;
    let cancelled = false;
    fetch("/api/operadores-indicante")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setComerciaisSistema(data.operadores);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComercial]);
  const comercialSistema = comerciaisSistema.find(
    (c) => c.codigo === usuario.comercialCodigo,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/dashboard/usuarios"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-azul-medio transition hover:text-azul-escuro"
      >
        <ArrowLeft size={14} strokeWidth={2} />
        Voltar para lista de usuários
      </Link>

      <div className="animate-fade-in-up rounded-2xl border border-cinza-prata/40 bg-white p-6 shadow-premium-sm sm:p-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-azul-escuro/10 text-azul-escuro ring-1 ring-cinza-prata/40">
              {usuario.fotoBase64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={usuario.fotoBase64}
                  alt={usuario.nome}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserIcon size={26} strokeWidth={1.5} />
              )}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-azul-escuro">
                {usuario.nome}
              </h1>
              <p className="flex items-center gap-1.5 text-sm text-azul-escuro/50">
                <Mail size={13} strokeWidth={1.75} />
                {usuario.email}
              </p>
            </div>
          </div>
          {confirmDelete ? (
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-azul-escuro/50">Tem certeza?</span>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-xl bg-vermelho-risco px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-vermelho-risco/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isDeleting ? "Excluindo..." : "Sim, excluir"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={isDeleting}
                className="rounded-xl border border-cinza-prata/60 px-4 py-2.5 text-sm font-medium text-azul-escuro transition hover:bg-surface-alt"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setConfirmDelete(true)}
                title="Excluir"
                className="flex items-center gap-2 rounded-xl border border-cinza-prata/60 px-4 py-2.5 text-sm font-medium text-vermelho-risco transition hover:border-vermelho-risco/40 hover:bg-vermelho-risco/5"
              >
                <Trash2 size={15} strokeWidth={2} />
                Excluir
              </button>
              <ResetSenhaButton
                usuarioId={usuario.id}
                nome={usuario.nome}
                variant="button"
              />
              <Link
                href={`/dashboard/usuarios/${usuario.id}/editar`}
                className="flex items-center gap-2 rounded-xl bg-azul-escuro px-4 py-2.5 text-sm font-semibold text-white shadow-premium-sm transition hover:bg-azul-medio active:scale-[0.99]"
              >
                <Pencil size={15} strokeWidth={2} />
                Editar
              </Link>
            </div>
          )}
        </div>

        {deleteError && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-vermelho-risco/10 px-4 py-3 text-sm text-vermelho-risco">
            <AlertTriangle size={16} className="shrink-0" />
            {deleteError}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full bg-azul-escuro/8 px-2.5 py-1 text-xs font-medium text-azul-escuro">
            {usuario.perfil}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle}`}
          >
            {usuario.status}
          </span>
          {isComercial && usuario.comercialTipo && (
            <span className="inline-flex items-center rounded-full bg-azul-medio/10 px-2.5 py-1 text-xs font-medium text-azul-medio">
              {usuario.comercialTipo}
            </span>
          )}
        </div>

        {(isComercial || isExternalProfile) && (
          <div className="mt-6 rounded-xl border border-cinza-prata/40 bg-surface-alt/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-azul-escuro/40">
              {isComercial ? "Dados do Comercial" : "Vínculo"}
            </p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              {isComercial && (
                <div>
                  <dt className="text-xs text-azul-escuro/50">
                    Comercial do Sistema
                  </dt>
                  <dd className="text-sm font-medium text-azul-escuro">
                    {comercialSistema
                      ? `${comercialSistema.codigo} - ${comercialSistema.nome ?? "(sem nome cadastrado)"}`
                      : (usuario.comercialCodigo ?? "—")}
                  </dd>
                </div>
              )}
              {isExternalProfile && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-azul-escuro/50">
                    {usuario.perfil === "Sacado"
                      ? "Sacado vinculado"
                      : "Cedente vinculado"}
                  </dt>
                  <dd className="text-sm font-medium text-azul-escuro">
                    {usuario.vinculo ?? "—"}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        <div className="mt-6 rounded-xl border border-cinza-prata/40 bg-surface-alt/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-azul-escuro/40">
            Permissões
          </p>
          {checkedPermissoes.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {checkedPermissoes.map((p) => (
                <span
                  key={p.key}
                  className="inline-flex items-center gap-1.5 rounded-full bg-verde-escuro/10 px-2.5 py-1 text-xs font-medium text-verde-escuro"
                >
                  <Check size={12} strokeWidth={2.5} />
                  {p.label}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-azul-escuro/45">
              Nenhuma permissão ativa.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
