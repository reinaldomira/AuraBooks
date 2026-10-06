import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  ArrowLeft, List, Palette, Sliders, Volume2, 
  ChevronLeft, ChevronRight, Bookmark, Heart, 
  Sparkles, Check, Play, Pause, Headphones, Clock, X,
  Maximize2, Minimize2, Type, MessageSquare,
  Globe, Quote, Download, Sun, Moon, BookOpen,
  BookMarked, Edit3, Copy, Trash2, BookA, Loader2
} from 'lucide-react';
import { Book, ReaderSettings, BookHighlight, HighlightColor } from '../types/book';
import { useAudioReader } from '../context/AudioReaderContext';
import { AudioControlBar } from './AudioControlBar';
import { NotesDrawer } from './NotesDrawer';
import { DictionaryModal } from './DictionaryModal';
import { getHighlights, saveHighlight, deleteHighlight, updateBookProgress } from '../services/storageService';
import { auth, syncProgressToCloud } from '../services/firebase';
import { sanitizeWord } from '../services/dictionaryService';
import confetti from 'canvas-confetti';

interface ReaderViewProps {
  book: Book;
  onBackToLibrary: () => void;
  onToggleFavorite: (bookId: string) => void;
  readerSettings: ReaderSettings;
  onUpdateReaderSettings: (settings: ReaderSettings) => void;
}

const HIGHLIGHT_COLOR_CLASSES: Record<HighlightColor, { bg: string; border: string; text: string }> = {
  yellow: { bg: 'bg-amber-200/70', border: 'border-b-2 border-amber-400', text: 'text-stone-950' },
  green: { bg: 'bg-emerald-200/70', border: 'border-b-2 border-emerald-400', text: 'text-stone-950' },
  purple: { bg: 'bg-purple-200/70', border: 'border-b-2 border-purple-400', text: 'text-stone-950' },
  rose: { bg: 'bg-rose-200/70', border: 'border-b-2 border-rose-400', text: 'text-stone-950' },
  blue: { bg: 'bg-sky-200/70', border: 'border-b-2 border-sky-400', text: 'text-stone-950' },
};

