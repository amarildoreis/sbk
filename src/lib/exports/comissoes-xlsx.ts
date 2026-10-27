import ExcelJS from "exceljs";
import type { ComissaoTitulo } from "@/lib/db/queries/comissoes";

// Compartilhado entre a exportação direta (api/comissoes/export) e o envio
// por e-mail (api/comissoes/export/email) — mesmo arquivo, dois jeitos de
// entregar. Mesmo padrão de relatorio-titulos-xlsx.ts.
const COLUMNS: {
  key: string;
  header: string;
  width: number;
  type: "text" | "currency" | "date" | "number" | "percent";
}[] = [
  { key: "titulo", header: "Título", width: 18, type: "text" },
  { key: "cedente", header: "Cedente", width: 32, type: "text" },
  { key: "sacado", header: "Sacado", width: 32, type: "text" },
  { key: "bordero", header: "Borderô", width: 12, type: "number" },
  { key: "indicanteOperador", header: "Indicante/Operador", width: 24, type: "text" },
  { key: "tipo", header: "Tipo", width: 12, type: "text" },
  { key: "dataCompra", header: "Data da Compra", width: 16, type: "date" },
  { key: "valorTitulo", header: "Valor do Título", width: 16, type: "currency" },
  { key: "statusPagamento", header: "Status do Pagamento", width: 16, type: "text" },
  { key: "tipoPagamento", header: "Tipo do Pagamento", width: 18, type: "text" },
  { key: "desagio", header: "Deságio", width: 14, type: "currency" },
  { key: "taxa", header: "Taxa", width: 12, type: "percent" },
  { key: "faixaComissao", header: "Faixa de Comissão", width: 16, type: "number" },
  { key: "comissao", header: "Comissão", width: 14, type: "currency" },
  { key: "vencimento", header: "Data de Vencimento", width: 16, type: "date" },
  { key: "dataPagamento", header: "Data de Pagamento", width: 16, type: "date" },
];

export async function buildComissoesWorkbookBuffer(
  rows: ComissaoTitulo[],
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SBK Capital";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Comissões");

  sheet.columns = COLUMNS.map((col) => ({
    key: col.key,
    header: col.header,
    width: col.width,
  }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    // "taxa" (JUROS_MENSAL) é fração — Excel espera o valor bruto pra
    // aplicar o formato de percentual (0.0226 exibido como 2,26%), não
    // multiplicado antes. "faixaComissao" já vem em escala percentual
    // crua do banco (ver comentário em comissoes.ts) — formatado como
    // número simples, não percentual do Excel.
    sheet.addRow(row as unknown as Record<string, unknown>);
  }

  for (const col of COLUMNS) {
    const column = sheet.getColumn(col.key);
    if (col.type === "currency") {
      column.numFmt = '"R$" #,##0.00';
    } else if (col.type === "date") {
      column.numFmt = "dd/mm/yyyy";
    } else if (col.type === "percent") {
      // Taxa com 4 casas decimais (pedido do cliente em 2026-07-17) — mesma
      // precisão da tabela na tela (comissoes-table.tsx).
      column.numFmt = "0.0000%";
    }
  }

  return workbook.xlsx.writeBuffer();
}

export function comissoesFilename(): string {
  return `comissoes-${new Date().toISOString().slice(0, 10)}.xlsx`;
}
