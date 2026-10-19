/**
 * coverService.ts
 * 
 * Serviço especializado e ultra-resiliente para extração, otimização, recuperação
 * e geração de capas de livros em todos os formatos (.EPUB, .PDF, .MOBI, .AZW3, .TXT).
 * 
 * Resolve definitivamente o problema de capas ausentes quando o usuário acessa em outro
 * computador, quando a sincronização inicial veio sem os dados visuais, ou quando o arquivo
 * não continha capa embutida.
 */

import JSZip from 'jszip';
// @ts-ignore
import { makeBook } from 'foliate-js/view.js';
// @ts-ignore
import { MOBI } from 'foliate-js/mobi.js';
// @ts-ignore
import * as fflate from 'foliate-js/vendor/fflate.js';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Book } from '../types/book';
import { saveBook, getAllBooks } from './storageService';
import { hasOriginalEpub, getOriginalEpub, saveOriginalEpub } from './epubStorageService';
import { downloadBookFromDrive, isDriveAuthorized } from './googleDriveService';
import { auth, syncBookToCloud } from './firebase';

// Configura o worker do PDF.js
try {
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  }
} catch {
  // worker fallback
}

/**
 * Limpa o nome do livro e remove extensões, tags de sites e numerações espúrias
 */
export function cleanBookTitleForSearch(rawTitle: string): string {
  if (!rawTitle) return '';
  return rawTitle
    .replace(/\.(epub|pdf|mobi|azw3|azw|txt|kf8)$/i, '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^\)]*(?:z-lib|annas|lelivros|doc|pdf|epub)[^\)]*\)/gi, ' ')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normaliza e sanitiza uma URL de capa (converte HTTP para HTTPS e remove blobs inválidos entre dispositivos)
 */
export function normalizeCoverUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  let trimmed = url.trim();
  if (trimmed.startsWith('blob:')) return ''; // Blob URLs são efêmeras e não funcionam entre dispositivos
  // Converte HTTP para HTTPS universalmente para não sofrer bloqueio de Conteúdo Misto em celulares (PWAs / iOS / Android)
  if (trimmed.startsWith('http://')) {
    trimmed = trimmed.replace('http://', 'https://');
  }
  return trimmed;
}

/**
 * Valida se uma string é uma URL de capa válida e utilizável no navegador (data:image, https://, http://)
 * Blob URLs são rejeitadas para armazenamento persistente pois não funcionam entre abas ou dispositivos (computador -> celular)
 */
export function isValidCoverUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.length < 15) return false;
  if (trimmed.toLowerCase() === 'error' || trimmed === 'null' || trimmed === 'undefined' || trimmed === '[object object]') return false;
  if (trimmed.startsWith('blob:')) return false; // Blobs não são persistentes
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://')
  );
}

/**
 * Redimensiona e otimiza uma imagem (Blob, DataURL ou URL remota) para um thumbnail nítido e leve (~320-360px de largura).
 * Evita estourar o limite de 1MB do Firestore e garante carregamento ultra-rápido no celular (~25-45KB).
 */
export async function optimizeCoverImage(imageBlobOrDataUrl: Blob | string, maxWidth: number = 340): Promise<string> {
  return new Promise((resolve) => {
    const isBlob = imageBlobOrDataUrl instanceof Blob;
    const isRemote = typeof imageBlobOrDataUrl === 'string' && (imageBlobOrDataUrl.startsWith('http://') || imageBlobOrDataUrl.startsWith('https://'));

    const img = new Image();

    // CRÍTICO: Nunca definir crossOrigin em data: ou blob:, pois em navegadores mobile (WebKit/Safari)
    // isso causa SecurityError / violação de CORS imediata e mancha o canvas!
    if (isRemote) {
      img.crossOrigin = 'anonymous';
    }

    let objectUrl = '';
    let isSettled = false;

    const cleanUp = () => {
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          // ignore
        }
      }
    };

    const finish = (result: string) => {
      if (isSettled) return;
      isSettled = true;
      cleanUp();
      resolve(result);
    };

    // Timeout defensivo de 3.5s para nunca travar a sincronização
    const timer = setTimeout(() => {
      finish(typeof imageBlobOrDataUrl === 'string' ? imageBlobOrDataUrl : '');
    }, 3500);

    img.onload = () => {
      clearTimeout(timer);
      try {
        if (!img.width || !img.height) {
          finish(typeof imageBlobOrDataUrl === 'string' ? imageBlobOrDataUrl : '');
          return;
        }

        const aspect = img.height / img.width;
        const targetWidth = Math.min(img.width, maxWidth);
        const targetHeight = Math.round(targetWidth * aspect);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          finish(typeof imageBlobOrDataUrl === 'string' ? imageBlobOrDataUrl : '');
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        try {
          const optimized = canvas.toDataURL('image/jpeg', 0.82);
          finish(optimized);
        } catch {
          // Se for imagem remota sem headers CORS, não consegue exportar canvas; retorna URL direta original
          finish(typeof imageBlobOrDataUrl === 'string' ? imageBlobOrDataUrl : '');
        }
      } catch {
        finish(typeof imageBlobOrDataUrl === 'string' ? imageBlobOrDataUrl : '');
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      finish(typeof imageBlobOrDataUrl === 'string' ? imageBlobOrDataUrl : '');
    };

    if (isBlob) {
      objectUrl = URL.createObjectURL(imageBlobOrDataUrl);
      img.src = objectUrl;
    } else {
      img.src = imageBlobOrDataUrl as string;
    }
  });
}

