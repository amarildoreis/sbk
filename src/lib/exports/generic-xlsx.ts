import ExcelJS from "exceljs";

// Exportação Excel genérica pro módulo de Interação por IA (CLAUDE.md
// seção 12) — diferente dos demais builders (comissoes-xlsx.ts etc.), aqui
// as colunas não são fixas: cada template devolve `linhas` com um formato
// de coluna próprio (Record<string, unknown>[]), então o builder deriva as
// colunas das próprias linhas em vez de uma lista de COLUMNS hardcoded.
function formatColuna(chave: string): string {
  return chave
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

export async function buildGenericWorkbookBuffer(
  linhas: Record<string, unknown>[],
  sheetName: string,
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SBK Capital";
  workbook.created = new Date();
  // Nome da aba tem limite de 31 caracteres no Excel.
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31) || "Resultado");

  const colunas = linhas.length > 0 ? Object.keys(linhas[0]) : [];
  sheet.columns = colunas.map((chave) => ({
    key: chave,
    header: formatColuna(chave),
    width: Math.min(Math.max(formatColuna(chave).length + 4, 12), 40),
  }));
  sheet.getRow(1).font = { bold: true };

  for (const linha of linhas) {
    sheet.addRow(linha);
  }

  // Sem metadado de tipo por coluna (moeda/percentual/data) — cada template
  // tem sua própria convenção de unidade (CLAUDE.md, "cada grupo tem sua
  // própria convenção de unidade"). Aplica só um separador de milhar em
  // colunas puramente numéricas, sem assumir moeda.
  for (const chave of colunas) {
    const todosNumericos = linhas.every((l) => typeof l[chave] === "number");
    if (todosNumericos && linhas.length > 0) {
      sheet.getColumn(chave).numFmt = "#,##0.00";
    }
  }

  return workbook.xlsx.writeBuffer();
}

export function genericXlsxFilename(prefixo: string): string {
  const slug = prefixo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "resultado"}-${new Date().toISOString().slice(0, 10)}.xlsx`;
}
