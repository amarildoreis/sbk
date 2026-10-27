import type { GroupPdfRow } from "./group-pdf";
import type { Scoped } from "@/lib/auth/access-scope";
import { getGraficoTitulosMensal } from "@/lib/db/queries/graficos-titulos";
import { getGraficoDesagiosMensal } from "@/lib/db/queries/graficos-desagios";
import { getGraficoComissoesMensal } from "@/lib/db/queries/graficos-comissoes";
import { getGraficoVencidosMensal, parseEixo as parseEixoVencidos } from "@/lib/db/queries/graficos-vencidos";
import { getGraficoVopCedenteMensal } from "@/lib/db/queries/graficos-vop-cedente";
import { getGraficoRecompraMensal } from "@/lib/db/queries/graficos-recompra";
import { getGraficoTotalPagoMensal } from "@/lib/db/queries/graficos-total-pago";
import { parseEixo as parseEixoData } from "@/lib/db/queries/graficos-shared";
import type { PontoMensal } from "@/lib/db/queries/graficos-shared";

const MESES_COMPLETOS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pontosParaRows(pontos: PontoMensal[]): GroupPdfRow[] {
  return pontos.map((p) => ({ label: MESES_COMPLETOS[p.mes - 1], value: formatBRL(p.valor) }));
}

// Filtros "crus" vindos da URL/body da rota de exportação — cada entrada do
// registro converte `eixo` (string) pro tipo específico da sua própria
// query (compra/pagamento/vencimento em Títulos/Deságios/Comissões;
// geral/vencidos em Vencidos), via parseEixo/parseEixoVencidos.
export interface GraficoFiltrosExport {
  ano: number;
  eixo: string;
  comercial: string;
  grupoEconomico: string;
  cedente: string;
}

export interface GraficoDef {
  slug: string;
  titulo: string;
  buildRows: (filtros: Scoped<GraficoFiltrosExport>) => Promise<GroupPdfRow[]>;
  /** Rótulo do radio selecionado, pro subtítulo do PDF. Padrão: mapeamento
   * de Data de Compra/Pagamento/Vencimento (Títulos/Deságios/Comissões). */
  eixoLabel: (eixo: string) => string;
}

const EIXO_LABEL_DATA: Record<string, string> = {
  compra: "Data de Compra (Pago Total, Parcial ou Pendente)",
  pagamento: "Data de Pagamento (Pago Total)",
  vencimento: "Data de Vencimento (Pago Total, Parcial ou Pendente)",
};

function eixoLabelData(eixo: string): string {
  return EIXO_LABEL_DATA[eixo] ?? EIXO_LABEL_DATA.compra;
}

const EIXO_LABEL_VENCIDOS: Record<string, string> = {
  geral: "Vencimento Acumulado — Evolução Geral",
  vencidos: "Vencimento Acumulado — Evolução Vencidos",
};

function eixoLabelVencidos(eixo: string): string {
  return EIXO_LABEL_VENCIDOS[eixo] ?? EIXO_LABEL_VENCIDOS.geral;
}

// VOP Cedente não tem radio de eixo (só o filtro de Ano) — subtítulo do PDF
// omite a linha "Base: ..." por completo (ver buildSubtitulo).
function eixoLabelVazio(): string {
  return "";
}

// Registro central: cada gráfico mensualizado do módulo Gráficos (CLAUDE.md
// seção 9) que tem exportação (PDF/e-mail) aparece aqui — mesma fonte de
// verdade (query) usada pelo gráfico na tela, pra nunca divergir do que o
// usuário vê. Mesmo padrão de comportamental-grupos-registry.ts. Adicionar
// um gráfico novo = adicionar uma entrada aqui.
export const GRAFICOS: Record<string, GraficoDef> = {
  titulos: {
    slug: "titulos",
    titulo: "Títulos",
    eixoLabel: eixoLabelData,
    buildRows: async (filtros) =>
      pontosParaRows(
        await getGraficoTitulosMensal({ ...filtros, eixo: parseEixoData(filtros.eixo) }),
      ),
  },
  desagios: {
    slug: "desagios",
    titulo: "Deságios",
    eixoLabel: eixoLabelData,
    buildRows: async (filtros) =>
      pontosParaRows(
        await getGraficoDesagiosMensal({ ...filtros, eixo: parseEixoData(filtros.eixo) }),
      ),
  },
  comissoes: {
    slug: "comissoes",
    titulo: "Comissões",
    eixoLabel: eixoLabelData,
    buildRows: async (filtros) =>
      pontosParaRows(
        await getGraficoComissoesMensal({ ...filtros, eixo: parseEixoData(filtros.eixo) }),
      ),
  },
  vencidos: {
    slug: "vencidos",
    titulo: "Vencidos",
    eixoLabel: eixoLabelVencidos,
    buildRows: async (filtros) =>
      pontosParaRows(
        await getGraficoVencidosMensal({ ...filtros, eixo: parseEixoVencidos(filtros.eixo) }),
      ),
  },
  "vop-cedente": {
    slug: "vop-cedente",
    titulo: "VOP Cedente",
    eixoLabel: eixoLabelVazio,
    buildRows: async (filtros) => pontosParaRows(await getGraficoVopCedenteMensal(filtros)),
  },
  recompra: {
    slug: "recompra",
    titulo: "Recompra",
    eixoLabel: eixoLabelVazio,
    buildRows: async (filtros) => pontosParaRows(await getGraficoRecompraMensal(filtros)),
  },
  "total-pago": {
    slug: "total-pago",
    titulo: "Total Pago",
    eixoLabel: eixoLabelVazio,
    buildRows: async (filtros) => pontosParaRows(await getGraficoTotalPagoMensal(filtros)),
  },
};

export function graficoPdfFilename(slug: string): string {
  return `graficos-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`;
}

// Subtítulo do PDF — "Base: X" só aparece quando o gráfico tem radio de
// eixo (VOP Cedente não tem, `eixoLabel` retorna string vazia nesse caso).
export function buildSubtitulo(ano: number, baseLabel: string): string {
  const base = `Módulo Gráficos — SBK Capital — Ano ${ano}`;
  return baseLabel ? `${base} — Base: ${baseLabel}` : base;
}