/**
 * Paletas clássicas para capas geradas em canvas
 */
interface CoverPalette {
  name: string;
  gradientTop: string;
  gradientBottom: string;
  accentGold: string;
  accentSub: string;
  textColor: string;
  labelColor: string;
  borderGold: string;
}

const CLASSIC_PALETTES: CoverPalette[] = [
  {
    name: 'warm-amber',
    gradientTop: '#3D1B06',
    gradientBottom: '#1F0B02',
    accentGold: '#F59E0B',
    accentSub: '#FDE68A',
    textColor: '#FFFBEB',
    labelColor: '#D97706',
    borderGold: 'rgba(245, 158, 11, 0.45)',
  },
  {
    name: 'midnight-navy',
    gradientTop: '#0F172A',
    gradientBottom: '#020617',
    accentGold: '#EAB308',
    accentSub: '#FEF08A',
    textColor: '#F8FAFC',
    labelColor: '#CA8A04',
    borderGold: 'rgba(234, 179, 8, 0.45)',
  },
  {
    name: 'forest-emerald',
    gradientTop: '#064E3B',
    gradientBottom: '#022C22',
    accentGold: '#10B981',
    accentSub: '#A7F3D0',
    textColor: '#F0FDF4',
    labelColor: '#059669',
    borderGold: 'rgba(16, 185, 129, 0.45)',
  },
  {
    name: 'burgundy-crimson',
    gradientTop: '#4C0519',
    gradientBottom: '#1F0208',
    accentGold: '#F43F5E',
    accentSub: '#FECDD3',
    textColor: '#FFF1F2',
    labelColor: '#E11D48',
    borderGold: 'rgba(244, 63, 94, 0.45)',
  },
  {
    name: 'slate-obsidian',
    gradientTop: '#1E293B',
    gradientBottom: '#0F172A',
    accentGold: '#CBD5E1',
    accentSub: '#F1F5F9',
    textColor: '#FFFFFF',
    labelColor: '#94A3B8',
    borderGold: 'rgba(203, 213, 225, 0.4)',
  },
];

/**
 * Escolhe uma paleta determinística com base no título e autor
 */
