"use client";

import { useEffect, useState } from "react";
import {
  Briefcase,
  Building2,
  Users,
  FileText,
  Hash,
  ClipboardList,
  CalendarRange,
  Check,
} from "lucide-react";
import {
  ComercialSistemaSelect,
  type ComercialSistema,
} from "../comercial-sistema-select";
import { FiltroSelect, type FiltroOption } from "../titulos/filtro-select";
import { FiltroBuscaSelect } from "../titulos/filtro-busca-select";
import { DateInput } from "../date-input";
import { useAccessScope } from "../use-access-scope";
import { LockedFiltroField } from "../locked-filtro-field";
import type { ComissoesFiltros } from "./comissoes-table";

const TODOS: ComercialSistema = { codigo: "", nome: "Todos", email: null };

const STATUS_PAGAMENTO_OPTIONS = ["A Vencer", "Vencido", "Pago Em Dia", "Pago Vencido"];
const TIPO_PAGAMENTO_OPTIONS: FiltroOption[] = [
  { value: "Pagamento Parcial", label: "Pagamento Parcial" },
  { value: "Pagamento Total", label: "Pagamento Total" },
];

function Secao({
  icon: Icon,
  titulo,
  children,
}: {
  icon: React.ElementType;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-azul-escuro/80">
        <Icon size={14} strokeWidth={1.75} className="text-azul-escuro/40" />
        {titulo}
      </p>
      {children}
    </div>
  );
}

