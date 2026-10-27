"use client";

import { useEffect, useState } from "react";
import {
  FileBarChart2,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  FilterX,
  SlidersHorizontal,
  Wallet,
  CircleDollarSign,
  Scale,
} from "lucide-react";
import { useDataRefresh, useIsForcedRefresh } from "../refresh-context";
import { TitulosExportMenu } from "./titulos-export-menu";
import { TituloDetalheModal } from "./titulo-detalhe-modal";
import { StatCard } from "../stat-card";
import { RetractableFiltrosPanel } from "../retractable-filtros-panel";
import { FiltrosTitulosInline } from "./filtros-titulos-inline";

interface RelatorioTotais {
  valorTitulo: number;
  valorPagamento: number;
  saldoTitulo: number;
}

export interface TituloRelatorio {
  id: number;
  titulo: string;
  cedente: string | null;
  sacado: string | null;
  indicanteOperador: string | null;
  valorTitulo: number;
  valorPagamento: number;
  saldoTitulo: number;
  vencimento: string | null;
  dataCompra: string | null;
  dataPagamento: string | null;
  statusPagamento: string | null;
  bordero: number | null;
  tipoPagamento: string | null;
  situacao: string | null;
  diasAtraso: number | null;
}

const PAGE_SIZE = 50;

export interface TitulosFiltros {
  comercial: string;
  grupoCedente: string;
  grupoSacado: string;
  bordero: string;
  borderoLabel: string;
  titulo: string;
  cedente: string;
  sacado: string;
  sacadoLabel: string;
  situacao: string;
  statusPagamento: string;
  tipoPagamento: string;
  dataCompraInicio: string;
  dataCompraFim: string;
  dataPagamentoInicio: string;
  dataPagamentoFim: string;
  vencimentoInicio: string;
  vencimentoFim: string;
}

const FILTROS_VAZIOS: TitulosFiltros = {
  comercial: "",
  grupoCedente: "",
  grupoSacado: "",
  bordero: "",
  borderoLabel: "",
  titulo: "",
  cedente: "",
  sacado: "",
  sacadoLabel: "",
  situacao: "",
  statusPagamento: "",
  tipoPagamento: "",
  dataCompraInicio: "",
  dataCompraFim: "",
  dataPagamentoInicio: "",
  dataPagamentoFim: "",
  vencimentoInicio: "",
  vencimentoFim: "",
};

function filtrosParaQueryString(filtros: TitulosFiltros) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filtros)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export const STATUS_STYLES: Record<string, string> = {
  Vencido: "bg-vermelho-risco/10 text-vermelho-risco",
  "A Vencer": "bg-ambar-alerta/10 text-ambar-alerta",
  "Pago Em Dia": "bg-verde-escuro/10 text-verde-escuro",
  "Pago Vencido": "bg-verde-claro/10 text-verde-claro",
};

export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

type SortDirection = "asc" | "desc";

