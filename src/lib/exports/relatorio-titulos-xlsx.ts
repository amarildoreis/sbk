import ExcelJS from "exceljs";
import type { TituloRelatorio } from "@/lib/db/queries/relatorio-titulos";

// Compartilhado entre a exportação direta (api/relatorio-titulos/export) e o
// envio por e-mail (api/relatorio-titulos/export/email) — mesmo arquivo,
// dois jeitos de entregar.
const COLUMNS: {
  key: string;
  header: string;
  width: number;
  type: "text" | "currency" | "date" | "number";
}[] = [
  { key: "titulo", header: "Título", width: 18, type: "text" },
  { key: "cedente", header: "Cedente", width: 32, type: "text" },
  { key: "sacado", header: "Sacado", width: 32, type: "text" },
  { key: "indicanteOperador", header: "Indicante/Operador", width: 24, type: "text" },
  { key: "valorTitulo", header: "Valor do Título", width: 16, type: "currency" },
  { key: "valorPagamento", header: "Valor do Pagamento", width: 18, type: "currency" },
  { key: "saldoTitulo", header: "Saldo do Título", width: 16, type: "currency" },
  { key: "vencimento", header: "Data do Vencimento", width: 16, type: "date" },
  { key: "dataCompra", header: "Data da Compra", width: 16, type: "date" },
  { key: "dataPagamento", header: "Data do Pagamento", width: 16, type: "date" },
  { key: "statusPagamento", header: "Status do Pagamento", width: 16, type: "text" },
  { key: "bordero", header: "Borderô", width: 12, type: "number" },
  { key: "tipoPagamento", header: "Tipo do Pagamento", width: 18, type: "text" },
  { key: "situacao", header: "Situação", width: 18, type: "text" },
  { key: "diasAtraso", header: "Dias de Atraso", width: 14, type: "number" },
];

export async function buildRelatorioTitulosWorkbookBuffer(
  rows: TituloRelatorio[],
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SBK Capital";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Títulos");

  sheet.columns = COLUMNS.map((col) => ({
    key: col.key,
    header: col.header,
    width: col.width,
  }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(row as unknown as Record<string, unknown>);
  }

  for (const col of COLUMNS) {
    const column = sheet.getColumn(col.key);
    if (col.type === "currency") {
      column.numFmt = '"R$" #,##0.00';
    } else if (col.type === "date") {
      column.numFmt = "dd/mm/yyyy";
    }
  }

  return workbook.xlsx.writeBuffer();
}

export function relatorioTitulosFilename(): string {
  return `relatorio-titulos-${new Date().toISOString().slice(0, 10)}.xlsx`;
}