function pickPaletteForBook(title: string, author?: string): CoverPalette {
  const combined = `${title || ''}-${author || ''}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % CLASSIC_PALETTES.length;
  return CLASSIC_PALETTES[index];
}

/**
 * Quebra o texto em linhas para caber na largura especificada do Canvas
 */
function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && i > 0) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Gera uma capa gráfica editorial de altíssima qualidade (Canvas 380x570)
 * para qualquer livro que não tenha imagem embutida ou quando o acesso remoto falha.
 * 
 * Inclui lombada 3D, moldura gravada a ouro, tipografia serifada balanceada e selo de acervo.
 */
export function generatePublisherCanvasCover(
  title: string,
  author?: string,
  format?: string,
  category?: string
): string {
  try {
    const width = 380;
    const height = 570;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const cleanTitle = cleanBookTitleForSearch(title) || 'Obra Literária';
    const cleanAuthor = (author && author.toLowerCase() !== 'autor desconhecido') 
      ? author.replace(/\[[^\]]*\]/g, '').trim() 
      : 'Biblioteca Lumina';
    const fmt = (format || 'livro').toUpperCase();
    const cat = (category || 'Literatura Clássica').toUpperCase();

    const palette = pickPaletteForBook(cleanTitle, cleanAuthor);

    // 1. Fundo Gradiente Rico
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, palette.gradientTop);
    bgGrad.addColorStop(1, palette.gradientBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Textura sutil de encadernação (linhas finas cruzadas)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 6) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();

    // 3. Moldura Dupla Clássica Gravada a Ouro
    ctx.save();
    // Borda Externa
    ctx.strokeStyle = palette.borderGold;
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, width - 36, height - 36);

    // Borda Interna Fina
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(24, 24, width - 48, height - 48);

    // Cantos decorativos (pequenos losangos nos 4 cantos)
    const corners = [
      { x: 21, y: 21 },
      { x: width - 21, y: 21 },
      { x: 21, y: height - 21 },
      { x: width - 21, y: height - 21 }
    ];
    ctx.fillStyle = palette.accentGold;
    corners.forEach(c => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // 4. Cabeçalho: Formato e Coleção
    ctx.save();
    ctx.fillStyle = palette.accentSub;
    ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '2px';
    ctx.fillText(`✦  EDIÇÃO  •  ${fmt}  ✦`, width / 2, 58);
    ctx.restore();

    // 5. Emblema Literário Central Superior
    ctx.save();
    ctx.strokeStyle = palette.accentGold;
    ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Losango central
    const cx = width / 2;
    const cy = 95;
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx + 14, cy);
    ctx.lineTo(cx, cy + 14);
    ctx.lineTo(cx - 14, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Ponto no centro do emblema
    ctx.fillStyle = palette.accentGold;
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 6. Título da Obra (com cálculo dinâmico de tamanho para nunca estourar)
    ctx.save();
    ctx.fillStyle = palette.textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let fontSize = 28;
    if (cleanTitle.length > 50) fontSize = 20;
    else if (cleanTitle.length > 30) fontSize = 23;
    else if (cleanTitle.length > 18) fontSize = 26;

    ctx.font = `bold ${fontSize}px "Cinzel", "Playfair Display", "Georgia", serif`;
    let titleLines = wrapCanvasText(ctx, cleanTitle, width - 70);

    // Se ainda tiver muitas linhas, reduz a fonte
    if (titleLines.length > 4) {
      fontSize = 19;
      ctx.font = `bold ${fontSize}px "Cinzel", "Playfair Display", "Georgia", serif`;
      titleLines = wrapCanvasText(ctx, cleanTitle, width - 70);
    }

    const lineHeight = fontSize * 1.25;
    const totalTitleHeight = titleLines.length * lineHeight;
    let startY = 240 - totalTitleHeight / 2;

    titleLines.forEach((line, idx) => {
      ctx.fillText(line, width / 2, startY + idx * lineHeight);
    });
    ctx.restore();

    // 7. Divisor Elegante de Ouro abaixo do título
    ctx.save();
    const divY = Math.max(startY + totalTitleHeight + 18, 310);
    ctx.strokeStyle = palette.borderGold;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 50, divY);
    ctx.lineTo(width / 2 + 50, divY);
    ctx.stroke();

    ctx.fillStyle = palette.accentGold;
    ctx.beginPath();
    ctx.arc(width / 2, divY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 8. Categoria / Movimento
    ctx.save();
    ctx.fillStyle = palette.accentSub;
    ctx.font = '500 10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '1.5px';
    ctx.fillText(cat.slice(0, 32), width / 2, divY + 32);
    ctx.restore();

    // 9. Nome do Autor
    ctx.save();
    ctx.fillStyle = palette.textColor;
    ctx.font = '600 14px "Playfair Display", "Newsreader", "Georgia", serif';
    ctx.textAlign = 'center';
    ctx.fillText(cleanAuthor, width / 2, height - 90);
    ctx.restore();

    // 10. Selo Lumina Editorial no rodapé
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '600 8px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '2px';
    ctx.fillText('LUMINA BOOKS • BIBLIOTECA EDITORIAL', width / 2, height - 42);
    ctx.restore();

    // 11. Efeito de Lombada 3D (Simulação física do vinco do livro na borda esquerda)
    ctx.save();
    const spineGrad = ctx.createLinearGradient(0, 0, 24, 0);
    spineGrad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
    spineGrad.addColorStop(0.3, 'rgba(0, 0, 0, 0.25)');
    spineGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.12)');
    spineGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = spineGrad;
    ctx.fillRect(0, 0, 24, height);
    ctx.restore();

    return canvas.toDataURL('image/jpeg', 0.88);
  } catch (err) {
    console.warn('Falha ao gerar capa em canvas:', err);
    return '';
  }
}

/**
 * Busca a capa oficial de uma obra na Internet (Open Library e Gemini API)
 */
export async function fetchOnlineCover(title: string, author?: string): Promise<string | null> {
  const cleanTitle = cleanBookTitleForSearch(title);
  if (!cleanTitle || cleanTitle.length < 2) return null;

  const cleanAuthor = author ? author.replace(/\[[^\]]*\]/g, '').trim() : '';

  // 1. Tenta consulta direta no endpoint do servidor (que acessa Open Library e Gemini)
  try {
    const res = await fetch('/api/books/cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: cleanTitle, author: cleanAuthor }),
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.coverUrl && isValidCoverUrl(data.coverUrl)) {
        if (data.coverUrl.startsWith('data:image/')) {
          return data.coverUrl;
        }
        // Tenta otimizar URL remota; se não conseguir no navegador, usa a URL direta
        const optimized = await optimizeCoverImage(data.coverUrl);
        return isValidCoverUrl(optimized) ? optimized : data.coverUrl;
      }
    }
  } catch {
    // Continua para o cliente direto do Open Library
  }

  // 2. Fallback direto no navegador: Consulta Open Library Search API
  try {
    const query = cleanAuthor && cleanAuthor.toLowerCase() !== 'autor desconhecido'
      ? `title=${encodeURIComponent(cleanTitle)}&author=${encodeURIComponent(cleanAuthor)}`
      : `q=${encodeURIComponent(cleanTitle)}`;

    const olRes = await fetch(`https://openlibrary.org/search.json?${query}&limit=3`, {
      signal: AbortSignal.timeout(5000),
    });

    if (olRes.ok) {
      const olData = await olRes.json();
      const docs = olData.docs || [];
      for (const doc of docs) {
        if (doc.cover_i) {
          const directUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
          const optimized = await optimizeCoverImage(directUrl);
          return isValidCoverUrl(optimized) ? optimized : directUrl;
        }
      }
    }
  } catch (err) {
    console.warn('Falha ao consultar Open Library diretamente:', err);
  }

  return null;
}

