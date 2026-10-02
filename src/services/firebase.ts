import { initializeApp } from 'firebase/app';
import { 
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, 
  onAuthStateChanged, User 
} from 'firebase/auth';
import { 
  getFirestore, doc, getDocFromServer, collection, 
  setDoc, getDocs, deleteDoc, updateDoc 
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
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

// 6. Firestore sync operations
export async function syncBookToCloud(userId: string, book: Book): Promise<void> {
  const path = `users/${userId}/books/${book.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'books', book.id), {
      userId,
      bookId: book.id,
      title: book.title.slice(0, 300),
      author: book.author.slice(0, 200),
      format: book.format,
      category: book.category.slice(0, 100),
      coverUrl: book.coverUrl ? book.coverUrl.slice(0, 500000) : '',
      progressPercent: book.progressPercent,
      currentChapterIndex: book.currentChapterIndex,
      currentParagraphIndex: book.currentParagraphIndex,
      lastReadAt: book.lastReadAt,
      isFavorite: book.isFavorite,
      totalWords: book.totalWords,
      estimatedAudioMinutes: book.estimatedAudioMinutes,
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncProgressToCloud(
  userId: string, 
  bookId: string, 
  chapterIndex: number, 
  paragraphIndex: number, 
  progressPercent: number
): Promise<void> {
  const path = `users/${userId}/books/${bookId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'books', bookId), {
      currentChapterIndex: chapterIndex,
      currentParagraphIndex: paragraphIndex,
      progressPercent,
      lastReadAt: Date.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteBookFromCloud(userId: string, bookId: string): Promise<void> {
  const path = `users/${userId}/books/${bookId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'books', bookId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

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