// Conteúdo do painel retrátil de filtros de Comissões — mesmos 11 filtros e
// mesmo efeito cascata da antiga popup (filtros-comissoes-popup.tsx,
// removida), agora embutidos na própria tela — mesmo padrão adotado em
// Borderôs Liberados/Títulos/Carteira de Clientes/Comportamental (CLAUDE.md,
// 2026-07-16). Estado próprio (staged) — só vira o filtro aplicado de fato
// quando "Aplicar filtros" é clicado; reflete de volta pro valor aplicado
// sempre que ele mudar por fora (ex: clique em "Limpar" no header).
export function FiltrosComissoesInline({
  value,
  onApply,
}: {
  value: ComissoesFiltros;
  onApply: (filtros: ComissoesFiltros) => void;
}) {
  const scope = useAccessScope();
  const [comercial, setComercial] = useState(value.comercial);
  const [grupoCedente, setGrupoCedente] = useState(value.grupoCedente);
  const [grupoSacado, setGrupoSacado] = useState(value.grupoSacado);
  const [bordero, setBordero] = useState(value.bordero);
  const [borderoLabel, setBorderoLabel] = useState(value.borderoLabel);
  const [titulo, setTitulo] = useState(value.titulo);
  const [cedente, setCedente] = useState(value.cedente);
  const [sacado, setSacado] = useState(value.sacado);
  const [sacadoLabel, setSacadoLabel] = useState(value.sacadoLabel);
  const [situacao, setSituacao] = useState(value.situacao);
  const [statusPagamento, setStatusPagamento] = useState<string[]>(
    value.statusPagamento ? value.statusPagamento.split("|") : [],
  );
  const [tipoPagamento, setTipoPagamento] = useState(value.tipoPagamento);
  const [dataCompraInicio, setDataCompraInicio] = useState(value.dataCompraInicio);
  const [dataCompraFim, setDataCompraFim] = useState(value.dataCompraFim);
  const [dataPagamentoInicio, setDataPagamentoInicio] = useState(value.dataPagamentoInicio);
  const [dataPagamentoFim, setDataPagamentoFim] = useState(value.dataPagamentoFim);
  const [vencimentoInicio, setVencimentoInicio] = useState(value.vencimentoInicio);
  const [vencimentoFim, setVencimentoFim] = useState(value.vencimentoFim);

  const [comerciais, setComerciais] = useState<ComercialSistema[]>([TODOS]);
  const [isLoadingComerciais, setIsLoadingComerciais] = useState(true);
  const [gruposCedente, setGruposCedente] = useState<FiltroOption[]>([]);
  const [isLoadingGruposCedente, setIsLoadingGruposCedente] = useState(true);
  const [gruposSacado, setGruposSacado] = useState<FiltroOption[]>([]);
  const [isLoadingGruposSacado, setIsLoadingGruposSacado] = useState(true);
  const [cedentes, setCedentes] = useState<FiltroOption[]>([]);
  const [isLoadingCedentes, setIsLoadingCedentes] = useState(true);
  const [situacoes, setSituacoes] = useState<FiltroOption[]>([]);
  const [isLoadingSituacoes, setIsLoadingSituacoes] = useState(true);

  // Sincroniza o estado local (staged) sempre que o filtro aplicado muda
  // por fora — ex: "Limpar" no header.
  useEffect(() => {
    setComercial(value.comercial);
    setGrupoCedente(value.grupoCedente);
    setGrupoSacado(value.grupoSacado);
    setBordero(value.bordero);
    setBorderoLabel(value.borderoLabel);
    setTitulo(value.titulo);
    setCedente(value.cedente);
    setSacado(value.sacado);
    setSacadoLabel(value.sacadoLabel);
    setSituacao(value.situacao);
    setStatusPagamento(value.statusPagamento ? value.statusPagamento.split("|") : []);
    setTipoPagamento(value.tipoPagamento);
    setDataCompraInicio(value.dataCompraInicio);
    setDataCompraFim(value.dataCompraFim);
    setDataPagamentoInicio(value.dataPagamentoInicio);
    setDataPagamentoFim(value.dataPagamentoFim);
    setVencimentoInicio(value.vencimentoInicio);
    setVencimentoFim(value.vencimentoFim);
  }, [value]);

  // Trava de acesso por perfil (CLAUDE.md, 2026-07-18) — Comercial/Cedente/
  // Sacado só veem os próprios dados; força o campo pro próprio valor,
  // ignorando qualquer seleção anterior. A trava de verdade é sempre no
  // servidor (applyAccessScope) — isto é só a pré-seleção/UX.
  useEffect(() => {
    if (scope.comercial.locked) setComercial(scope.comercial.codigo);
    if (scope.cedente.locked) setCedente(scope.cedente.codigo);
    if (scope.sacado.locked) {
      setSacado(scope.sacado.codigo);
      setSacadoLabel(scope.sacado.label);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.comercial.locked, scope.cedente.locked, scope.sacado.locked]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/operadores-indicante")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setComerciais([TODOS, ...(data.operadores as ComercialSistema[])]);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingComerciais(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Efeito cascata: Grupo Econômico Cedente reflete o Comercial já
  // escolhido.
  useEffect(() => {
    let cancelled = false;
    setIsLoadingGruposCedente(true);
    const params = new URLSearchParams();
    if (comercial) params.set("comercial", comercial);
    fetch(`/api/comissoes/grupos-economicos-cedente?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        const lista = data.grupos as { id: number; nome: string | null }[];
        const opts = lista.map((g) => ({
          value: String(g.id),
          label: `${g.id} - ${g.nome ?? "(sem nome)"}`,
        }));
        setGruposCedente(opts);
        if (grupoCedente && !lista.some((g) => String(g.id) === grupoCedente)) {
          setGrupoCedente("");
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingGruposCedente(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comercial]);

  // Efeito cascata: Grupo Econômico Sacado reflete o Comercial já escolhido.
  useEffect(() => {
    let cancelled = false;
    setIsLoadingGruposSacado(true);
    const params = new URLSearchParams();
    if (comercial) params.set("comercial", comercial);
    fetch(`/api/comissoes/grupos-economicos-sacado?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        const lista = data.grupos as { id: number; nome: string | null }[];
        const opts = lista.map((g) => ({
          value: String(g.id),
          label: `${g.id} - ${g.nome ?? "(sem nome)"}`,
        }));
        setGruposSacado(opts);
        if (grupoSacado && !lista.some((g) => String(g.id) === grupoSacado)) {
          setGrupoSacado("");
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingGruposSacado(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comercial]);

  // Efeito cascata: Cedente reflete Comercial e Grupo Econômico Cedente já
  // escolhidos.
  useEffect(() => {
    let cancelled = false;
    setIsLoadingCedentes(true);
    const params = new URLSearchParams();
    if (comercial) params.set("comercial", comercial);
    if (grupoCedente) params.set("grupoCedente", grupoCedente);
    fetch(`/api/comissoes/cedentes?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        const lista = data.cedentes as { codigo: string; nome: string | null; cgc: string | null }[];
        const opts = lista.map((c) => ({
          value: c.codigo,
          label: `${c.codigo} - ${c.nome ?? "(sem nome)"}${c.cgc ? ` - ${c.cgc}` : ""}`,
        }));
        setCedentes(opts);
        if (cedente && !lista.some((c) => c.codigo === cedente)) {
          setCedente("");
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingCedentes(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comercial, grupoCedente]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/comissoes/situacoes")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        const opts = (data.situacoes as string[]).map((s) => ({ value: s, label: s }));
        setSituacoes(opts);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingSituacoes(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleStatus(status: string) {
    setStatusPagamento((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  }

  function handleAplicar() {
    onApply({
      comercial,
      grupoCedente,
      grupoSacado,
      bordero,
      borderoLabel,
      titulo,
      cedente,
      sacado,
      sacadoLabel,
      situacao,
      statusPagamento: statusPagamento.join("|"),
      tipoPagamento,
      dataCompraInicio,
      dataCompraFim,
      dataPagamentoInicio,
      dataPagamentoFim,
      vencimentoInicio,
      vencimentoFim,
    });
  }

  return (
    <div className="border-t border-cinza-prata/40 bg-surface-alt/60 px-6 py-12">
      <div className="grid grid-cols-1 gap-x-6 gap-y-9 sm:grid-cols-2 xl:grid-cols-3">
        <Secao icon={Briefcase} titulo="Comercial">
          {scope.comercial.locked ? (
            <LockedFiltroField label={scope.comercial.label} />
          ) : (
            <ComercialSistemaSelect
              value={comercial}
              onChange={setComercial}
              options={comerciais}
              isLoading={isLoadingComerciais}
              placeholder="Todos"
            />
          )}
        </Secao>

        <Secao icon={Building2} titulo="Grupo Econômico Cedente">
          <FiltroSelect
            value={grupoCedente}
            onChange={setGrupoCedente}
            options={gruposCedente}
            isLoading={isLoadingGruposCedente}
            placeholder="Todos"
          />
        </Secao>

        <Secao icon={Building2} titulo="Grupo Econômico Sacado">
          <FiltroSelect
            value={grupoSacado}
            onChange={setGrupoSacado}
            options={gruposSacado}
            isLoading={isLoadingGruposSacado}
            placeholder="Todos"
          />
        </Secao>

        <Secao icon={Users} titulo="Cedente">
          {scope.cedente.locked ? (
            <LockedFiltroField label={scope.cedente.label} />
          ) : (
            <FiltroSelect
              value={cedente}
              onChange={setCedente}
              options={cedentes}
              isLoading={isLoadingCedentes}
              placeholder="Todos"
            />
          )}
        </Secao>

        <Secao icon={Users} titulo="Sacado">
          {scope.sacado.locked ? (
            <LockedFiltroField label={scope.sacado.label} />
          ) : (
            <FiltroBuscaSelect
              value={sacado}
              label={sacadoLabel}
              onChange={(v, label) => {
                setSacado(v);
                setSacadoLabel(label);
              }}
              endpoint={`/api/comissoes/sacados?${new URLSearchParams({
                ...(comercial && { comercial }),
                ...(grupoSacado && { grupoSacado }),
              }).toString()}`}
              minChars={2}
              placeholder="Código, nome ou CNPJ..."
              mapResults={(data) =>
                (
                  data as {
                    sacados: { codigo: string; nome: string; cgc: string | null }[];
                  }
                ).sacados.map((s) => ({
                  value: s.codigo,
                  label: `${s.codigo} - ${s.nome}${s.cgc ? ` - ${s.cgc}` : ""}`,
                }))
              }
            />
          )}
        </Secao>

        <Secao icon={FileText} titulo="Borderô">
          <FiltroBuscaSelect
            value={bordero}
            label={borderoLabel}
            onChange={(v, label) => {
              setBordero(v);
              setBorderoLabel(label);
            }}
            endpoint="/api/comissoes/borderos"
            placeholder="Número do borderô..."
            mapResults={(data) =>
              (data as { borderos: string[] }).borderos.map((b) => ({
                value: b,
                label: b,
              }))
            }
          />
        </Secao>

        <Secao icon={Hash} titulo="Título">
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Número do título..."
            autoComplete="off"
            className="w-full rounded-xl border border-cinza-prata/70 bg-white py-2.5 px-3.5 text-sm text-azul-escuro placeholder:text-azul-escuro/35 outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10"
          />
        </Secao>

        <Secao icon={ClipboardList} titulo="Situação">
          <FiltroSelect
            value={situacao}
            onChange={setSituacao}
            options={situacoes}
            isLoading={isLoadingSituacoes}
            placeholder="Todos"
          />
        </Secao>

        <Secao icon={ClipboardList} titulo="Tipo de Pagamento">
          <FiltroSelect
            value={tipoPagamento}
            onChange={setTipoPagamento}
            options={TIPO_PAGAMENTO_OPTIONS}
            placeholder="Todos"
          />
        </Secao>

        <Secao icon={CalendarRange} titulo="Data da Compra">
          <div className="flex gap-2">
            <DateInput value={dataCompraInicio} onChange={setDataCompraInicio} label="Início" />
            <DateInput value={dataCompraFim} onChange={setDataCompraFim} label="Fim" />
          </div>
        </Secao>

        <Secao icon={CalendarRange} titulo="Data do Pagamento">
          <div className="flex gap-2">
            <DateInput
              value={dataPagamentoInicio}
              onChange={setDataPagamentoInicio}
              label="Início"
            />
            <DateInput value={dataPagamentoFim} onChange={setDataPagamentoFim} label="Fim" />
          </div>
        </Secao>

        <Secao icon={CalendarRange} titulo="Data do Vencimento">
          <div className="flex gap-2">
            <DateInput value={vencimentoInicio} onChange={setVencimentoInicio} label="Início" />
            <DateInput value={vencimentoFim} onChange={setVencimentoFim} label="Fim" />
          </div>
        </Secao>

        <Secao icon={ClipboardList} titulo="Status do Pagamento">
          <div className="flex flex-wrap gap-2">
            {STATUS_PAGAMENTO_OPTIONS.map((status) => {
              const checked = statusPagamento.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatus(status)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    checked
                      ? "border-azul-medio bg-azul-medio/10 text-azul-escuro"
                      : "border-cinza-prata/60 text-azul-escuro/60 hover:bg-surface-alt"
                  }`}
                >
                  {status}
                </button>
              );
            })}
          </div>
        </Secao>
      </div>

      <div className="mt-10 flex justify-end border-t border-cinza-prata/30 pt-7">
        <button
          onClick={handleAplicar}
          className="flex items-center gap-2 rounded-xl bg-azul-escuro px-5 py-2.5 text-sm font-semibold text-white shadow-premium-sm transition hover:bg-azul-medio active:scale-[0.99]"
        >
          <Check size={16} strokeWidth={2} />
          Aplicar filtros
        </button>
      </div>
    </div>
  );
}
