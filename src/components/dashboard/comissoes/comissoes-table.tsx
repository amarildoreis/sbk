"use client";

import { useEffect, useState } from "react";
import {
  Percent,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Wallet,
  TrendingDown,
  CircleDollarSign,
  FilterX,
  SlidersHorizontal,
} from "lucide-react";
import { useDataRefresh, useIsForcedRefresh } from "../refresh-context";
import { StatCard } from "../stat-card";
import { ComissoesExportMenu } from "./comissoes-export-menu";
import { RetractableFiltrosPanel } from "../retractable-filtros-panel";
import { FiltrosComissoesInline } from "./filtros-comissoes-inline";

export interface ComissaoTitulo {
  id: number;
  titulo: string;
  cedente: string | null;
  sacado: string | null;
  bordero: number | null;
  indicanteOperador: string | null;
  /** "Interno"/"Externo" via tabela usuarios (perfil Comercial) — "—" quando
   * o título não tem indicante/operador nenhum (CLAUDE.md 19.6/21.9). */
  tipo: string | null;
  dataCompra: string | null;
  valorTitulo: number;
  statusPagamento: string | null;
  tipoPagamento: string | null;
  desagio: number;
  taxa: number | null;
  faixaComissao: number | null;
  comissao: number;
  vencimento: string | null;
  dataPagamento: string | null;
}

interface ComissoesTotais {
  valorTitulo: number;
  desagio: number;
  comissao: number;
}

// Mesmos 11 filtros do Relatório Analítico de Títulos (mesma popup, mesmo
// layout — a pedido do cliente em 2026-07-16).
export interface ComissoesFiltros {
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

const FILTROS_VAZIOS: ComissoesFiltros = {
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

function filtrosParaQueryString(filtros: ComissoesFiltros) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filtros)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

const PAGE_SIZE = 50;

const STATUS_STYLES: Record<string, string> = {
  Vencido: "bg-vermelho-risco/10 text-vermelho-risco",
  "A Vencer": "bg-ambar-alerta/10 text-ambar-alerta",
  "Pago Em Dia": "bg-verde-escuro/10 text-verde-escuro",
  "Pago Vencido": "bg-verde-claro/10 text-verde-claro",
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Taxa (JUROS_MENSAL) é uma fração (0,0226 = 2,26%) — multiplica por 100.
// 4 casas decimais (pedido do cliente em 2026-07-17) — 2 casas arredondava
// demais taxas com valor pequeno após a vírgula.
function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${(value * 100).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%`;
}

// Faixa de Comissão já vem em escala percentual "crua" do banco (3 = 3%,
// mesmo formato de /dashboard/faixas-comissao) — só formata, sem multiplicar.
function formatPercentRaw(value: number | null) {
  if (value === null) return "—";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

type SortDirection = "asc" | "desc";

// Relatório de Comissões (CLAUDE.md seção 9 / 19.6) — mesmo padrão de tela
// do Relatório Analítico de Títulos e Carteira de Clientes: tabela paginada
// e ordenável no servidor, cards totalizadores (Valor do Título, Deságio,
// Comissão), filtros em popup (mesmos 11 filtros, mesmo layout/tamanho de
// Títulos) e exportação/e-mail — confirmado pelo cliente em 2026-07-16.
export function ComissoesTable() {
  const { token: refreshToken } = useDataRefresh();
  const forced = useIsForcedRefresh(refreshToken);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("vencimento");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [filtros, setFiltros] = useState<ComissoesFiltros>(FILTROS_VAZIOS);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [rows, setRows] = useState<ComissaoTitulo[]>([]);
  const [total, setTotal] = useState(0);
  const [totais, setTotais] = useState<ComissoesTotais | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);

  const hasActiveFilters = Object.entries(filtros).some(
    ([key, value]) => value !== "" && key !== "borderoLabel" && key !== "sacadoLabel",
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetch(
      `/api/comissoes?page=${page}&pageSize=${PAGE_SIZE}&sort=${sortKey}&dir=${sortDir}&${filtrosParaQueryString(filtros)}${forced ? "&refresh=1" : ""}`,
    )
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setRows(data.rows as ComissaoTitulo[]);
        setTotal(data.total as number);
        setTotais(data.totais as ComissoesTotais);
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

  function handleAplicarFiltros(novosFiltros: ComissoesFiltros) {
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
    { key: "bordero", label: "Borderô" },
    { key: "indicanteOperador", label: "Indicante/Operador" },
    { key: "tipo", label: "Tipo" },
    { key: "dataCompra", label: "Data da Compra" },
    { key: "valorTitulo", label: "Valor do Título", align: "right" as const },
    { key: "statusPagamento", label: "Status do Pagamento" },
    { key: "tipoPagamento", label: "Tipo do Pagamento" },
    { key: "desagio", label: "Deságio", align: "right" as const },
    { key: "taxa", label: "Taxa", align: "right" as const },
    { key: "faixaComissao", label: "Faixa de Comissão", align: "right" as const },
    { key: "comissao", label: "Comissão", align: "right" as const },
    { key: "vencimento", label: "Data de Vencimento" },
    { key: "dataPagamento", label: "Data de Pagamento" },
  ];

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="rounded-2xl border border-cinza-prata/40 bg-white shadow-premium-sm">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-azul-escuro/5 text-azul-escuro">
              <Percent size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-azul-escuro">Comissões</h2>
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
              <ComissoesExportMenu
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
          <FiltrosComissoesInline value={filtros} onApply={handleAplicarFiltros} />
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
          title="Valor Total do Deságio"
          value={formatBRL(totais?.desagio ?? 0)}
          icon={TrendingDown}
          accent="ambar"
          delay={60}
          isLoading={isLoading}
          compact
        />
        <StatCard
          title="Valor Total da Comissão"
          value={formatBRL(totais?.comissao ?? 0)}
          icon={CircleDollarSign}
          accent="verde"
          delay={120}
          isLoading={isLoading}
          compact
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-cinza-prata/40 bg-white shadow-premium-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1700px] border-collapse text-left">
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
                      Carregando comissões...
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
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-azul-escuro/80">
                      {row.bordero ?? "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs text-azul-escuro/80">
                      {row.indicanteOperador ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-azul-escuro/80">
                      {row.tipo ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-azul-escuro/80">
                      {formatDate(row.dataCompra)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-azul-escuro">
                      {formatBRL(row.valorTitulo)}
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
                      {row.tipoPagamento ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-azul-escuro">
                      {formatBRL(row.desagio)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-azul-escuro">
                      {formatPercent(row.taxa)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-azul-escuro">
                      {formatPercentRaw(row.faixaComissao)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold tabular-nums text-azul-escuro">
                      {formatBRL(row.comissao)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-azul-escuro/80">
                      {formatDate(row.vencimento)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-azul-escuro/80">
                      {formatDate(row.dataPagamento)}
                    </td>
                  </tr>
                ))}

              {!isLoading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-azul-escuro/45">
                    Nenhuma comissão encontrada.
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
    </div>
  );
}