/**
 * Extrai a capa de um PDF renderizando a primeira página em um canvas.
 */
async function extractCoverFromPdf(fileOrBlob: File | Blob): Promise<string> {
  try {
    const arrayBuffer = await fileOrBlob.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
    });

    const pdfDoc = await loadingTask.promise;
    const firstPage = await pdfDoc.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1.0 });
    const scale = 360 / viewport.width;
    const scaledViewport = firstPage.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return '';

    // @ts-expect-error pdfjs typing nuance
    await firstPage.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch (err) {
    console.warn('Falha ao renderizar capa do PDF:', err);
    return '';
  }
}

/**
 * Extrai a capa de um EPUB usando JSZip com busca exaustiva (OPF cover meta, manifest e primeira imagem).
 */
async function extractCoverFromEpubWithZip(fileOrBlob: File | Blob): Promise<string> {
  try {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(fileOrBlob);

    // 1. Localiza o OPF
    let opfPath = '';
    const containerFile = loadedZip.files['META-INF/container.xml'];
    if (containerFile) {
      const containerXml = await containerFile.async('string');
      const match = containerXml.match(/full-path=["']([^"']+)["']/i);
      if (match && match[1]) opfPath = match[1];
    }

    if (!opfPath) {
      const opfKey = Object.keys(loadedZip.files).find(k => k.toLowerCase().endsWith('.opf'));
      if (opfKey) opfPath = opfKey;
    }

    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

    if (opfPath && loadedZip.files[opfPath]) {
      const opfContent = await loadedZip.files[opfPath].async('string');
      const parser = new DOMParser();
      const opfDoc = parser.parseFromString(opfContent, 'application/xml');

      // Tentativa A: <meta name="cover" content="item_id"/> (Padrão EPUB 2)
      const metaCoverId = opfDoc.querySelector('meta[name="cover"]')?.getAttribute('content');
      if (metaCoverId) {
        const item = opfDoc.querySelector(`manifest item[id="${metaCoverId}"], item[id="${metaCoverId}"]`);
        const href = item?.getAttribute('href');
        if (href) {
          const coverFile = loadedZip.file(opfDir + href) || loadedZip.file(href);
          if (coverFile) {
            const blob = await coverFile.async('blob');
            return await optimizeCoverImage(blob);
          }
        }
      }

      // Tentativa B: manifest item com properties="cover-image" (Padrão EPUB 3)
      const epub3Cover = opfDoc.querySelector('manifest item[properties*="cover-image"], item[properties*="cover-image"]');
      if (epub3Cover) {
        const href = epub3Cover.getAttribute('href');
        if (href) {
          const coverFile = loadedZip.file(opfDir + href) || loadedZip.file(href);
          if (coverFile) {
            const blob = await coverFile.async('blob');
            return await optimizeCoverImage(blob);
          }
        }
      }

      // Tentativa C: item com 'cover' no id ou no href
      const anyCoverItem = Array.from(opfDoc.querySelectorAll('manifest item, item')).find(el => {
        const id = (el.getAttribute('id') || '').toLowerCase();
        const href = (el.getAttribute('href') || '').toLowerCase();
        const media = (el.getAttribute('media-type') || '').toLowerCase();
        return media.startsWith('image/') && (id.includes('cover') || href.includes('cover') || href.includes('capa'));
      });

      if (anyCoverItem) {
        const href = anyCoverItem.getAttribute('href');
        if (href) {
          const coverFile = loadedZip.file(opfDir + href) || loadedZip.file(href);
          if (coverFile) {
            const blob = await coverFile.async('blob');
            return await optimizeCoverImage(blob);
          }
        }
      }
    }

    // Tentativa D: Varre os arquivos do zip procurando imagens com "cover" ou "capa" no nome
    const allFiles = Object.keys(loadedZip.files);
    const coverFileKey = allFiles.find(name => {
      const lower = name.toLowerCase();
      const isImg = lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp');
      return isImg && (lower.includes('cover') || lower.includes('capa') || lower.includes('titlepage') || lower.includes('jacket'));
    });

    if (coverFileKey) {
      const blob = await loadedZip.files[coverFileKey].async('blob');
      return await optimizeCoverImage(blob);
    }

    // Tentativa E: Primeira imagem encontrada no zip inteiro
    const firstImgKey = allFiles.find(name => {
      const lower = name.toLowerCase();
      return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp');
    });

    if (firstImgKey) {
      const blob = await loadedZip.files[firstImgKey].async('blob');
      return await optimizeCoverImage(blob);
    }

  } catch (err) {
    console.warn('Falha na extração de capa via JSZip:', err);
  }

  return '';
}

