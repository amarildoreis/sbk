"use client";

import { useEffect, useState } from "react";
import {
  Users2,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Wallet,
  SlidersHorizontal,
  FilterX,
} from "lucide-react";
import { useDataRefresh, useIsForcedRefresh } from "../refresh-context";
import { StatCard } from "../stat-card";
import { RetractableFiltrosPanel } from "../retractable-filtros-panel";
import { FiltrosCarteiraSacadosInline } from "./filtros-carteira-sacados-inline";
import { CarteiraSacadosExportMenu } from "./carteira-sacados-export-menu";
import { SacadoDetalheModal } from "./sacado-detalhe-modal";

export interface SacadoCarteira {
  id: string;
  sacado: string | null;
  cedente: string | null;
  riscoSacado: number;
  percentual: number;
  ultimoVencimento: string | null;
}

interface CarteiraSacadosTotais {
  riscoSacado: number;
}

// Os 5 filtros confirmados pelo cliente em 2026-07-16, abertos num painel
// retrátil embutido na tela (mesmo padrão de Borderôs Liberados/Títulos/
// Carteira de Clientes/Comportamental/Comissões).
export interface CarteiraSacadosFiltros {
  comercial: string;
  grupoCedente: string;
  grupoSacado: string;
  cedente: string;
  sacado: string;
  sacadoLabel: string;
}

const FILTROS_VAZIOS: CarteiraSacadosFiltros = {
  comercial: "",
  grupoCedente: "",
  grupoSacado: "",
  cedente: "",
  sacado: "",
  sacadoLabel: "",
};

function filtrosParaQueryString(filtros: CarteiraSacadosFiltros) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filtros)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

const PAGE_SIZE = 50;

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

type SortDirection = "asc" | "desc";

