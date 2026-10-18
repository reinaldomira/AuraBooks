import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, onAuthStateChanged, getRedirectResult, GoogleAuthProvider } from 'firebase/auth';
import { 
  auth, loginWithGoogle, loginWithEmail, registerWithEmail, logoutUser, syncBookToCloud, 
  syncProgressToCloud, fetchUserBooksFromCloud, uploadBookFileToCloud,
  downloadBookFileFromCloud, deleteBookFromCloud,
  isQuotaExceeded, setQuotaExceeded, isResourceExhaustedError, setDriveAccessToken
} from '../services/firebase';
import { Book } from '../types/book';
import { saveBook, getAllBooks } from '../services/storageService';
import { getOriginalEpub, saveOriginalEpub, hasOriginalEpub } from '../services/epubStorageService';
import { restoreBookFromDrive, isDriveAuthorized } from '../services/googleDriveService';
import { repairAllMissingCovers, repairMissingBookCover, isValidCoverUrl } from '../services/coverService';

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

            const hasCloudCover = isValidCoverUrl(cBook.coverUrl);
            const hasLocalCover = isValidCoverUrl(existing.coverUrl);

            // Prioriza capa válida da nuvem se o local não tiver ou se a nuvem tiver capa personalizada
            let resolvedCover = existing.coverUrl;
            if (hasCloudCover && (!hasLocalCover || cBook.customCoverApplied)) {
              resolvedCover = cBook.coverUrl;
            }

            const shouldUpdateMeta = cloudTimestamp >= localTimestamp;
            const updatedBook: Book = {
              ...existing,
              title: cBook.title || existing.title,
              author: cBook.author || existing.author,
              category: cBook.category || existing.category,
              coverUrl: resolvedCover,
              customCoverApplied: cBook.customCoverApplied !== undefined ? cBook.customCoverApplied : existing.customCoverApplied,
              progressPercent: shouldUpdateMeta ? cBook.progressPercent : existing.progressPercent,
              currentChapterIndex: shouldUpdateMeta ? cBook.currentChapterIndex : existing.currentChapterIndex,
              currentParagraphIndex: shouldUpdateMeta ? cBook.currentParagraphIndex : existing.currentParagraphIndex,
              lastReadAt: Math.max(cloudTimestamp, localTimestamp),
              epubLocationCfi: shouldUpdateMeta && cBook.epubLocationCfi ? cBook.epubLocationCfi : existing.epubLocationCfi,
              isFavorite: cBook.isFavorite !== undefined ? cBook.isFavorite : existing.isFavorite,
              syncedToCloud: true,
              hasCloudFile: !!cBook.hasCloudFile || !!cBook.driveFileId,
              driveFileId: cBook.driveFileId || existing.driveFileId,
              driveFileName: cBook.driveFileName || existing.driveFileName,
              driveLastSyncedAt: cBook.driveLastSyncedAt || existing.driveLastSyncedAt,
              driveSyncStatus: cBook.driveSyncStatus || existing.driveSyncStatus || (cBook.driveFileId ? 'synced' : undefined),
            };

            await saveBook(updatedBook);

            // Se o computador local possui capa válida mas a nuvem não tinha capa, envia a capa para a nuvem
            // para que a versão mobile no celular carregue a capa original instantaneamente!
            if (hasLocalCover && !hasCloudCover && !isQuotaExceeded()) {
              syncBookToCloud(currentUser.uid, updatedBook).catch(() => {});
            }

            // Se ainda assim estiver sem capa válida no dispositivo atual (ex: celular), repara em segundo plano
            if (!isValidCoverUrl(updatedBook.coverUrl)) {
              repairMissingBookCover(updatedBook).then((cov) => {
                if (cov) {
                  updatedBook.coverUrl = cov;
                  saveBook(updatedBook);
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('aurabooks_book_updated', { detail: updatedBook }));
                  }
                }
              }).catch(() => {});
            }

            // Se for EPUB ou PDF e ainda não tiver o arquivo físico neste PC, tenta obter da nuvem ou Google Drive
            if (cBook.format === 'epub' || cBook.format === 'pdf') {
              const hasFileLocally = await hasOriginalEpub(cBook.bookId);
              if (!hasFileLocally) {
                if (cBook.hasCloudFile) {
                  setSyncMessage(`Baixando arquivo do livro "${cBook.title}"...`);
                  const blob = await downloadBookFileFromCloud(currentUser.uid, cBook.bookId);
                  if (blob) {
                    await saveOriginalEpub(cBook.bookId, blob);
                  }
                } else if (cBook.driveFileId && isDriveAuthorized()) {
                  setSyncMessage(`Restaurando "${cBook.title}" do Google Drive...`);
                  await restoreBookFromDrive(cBook.bookId);
                }
              }
            }
          } else {
            // Livro novo vindo de outro computador ou da nuvem!
            setSyncMessage(`Importando "${cBook.title}" deste PC...`);

            const newBook: Book = {
              id: cBook.bookId,
              title: cBook.title || 'Livro da Nuvem',
              author: cBook.author || 'Autor desconhecido',
              format: cBook.format || 'epub',
              coverUrl: isValidCoverUrl(cBook.coverUrl) ? cBook.coverUrl : '',
              customCoverApplied: !!cBook.customCoverApplied,
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
              hasCloudFile: !!cBook.hasCloudFile || !!cBook.driveFileId,
              driveFileId: cBook.driveFileId,
              driveFileName: cBook.driveFileName,
              driveLastSyncedAt: cBook.driveLastSyncedAt,
              driveSyncStatus: cBook.driveSyncStatus || (cBook.driveFileId ? 'synced' : undefined),
            };

            await saveBook(newBook);

            // Se o livro novo da nuvem ainda não tiver capa no banco local, repara em segundo plano
            if (!isValidCoverUrl(newBook.coverUrl)) {
              repairMissingBookCover(newBook).then((cov) => {
                if (cov) {
                  newBook.coverUrl = cov;
                  saveBook(newBook);
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('aurabooks_book_updated', { detail: newBook }));
                  }
                }
              }).catch(() => {});
            }

            // Baixa o arquivo do livro se disponível
            if (cBook.format === 'epub' || cBook.format === 'pdf') {
              if (cBook.hasCloudFile) {
                setSyncMessage(`Baixando ${cBook.format.toUpperCase()} de "${cBook.title}"...`);
                const blob = await downloadBookFileFromCloud(currentUser.uid, cBook.bookId);
                if (blob) {
                  await saveOriginalEpub(cBook.bookId, blob);
                }
              } else if (cBook.driveFileId && isDriveAuthorized()) {
                setSyncMessage(`Restaurando "${cBook.title}" do Google Drive...`);
                await restoreBookFromDrive(cBook.bookId);
              }
            }
          }
        }
      }

      // 2. Local -> Nuvem (Backup dos livros locais que ainda não estão na nuvem ou que estão sem capa na nuvem)
      const currentLocalBooks = await getAllBooks();
      for (const lBook of currentLocalBooks) {
        if (isQuotaExceeded()) {
          setSyncMessage('Modo local ativo (cota de nuvem em pausa)');
          break;
        }
        const isSample = SAMPLE_IDS.includes(lBook.id) || lBook.id.startsWith('sample-');
        if (isSample) continue;

        const cloudBook = cloudBooks?.find(cb => cb.bookId === lBook.id);
        if (!cloudBook) {
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
          // Livro já está na nuvem: verifica se a capa local precisa ser enviada para a nuvem
          // (ex: capa extraída no computador mas não sincronizada anteriormente com o celular)
          const localHasCover = isValidCoverUrl(lBook.coverUrl);
          const cloudHasCover = isValidCoverUrl(cloudBook.coverUrl);

          if (localHasCover && (!cloudHasCover || lBook.customCoverApplied) && !isQuotaExceeded()) {
            setSyncMessage(`Sincronizando capa de "${lBook.title}" com o celular...`);
            await syncBookToCloud(currentUser.uid, lBook);
          }

          if (!lBook.syncedToCloud) {
            lBook.syncedToCloud = true;
            lBook.hasCloudFile = !!cloudBook.hasCloudFile;
            await saveBook(lBook);
          }
        }
      }

      // Varre e recupera capas para livros que estejam sem capa localmente
      try {
        await repairAllMissingCovers();
      } catch (covErr) {
        console.warn('Aviso ao reparar capas na sincronização:', covErr);
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
      } else {
        setDriveAccessToken(null);
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
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            setDriveAccessToken(credential.accessToken);
          }
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
