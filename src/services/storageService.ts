import { Book, Bookmark, BookHighlight, ReaderSettings, AudioSettings, ReadingSession } from '../types/book';
import { SAMPLE_BOOKS } from './sampleBooks';

const DB_NAME = 'AuraBooksDB';
const DB_VERSION = 3;

const STORES = {
  BOOKS: 'books',
  BOOKMARKS: 'bookmarks',
  HIGHLIGHTS: 'highlights',
  SETTINGS: 'settings',
  READING_SESSIONS: 'readingSessions',
};

const DEFAULT_READER_SETTINGS: ReaderSettings = {
  theme: 'alabaster',
  fontSize: 18,
  fontFamily: 'serif',
  lineHeight: 'relaxed',
  columnWidth: 'medium',
  autoScrollAudio: true
};

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  voiceURI: null,
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  sleepTimerMinutes: null,
  sleepTimerEndsAt: null
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORES.BOOKS)) {
        db.createObjectStore(STORES.BOOKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.BOOKMARKS)) {
        const bookmarkStore = db.createObjectStore(STORES.BOOKMARKS, { keyPath: 'id' });
        bookmarkStore.createIndex('bookId', 'bookId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.HIGHLIGHTS)) {
        const hlStore = db.createObjectStore(STORES.HIGHLIGHTS, { keyPath: 'id' });
        hlStore.createIndex('bookId', 'bookId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS);
      }
      if (!db.objectStoreNames.contains(STORES.READING_SESSIONS)) {
        const sessionStore = db.createObjectStore(STORES.READING_SESSIONS, { keyPath: 'id' });
        sessionStore.createIndex('bookId', 'bookId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function initStorage(): Promise<Book[]> {
  const db = await openDB();
  const tx = db.transaction(STORES.BOOKS, 'readwrite');
  const store = tx.objectStore(STORES.BOOKS);
  const getAllReq = store.getAll();

  return new Promise((resolve, reject) => {
    getAllReq.onsuccess = async () => {
      let books: Book[] = getAllReq.result || [];
      const sampleIds = [
        'book-cem-anos-solidao',
        'book-duna',
        'book-orgulho-preconceito',
        'book-metamorfose',
        'book-1984',
        'book-desassossego',
        'book-meditacoes',
        'sample-dom-casmurro',
        'sample-memorias-postumas',
        'sample-pequeno-principe'
      ];

      // Purge only exact sample book IDs
      const sampleBooks = books.filter(b => sampleIds.includes(b.id) || b.id.startsWith('sample-'));
      if (sampleBooks.length > 0) {
        for (const b of sampleBooks) {
          store.delete(b.id);
        }
        books = books.filter(b => !sampleIds.includes(b.id) && !b.id.startsWith('sample-'));
      }

      // Sort remaining user books by lastReadAt descending
      books.sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0));
      resolve(books);
    };
    getAllReq.onerror = () => reject(getAllReq.error);
  });
}

export async function getAllBooks(): Promise<Book[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.BOOKS, 'readonly');
    const store = tx.objectStore(STORES.BOOKS);
    const req = store.getAll();
    req.onsuccess = () => {
      const books: Book[] = req.result || [];
      // Sort by lastReadAt descending by default
      books.sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0));
      resolve(books);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getBook(id: string): Promise<Book | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.BOOKS, 'readonly');
    const store = tx.objectStore(STORES.BOOKS);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveBook(book: Book): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.BOOKS, 'readwrite');
    const store = tx.objectStore(STORES.BOOKS);
    const req = store.put(book);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteBook(id: string): Promise<void> {
  await deleteReadingSessions(id).catch(() => {});
  await deleteHighlightsForBook(id).catch(() => {});
  await deleteBookmarksForBook(id).catch(() => {});

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.BOOKS, 'readwrite');
    const store = tx.objectStore(STORES.BOOKS);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function updateBookProgress(
  id: string,
  chapterIndex: number,
  paragraphIndex: number,
  progressPercent?: number,
  epubLocationCfi?: string
): Promise<void> {
  const book = await getBook(id);
  if (!book) return;

  const totalChapters = book.chapters.length;
  let calculatedPercent = progressPercent;
  if (calculatedPercent === undefined) {
    if (totalChapters > 0) {
      const curChap = book.chapters[chapterIndex];
      const totalParasInChap = curChap ? Math.max(1, curChap.paragraphs.length) : 1;
      const chapterWeight = 1 / totalChapters;
      const intraChapProgress = paragraphIndex / totalParasInChap;
      calculatedPercent = Math.min(100, Math.round(((chapterIndex + intraChapProgress) * chapterWeight) * 100));
    } else {
      calculatedPercent = 0;
    }
  }

  const updated: Book = {
    ...book,
    currentChapterIndex: chapterIndex,
    currentParagraphIndex: paragraphIndex,
    progressPercent: Math.max(0, Math.min(100, calculatedPercent)),
    lastReadAt: Date.now(),
    ...(epubLocationCfi ? { epubLocationCfi } : {})
  };

  await saveBook(updated);
}

