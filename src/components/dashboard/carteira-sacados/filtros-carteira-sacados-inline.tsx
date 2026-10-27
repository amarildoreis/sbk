"use client";

import { useEffect, useState } from "react";
import { Briefcase, Building2, Users, Check } from "lucide-react";
import {
  ComercialSistemaSelect,
  type ComercialSistema,
} from "../comercial-sistema-select";
import { FiltroSelect, type FiltroOption } from "../titulos/filtro-select";
import { FiltroBuscaSelect } from "../titulos/filtro-busca-select";
import { useAccessScope } from "../use-access-scope";
import { LockedFiltroField } from "../locked-filtro-field";
import type { CarteiraSacadosFiltros } from "./carteira-sacados-table";

const TODOS: ComercialSistema = { codigo: "", nome: "Todos", email: null };

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

// Conteúdo do painel retrátil de filtros de Carteira de Sacados — os 5
// filtros confirmados pelo cliente em 2026-07-16 (Comercial, Grupo
// Econômico Cedente, Grupo Econômico Sacado, Cedente, Sacado), mesmo
// efeito cascata de Títulos/Comissões e mesmas queries de cascata
// (universo SIGFIDC idêntico) — mesmo padrão retrátil de Borderôs
// Liberados/Títulos/Carteira de Clientes/Comportamental/Comissões.
export function FiltrosCarteiraSacadosInline({
  value,
  onApply,
}: {
  value: CarteiraSacadosFiltros;
  onApply: (filtros: CarteiraSacadosFiltros) => void;
}) {
  const scope = useAccessScope();
  const [comercial, setComercial] = useState(value.comercial);
  const [grupoCedente, setGrupoCedente] = useState(value.grupoCedente);
  const [grupoSacado, setGrupoSacado] = useState(value.grupoSacado);
  const [cedente, setCedente] = useState(value.cedente);
  const [sacado, setSacado] = useState(value.sacado);
  const [sacadoLabel, setSacadoLabel] = useState(value.sacadoLabel);

  const [comerciais, setComerciais] = useState<ComercialSistema[]>([TODOS]);
  const [isLoadingComerciais, setIsLoadingComerciais] = useState(true);
  const [gruposCedente, setGruposCedente] = useState<FiltroOption[]>([]);
  const [isLoadingGruposCedente, setIsLoadingGruposCedente] = useState(true);
  const [gruposSacado, setGruposSacado] = useState<FiltroOption[]>([]);
  const [isLoadingGruposSacado, setIsLoadingGruposSacado] = useState(true);
  const [cedentes, setCedentes] = useState<FiltroOption[]>([]);
  const [isLoadingCedentes, setIsLoadingCedentes] = useState(true);

  // Sincroniza o estado local (staged) sempre que o filtro aplicado muda
  // por fora — ex: "Limpar" no header.
  useEffect(() => {
    setComercial(value.comercial);
    setGrupoCedente(value.grupoCedente);
    setGrupoSacado(value.grupoSacado);
    setCedente(value.cedente);
    setSacado(value.sacado);
    setSacadoLabel(value.sacadoLabel);
  }, [value]);

  // Trava de acesso por perfil (CLAUDE.md, 2026-07-18) — Comercial/Cedente/
  // Sacado só veem os próprios dados; força o campo pro próprio valor. A
  // trava de verdade é sempre no servidor (applyAccessScope), isto é só a
  // pré-seleção/UX.
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
    fetch(`/api/carteira-sacados/grupos-economicos-cedente?${params.toString()}`)
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
    fetch(`/api/carteira-sacados/grupos-economicos-sacado?${params.toString()}`)
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
    fetch(`/api/carteira-sacados/cedentes?${params.toString()}`)
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

  function handleAplicar() {
    onApply({ comercial, grupoCedente, grupoSacado, cedente, sacado, sacadoLabel });
  }

  return (
    <div className="border-t border-cinza-prata/40 bg-surface-alt/60 px-6 py-12">
      <div className="grid grid-cols-1 gap-x-6 gap-y-9 sm:grid-cols-2 xl:grid-cols-3">
        <Secao icon={Briefcase} titulo="Comercial">
          {scope.comercial.locked ? (
            <LockedFiltroField label={scope.comercial.label} />
          ) : (
            <ComercialSistemaSelect
              value={comercial ?? ""}
              onChange={setComercial}
              options={comerciais}
              isLoading={isLoadingComerciais}
              placeholder="Todos"
            />
          )}
        </Secao>

        <Secao icon={Building2} titulo="Grupo Econômico Cedente">
          <FiltroSelect
            value={grupoCedente ?? ""}
            onChange={setGrupoCedente}
            options={gruposCedente}
            isLoading={isLoadingGruposCedente}
            placeholder="Todos"
          />
        </Secao>

        <Secao icon={Building2} titulo="Grupo Econômico Sacado">
          <FiltroSelect
            value={grupoSacado ?? ""}
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
              value={cedente ?? ""}
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
              value={sacado ?? ""}
              label={sacadoLabel ?? ""}
              onChange={(v, label) => {
                setSacado(v);
                setSacadoLabel(label);
              }}
              endpoint={`/api/carteira-sacados/sacados?${new URLSearchParams({
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
