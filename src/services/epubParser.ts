import JSZip from 'jszip';
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

function findZipFile(zip: JSZip, path: string): JSZip.JSZipObject | null {
  if (!path) return null;

  // 1. Direct path
  let file = zip.file(path);
  if (file) return file;

  // 2. Decoded URI
  const decoded = decodeURIComponent(path);
  file = zip.file(decoded);
  if (file) return file;

  // 3. Without leading slash
  const noSlash = path.replace(/^\/+/, '');
  file = zip.file(noSlash) || zip.file(decodeURIComponent(noSlash));
  if (file) return file;

  // 4. Case-insensitive filename or suffix search
  const lowerTarget = noSlash.toLowerCase();
  const lowerBase = noSlash.split('/').pop()?.toLowerCase();

  for (const relativePath of Object.keys(zip.files)) {
    const lowerRel = relativePath.toLowerCase();
    if (lowerRel === lowerTarget || (lowerBase && lowerRel.endsWith('/' + lowerBase)) || lowerRel === lowerBase) {
      return zip.files[relativePath];
    }
  }

  return null;
}

function extractParagraphsFromHtml(html: string): { title: string; paragraphs: string[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove non-content elements
  const elementsToRemove = doc.querySelectorAll('script, style, link, meta, noscript');
  elementsToRemove.forEach(el => el.remove());

  // Try to find chapter title
  let title = '';
  const heading = doc.querySelector('h1, h2, h3, title');
  if (heading && heading.textContent) {
    title = cleanText(heading.textContent);
  }

  const paragraphs: string[] = [];

  // Look for block elements: p, blockquote, div
  const pElements = doc.querySelectorAll('p, blockquote, h1, h2, h3, h4, h5, li');
  if (pElements.length > 0) {
    pElements.forEach(el => {
      const txt = cleanText(el.textContent || '');
      if (txt.length > 10) {
        paragraphs.push(txt);
      }
    });
  }

  // Fallback if no block elements matched or list is empty
  if (paragraphs.length === 0) {
    const bodyText = doc.body?.textContent || '';
    const rawParagraphs = bodyText.split(/\n\s*\n/);
    for (const raw of rawParagraphs) {
      const txt = cleanText(raw);
      if (txt.length > 10) {
        paragraphs.push(txt);
      }
    }
  }

  return { title, paragraphs };
}

export async function parseEpubFile(file: File): Promise<Book> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  // 1. Read container.xml to locate rootfile (OPF)
  const containerFile = findZipFile(loadedZip, 'META-INF/container.xml');
  let opfPath = 'OEBPS/content.opf';

  if (containerFile) {
    const containerXml = await containerFile.async('string');
    const domParser = new DOMParser();
    const containerDoc = domParser.parseFromString(containerXml, 'application/xml');
    const rootfileEl = containerDoc.querySelector('rootfile');
    const fullPathAttr = rootfileEl?.getAttribute('full-path');
    if (fullPathAttr) {
      opfPath = fullPathAttr;
    }
  }

  // Find OPF file
  let opfFile = findZipFile(loadedZip, opfPath);
  if (!opfFile) {
    // Search for any .opf file in the zip
    for (const relativePath of Object.keys(loadedZip.files)) {
      if (relativePath.toLowerCase().endsWith('.opf')) {
        opfFile = loadedZip.files[relativePath];
        opfPath = relativePath;
        break;
      }
    }
  }

  if (!opfFile) {
    throw new Error('Arquivo EPUB inválido: pacote de conteúdo (.opf) não encontrado.');
  }

  const opfContent = await opfFile.async('string');
  const domParser = new DOMParser();
  const opfDoc = domParser.parseFromString(opfContent, 'application/xml');

  // 2. Extract Metadata
  const rawTitle = opfDoc.querySelector('metadata title, dc\\:title, title')?.textContent || '';
  const title = cleanText(rawTitle) || file.name.replace(/\.epub$/i, '');

  const rawAuthor = opfDoc.querySelector('metadata creator, dc\\:creator, creator')?.textContent || '';
  const author = cleanText(rawAuthor) || 'Autor desconhecido';

  const rawDesc = opfDoc.querySelector('metadata description, dc\\:description, description')?.textContent || '';
  const description = cleanText(rawDesc);

  const rawLang = opfDoc.querySelector('metadata language, dc\\:language, language')?.textContent || '';
  const language = cleanText(rawLang) || 'pt-BR';

  // 3. Resolve path base for OPF items
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

  // 4. Manifest map: id -> { href, mediaType }
  const manifestItems: Record<string, { href: string; mediaType: string }> = {};
  let coverHref = '';

  const manifestEls = Array.from(opfDoc.querySelectorAll('manifest item, item'));
  for (const item of manifestEls) {
    const id = item.getAttribute('id') || '';
    const href = item.getAttribute('href') || '';
    const mediaType = item.getAttribute('media-type') || '';
    const properties = item.getAttribute('properties') || '';

    if (id && href) {
      manifestItems[id] = { href, mediaType };

      if (
        properties.includes('cover-image') ||
        id.toLowerCase().includes('cover') ||
        href.toLowerCase().includes('cover')
      ) {
        if (mediaType.startsWith('image/')) {
          coverHref = href;
        }
      }
    }
  }

  // Extract cover image if found
  let coverUrl = '';
  if (coverHref) {
    const coverFile = findZipFile(loadedZip, opfDir + coverHref) || findZipFile(loadedZip, coverHref);
    if (coverFile) {
      try {
        const base64 = await coverFile.async('base64');
        const ext = coverHref.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
        coverUrl = `data:image/${ext};base64,${base64}`;
      } catch {
        // cover fallback
      }
    }
  }

  // 5. Spine: sequence of reading items
  const spineItemrefs = opfDoc.querySelectorAll('spine itemref, itemref');
  const chapters: Chapter[] = [];
  let chapterIndex = 1;

  for (let i = 0; i < spineItemrefs.length; i++) {
    const idref = spineItemrefs[i].getAttribute('idref');
    if (!idref || !manifestItems[idref]) continue;

    const item = manifestItems[idref];
    const chapterFile = findZipFile(loadedZip, opfDir + item.href) || findZipFile(loadedZip, item.href);

    if (chapterFile) {
      const chapterContent = await chapterFile.async('string');
      const { title: chapTitle, paragraphs } = extractParagraphsFromHtml(chapterContent);

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
  }

  // Fallback if spine was empty: scan all .html / .xhtml files
  if (chapters.length === 0) {
    const htmlFiles = Object.keys(loadedZip.files).filter(p => 
      p.toLowerCase().endsWith('.html') || 
      p.toLowerCase().endsWith('.xhtml') || 
      p.toLowerCase().endsWith('.htm')
    );

    for (const hPath of htmlFiles) {
      const f = loadedZip.files[hPath];
      if (!f.dir) {
        const content = await f.async('string');
        const { title: chapTitle, paragraphs } = extractParagraphsFromHtml(content);
        if (paragraphs.length > 0) {
          const wordCount = paragraphs.reduce((acc, p) => acc + p.split(/\s+/).length, 0);
          chapters.push({
            id: `chap-${chapterIndex}`,
            title: chapTitle || `Seção ${chapterIndex}`,
            paragraphs,
            wordCount
          });
          chapterIndex++;
        }
      }
    }
  }

  if (chapters.length === 0) {
    throw new Error('Não foi possível extrair o texto dos capítulos do arquivo EPUB. Verifique se o livro contém texto digital legível.');
  }

  // Calculate totals
  const totalWords = chapters.reduce((acc, ch) => acc + ch.wordCount, 0);
  const estimatedReadingMinutes = Math.max(1, Math.round(totalWords / 220));
  const estimatedAudioMinutes = Math.max(1, Math.round(totalWords / 150));

  // Determine auto-category
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
    format: 'epub',
    coverUrl: coverUrl || '',
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
