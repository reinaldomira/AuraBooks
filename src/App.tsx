/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Cloud, Loader2 } from 'lucide-react';
import { Book, ReaderSettings } from './types/book';
import { 
  initStorage, getAllBooks, getBook, deleteBook, toggleFavorite, 
  updateBookProgress, getReaderSettings, saveReaderSettings,
  getUserCustomTags, addUserCustomTag, updateBookTags 
} from './services/storageService';
import { AudioReaderProvider, useAudioReader } from './context/AudioReaderContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar, AppView } from './components/Sidebar';
import { TopNavbar } from './components/TopNavbar';
import { LibraryView } from './components/LibraryView';
import { ExploreView } from './components/ExploreView';
import { BookDetailView } from './components/BookDetailView';
import { ReaderView } from './components/ReaderView';
import { EpubReaderView } from './components/EpubReaderView';
import { UploadModal } from './components/UploadModal';
import { MiniAudioPlayer } from './components/MiniAudioPlayer';
import { InstallAppModal } from './components/InstallAppModal';
import { AuthModal } from './components/AuthModal';
import { DriveBackupModal } from './components/DriveBackupModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { deleteOriginalEpub, hasOriginalEpub } from './services/epubStorageService';
import { deleteBookFromCloud } from './services/firebase';
import { restoreBookFromDrive } from './services/googleDriveService';
import { startAutoBackupService, stopAutoBackupService } from './services/googleDriveBackupService';