/**
 * Extrai a capa de qualquer arquivo de livro (.epub, .pdf, .mobi, .azw3)
 */
export async function extractCoverFromFile(fileOrBlob: File | Blob, formatHint?: string): Promise<string> {
  const fileName = fileOrBlob instanceof File ? fileOrBlob.name.toLowerCase() : '';
  const hint = (formatHint || '').toLowerCase();
  
  const isPdf = hint === 'pdf' || fileName.endsWith('.pdf');
  const isMobi = hint === 'mobi' || hint === 'azw3' || fileName.endsWith('.mobi') || fileName.endsWith('.azw3') || fileName.endsWith('.kf8');

  // 1. PDF
  if (isPdf) {
    return await extractCoverFromPdf(fileOrBlob);
  }

  // 2. MOBI / AZW3
  if (isMobi) {
    try {
      const mobiInstance = new MOBI({ unzlib: fflate.unzlibSync });
      const bookData = await mobiInstance.open(fileOrBlob);
      const coverBlob = await bookData?.getCover?.();
      if (coverBlob && coverBlob.size > 0) {
        return await optimizeCoverImage(coverBlob);
      }
    } catch (mobiErr) {
      console.warn('Falha ao extrair capa via foliate MOBI:', mobiErr);
    }
  }

  // 3. EPUB: Tenta primeiro Foliate makeBook
  try {
    const book = await makeBook(fileOrBlob);
    const coverBlob = await book?.getCover?.();
    if (coverBlob && coverBlob.size > 0) {
      const optimized = await optimizeCoverImage(coverBlob);
      if (optimized) return optimized;
    }
  } catch {
    // Continua para o extrator com JSZip
  }

  // 4. Fallback EPUB com JSZip
  const zipCover = await extractCoverFromEpubWithZip(fileOrBlob);
  if (zipCover) return zipCover;

  return '';
}