export async function toggleFavorite(id: string): Promise<boolean> {
  const book = await getBook(id);
  if (!book) return false;
  const isFav = !book.isFavorite;
  await saveBook({ ...book, isFavorite: isFav });
  return isFav;
}

export async function getReaderSettings(): Promise<ReaderSettings> {
  try {
    const raw = localStorage.getItem('aurabooks_reader_settings');
    if (raw) return { ...DEFAULT_READER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // fallback
  }
  return DEFAULT_READER_SETTINGS;
}

export function saveReaderSettings(settings: ReaderSettings): void {
  try {
    localStorage.setItem('aurabooks_reader_settings', JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export async function getAudioSettings(): Promise<AudioSettings> {
  try {
    const raw = localStorage.getItem('aurabooks_audio_settings');
    if (raw) return { ...DEFAULT_AUDIO_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // fallback
  }
  return DEFAULT_AUDIO_SETTINGS;
}

export function saveAudioSettings(settings: AudioSettings): void {
  try {
    localStorage.setItem('aurabooks_audio_settings', JSON.stringify(settings));
  } catch {
    // ignore
  }
}

/* ================= HIGHLIGHTS & ANOTAÇÕES ================= */

export async function getHighlights(bookId: string): Promise<BookHighlight[]> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORES.HIGHLIGHTS)) {
      const local = localStorage.getItem(`aurabooks_hl_${bookId}`);
      return local ? JSON.parse(local) : [];
    }
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.HIGHLIGHTS, 'readonly');
      const store = tx.objectStore(STORES.HIGHLIGHTS);
      const index = store.index('bookId');
      const req = index.getAll(bookId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => {
        const local = localStorage.getItem(`aurabooks_hl_${bookId}`);
        resolve(local ? JSON.parse(local) : []);
      };
    });
  } catch {
    const local = localStorage.getItem(`aurabooks_hl_${bookId}`);
    return local ? JSON.parse(local) : [];
  }
}

export async function saveHighlight(highlight: BookHighlight): Promise<void> {
  try {
    // Also save in localStorage as instant sync backup
    const list = await getHighlights(highlight.bookId);
    const updated = [...list.filter(h => h.id !== highlight.id), highlight];
    localStorage.setItem(`aurabooks_hl_${highlight.bookId}`, JSON.stringify(updated));

    const db = await openDB();
    if (db.objectStoreNames.contains(STORES.HIGHLIGHTS)) {
      const tx = db.transaction(STORES.HIGHLIGHTS, 'readwrite');
      const store = tx.objectStore(STORES.HIGHLIGHTS);
      store.put(highlight);
    }
  } catch {
    // LocalStorage handled above
  }
}

export async function deleteHighlight(id: string, bookId: string): Promise<void> {
  try {
    const list = await getHighlights(bookId);
    const filtered = list.filter(h => h.id !== id);
    localStorage.setItem(`aurabooks_hl_${bookId}`, JSON.stringify(filtered));

    const db = await openDB();
    if (db.objectStoreNames.contains(STORES.HIGHLIGHTS)) {
      const tx = db.transaction(STORES.HIGHLIGHTS, 'readwrite');
      const store = tx.objectStore(STORES.HIGHLIGHTS);
      store.delete(id);
    }
  } catch {
    // ignore
  }
}