const AppContent: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [currentView, setCurrentView] = useState<AppView>('library');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpeningCloudBook, setIsOpeningCloudBook] = useState(false);
  const [cloudDownloadStep, setCloudDownloadStep] = useState('Baixando livro do Google Drive...');
  const [cloudDownloadError, setCloudDownloadError] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>(() => getUserCustomTags());
  const [useFallbackReader, setUseFallbackReader] = useState(false);

  const [readerSettings, setReaderSettings] = useState<ReaderSettings>({
    theme: 'alabaster',
    fontSize: 18,
    fontFamily: 'serif',
    lineHeight: 'relaxed',
    columnWidth: 'medium',
    autoScrollAudio: true,
  });

  const { currentBook, isPlaying, isPaused, playBook, loadBook, stopAudio } = useAudioReader();
  const { user, isSyncing, syncCurrentBook, syncProgress } = useAuth();

  // Load books and settings on startup
  useEffect(() => {
    async function load() {
      try {
        const initialBooks = await initStorage();
        setBooks(initialBooks);
        if (initialBooks.length > 0 && !selectedBook) {
          // Default to Cem Anos de Solidão or first book
          const defaultBook = initialBooks.find(b => b.id === 'book-cem-anos-solidao') || initialBooks[0];
          setSelectedBook(defaultBook);
          loadBook(defaultBook);
        }
        const settings = await getReaderSettings();
        setReaderSettings(settings);
      } catch (err) {
        console.error('Failed to initialize storage:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [loadBook]);

  // Inicializa o serviço de backup automático periódico no Google Drive
  useEffect(() => {
    startAutoBackupService();
    return () => {
      stopAutoBackupService();
    };
  }, []);

  const refreshBooks = async () => {
    const list = await getAllBooks();
    setBooks(list);
  };

  // Recarrega os livros automaticamente quando a sincronização com a nuvem finaliza
  useEffect(() => {
    if (!isSyncing && user) {
      refreshBooks();
    }
  }, [isSyncing, user]);

  const handleOpenReader = async (book: Book) => {
    // Carrega a versão mais atual diretamente do banco IndexedDB para garantir que progresso e CFI recentes sejam usados
    const freshBook = (await getBook(book.id)) || book;

    // Se for um EPUB, PDF, MOBI ou AZW3, verifica se o arquivo original já existe localmente no IndexedDB
    if (freshBook.format === 'epub' || freshBook.format === 'pdf' || freshBook.format === 'mobi' || freshBook.format === 'azw3') {
      const existsLocally = await hasOriginalEpub(freshBook.id);
      if (!existsLocally) {
        if (freshBook.driveFileId) {
          setIsOpeningCloudBook(true);
          setCloudDownloadStep('Baixando livro do Google Drive...');
          try {
            const result = await restoreBookFromDrive(freshBook.id, (step) => {
              setCloudDownloadStep(step);
            });
            if (!result.success) {
              console.warn('Falha ao restaurar livro do Google Drive:', result.error);
              setCloudDownloadError(result.error || 'Não foi possível baixar o livro do Google Drive no momento.');
              setIsOpeningCloudBook(false);
              return;
            }
          } catch (err) {
            console.warn('Erro ao obter arquivo do Google Drive antes de abrir:', err);
            setCloudDownloadError('Falha na comunicação com o Google Drive. Verifique sua conexão.');
            setIsOpeningCloudBook(false);
            return;
          } finally {
            setIsOpeningCloudBook(false);
          }
        }
      }
    }

    loadBook(freshBook);
    setSelectedBook(freshBook);
    setUseFallbackReader(false);
    setCurrentView('reader');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenDetails = (book: Book) => {
    setSelectedBook(book);
    setCurrentView('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePlayAudiobook = (book: Book) => {
    setSelectedBook(book);
    playBook(book, book.currentChapterIndex, book.currentParagraphIndex);
  };

  const handleBookImported = async (newBook: Book, originalFile?: Blob | File, openReader: boolean = false) => {
    await refreshBooks();
    setSelectedBook(newBook);
    if (user) {
      syncCurrentBook(newBook, originalFile);
    }
    if (openReader) {
      setUseFallbackReader(false);
      setCurrentView('reader');
    }
  };

  const handleDeleteBook = async (id: string) => {
    if (currentBook?.id === id) {
      stopAudio();
    }
    await deleteBook(id);
    await deleteOriginalEpub(id);
    if (user) {
      deleteBookFromCloud(user.uid, id).catch(() => {});
    }
    await refreshBooks();
    if (selectedBook?.id === id) {
      const remaining = books.filter(b => b.id !== id);
      setSelectedBook(remaining[0] || null);
      setCurrentView('library');
    }
  };

  const handleToggleFavorite = async (id: string) => {
    await toggleFavorite(id);
    await refreshBooks();
    if (selectedBook?.id === id) {
      setSelectedBook(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : null);
    }
  };

  const handleSaveBookTags = async (bookId: string, tags: string[]) => {
    await updateBookTags(bookId, tags);
    await refreshBooks();
    if (selectedBook?.id === bookId) {
      setSelectedBook(prev => prev ? { ...prev, tags } : null);
    }
  };

  const handleCreateTag = (newTag: string) => {
    const updated = addUserCustomTag(newTag);
    setAllTags(updated);
  };

  const handleUpdateReaderSettings = (settings: ReaderSettings) => {
    setReaderSettings(settings);
    saveReaderSettings(settings);
  };

  const handleNavigate = (view: AppView) => {
    if ((view === 'reader' || view === 'detail') && !selectedBook) {
      if (books.length > 0) {
        setSelectedBook(books[0]);
        loadBook(books[0]);
        setCurrentView(view);
      } else {
        setIsUploadOpen(true);
      }
      return;
    }
    setCurrentView(view);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9F8F5] flex items-center justify-center p-6 text-center">
        <div className="space-y-4">
          <div className="w-10 h-10 border-2 border-stone-900 border-t-[#9A3412] rounded-full animate-spin mx-auto" />
          <h2 className="font-serif-display text-2xl font-bold text-stone-950">
            Lumina
          </h2>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#9A3412] font-semibold block">
            BIBLIOTECA DE AUTORES
          </span>
          <p className="text-xs text-stone-500 font-sans">Carregando acervo literário...</p>
        </div>
      </div>
    );
  }

  // If in immersive reader, show full-screen book spread
  if (currentView === 'reader' && selectedBook) {
    if ((selectedBook.format === 'epub' || selectedBook.format === 'mobi' || selectedBook.format === 'azw3') && !useFallbackReader) {
      return (
        <EpubReaderView
          book={selectedBook}
          onBackToLibrary={async () => {
            await refreshBooks();
            setCurrentView('library');
          }}
          onFallbackToDefaultReader={() => setUseFallbackReader(true)}
          readerSettings={readerSettings}
        />
      );
    }

    return (
      <ReaderView
        book={selectedBook}
        onBackToLibrary={async () => {
          await refreshBooks();
          setCurrentView('library');
        }}
        onToggleFavorite={handleToggleFavorite}
        readerSettings={readerSettings}
        onUpdateReaderSettings={handleUpdateReaderSettings}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F8F5] text-stone-900 flex font-sans selection:bg-amber-200">
      {/* 1. Left Sidebar Navigation (Screens 1, 3, 4) */}
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
      />

      {/* Mobile Drawer Navigation */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-stone-950/60 backdrop-blur-xs flex">
          <div className="w-64 bg-[#F9F8F5] h-full shadow-2xl p-5 flex flex-col justify-between">
            <Sidebar
              isMobile={true}
              currentView={currentView}
              onNavigate={(view) => {
                handleNavigate(view);
                setIsMobileMenuOpen(false);
              }}
              onOpenUpload={() => {
                setIsUploadOpen(true);
                setIsMobileMenuOpen(false);
              }}
              onOpenInstallModal={() => {
                setIsInstallModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
            />
          </div>
          <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />
        </div>
      )}

      {/* 2. Main Body Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopNavbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          onNavigate={handleNavigate}
          onOpenInstallModal={() => setIsInstallModalOpen(true)}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onOpenBackupModal={() => setIsBackupModalOpen(true)}
        />

        {/* View Router */}
        <main className="flex-1">
          {currentView === 'library' && (
            <LibraryView
              books={books}
              onOpenBook={handleOpenReader}
              onPlayAudiobook={handlePlayAudiobook}
              onDeleteBook={handleDeleteBook}
              onToggleFavorite={handleToggleFavorite}
              onOpenUpload={() => setIsUploadOpen(true)}
              onOpenDetails={handleOpenDetails}
              allTags={allTags}
              onSaveBookTags={handleSaveBookTags}
              onCreateTag={handleCreateTag}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onRefreshBooks={refreshBooks}
              onOpenBackupModal={() => setIsBackupModalOpen(true)}
            />
          )}

          {currentView === 'explore' && (
            <ExploreView
              onOpenBook={handleOpenReader}
              onOpenUpload={() => setIsUploadOpen(true)}
              onBookAdded={async () => {
                await refreshBooks();
              }}
            />
          )}

          {currentView === 'detail' && selectedBook && (
            <BookDetailView
              book={selectedBook}
              onBack={() => setCurrentView('library')}
              onOpenReader={handleOpenReader}
              onPlayAudiobook={handlePlayAudiobook}
              onDeleteBook={handleDeleteBook}
              allTags={allTags}
              onSaveBookTags={handleSaveBookTags}
              onCreateTag={handleCreateTag}
              onRefreshBooks={refreshBooks}
            />
          )}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (Hidden on desktop) */}
      <MobileBottomNav
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        hasActiveBook={!!selectedBook || !!currentBook || books.length > 0}
      />

      {/* Floating Mini Audio Player when browsing and listening */}
      {(isPlaying || isPaused) && currentBook && currentView !== 'reader' && (
        <MiniAudioPlayer
          onOpenReader={() => {
            setSelectedBook(currentBook);
            setCurrentView('reader');
          }}
        />
      )}

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onBookImported={handleBookImported}
      />

      {/* Install Mobile App / APK Modal */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      {/* Cloud Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Google Drive Automatic Backup & Restore Modal */}
      <DriveBackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onLibraryRestored={refreshBooks}
      />

      {/* Cloud Book Download Overlay */}
      {isOpeningCloudBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 shadow-2xl border border-stone-200 flex flex-col items-center gap-3 max-w-xs text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-amber-700 animate-spin" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-900 text-sm">Recuperando livro...</h3>
              <p className="text-xs text-stone-600 mt-1.5 animate-pulse font-medium">{cloudDownloadStep}</p>
              <p className="text-[11px] text-stone-400 mt-1">Sincronizando o arquivo EPUB original do Google Drive para o leitor local.</p>
            </div>
          </div>
        </div>
      )}

      {/* Cloud Download Error Notice */}
      {cloudDownloadError && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-rose-50 border border-rose-200 rounded-xl p-4 shadow-xl text-xs text-rose-900 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-start justify-between gap-2">
            <div>
              <strong className="block font-semibold text-rose-950 mb-0.5">Falha ao baixar livro do Drive</strong>
              <p>{cloudDownloadError}</p>
              <p className="text-[11px] text-rose-700 mt-1.5">Seus dados e progresso permanecem salvos com segurança.</p>
            </div>
            <button
              onClick={() => setCloudDownloadError(null)}
              className="text-rose-500 hover:text-rose-800 font-bold p-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AudioReaderProvider>
        <AppContent />
      </AudioReaderProvider>
    </AuthProvider>
  );
}
