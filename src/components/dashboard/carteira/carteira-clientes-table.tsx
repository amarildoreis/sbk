"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Wallet,
  AlertTriangle as RiscoIcon,
  PlusCircle,
  CalendarX,
  CalendarClock,
  Layers,
  FilterX,
  SlidersHorizontal,
} from "lucide-react";
import { useDataRefresh, useIsForcedRefresh } from "../refresh-context";
import { StatCard } from "../stat-card";
import { CarteiraVisaoToggle, visaoLabel } from "./carteira-visao-toggle";
import { CarteiraExportMenu } from "./carteira-export-menu";
import { ClienteDetalheModal } from "./cliente-detalhe-modal";
import { RetractableFiltrosPanel } from "../retractable-filtros-panel";
import { FiltrosCarteiraInline } from "./filtros-carteira-inline";

export interface CarteiraFiltros {
  comercial: string;
  grupoEconomico: string;
  cedente: string;
}

export interface ClienteCarteira {
  codigo: string;
  cedente: string | null;
  comercial: string | null;
  situacao: string | null;
  limiteCredito: number;
  risco: number;
  participacao: number;
  limiteDisponivel: number;
  vencido: number;
  aVencer: number;
  ultimaData: string | null;
  tranche: number;
  taxa: number | null;
  metodo: string | null;
}

interface CarteiraTotais {
  limiteCredito: number;
  risco: number;
  limiteDisponivel: number;
  vencido: number;
  aVencer: number;
  tranche: number;
}

const PAGE_SIZE = 50;

export const SITUACAO_STYLES: Record<string, string> = {
  Liberado: "bg-verde-escuro/10 text-verde-escuro",
  "Em Alerta": "bg-ambar-alerta/10 text-ambar-alerta",
  Bloqueado: "bg-vermelho-risco/10 text-vermelho-risco",
};

export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

type SortDirection = "asc" | "desc";

const FILTROS_VAZIOS: CarteiraFiltros = {
  comercial: "",
  grupoEconomico: "",
  cedente: "",
};

