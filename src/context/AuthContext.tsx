import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { 
  auth, loginWithGoogle, logoutUser, syncBookToCloud, 
  syncProgressToCloud, fetchUserBooksFromCloud, uploadBookFileToCloud,
  downloadBookFileFromCloud, deleteBookFromCloud 
} from '../services/firebase';
import { Book } from '../types/book';
import { saveBook, getAllBooks } from '../services/storageService';
import { getOriginalEpub, saveOriginalEpub, hasOriginalEpub } from '../services/epubStorageService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isSyncing: boolean;
  syncMessage: string;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  syncCurrentBook: (book: Book, originalFile?: Blob | File) => Promise<void>;
  syncProgress: (bookId: string, chap: number, para: number, percent: number, cfi?: string) => Promise<void>;
  syncAll: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SAMPLE_IDS = [
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Sincronização completa bidirecional com o Firestore
  const syncAll = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      setIsSyncing(true);
      setSyncMessage('Buscando livros da sua nuvem...');

      const cloudBooks = await fetchUserBooksFromCloud(currentUser.uid);
      const localBooks = await getAllBooks();

      // 1. Nuvem -> Local (Baixar livros e arquivos criados em outros PCs)
      if (cloudBooks && cloudBooks.length > 0) {
        for (const cBook of cloudBooks) {
          const existing = localBooks.find(b => b.id === cBook.bookId);

          if (existing) {
            // Atualiza progresso e CFI se a nuvem tiver leitura mais recente
            const cloudTimestamp = cBook.lastReadAt || 0;
            const localTimestamp = existing.lastReadAt || 0;

            const shouldUpdateMeta = cloudTimestamp >= localTimestamp;
            const updatedBook: Book = {
              ...existing,
              title: cBook.title || existing.title,
              author: cBook.author || existing.author,
              category: cBook.category || existing.category,
              coverUrl: cBook.coverUrl || existing.coverUrl,
              progressPercent: shouldUpdateMeta ? cBook.progressPercent : existing.progressPercent,
              currentChapterIndex: shouldUpdateMeta ? cBook.currentChapterIndex : existing.currentChapterIndex,
              currentParagraphIndex: shouldUpdateMeta ? cBook.currentParagraphIndex : existing.currentParagraphIndex,
              lastReadAt: Math.max(cloudTimestamp, localTimestamp),
              epubLocationCfi: shouldUpdateMeta && cBook.epubLocationCfi ? cBook.epubLocationCfi : existing.epubLocationCfi,
              isFavorite: cBook.isFavorite !== undefined ? cBook.isFavorite : existing.isFavorite,
            };

            await saveBook(updatedBook);

            // Se for EPUB e ainda não tiver o arquivo físico neste PC, baixa da nuvem
            if (cBook.format === 'epub' && cBook.hasCloudFile) {
              const hasFileLocally = await hasOriginalEpub(cBook.bookId);
              if (!hasFileLocally) {
                setSyncMessage(`Baixando arquivo do livro "${cBook.title}"...`);
                const blob = await downloadBookFileFromCloud(currentUser.uid, cBook.bookId);
                if (blob) {
                  await saveOriginalEpub(cBook.bookId, blob);
                }
              }
            }
          } else {
            // Livro novo vindo de outro computador!
            setSyncMessage(`Importando "${cBook.title}" deste PC...`);

            const newBook: Book = {
              id: cBook.bookId,
              title: cBook.title || 'Livro da Nuvem',
              author: cBook.author || 'Autor desconhecido',
              format: cBook.format || 'epub',
              coverUrl: cBook.coverUrl || '',
              chapters: [], // O leitor Foliate.js usa diretamente o arquivo EPUB
              totalWords: cBook.totalWords || 0,
              estimatedReadingMinutes: Math.max(1, Math.round((cBook.totalWords || 0) / 220)),
              estimatedAudioMinutes: cBook.estimatedAudioMinutes || 0,
              category: cBook.category || 'Geral',
              tags: cBook.tags || [],
              progressPercent: cBook.progressPercent || 0,
              currentChapterIndex: cBook.currentChapterIndex || 0,
              currentParagraphIndex: cBook.currentParagraphIndex || 0,
              lastReadAt: cBook.lastReadAt || Date.now(),
              isFavorite: !!cBook.isFavorite,
              fileSize: cBook.fileSize || 0,
              addedAt: cBook.addedAt || Date.now(),
              description: cBook.description || '',
              epubLocationCfi: cBook.epubLocationCfi || undefined,
            };

            await saveBook(newBook);

            // Baixa o arquivo do livro se disponível
            if (cBook.format === 'epub' && cBook.hasCloudFile) {
              setSyncMessage(`Baixando EPUB de "${cBook.title}"...`);
              const blob = await downloadBookFileFromCloud(currentUser.uid, cBook.bookId);
              if (blob) {
                await saveOriginalEpub(cBook.bookId, blob);
              }
            }
          }
        }
      }

      // 2. Local -> Nuvem (Backup dos livros locais que ainda não estão na nuvem)
      const currentLocalBooks = await getAllBooks();
      for (const lBook of currentLocalBooks) {
        const isSample = SAMPLE_IDS.includes(lBook.id) || lBook.id.startsWith('sample-');
        if (isSample) continue;

        const existsInCloud = cloudBooks?.some(cb => cb.bookId === lBook.id);
        if (!existsInCloud) {
          setSyncMessage(`Enviando "${lBook.title}" para a nuvem...`);
          await syncBookToCloud(currentUser.uid, lBook);

          if (lBook.format === 'epub') {
            const originalBlob = await getOriginalEpub(lBook.id);
            if (originalBlob) {
              await uploadBookFileToCloud(currentUser.uid, lBook.id, originalBlob);
            }
          }
        }
      }

      setSyncMessage('Nuvem conectada e sincronizada');
    } catch (err) {
      console.warn('Erro na sincronização da nuvem:', err);
      setSyncMessage('Falha ao sincronizar nuvem');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        await syncAll();
      }
    });

    return () => unsubscribe();
  }, [syncAll]);

  const login = async () => {
    try {
      setIsSyncing(true);
      setSyncMessage('Entrando com o Google...');
      const loggedUser = await loginWithGoogle();
      setUser(loggedUser);
      await syncAll();
    } catch (err) {
      console.error('Google Sign In failed:', err);
      setIsSyncing(false);
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
      setUser(null);
      setSyncMessage('');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const syncCurrentBook = async (book: Book, originalFile?: Blob | File) => {
    if (!user) return;
    try {
      setIsSyncing(true);
      setSyncMessage(`Salvando "${book.title}" na nuvem...`);

      await syncBookToCloud(user.uid, book);

      // Envia o arquivo original (se fornecido ou se estiver no IndexedDB)
      let fileToUpload = originalFile;
      if (!fileToUpload && book.format === 'epub') {
        fileToUpload = (await getOriginalEpub(book.id)) || undefined;
      }

      if (fileToUpload) {
        setSyncMessage(`Enviando arquivo de "${book.title}"...`);
        await uploadBookFileToCloud(user.uid, book.id, fileToUpload);
      }

      setSyncMessage('Livro salvo na nuvem com sucesso');
    } catch (err) {
      console.warn('Falha ao sincronizar livro com a nuvem:', err);
      setSyncMessage('Erro ao salvar livro na nuvem');
    } finally {
      setIsSyncing(false);
    }
  };

  const syncProgress = async (
    bookId: string, 
    chap: number, 
    para: number, 
    percent: number, 
    cfi?: string
  ) => {
    if (!user) return;
    try {
      await syncProgressToCloud(user.uid, bookId, chap, para, percent, cfi);
    } catch (err) {
      console.warn('Falha ao sincronizar progresso com a nuvem:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isSyncing,
        syncMessage,
        login,
        logout,
        syncCurrentBook,
        syncProgress,
        syncAll
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
