import ExcelJS from "exceljs";
import type { TituloTranche } from "@/lib/db/queries/tranche";

// Compartilhado entre a exportação direta (api/tranche/export) e o envio
// por e-mail (api/tranche/export/email) — mesmo padrão de
// exposicao-cedente-xlsx.ts/borderos-liberados-xlsx.ts.
const COLUMNS: {
  key: string;
  header: string;
  width: number;
  type: "text" | "currency" | "date" | "number";
}[] = [
  { key: "titulo", header: "Título", width: 16, type: "text" },
  { key: "valor", header: "Valor", width: 16, type: "currency" },
  { key: "sacado", header: "Sacado", width: 42, type: "text" },
  { key: "cedente", header: "Cedente", width: 42, type: "text" },
  { key: "vencimento", header: "Vencimento do Título", width: 18, type: "date" },
  { key: "vencimentoTranche", header: "Vencimento da Tranche", width: 18, type: "date" },
  { key: "dataBordero", header: "Data do Borderô", width: 16, type: "date" },
];

export async function buildTrancheWorkbookBuffer(rows: TituloTranche[]): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SBK Capital";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Tranche");

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

export function trancheFilename(): string {
  return `tranche-${new Date().toISOString().slice(0, 10)}.xlsx`;
}
