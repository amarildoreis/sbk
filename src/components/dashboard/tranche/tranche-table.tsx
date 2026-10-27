"use client";

import { useEffect, useState } from "react";
import {
  Layers3,
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
import { TrancheVisaoToggle, trancheVisaoLabel } from "./tranche-visao-toggle";
import { FiltrosTrancheInline } from "./filtros-tranche-inline";
import { TrancheExportMenu } from "./tranche-export-menu";
import { TituloDetalheModal } from "./titulo-detalhe-modal";

export interface TituloTranche {
  id: number;
  titulo: string;
  valor: number;
  sacado: string | null;
  cedente: string | null;
  vencimento: string | null;
  vencimentoTranche: string | null;
  dataBordero: string | null;
}

interface TrancheTotais {
  valor: number;
}

// Os 3 filtros confirmados pelo cliente em 2026-07-16, abertos num painel
// retrátil embutido na tela (mesmo padrão de Exposição Cedente/Borderôs
// Liberados/Títulos/Carteira de Clientes/Comportamental/Comissões/Carteira
// de Sacados).
export interface TrancheFiltros {
  comercial: string;
  grupoEconomico: string;
  cedente: string;
}

const FILTROS_VAZIOS: TrancheFiltros = {
  comercial: "",
  grupoEconomico: "",
  cedente: "",
};

function filtrosParaQueryString(filtros: TrancheFiltros) {
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

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

type SortDirection = "asc" | "desc";

// Tranche (novo menu, abaixo de Exposição Cedente — CLAUDE.md seção 9).
// Etapa 1 (2026-07-16): tabela + toggle "Tomada"/"A Vencer"/"Vencida" (mesmo
// padrão visual do slicer "Visão" de Carteira de Clientes/Exposição
// Cedente, com 3 opções em vez de 2/3, espelhando as medidas DAX
// tranche_tomada/tranche_a_vencer/tranche_vencida). Colunas confirmadas
// pelo cliente: Título, Valor (ignorando a parte de Visão/CedentesComRisco
// das medidas DAX — a pedido explícito do cliente, mesma decisão de
// Exposição Cedente), Sacado, Cedente, Vencimento do Título, Vencimento da
// Tranche e Data do Borderô. Único totalizador — "Valor Total dos Títulos"
// — soma a coluna Valor sobre todo o universo filtrado pelo toggle (não só
// a página carregada), mesmo padrão de largura total de "Valor Total dos
// Borderôs"/"Valor Total do Risco Sacado". Etapa 2 (2026-07-16): filtros
// retráteis (Comercial, Grupo Econômico, Cedente) + exportação Excel/e-mail,
// mesmo padrão retrátil das demais telas — exatamente igual a Exposição
// Cedente.
export function TrancheTable() {
  const { token: refreshToken } = useDataRefresh();
  const forced = useIsForcedRefresh(refreshToken);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("vencimento");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [visao, setVisao] = useState("tomada");
  const [filtros, setFiltros] = useState<TrancheFiltros>(FILTROS_VAZIOS);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [rows, setRows] = useState<TituloTranche[]>([]);
  const [total, setTotal] = useState(0);
  const [totais, setTotais] = useState<TrancheTotais | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [detalheAberto, setDetalheAberto] = useState<TituloTranche | null>(null);

  const hasActiveFilters = Object.values(filtros).some((value) => value !== "");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetch(
      `/api/tranche?page=${page}&pageSize=${PAGE_SIZE}&sort=${sortKey}&dir=${sortDir}&visao=${visao}&${filtrosParaQueryString(filtros)}${forced ? "&refresh=1" : ""}`,
    )
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setRows(data.rows as TituloTranche[]);
        setTotal(data.total as number);
        setTotais(data.totais as TrancheTotais);
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
  }, [page, sortKey, sortDir, visao, filtros, refreshToken, forced]);

  function handleVisaoChange(value: string) {
    setVisao(value);
    setPage(1);
  }

  function handleAplicarFiltros(novosFiltros: TrancheFiltros) {
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
      setSortDir("asc");
    }
    setPage(1);
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, total);

  const columns = [
    { key: "titulo", label: "Título", width: "10%" },
    { key: "valor", label: "Valor", align: "right" as const, width: "7%" },
    { key: "sacado", label: "Sacado", width: "28%" },
    { key: "cedente", label: "Cedente", width: "28%" },
    { key: "vencimento", label: "Vencimento do Título", width: "9%" },
    { key: "vencimentoTranche", label: "Vencimento da Tranche", width: "9%" },
    { key: "dataBordero", label: "Data do Borderô", width: "9%" },
  ];

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="rounded-2xl border border-cinza-prata/40 bg-white shadow-premium-sm">
        <div className="relative flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-azul-escuro/5 text-azul-escuro">
              <Layers3 size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-azul-escuro">Tranche</h2>
              <p className="text-sm text-azul-escuro/50">
                {isLoading
                  ? "Carregando..."
                  : `${total.toLocaleString("pt-BR")} títulos no total.`}
              </p>
            </div>
          </div>

          <div className="pointer-events-none hidden items-center justify-center lg:absolute lg:inset-0 lg:flex">
            <span className="text-xl font-bold tracking-tight text-azul-escuro">
              {trancheVisaoLabel(visao)}
            </span>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2.5">
              <TrancheVisaoToggle value={visao} onChange={handleVisaoChange} />
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
              <TrancheExportMenu
                sortKey={sortKey}
                sortDir={sortDir}
                filtros={filtros}
                visao={visao}
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
          <FiltrosTrancheInline value={filtros} onApply={handleAplicarFiltros} />
        </RetractableFiltrosPanel>
      </div>

      <div className="grid grid-cols-1">
        <StatCard
          title="Valor Total dos Títulos"
          value={formatBRL(totais?.valor ?? 0)}
          icon={Wallet}
          accent="azul"
          delay={0}
          isLoading={isLoading}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-cinza-prata/40 bg-white shadow-premium-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] table-fixed border-collapse text-left">
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
                      style={{ width: col.width }}
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
                      Carregando títulos...
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
                    <td className="truncate px-4 py-3 text-xs font-medium text-azul-escuro">
                      {row.titulo}
                    </td>
                    <td className="truncate px-4 py-3 text-right text-xs tabular-nums text-azul-escuro">
                      {formatBRL(row.valor)}
                    </td>
                    <td className="truncate px-4 py-3 text-xs text-azul-escuro/80">
                      {row.sacado ?? "—"}
                    </td>
                    <td className="truncate px-4 py-3 text-xs text-azul-escuro/80">
                      {row.cedente ?? "—"}
                    </td>
                    <td className="truncate px-4 py-3 text-xs text-azul-escuro/80">
                      {formatDate(row.vencimento)}
                    </td>
                    <td className="truncate px-4 py-3 text-xs text-azul-escuro/80">
                      {formatDate(row.vencimentoTranche)}
                    </td>
                    <td className="truncate px-4 py-3 text-xs text-azul-escuro/80">
                      {formatDate(row.dataBordero)}
                    </td>
                  </tr>
                ))}

              {!isLoading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-azul-escuro/45">
                    Nenhum título encontrado.
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
        <TituloDetalheModal
          titulo={detalheAberto}
          onClose={() => setDetalheAberto(null)}
        />
      )}
    </div>
  );
}
