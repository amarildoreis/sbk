import PDFDocument from "pdfkit";

export interface GroupPdfRow {
  label: string;
  value: string;
}

export interface GroupPdfOptions {
  titulo: string;
  subtitulo?: string;
  filtrosResumo?: string;
  rows: GroupPdfRow[];
  /** Texto do cabeçalho fixo (ex: "Módulo Comportamental", "Módulo
   * Gráficos") — pra reaproveitar este builder genérico em outros módulos,
   * não só Comportamental. Padrão mantém o comportamento original. */
  modulo?: string;
}

// Gera um PDF simples (cabeçalho + lista label/valor) pra um grupo de cards
// — mesmo espírito do buildCarteiraClientesWorkbookBuffer
// (src/lib/exports/carteira-clientes-xlsx.ts), só que a saída é PDF em vez
// de Excel, usada tanto pro download direto quanto pro anexo de e-mail.
// Reaproveitado por Comportamental e Gráficos (CLAUDE.md seção 9) — cada
// módulo passa seu próprio `modulo` pro cabeçalho.
export function buildGroupPdfBuffer({
  titulo,
  subtitulo,
  filtrosResumo,
  rows,
  modulo = "Módulo Comportamental",
}: GroupPdfOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc
      .fontSize(10)
      .fillColor("#1A2347")
      .font("Helvetica-Bold")
      .text("SBK CAPITAL", { characterSpacing: 1 });
    doc
      .fontSize(9)
      .fillColor("#6B7280")
      .font("Helvetica")
      .text(modulo, { characterSpacing: 0.5 });

    doc.moveDown(1.2);
    doc.fontSize(18).fillColor("#1A2347").font("Helvetica-Bold").text(titulo);
    if (subtitulo) {
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor("#6B7280").font("Helvetica").text(subtitulo);
    }

    // Sempre mostra o contexto de filtro — filtrado ou não — pra quem
    // recebe o PDF (por download ou e-mail) nunca ficar em dúvida se os
    // números vieram de "toda a carteira" ou de um recorte específico.
    doc.moveDown(0.5);
    const temFiltro = Boolean(filtrosResumo);
    const textoFiltro = temFiltro
      ? `Filtros aplicados: ${filtrosResumo}`
      : "Sem filtros aplicados — dados de toda a carteira.";
    const corFiltro = temFiltro ? "#B3495A" : "#6B7280";
    const boxY = doc.y;
    const boxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc
      .roundedRect(doc.page.margins.left, boxY, boxWidth, 22, 4)
      .fillColor(temFiltro ? "#FBEAEC" : "#F7F8FA")
      .fill();
    doc
      .fontSize(9.5)
      .fillColor(corFiltro)
      .font("Helvetica-Bold")
      .text(textoFiltro, doc.page.margins.left + 10, boxY + 6, {
        width: boxWidth - 20,
      });
    doc.y = boxY + 22;

    doc.moveDown(0.6);
    doc
      .strokeColor("#C8CDD6")
      .lineWidth(1)
      .moveTo(doc.x, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke();
    doc.moveDown(0.8);

    for (const row of rows) {
      const y = doc.y;
      doc
        .fontSize(11)
        .fillColor("#1A2347")
        .font("Helvetica")
        .text(row.label, doc.page.margins.left, y, { width: 260 });
      doc
        .fontSize(12)
        .fillColor("#1A2347")
        .font("Helvetica-Bold")
        .text(row.value, doc.page.margins.left + 270, y, {
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 270,
          align: "right",
        });
      doc.moveDown(0.9);
    }

    doc.moveDown(1);
    doc
      .fontSize(8)
      .fillColor("#9CA3AF")
      .font("Helvetica")
      .text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, { align: "right" });

    doc.end();
  });
}

export function groupPdfFilename(slug: string, prefixo = "comportamental"): string {
  return `${prefixo}-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`;
}

export interface GroupPdfSection {
  titulo: string;
  rows: GroupPdfRow[];
}

export interface MultiGroupPdfOptions {
  titulo: string;
  subtitulo?: string;
  filtrosResumo?: string;
  secoes: GroupPdfSection[];
}

// Relatório geral do Comportamental — mesmo cabeçalho/caixa de filtro de
// buildGroupPdfBuffer, mas com todos os grupos da tela consolidados num só
// PDF, cada um com seu próprio subtítulo + divisor antes da lista de linhas.
// Usada pelo botão "Exportar tudo" do header (ao lado dos filtros), que
// sempre reflete o que está na tela no momento (filtrado ou não).
export function buildMultiGroupPdfBuffer({
  titulo,
  subtitulo,
  filtrosResumo,
  secoes,
}: MultiGroupPdfOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const bottomLimit = doc.page.height - doc.page.margins.bottom;
    function ensureSpace(height: number) {
      if (doc.y + height > bottomLimit) {
        doc.addPage();
      }
    }

    doc
      .fontSize(10)
      .fillColor("#1A2347")
      .font("Helvetica-Bold")
      .text("SBK CAPITAL", { characterSpacing: 1 });
    doc
      .fontSize(9)
      .fillColor("#6B7280")
      .font("Helvetica")
      .text("Módulo Comportamental", { characterSpacing: 0.5 });

    doc.moveDown(1.2);
    doc.fontSize(18).fillColor("#1A2347").font("Helvetica-Bold").text(titulo);
    if (subtitulo) {
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor("#6B7280").font("Helvetica").text(subtitulo);
    }

    doc.moveDown(0.5);
    const temFiltro = Boolean(filtrosResumo);
    const textoFiltro = temFiltro
      ? `Filtros aplicados: ${filtrosResumo}`
      : "Sem filtros aplicados — dados de toda a carteira.";
    const corFiltro = temFiltro ? "#B3495A" : "#6B7280";
    const boxY = doc.y;
    const boxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc
      .roundedRect(doc.page.margins.left, boxY, boxWidth, 22, 4)
      .fillColor(temFiltro ? "#FBEAEC" : "#F7F8FA")
      .fill();
    doc
      .fontSize(9.5)
      .fillColor(corFiltro)
      .font("Helvetica-Bold")
      .text(textoFiltro, doc.page.margins.left + 10, boxY + 6, {
        width: boxWidth - 20,
      });
    doc.y = boxY + 22;
    doc.moveDown(1);

    for (const secao of secoes) {
      ensureSpace(60);
      doc
        .fontSize(13)
        .fillColor("#1A2347")
        .font("Helvetica-Bold")
        .text(secao.titulo, doc.page.margins.left, doc.y);
      doc.moveDown(0.4);
      doc
        .strokeColor("#C8CDD6")
        .lineWidth(1)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
      doc.moveDown(0.6);

      for (const row of secao.rows) {
        ensureSpace(24);
        const y = doc.y;
        doc
          .fontSize(11)
          .fillColor("#1A2347")
          .font("Helvetica")
          .text(row.label, doc.page.margins.left, y, { width: 260 });
        doc
          .fontSize(12)
          .fillColor("#1A2347")
          .font("Helvetica-Bold")
          .text(row.value, doc.page.margins.left + 270, y, {
            width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 270,
            align: "right",
          });
        doc.moveDown(0.9);
      }
      doc.moveDown(0.8);
    }

    doc.moveDown(0.5);
    doc
      .fontSize(8)
      .fillColor("#9CA3AF")
      .font("Helvetica")
      .text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, { align: "right" });

    doc.end();
  });
}

export function multiGroupPdfFilename(): string {
  return `comportamental-geral-${new Date().toISOString().slice(0, 10)}.pdf`;
}
