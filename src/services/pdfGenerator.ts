import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Book } from '../types/book';

/**
 * Gera um arquivo PDF formatado e legível a partir do livro e seus capítulos,
 * utilizado para garantir que livros em PDF sempre possam ser salvos no Google Drive
 * na pasta "Livros", mesmo quando o binário original não estiver em cache local.
 */
export async function generatePdfFromBook(book: Book): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  // Página de Título / Capa
  let page = pdfDoc.addPage([595.28, 841.89]); // A4 padrão
  const { width, height } = page.getSize();

  page.drawText(book.title || 'Livro Digital', {
    x: 50,
    y: height - 160,
    size: 24,
    font: timesBold,
    color: rgb(0.1, 0.1, 0.1),
    maxWidth: width - 100,
  });

  page.drawText(`Autor: ${book.author || 'Desconhecido'}`, {
    x: 50,
    y: height - 210,
    size: 14,
    font: timesRoman,
    color: rgb(0.35, 0.35, 0.35),
    maxWidth: width - 100,
  });

  page.drawText('Organizado e sincronizado por AuraBooks', {
    x: 50,
    y: 80,
    size: 10,
    font: timesRoman,
    color: rgb(0.6, 0.6, 0.6),
  });

  // Capítulos e Parágrafos
  const chapters = book.chapters && book.chapters.length > 0
    ? book.chapters
    : [{ id: 'ch-1', title: 'Conteúdo do Documento', paragraphs: [book.description || 'Documento sem texto adicional.'], wordCount: 10 }];

  for (const chapter of chapters) {
    page = pdfDoc.addPage([595.28, 841.89]);
    let currentY = height - 60;

    page.drawText(chapter.title || 'Capítulo', {
      x: 50,
      y: currentY,
      size: 16,
      font: timesBold,
      color: rgb(0.15, 0.15, 0.15),
      maxWidth: width - 100,
    });
    currentY -= 35;

    for (const paragraph of chapter.paragraphs) {
      if (!paragraph || !paragraph.trim()) continue;

      const fontSize = 10.5;
      const lineHeight = 15;
      const margin = 50;
      const maxLineWidth = width - (margin * 2);

      const words = paragraph.split(/\s+/);
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        let testWidth = 0;
        try {
          testWidth = timesRoman.widthOfTextAtSize(testLine, fontSize);
        } catch {
          // Sanitização para caracteres que a fonte padrão não suporta
          const safeLine = testLine.replace(/[^\x00-\x7F]/g, '');
          testWidth = timesRoman.widthOfTextAtSize(safeLine, fontSize);
        }

        if (testWidth > maxLineWidth && currentLine) {
          if (currentY < 60) {
            page = pdfDoc.addPage([595.28, 841.89]);
            currentY = height - 60;
          }
          try {
            page.drawText(currentLine, {
              x: margin,
              y: currentY,
              size: fontSize,
              font: timesRoman,
              color: rgb(0.12, 0.12, 0.12),
            });
          } catch {
            const safe = currentLine.replace(/[^\x00-\x7F]/g, '');
            page.drawText(safe, {
              x: margin,
              y: currentY,
              size: fontSize,
              font: timesRoman,
              color: rgb(0.12, 0.12, 0.12),
            });
          }
          currentY -= lineHeight;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        if (currentY < 60) {
          page = pdfDoc.addPage([595.28, 841.89]);
          currentY = height - 60;
        }
        try {
          page.drawText(currentLine, {
            x: margin,
            y: currentY,
            size: fontSize,
            font: timesRoman,
            color: rgb(0.12, 0.12, 0.12),
          });
        } catch {
          const safe = currentLine.replace(/[^\x00-\x7F]/g, '');
          page.drawText(safe, {
            x: margin,
            y: currentY,
            size: fontSize,
            font: timesRoman,
            color: rgb(0.12, 0.12, 0.12),
          });
        }
        currentY -= lineHeight;
      }

      currentY -= 6; // espaço entre parágrafos
    }
  }

  const pdfBytes = await pdfDoc.save();
  const buffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: 'application/pdf' });
}
