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

// 3. Test Connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
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
export async function syncBookToCloud(userId: string, book: Book): Promise<void> {
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
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
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
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Faz upload do arquivo original (Blob / File) em pedaços (chunks) para o Firestore.
 * Cada pedaço tem no máximo ~450KB Base64 para respeitar o limite de 800.000 chars das regras de segurança.
 */
export async function uploadBookFileToCloud(
  userId: string,
  bookId: string,
  file: Blob | File,
  onProgress?: (percent: number) => void
): Promise<void> {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);

  // 450.000 caracteres por pedaço (~337 KB binário), seguro sob os 800.000 permitidos
  const CHUNK_CHAR_LIMIT = 450000;
  const totalChunks = Math.max(1, Math.ceil(base64.length / CHUNK_CHAR_LIMIT));

  for (let i = 0; i < totalChunks; i++) {
    const chunkData = base64.slice(i * CHUNK_CHAR_LIMIT, (i + 1) * CHUNK_CHAR_LIMIT);
    const chunkId = `chunk_${i}`;
    const chunkPath = `users/${userId}/books/${bookId}/fileChunks/${chunkId}`;

    try {
      await setDoc(doc(db, 'users', userId, 'books', bookId, 'fileChunks', chunkId), {
        userId,
        bookId,
        chunkIndex: i,
        totalChunks,
        data: chunkData
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, chunkPath);
    }

    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalChunks) * 100));
    }
  }

  // Marca no documento do livro que o arquivo em nuvem está pronto
  const bookPath = `users/${userId}/books/${bookId}`;
  try {
    await setDoc(doc(db, 'users', userId, 'books', bookId), {
      hasCloudFile: true,
      totalChunks
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, bookPath);
  }
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
  const path = `users/${userId}/books/${bookId}`;
  try {
    // 1. Apaga os pedaços do arquivo
    const chunksSnap = await getDocs(collection(db, 'users', userId, 'books', bookId, 'fileChunks'));
    for (const d of chunksSnap.docs) {
      await deleteDoc(d.ref);
    }
    // 2. Apaga o documento do livro
    await deleteDoc(doc(db, 'users', userId, 'books', bookId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Lista todos os livros do usuário na nuvem Firestore.
 */
export async function fetchUserBooksFromCloud(userId: string): Promise<any[]> {
  const path = `users/${userId}/books`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'books'));
    return snap.docs.map(d => d.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}
