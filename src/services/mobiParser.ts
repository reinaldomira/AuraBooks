// @ts-ignore
import { MOBI } from 'foliate-js/mobi.js';
// @ts-ignore
import * as fflate from 'foliate-js/vendor/fflate.js';
import { Book, Chapter } from '../types/book';

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractParagraphsFromDoc(doc: Document): { title: string; paragraphs: string[] } {
  // Remove elementos desnecessários para leitura
  const elementsToRemove = doc.querySelectorAll('script, style, link, meta, noscript');
  elementsToRemove.forEach(el => el.remove());

  // Procura título da seção ou cabeçalho
  let title = '';
  const heading = doc.querySelector('h1, h2, h3, title');
  if (heading && heading.textContent) {
    title = cleanText(heading.textContent);
  }

  const paragraphs: string[] = [];
  const pElements = doc.querySelectorAll('p, blockquote, dd, li');
  if (pElements.length > 0) {
    pElements.forEach(p => {
      const txt = cleanText(p.textContent || '');
      if (txt.length > 10) {
        paragraphs.push(txt);
      }
    });
  } else {
    // Fallback se não houver tags de parágrafo
    const bodyText = doc.body?.textContent || '';
    const rawParas = bodyText.split(/\n\s*\n/);
    rawParas.forEach(rp => {
      const txt = cleanText(rp);
      if (txt.length > 15) {
        paragraphs.push(txt);
      }
    });
  }

  return { title, paragraphs };
}

/**
 * Analisa e extrai metadados, capa e conteúdo de arquivos .MOBI e .AZW3 (KF8)
 * utilizando o motor de decodificação do Foliate.js.
 */
export async function parseMobiOrAzw3File(file: File | Blob, originalFileName?: string): Promise<Book> {
  const fileName = originalFileName || (file instanceof File ? file.name : 'livro.mobi');
  const lowerName = fileName.toLowerCase().trim();
  const isAzw3 = lowerName.endsWith('.azw3') || lowerName.endsWith('.kf8');
  const format: 'mobi' | 'azw3' = isAzw3 ? 'azw3' : 'mobi';

  let bookData: any;
  try {
    const mobiInstance = new MOBI({ unzlib: fflate.unzlibSync });
    bookData = await mobiInstance.open(file);
  } catch (err: any) {
    console.error('Erro ao decodificar arquivo MOBI/AZW3:', err);
    const msg = err?.message || '';
    if (msg.includes('encryption') || msg.includes('DRM') || msg.includes('compression')) {
      throw new Error('Este arquivo Kindle pode conter proteção por DRM (direitos da Amazon) ou compressão não suportada. Converta-o para EPUB ou remova o DRM antes de carregar.');
    }
    throw new Error(`Falha ao ler arquivo ${format.toUpperCase()}: ${msg || 'Arquivo corrompido ou formato incompatível'}`);
  }

  const metadata = bookData?.metadata || {};
  const fallbackTitle = fileName.replace(/\.(mobi|azw3|azw|kf8|prc)$/i, '').replace(/[-_]/g, ' ').trim() || 'Livro Sem Título';
  const title = (typeof metadata.title === 'string' && metadata.title.trim()) ? metadata.title.trim() : fallbackTitle;
  
  let author = 'Autor Desconhecido';
  if (Array.isArray(metadata.author) && metadata.author.length > 0) {
    author = metadata.author.join(', ');
  } else if (typeof metadata.author === 'string' && metadata.author.trim()) {
    author = metadata.author.trim();
  }

  const description = (typeof metadata.description === 'string') ? metadata.description.trim() : '';
  const language = (typeof metadata.language === 'string') ? metadata.language : 'pt';

  // Extrai imagem de capa se presente no cabeçalho EXTH
  let coverUrl = '';
  try {
    const coverBlob = await bookData.getCover?.();
    if (coverBlob && coverBlob.size > 0) {
      coverUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(typeof reader.result === 'string' ? reader.result : '');
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(coverBlob);
      });
    }
  } catch (coverErr) {
    console.warn('Não foi possível extrair capa do MOBI/AZW3:', coverErr);
  }

  // Extrai seções e capítulos legíveis
  const chapters: Chapter[] = [];
  const sections = bookData.sections || [];
  let chapterIndex = 1;

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    if (sec && sec.linear !== 'no') {
      try {
        const doc: Document | null = sec.createDocument
          ? await sec.createDocument()
          : (bookData.createDocument ? await bookData.createDocument(sec) : null);

        if (doc) {
          const { title: chapTitle, paragraphs } = extractParagraphsFromDoc(doc);
          if (paragraphs.length > 0) {
            const wordCount = paragraphs.reduce((acc, p) => acc + p.split(/\s+/).length, 0);
            chapters.push({
              id: `chap-${chapterIndex}`,
              title: chapTitle || `Capítulo ${chapterIndex}`,
              paragraphs,
              wordCount
            });
            chapterIndex++;
          }
        }
      } catch (secErr) {
        console.warn(`Erro ao ler seção ${i} do MOBI/AZW3:`, secErr);
      }
    }
  }

  // Fallback caso a extração direta de seções não produza capítulos com texto
  if (chapters.length === 0) {
    chapters.push({
      id: 'chap-1',
      title,
      paragraphs: [
        description || 'Livro importado com sucesso. Arquivo pronto para leitura imersiva completa com ajuste tipográfico e navegação.'
      ],
      wordCount: 30
    });
  }

  const totalWords = chapters.reduce((acc, ch) => acc + ch.wordCount, 0);
  const estimatedReadingMinutes = Math.max(1, Math.round(totalWords / 220));
  const estimatedAudioMinutes = Math.max(1, Math.round(totalWords / 150));

  let category = 'Literatura';
  const lowerTitle = title.toLowerCase();
  const lowerDesc = description.toLowerCase();
  if (lowerTitle.includes('filosofia') || lowerDesc.includes('filosofia')) category = 'Filosofia';
  else if (lowerTitle.includes('história') || lowerDesc.includes('história')) category = 'História';
  else if (lowerTitle.includes('conto') || lowerTitle.includes('poesia') || lowerDesc.includes('poesia')) category = 'Poesia & Contos';
  else if (lowerTitle.includes('ficção') || lowerDesc.includes('sci-fi') || lowerDesc.includes('fantasia')) category = 'Ficção & Fantasia';
  else if (language.startsWith('pt')) category = 'Literatura em Português';

  return {
    id: `user-book-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    title,
    author,
    format,
    coverUrl,
    chapters,
    totalWords,
    estimatedReadingMinutes,
    estimatedAudioMinutes,
    category,
    progressPercent: 0,
    currentChapterIndex: 0,
    currentParagraphIndex: 0,
    lastReadAt: Date.now(),
    isFavorite: false,
    fileSize: file.size,
    addedAt: Date.now(),
    description,
    language
  };
}
