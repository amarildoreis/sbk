import ExcelJS from "exceljs";
import type { ClienteCarteira } from "@/lib/db/queries/carteira-clientes";

const COLUMNS: {
  key: string;
  header: string;
  width: number;
  type: "text" | "currency" | "date" | "percent";
}[] = [
  { key: "codigo", header: "Código", width: 12, type: "text" },
  { key: "cedente", header: "Cedente", width: 32, type: "text" },
  { key: "comercial", header: "Comercial", width: 24, type: "text" },
  { key: "situacao", header: "Situação", width: 14, type: "text" },
  { key: "limiteCredito", header: "Limite de Crédito", width: 18, type: "currency" },
  { key: "risco", header: "Risco Cedente", width: 16, type: "currency" },
  { key: "participacao", header: "Participação Cedente", width: 18, type: "percent" },
  { key: "limiteDisponivel", header: "Limite Disponível", width: 18, type: "currency" },
  { key: "vencido", header: "Vencido", width: 16, type: "currency" },
  { key: "aVencer", header: "A Vencer", width: 16, type: "currency" },
  { key: "ultimaData", header: "Data do Último Borderô", width: 18, type: "date" },
  { key: "tranche", header: "Tranche", width: 16, type: "currency" },
  { key: "taxa", header: "Taxa", width: 12, type: "percent" },
  { key: "metodo", header: "Método", width: 14, type: "text" },
];

export async function buildCarteiraClientesWorkbookBuffer(
  rows: ClienteCarteira[],
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SBK Capital";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Carteira de Clientes");

  sheet.columns = COLUMNS.map((col) => ({
    key: col.key,
    header: col.header,
    width: col.width,
  }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow({
      ...row,
      participacao: row.participacao / 100,
    } as unknown as Record<string, unknown>);
  }

  for (const col of COLUMNS) {
    const column = sheet.getColumn(col.key);
    if (col.type === "currency") {
      column.numFmt = '"R$" #,##0.00';
    } else if (col.type === "date") {
      column.numFmt = "dd/mm/yyyy";
    } else if (col.type === "percent") {
      column.numFmt = "0.00%";
    }
  }

  return workbook.xlsx.writeBuffer();
}

export function carteiraClientesFilename(): string {
  return `carteira-clientes-${new Date().toISOString().slice(0, 10)}.xlsx`;
}
