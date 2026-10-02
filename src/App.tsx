/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Book, ReaderSettings } from './types/book';
import { 
  initStorage, getAllBooks, deleteBook, toggleFavorite, 
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
import { deleteOriginalEpub } from './services/epubStorageService';

const AppContent: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [currentView, setCurrentView] = useState<AppView>('library');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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
  const { user, syncCurrentBook, syncProgress } = useAuth();

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

  const refreshBooks = async () => {
    const list = await getAllBooks();
    setBooks(list);
  };

  const handleOpenReader = (book: Book) => {
    loadBook(book);
    setSelectedBook(book);
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

  const handleBookImported = async (newBook: Book) => {
    await refreshBooks();
    setSelectedBook(newBook);
    setUseFallbackReader(false);
    setCurrentView('reader');
    if (user) {
      syncCurrentBook(newBook);
    }
  };

  const handleDeleteBook = async (id: string) => {
    if (currentBook?.id === id) {
      stopAudio();
    }
    await deleteBook(id);
    await deleteOriginalEpub(id);
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
    if (selectedBook.format === 'epub' && !useFallbackReader) {
      return (
        <EpubReaderView
          book={selectedBook}
          onBackToLibrary={() => {
            setCurrentView('library');
            refreshBooks();
          }}
          onFallbackToDefaultReader={() => setUseFallbackReader(true)}
          readerSettings={readerSettings}
        />
      );
    }

    return (
      <ReaderView
        book={selectedBook}
        onBackToLibrary={() => {
          setCurrentView('library');
          refreshBooks();
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
      />

      {/* Mobile Drawer Navigation */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-stone-950/60 backdrop-blur-xs flex">
          <div className="w-64 bg-[#F9F8F5] h-full shadow-2xl p-5 flex flex-col justify-between">
            <Sidebar
              currentView={currentView}
              onNavigate={(view) => {
                handleNavigate(view);
                setIsMobileMenuOpen(false);
              }}
              onOpenUpload={() => {
                setIsUploadOpen(true);
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
            />
          )}
        </main>
      </div>

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
