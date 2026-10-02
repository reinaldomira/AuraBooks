import { Book, Chapter } from '../types/book';

export async function parseTxtFile(file: File): Promise<Book> {
  const content = await file.text();
  const title = file.name.replace(/\.(txt|md)$/i, '');

  const lines = content.split('\n');
  const chapters: Chapter[] = [];
  let currentTitle = 'Início';
  let currentParas: string[] = [];
  let chapNum = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect chapter headings like "# Chapter", "Capítulo 1", "CHAPTER I"
    const isHeading = 
      /^#{1,3}\s+(.+)$/i.test(trimmed) ||
      /^(capítulo|capitulo|chapter|parte|seção|secao)\s+([0-9ivxlcdm]+)/i.test(trimmed);

    if (isHeading && currentParas.length > 0) {
      const wordCount = currentParas.reduce((acc, p) => acc + p.split(/\s+/).length, 0);
      chapters.push({
        id: `txt-chap-${chapNum}`,
        title: currentTitle,
        paragraphs: [...currentParas],
        wordCount
      });
      chapNum++;
      currentTitle = trimmed.replace(/^#{1,3}\s+/, '');
      currentParas = [];
    } else if (isHeading && currentParas.length === 0) {
      currentTitle = trimmed.replace(/^#{1,3}\s+/, '');
    } else {
      currentParas.push(trimmed);
    }
  }

  if (currentParas.length > 0) {
    const wordCount = currentParas.reduce((acc, p) => acc + p.split(/\s+/).length, 0);
    chapters.push({
      id: `txt-chap-${chapNum}`,
      title: currentTitle,
      paragraphs: [...currentParas],
      wordCount
    });
  }

  if (chapters.length === 0) {
    chapters.push({
      id: 'txt-chap-1',
      title: 'Capítulo Único',
      paragraphs: [content || 'Arquivo vazio.'],
      wordCount: content.split(/\s+/).length
    });
  }

  const totalWords = chapters.reduce((acc, ch) => acc + ch.wordCount, 0);
  const estimatedReadingMinutes = Math.max(1, Math.round(totalWords / 220));
  const estimatedAudioMinutes = Math.max(1, Math.round(totalWords / 150));

  return {
    id: `user-book-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    title,
    author: 'Documento de Texto',
    format: 'txt',
    coverUrl: '',
    chapters,
    totalWords,
    estimatedReadingMinutes,
    estimatedAudioMinutes,
    category: 'Textos & Notas',
    progressPercent: 0,
    currentChapterIndex: 0,
    currentParagraphIndex: 0,
    lastReadAt: Date.now(),
    isFavorite: false,
    fileSize: file.size,
    addedAt: Date.now()
  };
}
