import ExcelJS from "exceljs";
import type { BorderoLiberado } from "@/lib/db/queries/borderos-liberados";

// Compartilhado entre a exportação direta (api/borderos-liberados/export) e
// o envio por e-mail (api/borderos-liberados/export/email) — mesmo padrão
// de relatorio-titulos-xlsx.ts/comissoes-xlsx.ts.
const COLUMNS: {
  key: string;
  header: string;
  width: number;
  type: "text" | "currency" | "date" | "number";
}[] = [
  { key: "bordero", header: "Borderô", width: 12, type: "number" },
  { key: "dataLiberacao", header: "Data de Liberação", width: 18, type: "date" },
  { key: "titulosFidc", header: "Valor do Borderô", width: 18, type: "currency" },
  { key: "cedente", header: "Cedente", width: 42, type: "text" },
  { key: "prazoMedio", header: "Prazo Médio", width: 14, type: "number" },
  { key: "metodo", header: "Método", width: 16, type: "text" },
  { key: "fator", header: "Fator", width: 12, type: "number" },
];

export async function buildBorderosLiberadosWorkbookBuffer(
  rows: BorderoLiberado[],
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SBK Capital";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Borderôs Liberados");

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

export function borderosLiberadosFilename(): string {
  return `borderos-liberados-${new Date().toISOString().slice(0, 10)}.xlsx`;
}