/**
 * Recupera ou regera a capa de um livro específico na biblioteca local.
 * 
 * Pipeline multi-camada ultra-robusto:
 * 1. Se já tiver capa válida e leve, retorna. Se for pesada (>500KB), otimiza para nuvem.
 * 2. Tenta extrair do arquivo original local (IndexedDB).
 * 3. Se estiver em outro PC mas existir no Google Drive, baixa do Drive e extrai.
 * 4. Busca capa oficial na Internet (Open Library / Gemini API).
 * 5. Se nenhuma capa for encontrada, gera uma belíssima capa de encadernação em Canvas.
 * 6. Persiste no IndexedDB local e sincroniza com o Firestore na nuvem!
 */
export async function repairMissingBookCover(
  book: Book,
  options?: { forceOnline?: boolean; forceRegenerate?: boolean; brokenUrl?: string }
): Promise<string> {
  try {
    const isBroken = !!(options?.brokenUrl && (book.coverUrl === options.brokenUrl || !isValidCoverUrl(book.coverUrl)));

    // 1. Verifica se já possui uma capa válida (e que não seja uma URL que falhou)
    if (
      !options?.forceOnline &&
      !options?.forceRegenerate &&
      !isBroken &&
      isValidCoverUrl(book.coverUrl)
    ) {
      // Se for uma capa personalizada enviada pelo usuário, preserva sempre (a menos que esteja quebrada)
      if (book.customCoverApplied && !isBroken) {
        return book.coverUrl;
      }

      // Se for uma imagem Base64 muito pesada (>80KB), otimiza para que o Firestore aceite sincronizar com celulares
      if (book.coverUrl.startsWith('data:image') && book.coverUrl.length > 80000) {
        const compressed = await optimizeCoverImage(book.coverUrl, 320);
        if (compressed && compressed.length < book.coverUrl.length && isValidCoverUrl(compressed)) {
          book.coverUrl = compressed;
          await saveBook(book);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('aurabooks_book_updated', { detail: { ...book, coverUrl: compressed } }));
          }
          if (auth.currentUser) {
            try { await syncBookToCloud(auth.currentUser.uid, book); } catch {}
          }
        }
      }
      return book.coverUrl;
    }

    let resolvedCoverUrl = '';

    // 2. Tenta obter o arquivo físico local (IndexedDB) e extrair
    if (!options?.forceOnline) {
      const existsLocally = await hasOriginalEpub(book.id);
      if (existsLocally) {
        const fileBlob = await getOriginalEpub(book.id);
        if (fileBlob) {
          const extracted = await extractCoverFromFile(fileBlob, book.format);
          if (extracted && extracted.length > 100) {
            resolvedCoverUrl = extracted;
          }
        }
      }
    }

    // 3. Se não tiver localmente mas tiver no Google Drive, baixa do Drive
    if (!resolvedCoverUrl && !options?.forceOnline && book.driveFileId && isDriveAuthorized()) {
      try {
        const driveBlob = await downloadBookFromDrive(book.driveFileId);
        if (driveBlob) {
          await saveOriginalEpub(book.id, driveBlob);
          const extracted = await extractCoverFromFile(driveBlob, book.format);
          if (extracted && extracted.length > 100) {
            resolvedCoverUrl = extracted;
          }
        }
      } catch (driveErr) {
        console.warn(`Aviso ao baixar livro "${book.title}" do Drive para extrair capa:`, driveErr);
      }
    }

    // 4. Busca capa oficial na internet (Open Library / Gemini)
    if (!resolvedCoverUrl) {
      const onlineCover = await fetchOnlineCover(book.title, book.author);
      if (isValidCoverUrl(onlineCover)) {
        resolvedCoverUrl = onlineCover!;
      }
    }

    // 5. Se o usuário pediu busca online explicitamente e não há foto nos acervos,
    // NÃO gera capa artificial ("fake") — retorna vazio para que o usuário seja informado
    // e possa carregar sua própria imagem do computador!
    if (!resolvedCoverUrl && options?.forceOnline) {
      return '';
    }

    // 6. Se obteve capa real (extraída do arquivo ou online), persiste e atualiza
    if (resolvedCoverUrl) {
      book.coverUrl = resolvedCoverUrl;
      book.isCanvasCover = false;
      book.coverUpdatedAt = book.coverUpdatedAt || Date.now();
      await saveBook(book);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('aurabooks_book_updated', { detail: { ...book, coverUrl: resolvedCoverUrl } }));
      }

      // Sincroniza metadados com Firestore se logado
      if (auth.currentUser) {
        try {
          const { syncCoverOnlyToCloud } = await import('./firebase');
          await syncCoverOnlyToCloud(
            auth.currentUser.uid,
            book.id,
            resolvedCoverUrl,
            !!book.customCoverApplied,
            false,
            book.coverUpdatedAt
          );
        } catch {
          // ignore
        }
      }

      return resolvedCoverUrl;
    }

    // 7. Fallback local em canvas (quando não há arquivo físico nem capa online)
    // CRÍTICO: Marca isCanvasCover = true e NÃO sobregrava a nuvem com fallback em canvas
    // para evitar que um dispositivo sem o arquivo sobrescreva uma capa real já salva na nuvem.
    const fallbackCover = generatePublisherCanvasCover(book.title, book.author, book.format, book.category);
    book.coverUrl = fallbackCover;
    book.isCanvasCover = true;
    book.coverUpdatedAt = book.coverUpdatedAt || (book.addedAt || Date.now());
    await saveBook(book);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aurabooks_book_updated', { detail: { ...book, coverUrl: fallbackCover } }));
    }
    return fallbackCover;
  } catch (err) {
    console.warn(`Erro ao reparar capa do livro ${book.title}:`, err);
    if (options?.forceOnline) return '';
    const emergencyCover = generatePublisherCanvasCover(book.title, book.author, book.format, book.category);
    book.coverUrl = emergencyCover;
    book.isCanvasCover = true;
    book.coverUpdatedAt = book.coverUpdatedAt || (book.addedAt || Date.now());
    await saveBook(book);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aurabooks_book_updated', { detail: { ...book, coverUrl: emergencyCover } }));
    }
    return emergencyCover;
  }
}

