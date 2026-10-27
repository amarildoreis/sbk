import type { GroupPdfRow } from "./group-pdf";
import type { Scoped } from "@/lib/auth/access-scope";
import { getExposicaoCedente } from "@/lib/db/queries/comportamental-exposicao-cedente";
import { getTranche } from "@/lib/db/queries/comportamental-tranche";
import { getTarifario } from "@/lib/db/queries/comportamental-tarifario";
import { getOperacoes } from "@/lib/db/queries/comportamental-operacoes";
import { getLiquidezPontual } from "@/lib/db/queries/comportamental-liquidez-pontual";
import { getVopCedente } from "@/lib/db/queries/comportamental-vop-cedente";
import { getVopSacado } from "@/lib/db/queries/comportamental-vop-sacado";
import { getRecompra } from "@/lib/db/queries/comportamental-recompra";
import { getMaiorConcentracao } from "@/lib/db/queries/comportamental-maior-concentracao";
import { getQuantidadeSacados } from "@/lib/db/queries/comportamental-quantidade-sacados";

export interface ComportamentalFiltrosExport {
  comercial?: string;
  grupoEconomico?: string;
  cedente?: string;
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(fracao: number) {
  return `${(fracao * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatDias(value: number) {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} dias`;
}

function comBadge(valor: string, qtd: number) {
  return `${valor}  (${qtd.toLocaleString("pt-BR")} títulos)`;
}

export interface GrupoComportamentalDef {
  slug: string;
  titulo: string;
  buildRows: (filtros: Scoped<ComportamentalFiltrosExport>) => Promise<GroupPdfRow[]>;
}

// Registro central: cada grupo do Comportamental que tem um menu de
// exportação (PDF / e-mail) aparece aqui — a mesma fonte de verdade
// (query + formatação) usada pelos cards na tela, pra nunca divergir do que
// o usuário vê. Adicionar um novo grupo = adicionar uma entrada aqui.
export const GRUPOS_COMPORTAMENTAL: Record<string, GrupoComportamentalDef> = {
  "exposicao-cedente": {
    slug: "exposicao-cedente",
    titulo: "Exposição Cedente",
    buildRows: async (filtros) => {
      const t = await getExposicaoCedente(filtros);
      return [
        { label: "Limite Cedente", value: formatBRL(t.limiteCredito) },
        { label: "Limite Grupo Cedente", value: formatBRL(t.limiteGrupoCedente) },
        { label: "Risco", value: formatBRL(t.risco) },
        { label: "Disponível", value: formatBRL(t.limiteDisponivel) },
        { label: "A Vencer", value: comBadge(formatBRL(t.aVencer), t.aVencerQtd) },
        { label: "Vencidos", value: comBadge(formatBRL(t.vencido), t.vencidoQtd) },
      ];
    },
  },
  tranche: {
    slug: "tranche",
    titulo: "Tranche",
    buildRows: async (filtros) => {
      const t = await getTranche(filtros);
      return [
        { label: "Limite", value: formatBRL(t.limite) },
        { label: "Tomada", value: comBadge(formatBRL(t.tomada), t.tomadaQtd) },
        { label: "Disponível", value: formatBRL(t.disponivel) },
        { label: "A Vencer", value: comBadge(formatBRL(t.aVencer), t.aVencerQtd) },
        { label: "Vencidos", value: comBadge(formatBRL(t.vencida), t.vencidaQtd) },
        { label: "Dias de Prazo", value: formatDias(t.diasPrazo) },
      ];
    },
  },
  tarifario: {
    slug: "tarifario",
    titulo: "Tarifário",
    buildRows: async (filtros) => {
      const t = await getTarifario(filtros);
      return [
        { label: "Taxa", value: formatPercent(t.taxa) },
        { label: "Tipo de Taxa", value: t.tipoDeTaxa },
        { label: "Ad Valorem", value: formatPercent(t.adValorem) },
        { label: "Borderô", value: formatBRL(t.bordero) },
        { label: "Protec", value: formatBRL(t.protec) },
        { label: "TED", value: formatBRL(t.ted) },
        { label: "Cheque", value: formatBRL(t.cheque) },
        { label: "Título", value: formatBRL(t.titulo) },
      ];
    },
  },
  operacoes: {
    slug: "operacoes",
    titulo: "Operações",
    buildRows: async (filtros) => {
      const t = await getOperacoes(filtros);
      return [
        { label: "Prazo Mínimo", value: formatDias(t.prazoMinimo) },
        { label: "Prazo Médio Geral", value: formatDias(t.prazoMedioGeral) },
        { label: "Prazo Médio 30 dias", value: formatDias(t.prazoMedio30d) },
        { label: "Prazo Médio 60 dias", value: formatDias(t.prazoMedio60d) },
        { label: "Prazo Médio 90 dias", value: formatDias(t.prazoMedio90d) },
        { label: "Prazo Máximo", value: formatDias(t.prazoMaximo) },
        { label: "Ticket Médio", value: formatBRL(t.ticketMedio) },
        { label: "Borderô Médio", value: formatBRL(t.borderoMedio) },
      ];
    },
  },
  "liquidez-pontual": {
    slug: "liquidez-pontual",
    titulo: "Liquidez Pontual",
    buildRows: async (filtros) => {
      const t = await getLiquidezPontual(filtros);
      return [
        { label: "Geral", value: formatPercent(t.geral) },
        { label: "Últimos 30 dias", value: formatPercent(t.janela30d) },
        { label: "Últimos 60 dias", value: formatPercent(t.janela60d) },
        { label: "Últimos 90 dias", value: formatPercent(t.janela90d) },
      ];
    },
  },
  "liquidez-com-atraso": {
    slug: "liquidez-com-atraso",
    titulo: "Liquidez com Atraso",
    buildRows: async (filtros) => {
      const t = await getLiquidezPontual(filtros);
      return [
        { label: "Geral", value: formatPercent(1 - t.geral) },
        { label: "Últimos 30 dias", value: formatPercent(1 - t.janela30d) },
        { label: "Últimos 60 dias", value: formatPercent(1 - t.janela60d) },
        { label: "Últimos 90 dias", value: formatPercent(1 - t.janela90d) },
      ];
    },
  },
  "vop-cedente": {
    slug: "vop-cedente",
    titulo: "VOP Cedente",
    buildRows: async (filtros) => {
      const t = await getVopCedente(filtros);
      return [
        { label: "Geral", value: formatBRL(t.geral) },
        { label: "Últimos 30 dias", value: formatBRL(t.janela30d) },
        { label: "Últimos 60 dias", value: formatBRL(t.janela60d) },
        { label: "Últimos 90 dias", value: formatBRL(t.janela90d) },
      ];
    },
  },
  "vop-sacado": {
    slug: "vop-sacado",
    titulo: "VOP Sacado",
    buildRows: async (filtros) => {
      const t = await getVopSacado(filtros);
      return [
        { label: "Geral", value: formatBRL(t.geral) },
        { label: "Últimos 30 dias", value: formatBRL(t.janela30d) },
        { label: "Últimos 60 dias", value: formatBRL(t.janela60d) },
        { label: "Últimos 90 dias", value: formatBRL(t.janela90d) },
      ];
    },
  },
  recompra: {
    slug: "recompra",
    titulo: "Recompra",
    buildRows: async (filtros) => {
      const t = await getRecompra(filtros);
      return [
        { label: "Total", value: formatBRL(t.total) },
        { label: "Últimos 30 dias", value: formatBRL(t.janela30d) },
        { label: "Últimos 60 dias", value: formatBRL(t.janela60d) },
        { label: "Últimos 90 dias", value: formatBRL(t.janela90d) },
      ];
    },
  },
  "maior-concentracao": {
    slug: "maior-concentracao",
    titulo: "Maior Concentração",
    buildRows: async (filtros) => {
      const t = await getMaiorConcentracao(filtros);
      return [{ label: "Maior Concentração", value: formatBRL(t.valor) }];
    },
  },
  "quantidade-sacados": {
    slug: "quantidade-sacados",
    titulo: "Quantidade de Sacados",
    buildRows: async (filtros) => {
      const t = await getQuantidadeSacados(filtros);
      return [
        { label: "Quantidade de Sacados", value: t.quantidade.toLocaleString("pt-BR") },
      ];
    },
  },
};