export const ReaderView: React.FC<ReaderViewProps> = ({
  book,
  onBackToLibrary,
  onToggleFavorite,
  readerSettings,
  onUpdateReaderSettings,
}) => {
  const {
    chapterIndex,
    paragraphIndex,
    isPlaying,
    isPaused,
    playBook,
    jumpToParagraph,
    jumpToChapter,
    updatePosition,
    togglePlayPause,
  } = useAudioReader();

  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'double' | 'single' | 'full'>('double');
  const [showAudioBar, setShowAudioBar] = useState(false);
  const [activeBookmark, setActiveBookmark] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveStatusTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Current spread/page index inside the current chapter
  const [pageInChapter, setPageInChapter] = useState(0);
  const [isChapterMenuOpen, setIsChapterMenuOpen] = useState(false);

  // Notes & Highlights state
  const [highlights, setHighlights] = useState<BookHighlight[]>([]);
  const [isNotesDrawerOpen, setIsNotesDrawerOpen] = useState(false);
  const [dictionaryWord, setDictionaryWord] = useState<string | null>(null);
  const [selectionPopup, setSelectionPopup] = useState<{
    x: number;
    y: number;
    text: string;
    paragraphIdx: number;
  } | null>(null);

  // Note addition prompt popup
  const [notePromptHl, setNotePromptHl] = useState<BookHighlight | null>(null);
  const [notePromptText, setNotePromptText] = useState('');

  // Touch gesture tracking for mobile swipe
  const touchStartX = useRef<number | null>(null);

  // Load highlights from storage on book change
  useEffect(() => {
    async function load() {
      const saved = await getHighlights(book.id);
      setHighlights(saved);
    }
    load();
  }, [book.id]);

  const currentChapter = book.chapters[chapterIndex] || book.chapters[0];
  const paragraphs = currentChapter ? currentChapter.paragraphs : [];

  // Determine paragraphs per single page based on font size
  const PARAGRAPHS_PER_PAGE = useMemo(() => {
    if (readerSettings.fontSize <= 15) return 4;
    if (readerSettings.fontSize >= 22) return 2;
    return 3;
  }, [readerSettings.fontSize]);

  // How many paragraphs appear on the current screen spread
  const parasPerSpread = layoutMode === 'double' ? PARAGRAPHS_PER_PAGE * 2 : PARAGRAPHS_PER_PAGE;
  const totalSpreadsInChapter = Math.max(1, Math.ceil(paragraphs.length / parasPerSpread));

  // Restaura o spread/página inicial com base no currentParagraphIndex salvo no livro
  const hasRestoredInitialPage = useRef(false);
  useEffect(() => {
    if (!hasRestoredInitialPage.current && book.currentParagraphIndex && book.currentParagraphIndex > 0) {
      const targetSpread = Math.floor(book.currentParagraphIndex / parasPerSpread);
      if (targetSpread < totalSpreadsInChapter) {
        setPageInChapter(targetSpread);
      }
      hasRestoredInitialPage.current = true;
    }
  }, [book.currentParagraphIndex, parasPerSpread, totalSpreadsInChapter]);

  // Compute total book pages across all chapters
  const chapterPagesCount = useMemo(() => {
    return book.chapters.map(ch => Math.max(1, Math.ceil(ch.paragraphs.length / PARAGRAPHS_PER_PAGE)));
  }, [book.chapters, PARAGRAPHS_PER_PAGE]);

  const totalBookPages = useMemo(() => {
    return chapterPagesCount.reduce((acc, count) => acc + count, 0);
  }, [chapterPagesCount]);

  // Global page numbers
  const prevPagesSum = useMemo(() => {
    return chapterPagesCount.slice(0, chapterIndex).reduce((acc, count) => acc + count, 0);
  }, [chapterPagesCount, chapterIndex]);

  const currentPageNum = Math.min(
    totalBookPages,
    prevPagesSum + (pageInChapter * (layoutMode === 'double' ? 2 : 1)) + 1
  );

  const rightPageNum = Math.min(totalBookPages, currentPageNum + 1);
  const overallProgress = Math.min(100, Math.round((currentPageNum / totalBookPages) * 100));

  // Salvar manual da posição atual acionado pelo usuário
  const handleSaveCurrentPosition = useCallback(async () => {
    if (saveStatus === 'saving') return;
    setSaveStatus('saving');
    try {
      const paraIdx = pageInChapter * parasPerSpread;
      const progress = Math.min(100, Math.round((currentPageNum / totalBookPages) * 100));

      await updateBookProgress(book.id, chapterIndex, paraIdx, progress);

      if (auth.currentUser) {
        syncProgressToCloud(auth.currentUser.uid, book.id, chapterIndex, paraIdx, progress).catch(err => {
          console.warn('Erro ao sincronizar progresso com a nuvem:', err);
        });
      }

      book.currentChapterIndex = chapterIndex;
      book.currentParagraphIndex = paraIdx;
      book.progressPercent = progress;

      setSaveStatus('saved');
      if (saveStatusTimerRef.current) {
        clearTimeout(saveStatusTimerRef.current);
      }
      saveStatusTimerRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (err) {
      console.warn('Erro ao salvar posição:', err);
      setSaveStatus('idle');
    }
  }, [book, chapterIndex, pageInChapter, parasPerSpread, currentPageNum, totalBookPages, saveStatus]);

  // Auto-save com debounce de 600ms ao virar de página
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      const paraIdx = pageInChapter * parasPerSpread;
      const progress = Math.min(100, Math.round((currentPageNum / totalBookPages) * 100));
      updateBookProgress(book.id, chapterIndex, paraIdx, progress).catch(() => {});
      book.currentChapterIndex = chapterIndex;
      book.currentParagraphIndex = paraIdx;
      book.progressPercent = progress;
    }, 600);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [chapterIndex, pageInChapter, parasPerSpread, currentPageNum, totalBookPages, book]);

  // Salvar e voltar à biblioteca
  const handleBackToLibrary = useCallback(async () => {
    const paraIdx = pageInChapter * parasPerSpread;
    const progress = Math.min(100, Math.round((currentPageNum / totalBookPages) * 100));
    try {
      await updateBookProgress(book.id, chapterIndex, paraIdx, progress);
      if (auth.currentUser) {
        await syncProgressToCloud(auth.currentUser.uid, book.id, chapterIndex, paraIdx, progress);
      }
    } catch {}
    onBackToLibrary();
  }, [book.id, chapterIndex, pageInChapter, parasPerSpread, currentPageNum, totalBookPages, onBackToLibrary]);

  // Paragraphs for Left Page and Right Page
  const startParaIdx = pageInChapter * parasPerSpread;
  const leftPageParagraphs = paragraphs.slice(startParaIdx, startParaIdx + PARAGRAPHS_PER_PAGE);
  const rightPageParagraphs = layoutMode === 'double' 
    ? paragraphs.slice(startParaIdx + PARAGRAPHS_PER_PAGE, startParaIdx + parasPerSpread) 
    : [];

  // Synchronize active spread when audio narration moves
  useEffect(() => {
    if (isPlaying) {
      const targetSpread = Math.floor(paragraphIndex / parasPerSpread);
      if (targetSpread !== pageInChapter && targetSpread < totalSpreadsInChapter) {
        setPageInChapter(targetSpread);
      }
    }
  }, [paragraphIndex, isPlaying, parasPerSpread, totalSpreadsInChapter, pageInChapter]);

  // Reset pageInChapter when switching chapters manually
  useEffect(() => {
    if (pageInChapter >= totalSpreadsInChapter) {
      setPageInChapter(0);
    }
  }, [chapterIndex, totalSpreadsInChapter, pageInChapter]);

  // Manual Page Navigation Functions
  const handleNextPage = () => {
    if (pageInChapter + 1 < totalSpreadsInChapter) {
      setPageInChapter(prev => prev + 1);
    } else if (chapterIndex + 1 < book.chapters.length) {
      jumpToChapter(chapterIndex + 1);
      setPageInChapter(0);
    }
  };

  const handlePrevPage = () => {
    if (pageInChapter > 0) {
      setPageInChapter(prev => prev - 1);
    } else if (chapterIndex > 0) {
      const prevChapParas = book.chapters[chapterIndex - 1].paragraphs.length;
      const prevSpreads = Math.max(1, Math.ceil(prevChapParas / parasPerSpread));
      jumpToChapter(chapterIndex - 1);
      setPageInChapter(prevSpreads - 1);
    }
  };

  const handleJumpToGlobalPage = (targetPage: number) => {
    const clamped = Math.max(1, Math.min(totalBookPages, targetPage));
    let accumulated = 0;
    for (let c = 0; c < book.chapters.length; c++) {
      const pCount = chapterPagesCount[c];
      if (clamped <= accumulated + pCount) {
        const pageWithinChap = clamped - accumulated - 1;
        const spreadWithinChap = Math.floor(pageWithinChap / (layoutMode === 'double' ? 2 : 1));
        jumpToChapter(c);
        setPageInChapter(spreadWithinChap);
        return;
      }
      accumulated += pCount;
    }
  };

  // Keyboard navigation listener (Arrow keys, PageUp/Down, A/D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handlePrevPage();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pageInChapter, totalSpreadsInChapter, chapterIndex, book.chapters.length, parasPerSpread]);

  // Handle Text Selection for Floating Highlighter Toolbar
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      // Don't close immediately if clicking inside popup
      return;
    }

    const selectedText = selection.toString().trim();
    if (selectedText.length < 3) return;

    // Check if selection is inside reader body
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Find enclosing paragraph index
    const parentParagraph = selection.anchorNode?.parentElement?.closest('[data-para-idx]');
    const paraIdx = parentParagraph ? parseInt(parentParagraph.getAttribute('data-para-idx') || '0', 10) : 0;

    setSelectionPopup({
      x: rect.left + rect.width / 2,
      y: Math.max(10, rect.top - 50),
      text: selectedText,
      paragraphIdx: paraIdx,
    });
  };

  // Double Click for Fast 1-Click Portuguese Dictionary
  const handleDoubleClick = () => {
    const selection = window.getSelection();
    if (selection) {
      const selected = selection.toString().trim();
      const cleaned = sanitizeWord(selected);
      if (cleaned && cleaned.length >= 2 && !cleaned.includes(' ')) {
        setDictionaryWord(cleaned);
        setSelectionPopup(null);
      }
    }
  };

  // Save dictionary definition into user notes
  const handleSaveDictionaryNote = async (term: string, definition: string) => {
    const newHl: BookHighlight = {
      id: `hl-dict-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      bookId: book.id,
      chapterIndex,
      chapterTitle: currentChapter?.title || `Capítulo ${chapterIndex + 1}`,
      paragraphIndex,
      color: 'yellow',
      text: term,
      note: definition,
      createdAt: Date.now(),
      pageNumber: currentPageNum,
    };
    await saveHighlight(newHl);
    setHighlights(prev => [...prev, newHl]);
  };

  // Create and save highlight
  const handleCreateHighlight = async (color: HighlightColor) => {
    if (!selectionPopup) return;

    const newHl: BookHighlight = {
      id: `hl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      bookId: book.id,
      chapterIndex,
      chapterTitle: currentChapter?.title || `Capítulo ${chapterIndex + 1}`,
      paragraphIndex: selectionPopup.paragraphIdx,
      color,
      text: selectionPopup.text,
      createdAt: Date.now(),
      pageNumber: currentPageNum,
    };

    await saveHighlight(newHl);
    setHighlights(prev => [...prev, newHl]);
    setSelectionPopup(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleDeleteHighlight = async (id: string) => {
    await deleteHighlight(id, book.id);
    setHighlights(prev => prev.filter(h => h.id !== id));
  };

  const handleUpdateNote = async (id: string, note: string) => {
    const target = highlights.find(h => h.id === id);
    if (!target) return;
    const updated = { ...target, note };
    await saveHighlight(updated);
    setHighlights(prev => prev.map(h => (h.id === id ? updated : h)));
  };

  // Touch Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX.current;
    if (deltaX < -50) {
      handleNextPage();
    } else if (deltaX > 50) {
      handlePrevPage();
    }
    touchStartX.current = null;
  };

  // Theme style mapping
  const getThemeStyles = () => {
    switch (readerSettings.theme) {
      case 'sepia':
        return {
          bg: 'bg-[#F4ECD8]',
          pageBg: 'bg-[#FDF9ED]',
          text: 'text-[#433422]',
          border: 'border-[#D9CCA8]',
          highlight: 'bg-[#EAD8B3] border-amber-700',
          gutter: 'from-black/10 via-black/3 to-transparent',
        };
      case 'dark':
        return {
          bg: 'bg-[#121214]',
          pageBg: 'bg-[#1A1A1E]',
          text: 'text-[#E4E4E7]',
          border: 'border-stone-800',
          highlight: 'bg-stone-800 border-amber-400 text-amber-200',
          gutter: 'from-white/5 via-white/1 to-transparent',
        };
      case 'alabaster':
      default:
        return {
          bg: 'bg-[#F4F1EA]',
          pageBg: 'bg-[#FFFFFF]',
          text: 'text-stone-900',
          border: 'border-[#E8E2D9]',
          highlight: 'bg-[#FBE8C5] border-amber-700 text-stone-950',
          gutter: 'from-black/8 via-black/2 to-transparent',
        };
    }
  };

  const theme = getThemeStyles();

  // Font family mapping
  const getFontFamilyClass = () => {
    switch (readerSettings.fontFamily) {
      case 'sans': return 'font-sans';
      case 'mono': return 'font-mono text-[0.92em]';
      case 'serif':
      default: return 'font-reading-serif';
    }
  };

  // Line height mapping
  const getLineHeightClass = () => {
    switch (readerSettings.lineHeight) {
      case 'normal': return 'leading-[1.65]';
      case 'loose': return 'leading-[2.1]';
      case 'relaxed':
      default: return 'leading-[1.85]';
    }
  };

  const isAtFirstPage = chapterIndex === 0 && pageInChapter === 0;
  const isAtLastPage = chapterIndex >= book.chapters.length - 1 && pageInChapter >= totalSpreadsInChapter - 1;

  // Render a paragraph with its highlighted segments
  const renderParagraphContent = (paraText: string, globalIdx: number) => {
    const paraHighlights = highlights.filter(h => h.chapterIndex === chapterIndex && h.paragraphIndex === globalIdx);

    if (paraHighlights.length === 0) {
      return paraText;
    }

    // Sort highlights by where they appear
    let elements: React.ReactNode[] = [];
    let remainingText = paraText;
    let keyIdx = 0;

    for (const hl of paraHighlights) {
      const matchPos = remainingText.indexOf(hl.text);
      if (matchPos !== -1) {
        // Text before highlight
        if (matchPos > 0) {
          elements.push(<span key={keyIdx++}>{remainingText.substring(0, matchPos)}</span>);
        }

        // The highlighted text
        const colorStyle = HIGHLIGHT_COLOR_CLASSES[hl.color] || HIGHLIGHT_COLOR_CLASSES.yellow;
        elements.push(
          <mark
            key={keyIdx++}
            className={`${colorStyle.bg} ${colorStyle.border} ${colorStyle.text} rounded-xs px-0.5 relative group cursor-pointer inline`}
            title={hl.note ? `Nota: "${hl.note}"` : 'Trecho destacado'}
            onClick={(e) => {
              e.stopPropagation();
              setNotePromptHl(hl);
              setNotePromptText(hl.note || '');
            }}
          >
            {hl.text}
            {hl.note && (
              <span className="inline-block ml-1 text-[10px] text-amber-800 align-super font-sans">
                ✏️
              </span>
            )}
          </mark>
        );

        remainingText = remainingText.substring(matchPos + hl.text.length);
      }
    }

    if (remainingText) {
      elements.push(<span key={keyIdx++}>{remainingText}</span>);
    }

    return elements;
  };

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      className={`min-h-screen flex flex-col ${theme.bg} text-stone-900 select-text transition-colors duration-200`}
    >
      {/* 1. Reader Top Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#F9F8F5]/95 backdrop-blur-md border-b border-[#E8E2D9] px-2.5 sm:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4 pt-[env(safe-area-inset-top,0px)]">
        {/* Left: Back to Library */}
        <button
          onClick={handleBackToLibrary}
          className="inline-flex items-center gap-1.5 sm:gap-2 text-xs font-semibold text-stone-700 hover:text-stone-950 px-2 sm:px-2.5 py-1.5 rounded-lg hover:bg-stone-200/50 transition-colors font-sans cursor-pointer active:scale-95 shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Biblioteca</span>
        </button>

        {/* Center: Book Title & Chapter indicator with direct jump menu */}
        <div className="relative text-center truncate px-2">
          <button
            onClick={() => setIsChapterMenuOpen(!isChapterMenuOpen)}
            className="flex items-center gap-1.5 mx-auto group hover:opacity-80 transition-opacity cursor-pointer"
          >
            <h2 className="font-serif-display font-bold text-sm sm:text-base text-stone-950 truncate leading-snug group-hover:text-amber-900">
              {book.title}
            </h2>
            <List className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-700 shrink-0" />
          </button>
          
          <p className="text-[11px] text-stone-500 font-sans truncate">
            {currentChapter?.title || `Capítulo ${chapterIndex + 1}`} • Pág. {currentPageNum} de {totalBookPages}
          </p>

          {/* Chapter Selector Dropdown */}
          {isChapterMenuOpen && (
            <div className="absolute left-1/2 -translate-x-1/2 top-12 w-72 max-h-80 bg-white rounded-2xl shadow-xl border border-stone-200 p-2 overflow-y-auto z-50 text-left animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 border-b border-stone-100 flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-stone-400 font-sans">Capítulos & Sumário</span>
                <span className="text-xs font-sans text-stone-500">{book.chapters.length} partes</span>
              </div>
              <div className="py-1 space-y-0.5">
                {book.chapters.map((ch, idx) => (
                  <button
                    key={ch.id || idx}
                    onClick={() => {
                      jumpToChapter(idx);
                      setPageInChapter(0);
                      setIsChapterMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-sans transition-colors flex items-center justify-between cursor-pointer ${
                      chapterIndex === idx
                        ? 'bg-amber-100/70 text-amber-950 font-bold'
                        : 'text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <span className="truncate">{ch.title || `Capítulo ${idx + 1}`}</span>
                    {chapterIndex === idx && <Check className="w-3.5 h-3.5 text-amber-800 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Actions (Dicionário, Caderno de Anotações, Marcar, Aa) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Dicionário 1-Clique */}
          <button
            onClick={() => setDictionaryWord('tempo')}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white hover:bg-stone-100 border border-stone-200 transition-colors font-sans cursor-pointer text-stone-700 hover:text-stone-950 shadow-2xs"
            title="Dicionário Rápido de Português (ou dê duplo clique em qualquer palavra)"
          >
            <BookA className="w-3.5 h-3.5 text-amber-800" />
            <span className="hidden md:inline font-medium">Dicionário</span>
          </button>

          {/* Anotações Drawer Toggle Button */}
          <button
            onClick={() => setIsNotesDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white hover:bg-stone-100 border border-stone-200 transition-colors font-sans cursor-pointer text-stone-700 hover:text-stone-950 shadow-2xs"
            title="Abrir Caderno de Citações e Anotações"
          >
            <BookMarked className="w-3.5 h-3.5 text-amber-800" />
            <span className="hidden sm:inline font-medium">Anotações</span>
            <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded-full font-bold">
              {highlights.length}
            </span>
          </button>

          {/* Botão Salvar onde parei */}
          <button
            onClick={handleSaveCurrentPosition}
            disabled={saveStatus === 'saving'}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 font-sans cursor-pointer shadow-xs ${
              saveStatus === 'saved'
                ? 'bg-emerald-100 border-emerald-400 text-emerald-950 font-semibold'
                : 'bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-950 font-semibold'
            }`}
            title="Salvar onde parei de ler (grava no banco de dados local e nuvem)"
          >
            {saveStatus === 'saving' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-amber-800 animate-spin" />
                <span className="font-semibold hidden sm:inline">Salvando...</span>
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-700 stroke-[2.5]" />
                <span className="font-bold text-emerald-800">Posição salva!</span>
              </>
            ) : (
              <>
                <Bookmark className="w-3.5 h-3.5 text-amber-800 fill-amber-700/20" />
                <span className="font-semibold">Salvar onde parei</span>
              </>
            )}
          </button>

          <button
            onClick={() => setIsPreferencesOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 hover:text-stone-950 px-2.5 py-1.5 rounded-lg bg-stone-200/50 hover:bg-stone-200 transition-colors font-sans cursor-pointer"
          >
            <Type className="w-3.5 h-3.5" />
            <span className="font-serif font-bold text-xs">Aa</span>
          </button>
        </div>
      </header>

      {/* 2. Main Two-Page Open Book Spread Canvas with Floating Lateral Turn Buttons */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-2 sm:px-6 py-4 sm:py-8 flex items-center justify-center relative">
        {/* Floating Left Page Turn Button */}
        <button
          onClick={handlePrevPage}
          disabled={isAtFirstPage}
          className={`absolute left-0 sm:left-1 z-20 w-11 h-11 rounded-full bg-white/95 border border-stone-300 text-stone-800 shadow-md hover:bg-stone-900 hover:text-white hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer ${
            isAtFirstPage ? 'opacity-20 pointer-events-none' : 'opacity-80 hover:opacity-100'
          }`}
          title="Página Anterior (Seta Esquerda ← ou tecla A)"
        >
          <ChevronLeft className="w-6 h-6 -translate-x-0.5" />
        </button>

        {/* Floating Right Page Turn Button */}
        <button
          onClick={handleNextPage}
          disabled={isAtLastPage}
          className={`absolute right-0 sm:right-1 z-20 w-11 h-11 rounded-full bg-white/95 border border-stone-300 text-stone-800 shadow-md hover:bg-stone-900 hover:text-white hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer ${
            isAtLastPage ? 'opacity-20 pointer-events-none' : 'opacity-80 hover:opacity-100'
          }`}
          title="Próxima Página (Seta Direita → ou tecla D)"
        >
          <ChevronRight className="w-6 h-6 translate-x-0.5" />
        </button>

        {/* The Open Book Canvas */}
        <div 
          className={`w-full rounded-2xl shadow-xl border ${theme.border} ${theme.pageBg} overflow-hidden transition-all duration-300 animate-in fade-in duration-200 ${
            layoutMode === 'double' ? 'grid grid-cols-1 md:grid-cols-2' : 'max-w-2xl mx-auto'
          }`}
        >
          {/* Left Page */}
          <div className="p-6 sm:p-10 lg:p-12 relative flex flex-col justify-between border-b md:border-b-0 md:border-r border-[#EBE6DF]">
            {/* Book spine gutter shadow (right side of left page) */}
            {layoutMode === 'double' && (
              <div className={`hidden md:block absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l ${theme.gutter} pointer-events-none`} />
            )}

            {/* Left Page Header */}
            <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-stone-600 font-sans font-semibold pb-4 mb-4 border-b border-stone-200/50">
              <span className="truncate">{book.author}</span>
              <span className="tabular-nums font-mono">Pág. {currentPageNum}</span>
            </div>

            {/* Left Page Body Content */}
            <div 
              className={`space-y-4 text-justify ${getFontFamilyClass()} ${getLineHeightClass()} ${theme.text} min-h-[360px]`}
              style={{ fontSize: `${readerSettings.fontSize}px` }}
            >
              {leftPageParagraphs.length > 0 ? (
                leftPageParagraphs.map((para, i) => {
                  const globalIdx = startParaIdx + i;
                  const isCurrentAudio = isPlaying && globalIdx === paragraphIndex;
                  const isInitial = pageInChapter === 0 && i === 0 && chapterIndex === 0;

                  return (
                    <p
                      key={i}
                      data-para-idx={globalIdx}
                      onClick={() => jumpToParagraph(globalIdx)}
                      className={`relative cursor-pointer transition-colors rounded p-1.5 leading-relaxed ${
                        isCurrentAudio ? theme.highlight : 'hover:bg-amber-50/50'
                      } ${
                        isInitial
                          ? 'first-letter:text-6xl first-letter:font-serif-display first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:text-stone-950'
                          : ''
                      }`}
                    >
                      {isCurrentAudio && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-900 font-sans font-bold mr-2 uppercase">
                          <Headphones className="w-3 h-3 text-amber-700 animate-pulse" />
                          <span>Lendo:</span>
                        </span>
                      )}
                      {renderParagraphContent(para, globalIdx)}
                    </p>
                  );
                })
              ) : (
                <div className="py-16 text-center text-stone-400 italic font-serif">
                  Fim dos parágrafos desta seção.
                </div>
              )}
            </div>

            {/* Left Page Footer */}
            <div className="text-center pt-6 text-[11px] text-stone-500 font-serif italic border-t border-stone-200/40">
              — {book.title} —
            </div>
          </div>

          {/* Right Page (In Double Mode) */}
          {layoutMode === 'double' && (
            <div className="p-6 sm:p-10 lg:p-12 relative flex flex-col justify-between">
              {/* Book spine gutter shadow (left side of right page) */}
              <div className={`hidden md:block absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r ${theme.gutter} pointer-events-none`} />

              {/* Right Page Header */}
              <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-stone-600 font-sans font-semibold pb-4 mb-4 border-b border-stone-200/50">
                <span className="truncate">{currentChapter?.title || 'SEÇÃO DE LEITURA'}</span>
                <span className="tabular-nums font-mono">Pág. {rightPageNum}</span>
              </div>

              {/* Right Page Body Content */}
              <div 
                className={`space-y-4 text-justify ${getFontFamilyClass()} ${getLineHeightClass()} ${theme.text} min-h-[360px]`}
                style={{ fontSize: `${readerSettings.fontSize}px` }}
              >
                {rightPageParagraphs.length > 0 ? (
                  rightPageParagraphs.map((para, i) => {
                    const globalIdx = startParaIdx + PARAGRAPHS_PER_PAGE + i;
                    const isCurrentAudio = isPlaying && globalIdx === paragraphIndex;

                    return (
                      <div
                        key={i}
                        data-para-idx={globalIdx}
                        onClick={() => jumpToParagraph(globalIdx)}
                        className={`relative cursor-pointer transition-all rounded p-1.5 leading-relaxed ${
                          isCurrentAudio 
                            ? theme.highlight 
                            : 'hover:bg-amber-50/50'
                        }`}
                      >
                        {isCurrentAudio && (
                          <span className="flex items-center gap-1 text-[10px] text-amber-900 font-sans font-bold mb-1">
                            <Headphones className="w-3 h-3 text-amber-700 animate-pulse" />
                            <span>Lendo em áudio:</span>
                          </span>
                        )}
                        <p>{renderParagraphContent(para, globalIdx)}</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-20 text-center text-stone-400 italic font-serif flex flex-col items-center justify-center space-y-2">
                    <BookOpen className="w-8 h-8 text-stone-300" />
                    <span>Próximo capítulo disponível</span>
                  </div>
                )}
              </div>

              {/* Right Page Footer */}
              <div className="text-center pt-6 text-[11px] text-stone-500 font-serif italic border-t border-stone-200/40">
                — Pág. {rightPageNum} —
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Floating Highlighter Toolbar when text is selected */}
      {selectionPopup && (
        <div
          style={{ 
            position: 'fixed', 
            left: `${Math.min(window.innerWidth - 240, Math.max(20, selectionPopup.x - 120))}px`, 
            top: `${selectionPopup.y}px` 
          }}
          className="z-50 bg-stone-900 text-white rounded-xl shadow-2xl p-1.5 flex items-center gap-2 animate-in zoom-in-95 duration-150 border border-stone-700"
        >
          {/* Color marker options */}
          <div className="flex items-center gap-1.5 px-1.5 border-r border-stone-700">
            <button
              onClick={() => handleCreateHighlight('yellow')}
              className="w-5 h-5 rounded-full bg-amber-300 hover:scale-115 transition-transform border border-amber-400 cursor-pointer shadow-xs"
              title="Marca-texto Amarelo"
            />
            <button
              onClick={() => handleCreateHighlight('green')}
              className="w-5 h-5 rounded-full bg-emerald-400 hover:scale-115 transition-transform border border-emerald-500 cursor-pointer shadow-xs"
              title="Marca-texto Verde"
            />
            <button
              onClick={() => handleCreateHighlight('purple')}
              className="w-5 h-5 rounded-full bg-purple-400 hover:scale-115 transition-transform border border-purple-500 cursor-pointer shadow-xs"
              title="Marca-texto Lavanda"
            />
            <button
              onClick={() => handleCreateHighlight('rose')}
              className="w-5 h-5 rounded-full bg-rose-400 hover:scale-115 transition-transform border border-rose-500 cursor-pointer shadow-xs"
              title="Marca-texto Coral"
            />
            <button
              onClick={() => handleCreateHighlight('blue')}
              className="w-5 h-5 rounded-full bg-sky-400 hover:scale-115 transition-transform border border-sky-500 cursor-pointer shadow-xs"
              title="Marca-texto Azul"
            />
          </div>

          {/* Quick Dictionary lookup */}
          <button
            onClick={() => {
              const firstWord = sanitizeWord(selectionPopup.text.split(' ')[0]);
              setDictionaryWord(firstWord || selectionPopup.text);
              setSelectionPopup(null);
            }}
            className="p-1 px-1.5 hover:bg-stone-800 rounded text-xs flex items-center gap-1 font-sans cursor-pointer text-amber-300 hover:text-amber-200"
            title="Consultar no Dicionário da Língua Portuguesa"
          >
            <BookA className="w-3.5 h-3.5" />
            <span>Definir</span>
          </button>

          {/* Quick Copy */}
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(`"${selectionPopup.text}" — ${book.title}, ${book.author}`);
              setSelectionPopup(null);
            }}
            className="p-1 px-1.5 hover:bg-stone-800 rounded text-xs flex items-center gap-1 font-sans cursor-pointer text-stone-300 hover:text-white"
            title="Copiar citação formatada"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Copiar</span>
          </button>

          {/* Close toolbar */}
          <button
            onClick={() => setSelectionPopup(null)}
            className="p-1 hover:bg-stone-800 text-stone-400 hover:text-white rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Note view/edit modal for clicked highlight */}
      {notePromptHl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <span className="text-xs font-semibold font-sans text-stone-900 flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                <span>Nota Marginal & Destaque</span>
              </span>
              <button
                onClick={() => setNotePromptHl(null)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-stone-50 border-l-2 border-amber-600 font-serif italic text-xs text-stone-800 leading-relaxed">
              “{notePromptHl.text}”
            </div>

            <div className="space-y-1.5 font-sans">
              <label className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                Sua anotação pessoal:
              </label>
              <textarea
                value={notePromptText}
                onChange={(e) => setNotePromptText(e.target.value)}
                placeholder="Escreva sua reflexão, insight ou comentário sobre esta passagem..."
                rows={3}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-stone-600"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-stone-100 font-sans text-xs">
              <button
                onClick={async () => {
                  await handleDeleteHighlight(notePromptHl.id);
                  setNotePromptHl(null);
                }}
                className="text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remover Destaque</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setNotePromptHl(null)}
                  className="px-3 py-1.5 text-stone-600 hover:text-stone-900"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    await handleUpdateNote(notePromptHl.id, notePromptText.trim());
                    setNotePromptHl(null);
                  }}
                  className="px-4 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg font-semibold shadow-xs"
                >
                  Salvar Nota
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Bottom Utility & Manual Page Turning Bar */}
      <footer className="sticky bottom-0 z-30 bg-[#F9F8F5]/95 backdrop-blur-md border-t border-[#E8E2D9] px-4 sm:px-8 py-3">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-sans text-stone-600">
          {/* Left: Overall Reading Progress */}
          <div className="flex items-center gap-3">
            <span className="font-bold text-stone-900 tabular-nums">{overallProgress}%</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums font-medium text-stone-800">
              Página {currentPageNum} de {totalBookPages}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-stone-500 hidden sm:inline">
              Capítulo {chapterIndex + 1}/{book.chapters.length}
            </span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            {/* Quick Save in Footer */}
            <button
              onClick={handleSaveCurrentPosition}
              disabled={saveStatus === 'saving'}
              className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition-colors cursor-pointer border ${
                saveStatus === 'saved'
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
                  : 'bg-stone-100 text-stone-700 hover:text-stone-950 border-stone-200 hover:bg-stone-200'
              }`}
              title="Salvar onde parei de ler"
            >
              {saveStatus === 'saved' ? (
                <>
                  <Check className="w-3 h-3 text-emerald-700" />
                  <span>Salvo!</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-3 h-3 text-amber-800" />
                  <span>Salvar posição</span>
                </>
              )}
            </button>
          </div>

          {/* Center: Flip Page Buttons & Interactive Page Scrubber Slider */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-center">
            {/* Previous Page Button */}
            <button
              onClick={handlePrevPage}
              disabled={isAtFirstPage}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 hover:text-stone-950 font-semibold disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer text-xs shrink-0"
              title="Voltar página (←)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            {/* Interactive Page Slider */}
            <div className="flex items-center gap-2 max-w-[200px] w-full">
              <input
                type="range"
                min="1"
                max={totalBookPages}
                value={currentPageNum}
                onChange={(e) => handleJumpToGlobalPage(parseInt(e.target.value))}
                className="w-full accent-stone-900 cursor-pointer h-1.5 bg-stone-300 rounded-lg"
                title={`Arraste para folhear diretamente (pág. ${currentPageNum})`}
              />
            </div>

            {/* Next Page Button */}
            <button
              onClick={handleNextPage}
              disabled={isAtLastPage}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 hover:text-stone-950 font-semibold disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer text-xs shrink-0"
              title="Avançar página (→)"
            >
              <span>Próxima</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Audio Narration & Preferences shortcuts */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-stone-400 hidden lg:inline">
              Setas ← / → do teclado para folhear
            </span>

            {/* Audio narration toggle button */}
            <button
              onClick={() => {
                setShowAudioBar(!showAudioBar);
                if (!isPlaying && !showAudioBar) {
                  togglePlayPause();
                }
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer text-xs font-medium ${
                isPlaying 
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold' 
                  : 'hover:bg-stone-200/50 text-stone-700 border border-stone-200'
              }`}
              title="Leitor de Audiolivro / Narração TTS"
            >
              <Headphones className="w-3.5 h-3.5 text-amber-800" />
              <span>{isPlaying ? 'Ouvindo' : 'Áudio'}</span>
              {isPlaying && (
                <span className="flex items-center gap-0.5 ml-1">
                  <span className="w-1 h-2.5 bg-amber-700 rounded-full animate-wave-1" />
                  <span className="w-1 h-3.5 bg-amber-700 rounded-full animate-wave-2" />
                  <span className="w-1 h-2 bg-amber-700 rounded-full animate-wave-3" />
                </span>
              )}
            </button>
          </div>
        </div>
      </footer>

      {/* Docked Audio Control Bar (Shown when listening) */}
      {showAudioBar && (
        <AudioControlBar
          totalParagraphs={paragraphs.length}
          totalChapters={book.chapters.length}
          autoScroll={readerSettings.autoScrollAudio}
          onToggleAutoScroll={() => {
            onUpdateReaderSettings({
              ...readerSettings,
              autoScrollAudio: !readerSettings.autoScrollAudio,
            });
          }}
        />
      )}

      {/* Notes & Highlights Drawer */}
      <NotesDrawer
        isOpen={isNotesDrawerOpen}
        onClose={() => setIsNotesDrawerOpen(false)}
        book={book}
        highlights={highlights}
        onDeleteHighlight={handleDeleteHighlight}
        onUpdateNote={handleUpdateNote}
        onJumpToHighlight={(chapIdx, paraIdx) => {
          jumpToChapter(chapIdx);
          const targetSpread = Math.floor(paraIdx / parasPerSpread);
          setPageInChapter(targetSpread);
        }}
      />

      {/* 4. "Preferências de Leitura" Modal Flyout (Screen 2 Right Panel) */}
      {isPreferencesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-stone-950/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white h-full shadow-2xl p-6 flex flex-col justify-between border-l border-[#EBE6DF] overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-stone-200 pb-4">
                <h3 className="font-serif-display font-bold text-lg text-stone-950">
                  Preferências de Leitura
                </h3>
                <button
                  onClick={() => setIsPreferencesOpen(false)}
                  className="p-1 text-stone-400 hover:text-stone-800 rounded-lg hover:bg-stone-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Ambiente de Luz */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-stone-500 font-sans font-bold block">
                  AMBIENTE DE LUZ
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'alabaster', label: 'Claro', icon: Sun },
                    { id: 'sepia', label: 'Sépia', icon: Sparkles },
                    { id: 'dark', label: 'Carvão', icon: Moon },
                  ].map(amb => (
                    <button
                      key={amb.id}
                      onClick={() => onUpdateReaderSettings({ ...readerSettings, theme: amb.id as any })}
                      className={`p-3 rounded-xl border text-center flex flex-col items-center gap-1.5 transition-all font-sans text-xs cursor-pointer ${
                        readerSettings.theme === amb.id
                          ? 'border-stone-900 bg-stone-50 font-bold shadow-2xs'
                          : 'border-stone-200 hover:border-stone-300 text-stone-600'
                      }`}
                    >
                      <amb.icon className="w-4 h-4" />
                      <span>{amb.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipografia */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-stone-500 font-sans font-bold block">
                  TIPOGRAFIA
                </label>
                <div className="grid grid-cols-3 gap-2 bg-[#F3EFEA] p-1 rounded-xl">
                  {[
                    { id: 'serif', label: 'Serif', font: 'font-serif' },
                    { id: 'sans', label: 'Sans', font: 'font-sans' },
                    { id: 'mono', label: 'Mono', font: 'font-mono' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => onUpdateReaderSettings({ ...readerSettings, fontFamily: f.id as any })}
                      className={`py-2 text-xs rounded-lg transition-all cursor-pointer ${f.font} ${
                        readerSettings.fontFamily === f.id
                          ? 'bg-white text-stone-950 font-bold shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tamanho da Letra */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-sans">
                  <span className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">
                    TAMANHO DA LETRA
                  </span>
                  <span className="font-bold tabular-nums text-stone-900">{readerSettings.fontSize}px</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-serif text-xs font-bold">A</span>
                  <input
                    type="range"
                    min="14"
                    max="26"
                    value={readerSettings.fontSize}
                    onChange={(e) => onUpdateReaderSettings({ ...readerSettings, fontSize: parseInt(e.target.value) })}
                    className="flex-1 accent-stone-900 cursor-pointer h-1.5 bg-stone-200 rounded-lg"
                  />
                  <span className="font-serif text-lg font-bold">A</span>
                </div>
              </div>

              {/* Espaçamento entre Linhas */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-stone-500 font-sans font-bold block">
                  ESPAÇAMENTO ENTRE LINHAS
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'normal', label: 'Compacto' },
                    { id: 'relaxed', label: 'Ideal' },
                    { id: 'loose', label: 'Amplo' },
                  ].map(s => (
                    <button
                      key={s.id}
                      onClick={() => onUpdateReaderSettings({ ...readerSettings, lineHeight: s.id as any })}
                      className={`py-2 text-xs rounded-lg border text-center transition-all font-sans cursor-pointer ${
                        readerSettings.lineHeight === s.id
                          ? 'bg-stone-900 text-white font-bold border-stone-900'
                          : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Margens e Largura (Duas Páginas / Central / Tela Cheia) */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-stone-500 font-sans font-bold block">
                  LAYOUT DE PÁGINAS
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setLayoutMode('double')}
                    className={`py-2.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                      layoutMode === 'double' ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                    }`}
                    title="Livro Aberto (2 Páginas)"
                  >
                    <div className="flex gap-0.5">
                      <span className="w-2.5 h-4 border border-current rounded-xs" />
                      <span className="w-2.5 h-4 border border-current rounded-xs" />
                    </div>
                  </button>

                  <button
                    onClick={() => setLayoutMode('single')}
                    className={`py-2.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                      layoutMode === 'single' ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                    }`}
                    title="Página Centralizada"
                  >
                    <span className="w-4 h-4 border border-current rounded-xs" />
                  </button>

                  <button
                    onClick={() => setLayoutMode('full')}
                    className={`py-2.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                      layoutMode === 'full' ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                    }`}
                    title="Largura Expandida"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-stone-200">
              <button
                onClick={() => setIsPreferencesOpen(false)}
                className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Dicionário Rápido com 1 Clique */}
      <DictionaryModal
        word={dictionaryWord}
        onClose={() => setDictionaryWord(null)}
        onSaveAsNote={handleSaveDictionaryNote}
      />
    </div>
  );
};