export function TitulosTable() {
  const { token: refreshToken } = useDataRefresh();
  const forced = useIsForcedRefresh(refreshToken);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("vencimento");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [filtros, setFiltros] = useState<TitulosFiltros>(FILTROS_VAZIOS);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [rows, setRows] = useState<TituloRelatorio[]>([]);
  const [total, setTotal] = useState(0);
  const [totais, setTotais] = useState<RelatorioTotais | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [detalheAberto, setDetalheAberto] = useState<TituloRelatorio | null>(null);

  const hasActiveFilters = Object.entries(filtros).some(
    ([key, value]) => value !== "" && key !== "borderoLabel" && key !== "sacadoLabel",
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetch(
      `/api/relatorio-titulos?page=${page}&pageSize=${PAGE_SIZE}&sort=${sortKey}&dir=${sortDir}&${filtrosParaQueryString(filtros)}${forced ? "&refresh=1" : ""}`,
    )
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setRows(data.rows as TituloRelatorio[]);
        setTotal(data.total as number);
        setTotais(data.totais as RelatorioTotais);
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

  function handleSort(key: string) {
    if (key === sortKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  function handleClearFilters() {
    setFiltros(FILTROS_VAZIOS);
    setPage(1);
  }

  function handleAplicarFiltros(novosFiltros: TitulosFiltros) {
    setFiltros(novosFiltros);
    setPage(1);
    setFiltrosAbertos(false);
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, total);

  const columns = [
    { key: "titulo", label: "Título" },
    { key: "cedente", label: "Cedente" },
    { key: "sacado", label: "Sacado" },
    { key: "indicanteOperador", label: "Indicante/Operador" },
    { key: "valorTitulo", label: "Valor do Título", align: "right" as const },
    { key: "valorPagamento", label: "Valor do Pagamento", align: "right" as const },
    { key: "saldoTitulo", label: "Saldo do Título", align: "right" as const },
    { key: "vencimento", label: "Data do Vencimento" },
    { key: "dataCompra", label: "Data da Compra" },
    { key: "dataPagamento", label: "Data do Pagamento" },
    { key: "statusPagamento", label: "Status do Pagamento" },
    { key: "bordero", label: "Borderô" },
    { key: "tipoPagamento", label: "Tipo do Pagamento" },
    { key: "situacao", label: "Situação" },
    { key: "diasAtraso", label: "Dias de Atraso", align: "right" as const },
  ];

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="rounded-2xl border border-cinza-prata/40 bg-white shadow-premium-sm">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-azul-escuro/5 text-azul-escuro">
              <FileBarChart2 size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-azul-escuro">
                Relatório Analítico de Títulos
              </h2>
              <p className="text-sm text-azul-escuro/50">
                {isLoading
                  ? "Carregando..."
                  : `${total.toLocaleString("pt-BR")} títulos no total.`}
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
                  onClick={handleClearFilters}
                  title="Limpar filtros"
                  className="flex h-10 items-center gap-2 rounded-xl border border-cinza-prata/60 px-3.5 text-sm font-medium text-azul-escuro/70 transition hover:border-vermelho-risco/40 hover:bg-vermelho-risco/5 hover:text-vermelho-risco"
                >
                  <FilterX size={16} strokeWidth={1.75} />
                  Limpar
                </button>
              )}
              <TitulosExportMenu
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
          <FiltrosTitulosInline value={filtros} onApply={handleAplicarFiltros} />
        </RetractableFiltrosPanel>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-5">
        <StatCard
          title="Valor Total dos Títulos"
          value={formatBRL(totais?.valorTitulo ?? 0)}
          icon={Wallet}
          accent="azul"
          delay={0}
          isLoading={isLoading}
          compact
        />
        <StatCard
          title="Valor Total dos Pagamentos"
          value={formatBRL(totais?.valorPagamento ?? 0)}
          icon={CircleDollarSign}
          accent="verde"
          delay={60}
          isLoading={isLoading}
          compact
        />
        <StatCard
          title="Valor Total do Saldo dos Títulos"
          value={formatBRL(totais?.saldoTitulo ?? 0)}
          icon={Scale}
          accent="ambar"
          delay={120}
          isLoading={isLoading}
          compact
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-cinza-prata/40 bg-white shadow-premium-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1600px] border-collapse text-left">
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
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-azul-escuro">
                      {row.titulo}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-xs text-azul-escuro/80">
                      {row.cedente ?? "—"}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-xs text-azul-escuro/80">
                      {row.sacado ?? "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs text-azul-escuro/80">
                      {row.indicanteOperador ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-azul-escuro">
                      {formatBRL(row.valorTitulo)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-azul-escuro">
                      {formatBRL(row.valorPagamento)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-azul-escuro">
                      {formatBRL(row.saldoTitulo)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-azul-escuro/80">
                      {formatDate(row.vencimento)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-azul-escuro/80">
                      {formatDate(row.dataCompra)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-azul-escuro/80">
                      {formatDate(row.dataPagamento)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {row.statusPagamento && (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                            STATUS_STYLES[row.statusPagamento] ?? "bg-cinza-prata/20 text-azul-escuro/70"
                          }`}
                        >
                          {row.statusPagamento}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-azul-escuro/80">
                      {row.bordero ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-azul-escuro/80">
                      {row.tipoPagamento ?? "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs text-azul-escuro/80">
                      {row.situacao ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-azul-escuro">
                      {row.diasAtraso ?? "—"}
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
