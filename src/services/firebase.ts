import { initializeApp } from 'firebase/app';
import { 
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, 
  getRedirectResult, signOut, onAuthStateChanged, User,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile
} from 'firebase/auth';
import { 
  getFirestore, doc, getDocFromServer, collection, 
  setDoc, getDocs, deleteDoc, updateDoc, getDoc 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Book } from '../types/book';

// 1. Initialize Firebase App
const app = initializeApp(firebaseConfig);

// 2. Initialize Firestore with explicit database ID (MANDATORY)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Quota Protection: Detecta se a cota gratuita diária do Firestore foi atingida e persiste no localStorage
const QUOTA_STORAGE_KEY = 'lumina_firestore_quota_exhausted_until';

export function isQuotaExceeded(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(QUOTA_STORAGE_KEY);
      if (stored) {
        const until = Number(stored);
        if (until > Date.now()) {
          return true;
        }
      }
    }
  } catch {}
  return false;
}

export function setQuotaExceeded(durationHours: number = 12): void {
  const until = Date.now() + durationHours * 60 * 60 * 1000;
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(QUOTA_STORAGE_KEY, String(until));
    }
  } catch {}
  console.warn(`[Firebase Quota] Limite diário gratuito de escrita do Firestore pausado até ${new Date(until).toLocaleTimeString()}. Modo local offline ativo.`);
}

export function clearQuotaExceeded(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(QUOTA_STORAGE_KEY);
    }
  } catch {}
  console.log('[Firebase Quota] Pausa de cota removida com sucesso.');
}

// Inicialização preventiva: ativa proteção persistente para a cota diária atual
if (typeof window !== 'undefined') {
  try {
    const existing = localStorage.getItem(QUOTA_STORAGE_KEY);
    if (!existing || Number(existing) < Date.now()) {
      setQuotaExceeded(12);
    }
  } catch {}
}

export function isResourceExhaustedError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code;
  return (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded')
  );
}

// 3. Test Connection
async function testConnection() {
  if (isQuotaExceeded()) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (isResourceExhaustedError(error)) {
      setQuotaExceeded(12);
      return;
    }
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase connection check: client is offline or network is limited.');
    }
  }
}
testConnection();

// 4. Error Handler per Skill Protocol
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  if (isResourceExhaustedError(error)) {
    setQuotaExceeded();
    console.warn('[Firestore Quota Limit] Operações em nuvem pausadas até a renovação da cota do Google. Dados preservados localmente no IndexedDB.');
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// 5. Auth operations
export async function loginWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error: any) {
    // Se o popup for bloqueado pelo WebView ou navegador
    if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/cancelled-popup-request') {
      await signInWithRedirect(auth, provider);
      throw new Error('Redirecionando para login com o Google...');
    }
    throw error;
  }
}

export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  return result.user;
}

