import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { 
  auth, loginWithGoogle, loginWithEmail, registerWithEmail, logoutUser, syncBookToCloud, 
  syncProgressToCloud, fetchUserBooksFromCloud, uploadBookFileToCloud,
  downloadBookFileFromCloud, deleteBookFromCloud,
  isQuotaExceeded, setQuotaExceeded, isResourceExhaustedError
} from '../services/firebase';
import { getRedirectResult } from 'firebase/auth';
import { Book } from '../types/book';
import { saveBook, getAllBooks } from '../services/storageService';
import { getOriginalEpub, saveOriginalEpub, hasOriginalEpub } from '../services/epubStorageService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isSyncing: boolean;
  syncMessage: string;
  authError: string | null;
  clearAuthError: () => void;
  login: () => Promise<void>;
  loginWithEmailAccount: (email: string, pass: string) => Promise<boolean>;
  registerWithEmailAccount: (email: string, pass: string, name: string) => Promise<boolean>;
  logout: () => Promise<void>;
  syncCurrentBook: (book: Book, originalFile?: Blob | File, force?: boolean) => Promise<boolean>;
  syncProgress: (bookId: string, chap: number, para: number, percent: number, cfi?: string) => Promise<void>;
  syncAll: () => Promise<void>;
  isQuotaPaused: boolean;
  cloudBookIds: Set<string>;
  isBookInCloud: (bookId: string) => boolean;
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
  const [authError, setAuthError] = useState<string | null>(null);
  const [cloudBookIds, setCloudBookIds] = useState<Set<string>>(new Set());

  const clearAuthError = () => setAuthError(null);

  const isBookInCloud = useCallback((bookId: string) => {
    return cloudBookIds.has(bookId);
  }, [cloudBookIds]);

  // Sincronização completa bidirecional com o Firestore
  const syncAll = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    if (isQuotaExceeded()) {
      setSyncMessage('Modo local ativo (cota gratuita da nuvem pausada)');
      return;
    }

    try {
      setIsSyncing(true);
      setSyncMessage('Buscando livros da sua nuvem...');

      const cloudBooks = await fetchUserBooksFromCloud(currentUser.uid);
      if (cloudBooks && Array.isArray(cloudBooks)) {
        setCloudBookIds(new Set(cloudBooks.map((cb: any) => cb.bookId).filter(Boolean)));
      }

      if (isQuotaExceeded()) {
        setSyncMessage('Modo local ativo (cota de nuvem em pausa)');
        setIsSyncing(false);
        return;
      }

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
              syncedToCloud: true,
              hasCloudFile: !!cBook.hasCloudFile,
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
              syncedToCloud: true,
              hasCloudFile: !!cBook.hasCloudFile,
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
        if (isQuotaExceeded()) {
          setSyncMessage('Modo local ativo (cota de nuvem em pausa)');
          break;
        }
        const isSample = SAMPLE_IDS.includes(lBook.id) || lBook.id.startsWith('sample-');
        if (isSample) continue;

        const existsInCloud = cloudBooks?.some(cb => cb.bookId === lBook.id);
        if (!existsInCloud) {
          if (!isQuotaExceeded()) {
            setSyncMessage(`Enviando "${lBook.title}" para a nuvem...`);
            await syncBookToCloud(currentUser.uid, lBook);
            if (!isQuotaExceeded()) {
              lBook.syncedToCloud = true;
              await saveBook(lBook);
              setCloudBookIds(prev => new Set(prev).add(lBook.id));
            }
          }
        } else {
          if (!lBook.syncedToCloud) {
            lBook.syncedToCloud = true;
            lBook.hasCloudFile = !!cloudBooks?.find(cb => cb.bookId === lBook.id)?.hasCloudFile;
            await saveBook(lBook);
          }
        }
      }

      if (isQuotaExceeded()) {
        setSyncMessage('Modo local ativo (cota diária do Firebase em pausa)');
      } else {
        setSyncMessage('Nuvem conectada e sincronizada');
      }
    } catch (err: any) {
      if (isResourceExhaustedError(err)) {
        setQuotaExceeded();
        setSyncMessage('Modo local ativo (cota diária do Firebase em pausa)');
      } else {
        console.warn('Erro na sincronização da nuvem:', err);
        setSyncMessage('Modo local ativo');
      }
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

    // Sincroniza automaticamente quando o app volta ao foco (ex: leu no celular e voltou para o PC)
    const handleSyncOnResume = () => {
      if (document.visibilityState === 'visible' && auth.currentUser) {
        syncAll();
      }
    };

    window.addEventListener('focus', handleSyncOnResume);
    document.addEventListener('visibilitychange', handleSyncOnResume);

    // Se veio de redirecionamento do Google (comum em navegadores móveis/PWA)
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          setUser(result.user);
          await syncAll();
        }
      })
      .catch((err) => {
        console.warn('Redirect auth result info:', err);
      });

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleSyncOnResume);
      document.removeEventListener('visibilitychange', handleSyncOnResume);
    };
  }, [syncAll]);

  const login = async () => {
    try {
      setAuthError(null);
      setIsSyncing(true);
      setSyncMessage('Conectando com o Google...');
      const loggedUser = await loginWithGoogle();
      setUser(loggedUser);
      await syncAll();
    } catch (err: any) {
      console.error('Google Sign In failed:', err);
      const msg = err?.message || '';
      if (msg.includes('disallowed_useragent') || msg.includes('403') || msg.includes('popup')) {
        setAuthError('O Google restringe o login direto dentro de alguns WebViews do Android. Você pode entrar digitando seu e-mail ou ajustando o User-Agent no Android Studio.');
      } else {
        setAuthError('Não foi possível conectar com o Google. Tente pelo e-mail ou verifique sua conexão.');
      }
      setIsSyncing(false);
    }
  };

  const loginWithEmailAccount = async (email: string, pass: string): Promise<boolean> => {
    try {
      setAuthError(null);
      setIsSyncing(true);
      setSyncMessage('Entrando com e-mail...');
      const loggedUser = await loginWithEmail(email, pass);
      setUser(loggedUser);
      await syncAll();
      return true;
    } catch (err: any) {
      console.error('Email sign in failed:', err);
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        setAuthError('E-mail ou senha incorretos.');
      } else if (err?.code === 'auth/user-not-found') {
        setAuthError('Usuário não encontrado com este e-mail.');
      } else {
        setAuthError('Falha ao entrar com e-mail. Verifique suas credenciais.');
      }
      setIsSyncing(false);
      return false;
    }
  };

  const registerWithEmailAccount = async (email: string, pass: string, name: string): Promise<boolean> => {
    try {
      setAuthError(null);
      setIsSyncing(true);
      setSyncMessage('Criando sua conta...');
      const loggedUser = await registerWithEmail(email, pass, name);
      setUser(loggedUser);
      await syncAll();
      return true;
    } catch (err: any) {
      console.error('Email register failed:', err);
      if (err?.code === 'auth/email-already-in-use') {
        setAuthError('Este e-mail já está cadastrado. Faça login ou use outro.');
      } else if (err?.code === 'auth/weak-password') {
        setAuthError('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setAuthError('Erro ao criar conta. Tente novamente.');
      }
      setIsSyncing(false);
      return false;
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
      setUser(null);
      setSyncMessage('');
      setAuthError(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const syncCurrentBook = async (book: Book, originalFile?: Blob | File, force: boolean = false): Promise<boolean> => {
    if (!user) {
      setSyncMessage('Faça login com sua conta Google para salvar na nuvem');
      return false;
    }

    if (isQuotaExceeded() && !force) {
      setSyncMessage('Cota do Firebase em pausa para hoje. Livro salvo com segurança localmente.');
      return false;
    }

    try {
      setIsSyncing(true);
      setSyncMessage(`Salvando "${book.title}" na nuvem...`);

      const success = await syncBookToCloud(user.uid, book, force);
      if (success) {
        book.syncedToCloud = true;
        setCloudBookIds(prev => new Set(prev).add(book.id));
        await saveBook(book);
        setSyncMessage('Livro salvo na nuvem com sucesso!');
        return true;
      } else {
        setSyncMessage('Cota do Firebase atingida. Livro salvo com segurança localmente.');
        return false;
      }
    } catch (err) {
      if (isResourceExhaustedError(err)) {
        setQuotaExceeded(12);
        setSyncMessage('Cota do Firebase atingida. Livro salvo com segurança localmente.');
      } else {
        console.warn('Falha ao sincronizar livro com a nuvem:', err);
        setSyncMessage('Livro salvo localmente');
      }
      return false;
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
    if (!user || isQuotaExceeded()) return;
    try {
      await syncProgressToCloud(user.uid, bookId, chap, para, percent, cfi);
    } catch (err) {
      if (isResourceExhaustedError(err)) {
        setQuotaExceeded();
      } else {
        console.warn('Falha ao sincronizar progresso com a nuvem:', err);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isSyncing,
        syncMessage,
        authError,
        clearAuthError,
        login,
        loginWithEmailAccount,
        registerWithEmailAccount,
        logout,
        syncCurrentBook,
        syncProgress,
        syncAll,
        isQuotaPaused: isQuotaExceeded(),
        cloudBookIds,
        isBookInCloud
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
