import ExcelJS from "exceljs";
import type { TituloExposicaoCedente } from "@/lib/db/queries/exposicao-cedente";

// Compartilhado entre a exportação direta (api/exposicao-cedente/export) e o
// envio por e-mail (api/exposicao-cedente/export/email) — mesmo padrão de
// borderos-liberados-xlsx.ts/comissoes-xlsx.ts.
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
  { key: "vencimento", header: "Vencimento", width: 16, type: "date" },
  { key: "vencimentoTranche", header: "Vencimento Tranche", width: 18, type: "date" },
  { key: "dataBordero", header: "Data do Borderô", width: 16, type: "date" },
];

export async function buildExposicaoCedenteWorkbookBuffer(
  rows: TituloExposicaoCedente[],
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SBK Capital";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Exposição Cedente");

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

export function exposicaoCedenteFilename(): string {
  return `exposicao-cedente-${new Date().toISOString().slice(0, 10)}.xlsx`;
}