export function CarteiraClientesTable() {
  const { token: refreshToken } = useDataRefresh();
  const forced = useIsForcedRefresh(refreshToken);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("risco");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [visao, setVisao] = useState("");
  const [filtros, setFiltros] = useState<CarteiraFiltros>(FILTROS_VAZIOS);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [rows, setRows] = useState<ClienteCarteira[]>([]);
  const [total, setTotal] = useState(0);
  const [totais, setTotais] = useState<CarteiraTotais | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [detalheAberto, setDetalheAberto] = useState<ClienteCarteira | null>(null);

  const hasActiveFilters = Object.values(filtros).some((value) => value !== "");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      sort: sortKey,
      dir: sortDir,
    });
    if (visao) params.set("visao", visao);
    for (const [key, value] of Object.entries(filtros)) {
      if (value) params.set(key, value);
    }
    if (forced) params.set("refresh", "1");
    fetch(`/api/carteira-clientes?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setRows(data.rows as ClienteCarteira[]);
        setTotal(data.total as number);
        setTotais(data.totais as CarteiraTotais);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar a carteira agora.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sortKey, sortDir, visao, filtros, refreshToken, forced]);

  function handleSort(key: string) {
    if (key === sortKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  }

  function handleVisaoChange(value: string) {
    setVisao(value);
    setPage(1);
  }

  function handleClearFilters() {
    setFiltros(FILTROS_VAZIOS);
    setPage(1);
  }

  function handleAplicarFiltros(novosFiltros: CarteiraFiltros) {
    setFiltros(novosFiltros);
    setPage(1);
    setFiltrosAbertos(false);
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, total);

  const columns = [
    { key: "codigo", label: "Código" },
    { key: "cedente", label: "Cedente" },
    { key: "comercial", label: "Comercial" },
    { key: "situacao", label: "Situação" },
    { key: "limiteCredito", label: "Limite de Crédito", align: "right" as const },
    { key: "risco", label: "Risco Cedente", align: "right" as const },
    { key: "participacao", label: "Participação Cedente", align: "right" as const },
    { key: "limiteDisponivel", label: "Limite Disponível", align: "right" as const },
    { key: "vencido", label: "Vencido", align: "right" as const },
    { key: "aVencer", label: "A Vencer", align: "right" as const },
    { key: "ultimaData", label: "Data do Último Borderô" },
    { key: "tranche", label: "Tranche", align: "right" as const },
    { key: "taxa", label: "Taxa", align: "right" as const },
    { key: "metodo", label: "Método" },
  ];

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="rounded-2xl border border-cinza-prata/40 bg-white shadow-premium-sm">
        <div className="relative flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-azul-escuro/5 text-azul-escuro">
              <Users size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-azul-escuro">Carteira de Clientes</h2>
              <p className="text-sm text-azul-escuro/50">
                {isLoading
                  ? "Carregando..."
                  : `${total.toLocaleString("pt-BR")} cedentes no total.`}
              </p>
            </div>
          </div>

          <div className="pointer-events-none hidden items-center justify-center lg:absolute lg:inset-0 lg:flex">
            <span className="text-xl font-bold tracking-tight text-azul-escuro">
              {visaoLabel(visao)}
            </span>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2.5">
              <CarteiraVisaoToggle value={visao} onChange={handleVisaoChange} />
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
                  onClick={handleClearFilters}
                  title="Limpar filtros"
                  className="flex h-10 items-center gap-2 rounded-xl border border-cinza-prata/60 px-3.5 text-sm font-medium text-azul-escuro/70 transition hover:border-vermelho-risco/40 hover:bg-vermelho-risco/5 hover:text-vermelho-risco"
                >
                  <FilterX size={16} strokeWidth={1.75} />
                  Limpar
                </button>
              )}
              <CarteiraExportMenu
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
          <FiltrosCarteiraInline value={filtros} onApply={handleAplicarFiltros} />
        </RetractableFiltrosPanel>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          title="Limite de Crédito"
          value={formatBRL(totais?.limiteCredito ?? 0)}
          icon={Wallet}
          accent="azul"
          delay={0}
          isLoading={isLoading}
        />
        <StatCard
          title="Risco"
          value={formatBRL(totais?.risco ?? 0)}
          icon={RiscoIcon}
          accent="ambar"
          delay={60}
          isLoading={isLoading}
        />
        <StatCard
          title="Limite Disponível"
          value={formatBRL(totais?.limiteDisponivel ?? 0)}
          icon={PlusCircle}
          accent="verde"
          delay={120}
          isLoading={isLoading}
        />
        <StatCard
          title="Vencido"
          value={formatBRL(totais?.vencido ?? 0)}
          icon={CalendarX}
          accent="vermelho"
          delay={180}
          isLoading={isLoading}
          danger
        />
        <StatCard
          title="A Vencer"
          value={formatBRL(totais?.aVencer ?? 0)}
          icon={CalendarClock}
          accent="azulMedio"
          delay={240}
          isLoading={isLoading}
        />
        <StatCard
          title="Tranche"
          value={formatBRL(totais?.tranche ?? 0)}
          icon={Layers}
          accent="azul"
          delay={300}
          isLoading={isLoading}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-cinza-prata/40 bg-white shadow-premium-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px] border-collapse text-left">
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
                      Carregando carteira...
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
                    key={row.codigo}
                    onClick={() => setSelectedRowId(row.codigo)}
                    onDoubleClick={() => setDetalheAberto(row)}
                    className={`cursor-pointer border-b border-cinza-prata/25 transition-colors last:border-0 hover:bg-azul-medio/5 ${
                      selectedRowId === row.codigo ? "bg-azul-medio/10" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-azul-escuro">
                      {row.codigo}
                    </td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-xs text-azul-escuro/80">
                      {row.cedente ?? "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs text-azul-escuro/80">
                      {row.comercial ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {row.situacao ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                            SITUACAO_STYLES[row.situacao] ?? "bg-cinza-prata/20 text-azul-escuro/70"
                          }`}
                        >
                          {row.situacao}
                        </span>
                      ) : (
                        <span className="text-xs text-azul-escuro/40">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-azul-escuro">
                      {formatBRL(row.limiteCredito)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-azul-escuro">
                      {formatBRL(row.risco)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-azul-escuro">
                      {formatPercent(row.participacao)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-azul-escuro">
                      {formatBRL(row.limiteDisponivel)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-azul-escuro">
                      {formatBRL(row.vencido)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-azul-escuro">
                      {formatBRL(row.aVencer)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-azul-escuro/80">
                      {formatDate(row.ultimaData)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-azul-escuro">
                      {formatBRL(row.tranche)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-azul-escuro">
                      {row.taxa === null ? "—" : formatPercent(row.taxa * 100)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-azul-escuro/80">
                      {row.metodo ?? "—"}
                    </td>
                  </tr>
                ))}

              {!isLoading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-azul-escuro/45">
                    Nenhum cedente encontrado.
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
        <ClienteDetalheModal cliente={detalheAberto} onClose={() => setDetalheAberto(null)} />
      )}
    </div>
  );
}