/* ================= COLEÇÕES & TAGS PERSONALIZADAS ================= */

const DEFAULT_COLLECTIONS = ['Estudos', 'Filosofia', 'Ficção', 'Lidos em 2025', 'Para Reeler'];

export function getUserCustomTags(): string[] {
  try {
    const saved = localStorage.getItem('aurabooks_custom_tags');
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return DEFAULT_COLLECTIONS;
}

export function saveUserCustomTags(tags: string[]): void {
  try {
    localStorage.setItem('aurabooks_custom_tags', JSON.stringify(tags));
  } catch {
    // ignore
  }
}

export function addUserCustomTag(newTag: string): string[] {
  const current = getUserCustomTags();
  const trimmed = newTag.trim();
  if (!trimmed || current.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
    return current;
  }
  const updated = [...current, trimmed];
  saveUserCustomTags(updated);
  return updated;
}

export async function updateBookTags(bookId: string, tags: string[]): Promise<Book | null> {
  const book = await getBook(bookId);
  if (!book) return null;
  const updated: Book = { ...book, tags };
  await saveBook(updated);
  return updated;
}

/* ================= SESSÕES DE LEITURA (READING SESSIONS) ================= */

export async function saveReadingSession(session: ReadingSession): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(STORES.READING_SESSIONS)) {
      resolve();
      return;
    }
    const tx = db.transaction(STORES.READING_SESSIONS, 'readwrite');
    const store = tx.objectStore(STORES.READING_SESSIONS);
    const req = store.put(session);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getReadingSessions(bookId: string): Promise<ReadingSession[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(STORES.READING_SESSIONS)) {
      resolve([]);
      return;
    }
    const tx = db.transaction(STORES.READING_SESSIONS, 'readonly');
    const store = tx.objectStore(STORES.READING_SESSIONS);
    const index = store.index('bookId');
    const req = index.getAll(bookId);
    req.onsuccess = () => {
      const sessions: ReadingSession[] = req.result || [];
      // Ordenar por startedAt DESC
      sessions.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
      resolve(sessions);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getAllReadingSessions(): Promise<ReadingSession[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(STORES.READING_SESSIONS)) {
      resolve([]);
      return;
    }
    const tx = db.transaction(STORES.READING_SESSIONS, 'readonly');
    const store = tx.objectStore(STORES.READING_SESSIONS);
    const req = store.getAll();
    req.onsuccess = () => {
      const sessions: ReadingSession[] = req.result || [];
      // Ordenar por startedAt DESC
      sessions.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
      resolve(sessions);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteReadingSessions(bookId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(STORES.READING_SESSIONS)) {
      resolve();
      return;
    }
    const tx = db.transaction(STORES.READING_SESSIONS, 'readwrite');
    const store = tx.objectStore(STORES.READING_SESSIONS);
    const index = store.index('bookId');
    const req = index.openCursor(IDBKeyRange.only(bookId));
    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
  });
}

export async function getTotalReadingTime(bookId: string): Promise<number> {
  const sessions = await getReadingSessions(bookId);
  return sessions.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
}

export async function deleteHighlightsForBook(bookId: string): Promise<void> {
  try {
    localStorage.removeItem(`aurabooks_hl_${bookId}`);
    const db = await openDB();
    if (db.objectStoreNames.contains(STORES.HIGHLIGHTS)) {
      const tx = db.transaction(STORES.HIGHLIGHTS, 'readwrite');
      const store = tx.objectStore(STORES.HIGHLIGHTS);
      const index = store.index('bookId');
      const req = index.openCursor(IDBKeyRange.only(bookId));
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    }
  } catch {
    // ignore
  }
}

export async function deleteBookmarksForBook(bookId: string): Promise<void> {
  try {
    localStorage.removeItem(`aurabooks_bm_${bookId}`);
    const db = await openDB();
    if (db.objectStoreNames.contains(STORES.BOOKMARKS)) {
      const tx = db.transaction(STORES.BOOKMARKS, 'readwrite');
      const store = tx.objectStore(STORES.BOOKMARKS);
      const index = store.index('bookId');
      const req = index.openCursor(IDBKeyRange.only(bookId));
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    }
  } catch {
    // ignore
  }
}


