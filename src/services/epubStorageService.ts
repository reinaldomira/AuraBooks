/**
 * Serviço isolado para armazenamento e recuperação de arquivos EPUB originais no IndexedDB.
 * Permite que o arquivo original (Blob / File) seja preservado integralmente para renderização no Foliate.js.
 */

const DB_NAME = 'AuraBooksEpubDB';
const DB_VERSION = 1;
const STORE_NAME = 'epub_originals';

function openEpubDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'bookId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface StoredEpubRecord {
  bookId: string;
  blob: Blob;
  name: string;
  size: number;
  mimeType: string;
  updatedAt: number;
}

/**
 * Salva o arquivo original (EPUB ou PDF) como Blob no IndexedDB isolado.
 */
export async function saveOriginalEpub(bookId: string, file: Blob | File): Promise<void> {
  try {
    const db = await openEpubDB();
    const isPdf = (file instanceof File && file.name.toLowerCase().endsWith('.pdf')) || (file.type && file.type.includes('pdf'));
    const defaultExt = isPdf ? '.pdf' : '.epub';
    const fileName = (file instanceof File) ? file.name : `${bookId}${defaultExt}`;
    const defaultMime = isPdf ? 'application/pdf' : 'application/epub+zip';
    
    // Garante que o objeto armazenado é um Blob puro e clonável no IndexedDB
    const safeBlob: Blob = file instanceof Blob ? file : new Blob([file as any], { type: defaultMime });

    const record: StoredEpubRecord = {
      bookId,
      blob: safeBlob,
      name: fileName,
      size: safeBlob.size,
      mimeType: safeBlob.type || defaultMime,
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Falha ao gravar arquivo original no IndexedDB:', err);
    throw err;
  }
}

/**
 * Recupera o arquivo EPUB/PDF original (Blob) pelo ID do livro.
 */
export async function getOriginalEpub(bookId: string): Promise<Blob | null> {
  try {
    const db = await openEpubDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(bookId);
      req.onsuccess = () => {
        const record = req.result as StoredEpubRecord | undefined;
        if (!record || !record.blob) {
          resolve(null);
          return;
        }
        const rawBlob = record.blob as unknown;
        if (rawBlob instanceof Blob) {
          resolve(rawBlob);
        } else if (rawBlob instanceof ArrayBuffer) {
          resolve(new Blob([rawBlob], { type: record.mimeType || 'application/pdf' }));
        } else {
          resolve(new Blob([rawBlob as any], { type: record.mimeType || 'application/pdf' }));
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Falha ao recuperar arquivo EPUB original:', err);
    return null;
  }
}

/**
 * Verifica se o arquivo EPUB original está disponível localmente.
 */
export async function hasOriginalEpub(bookId: string): Promise<boolean> {
  const blob = await getOriginalEpub(bookId);
  return blob !== null && blob.size > 0;
}

/**
 * Remove o arquivo EPUB original do armazenamento local quando o livro é excluído.
 */
export async function deleteOriginalEpub(bookId: string): Promise<void> {
  try {
    const db = await openEpubDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(bookId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Erro ao excluir EPUB original do IndexedDB:', err);
  }
}