// Carteira de Sacados (novo menu, abaixo de Borderôs Liberados — CLAUDE.md
// seção 9). Etapa 2 (2026-07-16): filtros retráteis (Comercial, Grupo
// Econômico Cedente, Grupo Econômico Sacado, Cedente, Sacado) + exportação
// Excel/e-mail, mesmo padrão dos demais relatórios.
export function CarteiraSacadosTable() {
  const { token: refreshToken } = useDataRefresh();
  const forced = useIsForcedRefresh(refreshToken);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("riscoSacado");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [filtros, setFiltros] = useState<CarteiraSacadosFiltros>(FILTROS_VAZIOS);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [rows, setRows] = useState<SacadoCarteira[]>([]);
  const [total, setTotal] = useState(0);
  const [totais, setTotais] = useState<CarteiraSacadosTotais | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [detalheAberto, setDetalheAberto] = useState<SacadoCarteira | null>(null);

  const hasActiveFilters = Object.entries(filtros).some(
    ([key, value]) => value !== "" && key !== "sacadoLabel",
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetch(
      `/api/carteira-sacados?page=${page}&pageSize=${PAGE_SIZE}&sort=${sortKey}&dir=${sortDir}&${filtrosParaQueryString(filtros)}${forced ? "&refresh=1" : ""}`,
    )
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setRows(data.rows as SacadoCarteira[]);
        setTotal(data.total as number);
        setTotais(data.totais as CarteiraSacadosTotais);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar o relatório agora.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sortKey, sortDir, filtros, refreshToken, forced]);

  function handleAplicarFiltros(novosFiltros: CarteiraSacadosFiltros) {
    setFiltros(novosFiltros);
    setPage(1);
    setFiltrosAbertos(false);
  }

  function handleLimparFiltros() {
    setFiltros(FILTROS_VAZIOS);
    setPage(1);
  }

  function handleSort(key: string) {
    if (key === sortKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, total);

  const columns = [
    { key: "sacado", label: "Sacado" },
    { key: "cedente", label: "Cedente" },
    { key: "riscoSacado", label: "Risco Sacado", align: "right" as const },
    { key: "percentual", label: "%", align: "right" as const },
    { key: "ultimoVencimento", label: "Último Vencimento" },
  ];

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="rounded-2xl border border-cinza-prata/40 bg-white shadow-premium-sm">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-azul-escuro/5 text-azul-escuro">
              <Users2 size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-azul-escuro">Carteira de Sacados</h2>
              <p className="text-sm text-azul-escuro/50">
                {isLoading
                  ? "Carregando..."
                  : `${total.toLocaleString("pt-BR")} combinações sacado/cedente no total.`}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setFiltrosAbertos((v) => !v)}
                aria-expanded={filtrosAbertos}
                className={`relative flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition ${
                  filtrosAbertos || hasActiveFilters
                    ? "border-azul-medio/50 bg-azul-medio/5 text-azul-escuro"
                    : "border-cinza-prata/60 text-azul-escuro/70 hover:border-azul-medio/40 hover:bg-azul-medio/5 hover:text-azul-escuro"
                }`}
              >
                <SlidersHorizontal size={16} strokeWidth={1.75} />
                Filtros
                {hasActiveFilters && (
                  <span className="h-1.5 w-1.5 rounded-full bg-vermelho-risco" />
                )}
                <ChevronDown
                  size={14}
                  strokeWidth={2}
                  className={`transition-transform duration-300 ${filtrosAbertos ? "rotate-180" : ""}`}
                />
              </button>
              {hasActiveFilters && (
                <button
                  onClick={handleLimparFiltros}
                  title="Limpar filtros"
                  className="flex h-10 items-center gap-2 rounded-xl border border-cinza-prata/60 px-3.5 text-sm font-medium text-azul-escuro/70 transition hover:border-vermelho-risco/40 hover:bg-vermelho-risco/5 hover:text-vermelho-risco"
                >
                  <FilterX size={16} strokeWidth={1.75} />
                  Limpar
                </button>
              )}
              <CarteiraSacadosExportMenu
                sortKey={sortKey}
                sortDir={sortDir}
                filtros={filtros}
                total={total}
              />
            </div>
            {hasActiveFilters && (
              <p className="text-xs text-vermelho-risco/70">
                As informações desta tela estão filtradas.
              </p>
            )}
          </div>
        </div>

        <RetractableFiltrosPanel open={filtrosAbertos}>
          <FiltrosCarteiraSacadosInline value={filtros} onApply={handleAplicarFiltros} />
        </RetractableFiltrosPanel>
      </div>

      <div className="grid grid-cols-1">
        <StatCard
          title="Valor Total do Risco Sacado"
          value={formatBRL(totais?.riscoSacado ?? 0)}
          icon={Wallet}
          accent="azul"
          delay={0}
          isLoading={isLoading}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-cinza-prata/40 bg-white shadow-premium-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left">
            <thead>
              <tr className="border-b border-cinza-prata/40 bg-surface-alt/60">
                {columns.map((col) => {
                  const isActive = col.key === sortKey;
                  const SortIcon = !isActive
                    ? ChevronsUpDown
                    : sortDir === "asc"
                      ? ChevronUp
                      : ChevronDown;
                  return (
                    <th
                      key={col.key}
                      className={`whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-azul-escuro/50 ${
                        col.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      <button
                        onClick={() => handleSort(col.key)}
                        className={`group inline-flex items-center gap-1 transition hover:text-azul-escuro ${
                          col.align === "right" ? "flex-row-reverse" : ""
                        } ${isActive ? "text-azul-escuro" : ""}`}
                      >
                        {col.label}
                        <SortIcon
                          size={13}
                          strokeWidth={2}
                          className={`shrink-0 transition ${
                            isActive ? "text-azul-medio" : "text-azul-escuro/25 group-hover:text-azul-escuro/50"
                          }`}
                        />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-azul-escuro/45">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Carregando sacados...
                    </span>
                  </td>
                </tr>
              )}

              {!isLoading && error && (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-vermelho-risco">
                    <span className="inline-flex items-center gap-2">
                      <AlertTriangle size={16} />
                      {error}
                    </span>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !error &&
                rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedRowId(row.id)}
                    onDoubleClick={() => setDetalheAberto(row)}
                    className={`cursor-pointer border-b border-cinza-prata/25 transition-colors last:border-0 hover:bg-azul-medio/5 ${
                      selectedRowId === row.id ? "bg-azul-medio/10" : ""
                    }`}
                  >
                    <td className="max-w-[280px] truncate px-4 py-3 text-xs font-medium text-azul-escuro">
                      {row.sacado ?? "—"}
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-3 text-xs text-azul-escuro/80">
                      {row.cedente ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-azul-escuro">
                      {formatBRL(row.riscoSacado)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-azul-escuro">
                      {formatPercent(row.percentual)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-azul-escuro/80">
                      {formatDate(row.ultimoVencimento)}
                    </td>
                  </tr>
                ))}

              {!isLoading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-azul-escuro/45">
                    Nenhum sacado encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-cinza-prata/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-azul-escuro/50">
            {total === 0
              ? "Nenhum resultado."
              : `Mostrando ${firstRow.toLocaleString("pt-BR")}–${lastRow.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1 || isLoading}
              className="flex items-center gap-1 rounded-lg border border-cinza-prata/60 px-3 py-1.5 text-sm font-medium text-azul-escuro/70 transition hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={15} strokeWidth={2} />
              Anterior
            </button>
            <span className="text-xs text-azul-escuro/50">
              Página {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages || isLoading}
              className="flex items-center gap-1 rounded-lg border border-cinza-prata/60 px-3 py-1.5 text-sm font-medium text-azul-escuro/70 transition hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40"
            >
              Próxima
              <ChevronRight size={15} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {detalheAberto && (
        <SacadoDetalheModal
          sacado={detalheAberto}
          onClose={() => setDetalheAberto(null)}
        />
      )}
    </div>
  );
}