export interface CoverOperationResult {
  coverUrl: string;
  coverUpdatedAt: number;
  isCanvasCover?: boolean;
  localSuccess: boolean;
  cloudSynced: boolean;
  error?: string;
}

/**
 * Define e persiste uma capa personalizada enviada pelo usuário (arquivo local, Base64 ou URL).
 * Otimiza e redimensiona a imagem para caber perfeitamente no Firestore e IndexedDB (~30-60KB).
 * Separa explicitamente o salvamento local da sincronização remota, preservando a capa local se a nuvem falhar.
 */
export async function setCustomBookCover(
  book: Book,
  imageFileOrDataUrl: File | Blob | string
): Promise<CoverOperationResult> {
  const optimized = await optimizeCoverImage(imageFileOrDataUrl, 380);
  if (!optimized || !isValidCoverUrl(optimized)) {
    throw new Error('Não foi possível processar a imagem selecionada. Escolha um arquivo de imagem válido (PNG, JPG, WEBP).');
  }

  const now = Date.now();
  book.coverUrl = optimized;
  book.customCoverApplied = true;
  book.isCanvasCover = false;
  book.coverUpdatedAt = now;
  await saveBook(book);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aurabooks_book_updated', { detail: { ...book } }));
  }

  // Etapa distinta: Sincronização remota da capa com o Firestore
  let cloudSynced = false;
  let syncError: string | undefined = undefined;

  if (auth.currentUser) {
    try {
      const { syncCoverOnlyToCloud } = await import('./firebase');
      cloudSynced = await syncCoverOnlyToCloud(
        auth.currentUser.uid,
        book.id,
        optimized,
        true,
        false,
        now,
        true
      );
      if (!cloudSynced) {
        syncError = 'Sincronização remota pendente (offline ou limite de cota)';
      }
    } catch (syncErr: any) {
      console.warn('Capa salva localmente, mas a sincronização com a nuvem falhou:', syncErr);
      cloudSynced = false;
      syncError = syncErr?.message || 'Falha na conexão com a nuvem';
    }
  }

  return {
    coverUrl: optimized,
    coverUpdatedAt: now,
    isCanvasCover: false,
    localSuccess: true,
    cloudSynced,
    error: syncError,
  };
}

