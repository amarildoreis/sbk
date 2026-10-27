"use client";

import { useState } from "react";
import { ComportamentalHeader } from "./comportamental-header";
import { ExposicaoCedenteGroup } from "./exposicao-cedente-group";
import { TrancheGroup } from "./tranche-group";
import { TarifarioGroup } from "./tarifario-group";
import { OperacoesGroup } from "./operacoes-group";
import { LiquidezPontualGroup } from "./liquidez-pontual-group";
import { LiquidezComAtrasoGroup } from "./liquidez-com-atraso-group";
import { VopCedenteGroup } from "./vop-cedente-group";
import { VopSacadoGroup } from "./vop-sacado-group";
import { RecompraGroup } from "./recompra-group";
import { MaiorConcentracaoGroup } from "./maior-concentracao-group";
import { QuantidadeSacadosGroup } from "./quantidade-sacados-group";

export interface ComportamentalFiltros {
  comercial: string;
  grupoEconomico: string;
  cedente: string;
}

const FILTROS_VAZIOS: ComportamentalFiltros = {
  comercial: "",
  grupoEconomico: "",
  cedente: "",
};

export function ComportamentalPage() {
  const [filtros, setFiltros] = useState<ComportamentalFiltros>(FILTROS_VAZIOS);
  const [resumo, setResumo] = useState("");

  const hasActiveFilters = Object.values(filtros).some((value) => value !== "");

  function handleClearFilters() {
    setFiltros(FILTROS_VAZIOS);
    setResumo("");
  }

  function handleApplyFiltros(novosFiltros: ComportamentalFiltros, novoResumo: string) {
    setFiltros(novosFiltros);
    setResumo(novoResumo);
  }

  return (
    <div className="space-y-6">
      <ComportamentalHeader
        filtros={filtros}
        hasActiveFilters={hasActiveFilters}
        resumo={resumo}
        onClearFilters={handleClearFilters}
        onApplyFiltros={handleApplyFiltros}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ExposicaoCedenteGroup filtros={filtros} resumoFiltros={resumo} />
        <TrancheGroup filtros={filtros} resumoFiltros={resumo} />
        <TarifarioGroup filtros={filtros} resumoFiltros={resumo} />
        <OperacoesGroup filtros={filtros} resumoFiltros={resumo} />
        <LiquidezPontualGroup filtros={filtros} resumoFiltros={resumo} />
        <LiquidezComAtrasoGroup filtros={filtros} resumoFiltros={resumo} />
        <VopCedenteGroup filtros={filtros} resumoFiltros={resumo} />
        <VopSacadoGroup filtros={filtros} resumoFiltros={resumo} />
        <RecompraGroup filtros={filtros} resumoFiltros={resumo} />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <MaiorConcentracaoGroup filtros={filtros} resumoFiltros={resumo} />
          <QuantidadeSacadosGroup filtros={filtros} resumoFiltros={resumo} />
        </div>
      </div>
    </div>
  );
}
