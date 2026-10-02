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
 * Salva o arquivo EPUB original como Blob no IndexedDB isolado.
 */
export async function saveOriginalEpub(bookId: string, file: Blob | File): Promise<void> {
  try {
    const db = await openEpubDB();
    const fileName = (file instanceof File) ? file.name : `${bookId}.epub`;
    const record: StoredEpubRecord = {
      bookId,
      blob: file,
      name: fileName,
      size: file.size,
      mimeType: file.type || 'application/epub+zip',
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
    console.error('Falha ao gravar arquivo EPUB original no IndexedDB:', err);
    throw err;
  }
}

/**
 * Recupera o arquivo EPUB original (Blob) pelo ID do livro.
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
        resolve(record ? record.blob : null);
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