export interface CoverCandidate {
  id: string;
  title: string;
  author?: string;
  thumbnailUrl: string;
  fullUrl: string;
  year?: number;
}

/**
 * Pesquisa múltiplos candidatos a capa em acervos públicos (Open Library e Gemini)
 * Retorna uma galeria de opções para que o usuário escolha a edição visual desejada
 */
export async function searchOnlineCoverCandidates(
  query: string,
  author?: string
): Promise<CoverCandidate[]> {
  const cleanTitle = cleanBookTitleForSearch(query);
  if (!cleanTitle) return [];

  // 1. Tenta endpoint do servidor
  try {
    const res = await fetch('/api/books/cover-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: cleanTitle, author }),
      signal: AbortSignal.timeout(6500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.candidates) && data.candidates.length > 0) {
        return data.candidates;
      }
    }
  } catch (err) {
    console.warn('Erro ao consultar /api/books/cover-search:', err);
  }

  // 2. Fallback direto no navegador com Open Library
  try {
    const olQuery = author ? `${cleanTitle} ${author}` : cleanTitle;
    const olRes = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(olQuery)}&limit=10`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (olRes.ok) {
      const data = await olRes.json();
      const docs = data.docs || [];
      const seen = new Set<number>();
      const candidates: CoverCandidate[] = [];
      for (const d of docs) {
        if (d.cover_i && !seen.has(d.cover_i)) {
          seen.add(d.cover_i);
          candidates.push({
            id: `ol-${d.cover_i}`,
            title: d.title || cleanTitle,
            author: d.author_name?.[0] || author,
            year: d.first_publish_year,
            thumbnailUrl: `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`,
            fullUrl: `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`,
          });
        }
      }
      return candidates;
    }
  } catch (err) {
    console.warn('Erro no fallback do navegador para busca de capas:', err);
  }

  return [];
}

/**
 * Remove a capa personalizada do livro e restaura a capa padrão
 */
export async function removeCustomBookCover(book: Book): Promise<CoverOperationResult> {
  const now = Date.now();
  book.customCoverApplied = false;
  book.coverUrl = '';
  book.coverUpdatedAt = now;
  const restored = await repairMissingBookCover(book, { forceRegenerate: true });

  const finalCover = restored || '';
  const isCanvas = !!book.isCanvasCover;
  book.coverUrl = finalCover;
  book.coverUpdatedAt = now;
  await saveBook(book);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aurabooks_book_updated', { detail: { ...book } }));
  }

  let cloudSynced = false;
  let syncError: string | undefined = undefined;

  if (auth.currentUser) {
    try {
      const { syncCoverOnlyToCloud } = await import('./firebase');
      cloudSynced = await syncCoverOnlyToCloud(
        auth.currentUser.uid,
        book.id,
        finalCover,
        false,
        isCanvas,
        now,
        true
      );
      if (!cloudSynced) {
        syncError = 'Sincronização remota pendente';
      }
    } catch (err: any) {
      cloudSynced = false;
      syncError = err?.message;
    }
  }

  return {
    coverUrl: finalCover,
    coverUpdatedAt: now,
    isCanvasCover: isCanvas,
    localSuccess: true,
    cloudSynced,
    error: syncError,
  };
}

/**
 * Varre todos os livros da biblioteca procurando capas ausentes ou quebradas e repara todas elas.
 */
export async function repairAllMissingCovers(
  onProgress?: (current: number, total: number, title: string) => void
): Promise<{ repairedCount: number; books: Book[] }> {
  const allBooks = await getAllBooks();
  const needsCover = allBooks.filter(
    b => !isValidCoverUrl(b.coverUrl)
  );

  if (needsCover.length === 0) {
    return { repairedCount: 0, books: allBooks };
  }

  let repairedCount = 0;

  for (let i = 0; i < needsCover.length; i++) {
    const book = needsCover[i];
    if (onProgress) {
      onProgress(i + 1, needsCover.length, book.title);
    }

    const newCover = await repairMissingBookCover(book);
    if (newCover && newCover !== book.coverUrl) {
      repairedCount++;
    }
  }

  const updatedBooks = await getAllBooks();
  return { repairedCount, books: updatedBooks };
}
