import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Book, Chapter } from '../types/book';

// Set up worker locally via Vite asset bundler
try {
  if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  }
} catch {
  // worker fallback
}

export async function parsePdfFile(file: File): Promise<Book> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  // Extract metadata if available
  let title = file.name.replace(/\.pdf$/i, '');
  let author = 'Autor desconhecido';

  try {
    const meta = await pdfDoc.getMetadata();
    const info = meta?.info as Record<string, string | undefined> | undefined;
    if (info) {
      if (info.Title && info.Title.trim().length > 1) {
        title = info.Title.trim();
      }
      if (info.Author && info.Author.trim().length > 1) {
        author = info.Author.trim();
      }
    }
  } catch {
    // metadata fallback
  }

  // Generate cover from Page 1
  let coverUrl = '';
  try {
    const firstPage = await pdfDoc.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1.0 });
    // Scale for crisp cover thumbnail (~380px wide)
    const scale = 380 / viewport.width;
    const scaledViewport = firstPage.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // @ts-expect-error pdfjs typing nuance
      await firstPage.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
      coverUrl = canvas.toDataURL('image/jpeg', 0.85);
    }
  } catch (err) {
    console.warn('Could not generate PDF cover thumbnail:', err);
  }

  // Extract text per page
  const chapters: Chapter[] = [];
  const PAGES_PER_CHAPTER = 5; // Group every 5 pages or split per page if small
  let currentParagraphs: string[] = [];
  let currentStartPage = 1;
  let chapterIndex = 1;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Group text items into lines and paragraphs
    const lines: string[] = [];
    let currentLine = '';
    let lastY: number | null = null;

    for (const item of textContent.items) {
      if ('str' in item) {
        const text = item.str;
        const transform = item.transform;
        const y = transform ? transform[5] : 0;

        if (lastY !== null && Math.abs(y - lastY) > 6) {
          if (currentLine.trim()) lines.push(currentLine.trim());
          currentLine = text;
        } else {
          currentLine += (currentLine.length > 0 && !currentLine.endsWith(' ') ? ' ' : '') + text;
        }
        lastY = y;
      }
    }
    if (currentLine.trim()) lines.push(currentLine.trim());

    // Merge lines into coherent paragraphs (empty line or significant break signals new paragraph)
    const pageParagraphs: string[] = [];
    let runningPara = '';

    for (const line of lines) {
      if (!line) continue;
      // Filter out header/footer page numbers alone
      if (/^\d{1,4}$/.test(line.trim())) continue;

      if (runningPara.length > 0) {
        // If line ends with hyphen, stitch broken word
        if (runningPara.endsWith('-')) {
          runningPara = runningPara.slice(0, -1) + line;
        } else if (runningPara.endsWith('.') || runningPara.endsWith('!') || runningPara.endsWith('?')) {
          // Paragraph could end here if line is short
          if (line.length < 35) {
            pageParagraphs.push(runningPara);
            runningPara = line;
          } else {
            runningPara += ' ' + line;
          }
        } else {
          runningPara += ' ' + line;
        }
      } else {
        runningPara = line;
      }

      if (runningPara.length > 400) {
        pageParagraphs.push(runningPara);
        runningPara = '';
      }
    }

    if (runningPara.trim().length > 10) {
      pageParagraphs.push(runningPara.trim());
    }

    if (pageParagraphs.length > 0) {
      currentParagraphs.push(...pageParagraphs);
    }

    // Group chapters
    const isLastPage = pageNum === numPages;
    const shouldBreakChapter = (pageNum % PAGES_PER_CHAPTER === 0) || isLastPage;

    if (shouldBreakChapter && currentParagraphs.length > 0) {
      const pageLabel = currentStartPage === pageNum 
        ? `Página ${currentStartPage}` 
        : `Páginas ${currentStartPage}–${pageNum}`;
      
      const wordCount = currentParagraphs.reduce((acc, p) => acc + p.split(/\s+/).length, 0);

      chapters.push({
        id: `pdf-chap-${chapterIndex}`,
        title: `Seção ${chapterIndex} (${pageLabel})`,
        paragraphs: [...currentParagraphs],
        wordCount,
        pageNumber: currentStartPage
      });

      currentParagraphs = [];
      currentStartPage = pageNum + 1;
      chapterIndex++;
    }
  }

  // If still empty fallback
  if (chapters.length === 0) {
    chapters.push({
      id: 'pdf-chap-1',
      title: 'Documento Completo',
      paragraphs: ['Não foi possível extrair texto formatado deste arquivo PDF. Ele pode ser composto de imagens escaneadas.'],
      wordCount: 15
    });
  }

  const totalWords = chapters.reduce((acc, ch) => acc + ch.wordCount, 0);
  const estimatedReadingMinutes = Math.max(1, Math.round(totalWords / 220));
  const estimatedAudioMinutes = Math.max(1, Math.round(totalWords / 150));

  return {
    id: `user-book-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    title,
    author,
    format: 'pdf',
    coverUrl,
    chapters,
    totalWords,
    estimatedReadingMinutes,
    estimatedAudioMinutes,
    category: 'Documentos & PDFs',
    progressPercent: 0,
    currentChapterIndex: 0,
    currentParagraphIndex: 0,
    lastReadAt: Date.now(),
    isFavorite: false,
    fileSize: file.size,
    addedAt: Date.now()
  };
}
