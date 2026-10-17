/**
 * coverService.ts
 * 
 * Serviço especializado e ultra-resiliente para extração, otimização e recuperação
 * de capas de livros em todos os formatos suportados (.EPUB, .PDF, .MOBI, .AZW3).
 * 
 * Resolve o problema de capas ausentes quando o usuário acessa em outro computador
 * ou quando a sincronização inicial veio sem os dados visuais.
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
import { getBook, saveBook, getAllBooks } from './storageService';
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
 * Redimensiona e otimiza uma imagem (Blob ou Base64) para um thumbnail nítido e leve (~360px de largura).
 * Evita estourar o limite de 1MB do Firestore e garante carregamento instantâneo no navegador.
 */
export async function optimizeCoverImage(imageBlobOrDataUrl: Blob | string, maxWidth: number = 380): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const cleanUp = () => {
      if (imageBlobOrDataUrl instanceof Blob) {
        URL.revokeObjectURL(img.src);
      }
    };

    img.onload = () => {
      try {
        const aspect = img.height / img.width;
        const targetWidth = Math.min(img.width, maxWidth);
        const targetHeight = Math.round(targetWidth * aspect);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          cleanUp();
          resolve(typeof imageBlobOrDataUrl === 'string' ? imageBlobOrDataUrl : '');
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const optimized = canvas.toDataURL('image/jpeg', 0.82);
        cleanUp();
        resolve(optimized);
      } catch (err) {
        cleanUp();
        resolve(typeof imageBlobOrDataUrl === 'string' ? imageBlobOrDataUrl : '');
      }
    };

    img.onerror = () => {
      cleanUp();
      resolve(typeof imageBlobOrDataUrl === 'string' ? imageBlobOrDataUrl : '');
    };

    if (imageBlobOrDataUrl instanceof Blob) {
      img.src = URL.createObjectURL(imageBlobOrDataUrl);
    } else {
      img.src = imageBlobOrDataUrl;
    }
  });
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
    const scale = 380 / viewport.width;
    const scaledViewport = firstPage.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return '';

    // @ts-expect-error pdfjs typing nuance
    await firstPage.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.85);
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
 * Se o arquivo físico original estiver faltando neste PC mas existir no Google Drive,
 * faz o download automático do Google Drive e recupera a capa.
 */
export async function repairMissingBookCover(book: Book): Promise<string | null> {
  try {
    // 1. Verifica se o livro já possui uma capa válida
    if (book.coverUrl && book.coverUrl.trim().length > 100 && !book.coverUrl.includes('error')) {
      return book.coverUrl;
    }

    let fileBlob: Blob | null = null;

    // 2. Tenta obter o arquivo físico local (IndexedDB)
    const existsLocally = await hasOriginalEpub(book.id);
    if (existsLocally) {
      fileBlob = await getOriginalEpub(book.id);
    }

    // 3. Se não tiver localmente mas tiver no Google Drive, baixa do Drive
    if (!fileBlob && book.driveFileId && isDriveAuthorized()) {
      try {
        fileBlob = await downloadBookFromDrive(book.driveFileId);
        if (fileBlob) {
          // Salva para já ficar disponível offline neste PC
          await saveOriginalEpub(book.id, fileBlob);
        }
      } catch (driveErr) {
        console.warn(`Aviso ao baixar livro "${book.title}" do Drive para extrair capa:`, driveErr);
      }
    }

    if (!fileBlob) {
      return null;
    }

    // 4. Extrai a capa do arquivo
    const coverUrl = await extractCoverFromFile(fileBlob, book.format);
    if (coverUrl && coverUrl.trim().length > 100) {
      book.coverUrl = coverUrl;
      await saveBook(book);

      // Sincroniza metadados com Firestore se logado
      if (auth.currentUser) {
        try {
          await syncBookToCloud(auth.currentUser.uid, book);
        } catch {
          // ignore
        }
      }

      return coverUrl;
    }

    return null;
  } catch (err) {
    console.warn(`Erro ao reparar capa do livro ${book.title}:`, err);
    return null;
  }
}

/**
 * Varre todos os livros da biblioteca procurando capas ausentes ou quebradas e repara todas elas.
 */
export async function repairAllMissingCovers(
  onProgress?: (current: number, total: number, title: string) => void
): Promise<{ repairedCount: number; books: Book[] }> {
  const allBooks = await getAllBooks();
  const needsCover = allBooks.filter(b => !b.coverUrl || b.coverUrl.trim().length < 100);

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
    if (newCover) {
      repairedCount++;
    }
  }

  const updatedBooks = await getAllBooks();
  return { repairedCount, books: updatedBooks };
}