export async function registerWithEmail(email: string, pass: string, name: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  if (name.trim()) {
    try {
      await updateProfile(result.user, { displayName: name.trim() });
    } catch {
      // Ignora erro menor de atualizar display name
    }
  }
  return result.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

// Helper: Convert ArrayBuffer to Base64 in safe chunks
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

// Helper: Convert Base64 string to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// 6. Firestore sync operations

/**
 * Salva ou atualiza os metadados de um livro na coleção do usuário no Firestore.
 */
export async function syncBookToCloud(userId: string, book: Book, force: boolean = false): Promise<boolean> {
  if (isQuotaExceeded() && !force) return false;
  const path = `users/${userId}/books/${book.id}`;
  try {
    const cleanData: any = {
      userId,
      bookId: book.id,
      title: (book.title || 'Sem título').slice(0, 300),
      author: (book.author || 'Autor desconhecido').slice(0, 200),
      format: book.format || 'epub',
      category: (book.category || 'Geral').slice(0, 100),
      coverUrl: book.coverUrl ? book.coverUrl.slice(0, 500000) : '',
      progressPercent: typeof book.progressPercent === 'number' ? Math.max(0, Math.min(100, Math.round(book.progressPercent))) : 0,
      currentChapterIndex: typeof book.currentChapterIndex === 'number' ? Math.max(0, book.currentChapterIndex) : 0,
      currentParagraphIndex: typeof book.currentParagraphIndex === 'number' ? Math.max(0, book.currentParagraphIndex) : 0,
      lastReadAt: typeof book.lastReadAt === 'number' ? book.lastReadAt : Date.now(),
      isFavorite: !!book.isFavorite,
      totalWords: typeof book.totalWords === 'number' ? book.totalWords : 0,
      estimatedAudioMinutes: typeof book.estimatedAudioMinutes === 'number' ? book.estimatedAudioMinutes : 0,
    };

    if (book.epubLocationCfi) {
      cleanData.epubLocationCfi = book.epubLocationCfi.slice(0, 1000);
    }
    if (typeof book.fileSize === 'number') {
      cleanData.fileSize = book.fileSize;
    }
    if (typeof book.addedAt === 'number') {
      cleanData.addedAt = book.addedAt;
    }
    if (book.description) {
      cleanData.description = book.description.slice(0, 1000);
    }
    if (book.tags && Array.isArray(book.tags)) {
      cleanData.tags = book.tags.slice(0, 10);
    }

    await setDoc(doc(db, 'users', userId, 'books', book.id), cleanData, { merge: true });
    // Sucesso: remove pausa se houver
    clearQuotaExceeded();
    return true;
  } catch (error) {
    if (isResourceExhaustedError(error)) {
      setQuotaExceeded(12);
      return false;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

/**
 * Atualiza apenas o progresso e posição de leitura no Firestore.
 */
export async function syncProgressToCloud(
  userId: string, 
  bookId: string, 
  chapterIndex: number, 
  paragraphIndex: number, 
  progressPercent: number,
  epubLocationCfi?: string
): Promise<void> {
  if (isQuotaExceeded()) return;
  const path = `users/${userId}/books/${bookId}`;
  try {
    const updateData: any = {
      currentChapterIndex: Math.max(0, chapterIndex),
      currentParagraphIndex: Math.max(0, paragraphIndex),
      progressPercent: Math.max(0, Math.min(100, Math.round(progressPercent))),
      lastReadAt: Date.now()
    };
    if (epubLocationCfi) {
      updateData.epubLocationCfi = epubLocationCfi.slice(0, 1000);
    }
    await setDoc(doc(db, 'users', userId, 'books', bookId), updateData, { merge: true });
  } catch (error) {
    if (isResourceExhaustedError(error)) {
      setQuotaExceeded(12);
      return;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Upload de arquivo original no Firestore desativado.
 * Arquivos EPUB/PDF continuam 100% seguros no IndexedDB local para preservar a cota diária do Firestore.
 */
export async function uploadBookFileToCloud(
  _userId: string,
  _bookId: string,
  _file: Blob | File,
  onProgress?: (percent: number) => void
): Promise<void> {
  if (onProgress) {
    onProgress(100);
  }
  return;
}

/**
 * Baixa os pedaços do arquivo original do Firestore e remonta o Blob do EPUB/arquivo.
 */
export async function downloadBookFileFromCloud(
  userId: string,
  bookId: string,
  onProgress?: (percent: number) => void
): Promise<Blob | null> {
  const path = `users/${userId}/books/${bookId}/fileChunks`;
  try {
    const snapshot = await getDocs(collection(db, 'users', userId, 'books', bookId, 'fileChunks'));
    if (snapshot.empty) {
      return null;
    }

    const chunks = snapshot.docs.map(d => d.data() as { chunkIndex: number; totalChunks: number; data: string });
    chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

    let fullBase64 = '';
    const total = chunks.length;
    for (let i = 0; i < total; i++) {
      fullBase64 += chunks[i].data;
      if (onProgress) {
        onProgress(Math.round(((i + 1) / total) * 100));
      }
    }

    const uint8 = base64ToUint8Array(fullBase64);
    return new Blob([uint8.buffer as ArrayBuffer], { type: 'application/epub+zip' });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

/**
 * Verifica se um livro possui arquivo salvo na nuvem.
 */
export async function hasCloudBookFile(userId: string, bookId: string): Promise<boolean> {
  try {
    const bookDoc = await getDoc(doc(db, 'users', userId, 'books', bookId));
    if (bookDoc.exists()) {
      return !!bookDoc.data()?.hasCloudFile;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Remove o livro e todos os seus pedaços de arquivo do Firestore.
 */
export async function deleteBookFromCloud(userId: string, bookId: string): Promise<void> {
  if (isQuotaExceeded()) return;
  const path = `users/${userId}/books/${bookId}`;
  try {
    // 1. Apaga os pedaços do arquivo
    const chunksSnap = await getDocs(collection(db, 'users', userId, 'books', bookId, 'fileChunks'));
    for (const d of chunksSnap.docs) {
      if (isQuotaExceeded()) break;
      await deleteDoc(d.ref);
    }
    // 2. Apaga o documento do livro
    if (!isQuotaExceeded()) {
      await deleteDoc(doc(db, 'users', userId, 'books', bookId));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Lista todos os livros do usuário na nuvem Firestore.
 */
export async function fetchUserBooksFromCloud(userId: string): Promise<any[]> {
  if (isQuotaExceeded()) return [];
  const path = `users/${userId}/books`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'books'));
    return snap.docs.map(d => d.data());
  } catch (error) {
    if (isResourceExhaustedError(error)) {
      setQuotaExceeded();
      return [];
    }
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}
