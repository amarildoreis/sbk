import ExcelJS from "exceljs";
import type { SacadoCarteira } from "@/lib/db/queries/carteira-sacados";

// Compartilhado entre a exportação direta (api/carteira-sacados/export) e o
// envio por e-mail (api/carteira-sacados/export/email) — mesmo padrão de
// relatorio-titulos-xlsx.ts/comissoes-xlsx.ts.
const COLUMNS: {
  key: string;
  header: string;
  width: number;
  type: "text" | "currency" | "date" | "number";
}[] = [
  { key: "sacado", header: "Sacado", width: 42, type: "text" },
  { key: "cedente", header: "Cedente", width: 42, type: "text" },
  { key: "riscoSacado", header: "Risco Sacado", width: 18, type: "currency" },
  { key: "percentual", header: "%", width: 12, type: "number" },
  { key: "ultimoVencimento", header: "Último Vencimento", width: 18, type: "date" },
];

export async function buildCarteiraSacadosWorkbookBuffer(
  rows: SacadoCarteira[],
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SBK Capital";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Carteira de Sacados");

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

export function carteiraSacadosFilename(): string {
  return `carteira-sacados-${new Date().toISOString().slice(0, 10)}.xlsx`;
}
