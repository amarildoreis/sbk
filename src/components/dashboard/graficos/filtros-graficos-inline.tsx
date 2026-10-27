"use client";

import { useEffect, useState } from "react";
import { Briefcase, Building2, Users, Check } from "lucide-react";
import {
  ComercialSistemaSelect,
  type ComercialSistema,
} from "../comercial-sistema-select";
import { FiltroSelect, type FiltroOption } from "../titulos/filtro-select";
import { useAccessScope } from "../use-access-scope";
import { LockedFiltroField } from "../locked-filtro-field";
import type { GraficosFiltros } from "./graficos-page";

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

// Conteúdo do painel retrátil de filtros de Gráficos — os mesmos 3 filtros
// de Exposição Cedente/Tranche (Comercial, Grupo Econômico, Cedente), mesmo
// efeito cascata e mesmas queries de cascata (universo SIGFIDC idêntico).
// Também calcula o "resumo" (nomes escolhidos, não só códigos) que vira o
// título centralizado dentro do painel de cada gráfico — mesmo padrão de
// filtros-comportamental-inline.tsx.
export function FiltrosGraficosInline({
  value,
  onApply,
}: {
  value: GraficosFiltros;
  onApply: (filtros: GraficosFiltros, resumo: string) => void;
}) {
  const scope = useAccessScope();
  const [comercial, setComercial] = useState(value.comercial);
  const [grupoEconomico, setGrupoEconomico] = useState(value.grupoEconomico);
  const [cedente, setCedente] = useState(value.cedente);

  const [comerciais, setComerciais] = useState<ComercialSistema[]>([TODOS]);
  const [isLoadingComerciais, setIsLoadingComerciais] = useState(true);
  const [grupos, setGrupos] = useState<FiltroOption[]>([]);
  const [isLoadingGrupos, setIsLoadingGrupos] = useState(true);
  const [cedentes, setCedentes] = useState<FiltroOption[]>([]);
  const [isLoadingCedentes, setIsLoadingCedentes] = useState(true);

  // Sincroniza o estado local (staged) sempre que o filtro aplicado muda
  // por fora — ex: "Limpar" no header.
  useEffect(() => {
    setComercial(value.comercial);
    setGrupoEconomico(value.grupoEconomico);
    setCedente(value.cedente);
  }, [value]);

  // Trava de acesso por perfil (CLAUDE.md, 2026-07-18) — Comercial/Cedente
  // só veem os próprios dados; força o campo pro próprio valor. A trava de
  // verdade é sempre no servidor (applyAccessScope), isto é só a
  // pré-seleção/UX.
  useEffect(() => {
    if (scope.comercial.locked) setComercial(scope.comercial.codigo);
    if (scope.cedente.locked) setCedente(scope.cedente.codigo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.comercial.locked, scope.cedente.locked]);

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

  // Efeito cascata: Grupo Econômico reflete o Comercial já escolhido.
  useEffect(() => {
    let cancelled = false;
    setIsLoadingGrupos(true);
    const params = new URLSearchParams();
    if (comercial) params.set("comercial", comercial);
    fetch(`/api/graficos/grupos-economicos?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        const lista = data.grupos as { id: number; nome: string | null }[];
        const opts = lista.map((g) => ({
          value: String(g.id),
          label: `${g.id} - ${g.nome ?? "(sem nome)"}`,
        }));
        setGrupos(opts);
        if (grupoEconomico && !lista.some((g) => String(g.id) === grupoEconomico)) {
          setGrupoEconomico("");
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingGrupos(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comercial]);

  // Efeito cascata: Cedente reflete Comercial e Grupo Econômico já
  // escolhidos.
  useEffect(() => {
    let cancelled = false;
    setIsLoadingCedentes(true);
    const params = new URLSearchParams();
    if (comercial) params.set("comercial", comercial);
    if (grupoEconomico) params.set("grupoEconomico", grupoEconomico);
    fetch(`/api/graficos/cedentes?${params.toString()}`)
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
  }, [comercial, grupoEconomico]);

  function handleAplicar() {
    const partesResumo: string[] = [];
    if (comercial) {
      const opcao = comerciais.find((c) => c.codigo === comercial);
      if (opcao) partesResumo.push(`Comercial: ${opcao.nome}`);
    }
    if (grupoEconomico) {
      const opcao = grupos.find((g) => g.value === grupoEconomico);
      if (opcao) partesResumo.push(`Grupo: ${opcao.label.replace(/^\d+ - /, "")}`);
    }
    if (cedente) {
      const opcao = cedentes.find((c) => c.value === cedente);
      if (opcao) partesResumo.push(`Cedente: ${opcao.label.replace(/^\d+ - /, "").split(" - ")[0]}`);
    }
    onApply({ comercial, grupoEconomico, cedente }, partesResumo.join(" · "));
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

        <Secao icon={Building2} titulo="Grupo Econômico">
          <FiltroSelect
            value={grupoEconomico}
            onChange={setGrupoEconomico}
            options={grupos}
            isLoading={isLoadingGrupos}
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
