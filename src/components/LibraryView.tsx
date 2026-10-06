import React, { useState, useMemo } from 'react';
import { 
  Play, Pause, BookOpen, Clock, Heart, Search, 
  Trash2, Headphones, Sparkles, Filter, ChevronRight,
  BookMarked, Check, Info, Flame, Bookmark, Quote, 
  Share2, Plus, LayoutGrid, List as ListIcon, Award,
  Upload, AlertTriangle, X, Tag, FolderPlus, ArrowUpDown, Cloud
} from 'lucide-react';
import { Book } from '../types/book';
import { useAudioReader } from '../context/AudioReaderContext';
import { useAuth } from '../context/AuthContext';
import { TagManagerModal } from './TagManagerModal';

export type SortOption = 'lastRead' | 'recent' | 'oldest' | 'titleAsc' | 'titleDesc';
export type FilterTab = 'todos' | 'lendo' | 'nao-iniciados' | 'concluidos' | 'favoritos' | 'nuvem' | string;

interface LibraryViewProps {
  books: Book[];
  onOpenBook: (book: Book) => void;
  onPlayAudiobook: (book: Book) => void;
  onDeleteBook: (bookId: string) => void;
  onToggleFavorite: (bookId: string) => void;
  onOpenUpload: () => void;
  onOpenDetails: (book: Book) => void;
  allTags: string[];
  onSaveBookTags: (bookId: string, tags: string[]) => void;
  onCreateTag: (newTag: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

/**
 * Normaliza o percentual de progresso para um inteiro entre 0 e 100
 */
function normalizeProgress(progress: number | undefined): number {
  if (typeof progress !== 'number' || isNaN(progress)) return 0;
  return Math.max(0, Math.min(100, Math.round(progress)));
}

/**
 * Verifica se um livro corresponde à busca (case-insensitive em title, author, category, tags)
 */
function matchesSearch(book: Book, query: string): boolean {
  if (!query || !query.trim()) return true;
  const q = query.trim().toLowerCase();

  // title
  if (book.title && book.title.toLowerCase().includes(q)) return true;
  // author
  if (book.author && book.author.toLowerCase().includes(q)) return true;
  // category
  if (book.category && book.category.toLowerCase().includes(q)) return true;
  // tags
  if (book.tags && Array.isArray(book.tags) && book.tags.some(t => t.toLowerCase().includes(q))) return true;

  return false;
}

/**
 * Aplica a ordenação solicitada à lista de livros
 */
function sortBooksList(list: Book[], sortBy: SortOption): Book[] {
  const sorted = [...list];
  switch (sortBy) {
    case 'lastRead':
      return sorted.sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0));
    case 'recent':
      return sorted.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    case 'oldest':
      return sorted.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
    case 'titleAsc':
      return sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'pt-BR', { sensitivity: 'base' }));
    case 'titleDesc':
      return sorted.sort((a, b) => (b.title || '').localeCompare(a.title || '', 'pt-BR', { sensitivity: 'base' }));
    default:
      return sorted;
  }
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  books,
  onOpenBook,
  onPlayAudiobook,
  onDeleteBook,
  onToggleFavorite,
  onOpenUpload,
  onOpenDetails,
  allTags,
  onSaveBookTags,
  onCreateTag,
  searchQuery = '',
  onSearchChange,
}) => {
  const { currentBook, isPlaying, isPaused, togglePlayPause } = useAudioReader();
  const { user, login, isBookInCloud } = useAuth();

  const isCloudBook = (book: Book) => {
    return !!book.syncedToCloud || (isBookInCloud ? isBookInCloud(book.id) : false);
  };

  const [selectedTab, setSelectedTab] = useState<FilterTab>('todos');
  const [sortBy, setSortBy] = useState<SortOption>('lastRead');
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [taggingBook, setTaggingBook] = useState<Book | null>(null);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const displayName = user?.displayName ? user.displayName.split(' ')[0] : 'Reinaldo';

  // 1. Grupos Canônicos baseados na Regra de Estados de Leitura
  // NÃO INICIADO: progressPercent === 0
  // EM LEITURA: progressPercent > 0 && progressPercent < 100
  // CONCLUÍDO: progressPercent >= 100
  const inProgressBooks = useMemo(() => {
    return books
      .filter(b => {
        const p = normalizeProgress(b.progressPercent);
        return p > 0 && p < 100;
      })
      .sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0));
  }, [books]);

  const notStartedBooks = useMemo(() => {
    return books
      .filter(b => normalizeProgress(b.progressPercent) === 0)
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  }, [books]);

  const completedBooks = useMemo(() => {
    return books
      .filter(b => normalizeProgress(b.progressPercent) >= 100)
      .sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0));
  }, [books]);

  const favoriteBooks = useMemo(() => {
    return books.filter(b => b.isFavorite);
  }, [books]);

  const cloudBooks = useMemo(() => {
    return books.filter(isCloudBook);
  }, [books, isBookInCloud]);

  // Livro para a seção "Continuar Lendo":
  // Considera estritamente livros com 0 < progressPercent < 100, ordenados por lastReadAt DESC
  const currentReadingBook = inProgressBooks[0] || null;

  // 2. Filtragem e Ordenação do Catálogo da Estante
  const catalogFilteredAndSorted = useMemo(() => {
    // 1º Passo: Filtragem por Tab/Categoria
    let baseList = books;

    if (selectedTab === 'todos') {
      baseList = books;
    } else if (selectedTab === 'lendo') {
      baseList = inProgressBooks;
    } else if (selectedTab === 'nao-iniciados') {
      baseList = notStartedBooks;
    } else if (selectedTab === 'concluidos') {
      baseList = completedBooks;
    } else if (selectedTab === 'favoritos') {
      baseList = favoriteBooks;
    } else if (selectedTab === 'nuvem') {
      baseList = cloudBooks;
    } else {
      // Filtro de Coleção / Tag personalizada
      baseList = books.filter(b => b.tags && Array.isArray(b.tags) && b.tags.includes(selectedTab));
    }

    // 2º Passo: Filtragem pela Busca (título, autor, categoria, tags)
    const afterSearch = baseList.filter(b => matchesSearch(b, searchQuery));

    // 3º Passo: Ordenação
    return sortBooksList(afterSearch, sortBy);
  }, [books, selectedTab, inProgressBooks, notStartedBooks, completedBooks, favoriteBooks, cloudBooks, searchQuery, sortBy]);

  const handleConfirmDelete = () => {
    if (bookToDelete) {
      onDeleteBook(bookToDelete.id);
      setBookToDelete(null);
    }
  };

  const handleCreateTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTagName.trim()) {
      onCreateTag(newTagName.trim());
      setSelectedTab(newTagName.trim());
      setNewTagName('');
      setIsCreatingTag(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-8 py-5 sm:py-8 space-y-6 sm:space-y-10 bg-[#F9F8F5] pb-28 md:pb-8">
      {/* 1. Daily Session Greeting Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div className="space-y-1 sm:space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] sm:text-[11px] uppercase tracking-wider text-stone-600 font-semibold font-sans">
            <span className="w-2 h-2 rounded-full bg-[#9A3412] inline-block animate-pulse shrink-0" />
            <span>SESSÃO DIÁRIA ATIVA</span>
            <span aria-hidden="true">·</span>
            <span>Estante Pessoal</span>
          </div>

          <h1 className="font-serif-display text-2xl sm:text-4xl lg:text-[42px] font-medium tracking-tight text-stone-950 leading-tight">
            Bem-vindo de volta, <span className="italic font-normal">{displayName}.</span>
          </h1>

          <p className="text-xs sm:text-sm text-stone-600 font-sans max-w-xl leading-relaxed">
            {books.length > 0 
              ? 'Sua biblioteca, audiolivros e coleções estão organizados. Escolha uma obra para ler, ouvir ou organizar suas anotações.'
              : 'Sua estante pessoal está pronta. Adicione seus livros em EPUB ou PDF para ler no formato editorial ou ouvir em áudio.'}
          </p>
        </div>

        {/* Status card */}
        <div className="flex items-center gap-3 p-3 sm:p-3.5 sm:px-5 bg-white rounded-xl sm:rounded-2xl border border-[#E8E2D9] shadow-2xs self-start md:self-auto shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700 shrink-0">
            <Flame className="w-4 h-4 sm:w-5 sm:h-5 fill-amber-500 text-amber-600" />
          </div>
          <div>
            <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-stone-500 font-sans font-semibold block">
              ACERVO PESSOAL
            </span>
            <span className="font-serif-display text-base sm:text-lg font-bold text-stone-950 block leading-tight">
              {books.length} {books.length === 1 ? 'Livro' : 'Livros'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Empty Library State if no books yet */}
      {books.length === 0 ? (
        <div className="p-5 sm:p-14 bg-white rounded-2xl sm:rounded-3xl border border-[#E8E2D9] shadow-xs text-center space-y-4 sm:space-y-6 max-w-2xl mx-auto">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#FAF6F0] border border-[#EFE8DC] text-[#9A3412] flex items-center justify-center mx-auto shadow-2xs">
            <BookOpen className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <h2 className="font-serif-display text-xl sm:text-3xl font-bold text-stone-950">
              Sua estante está livre, {displayName}
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 font-sans max-w-md mx-auto leading-relaxed">
              Arraste e solte seus arquivos de livros em <strong>EPUB</strong> ou <strong>PDF</strong>. O aplicativo organiza os capítulos, memoriza exatamente onde você parar, oferece marca-texto com anotações e lê em voz alta com áudio natural.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onOpenUpload}
              className="w-full sm:w-auto px-5 sm:px-6 py-3 bg-stone-950 hover:bg-stone-800 text-white rounded-xl text-xs sm:text-sm font-semibold font-sans shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Upload className="w-4 h-4 text-amber-300" />
              <span>Importar Meu Primeiro Livro (EPUB / PDF)</span>
            </button>
          </div>

          <div className="pt-4 sm:pt-6 border-t border-[#F0EBE3] grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 text-left">
            <div className="p-3 sm:p-3.5 rounded-xl bg-[#FAF6F0] border border-[#EFE8DC]">
              <span className="font-serif-display font-bold text-xs text-stone-900 block">Marca-Texto & Notas</span>
              <p className="text-[11px] text-stone-500 font-sans mt-0.5">Destaques em cores e caderno de estudos exportável em .md.</p>
            </div>
            <div className="p-3 sm:p-3.5 rounded-xl bg-[#FAF6F0] border border-[#EFE8DC]">
              <span className="font-serif-display font-bold text-xs text-stone-900 block">Coleções & Tags</span>
              <p className="text-[11px] text-stone-500 font-sans mt-0.5">Organize seus livros por temas como Filosofia, Estudos e Favoritos.</p>
            </div>
            <div className="p-3 sm:p-3.5 rounded-xl bg-[#FAF6F0] border border-[#EFE8DC]">
              <span className="font-serif-display font-bold text-xs text-stone-900 block">Audiolivro TTS</span>
              <p className="text-[11px] text-stone-500 font-sans mt-0.5">Narração por voz com controle de velocidade e timer de sono.</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Banner de Sincronização em Nuvem quando desconectado */}
          {!user && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50/80 border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Cloud className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-stone-900 font-sans">
                    Sincronização em Nuvem Desconectada
                  </h4>
                  <p className="text-[11px] text-stone-600 font-sans">
                    Seus livros estão armazenados apenas neste computador. Conecte sua conta Google para ler em múltiplos PCs e celulares.
                  </p>
                </div>
              </div>
              <button
                onClick={login}
                className="shrink-0 px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-stone-100 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Cloud className="w-3.5 h-3.5 text-amber-400" />
                <span>Conectar Conta Google</span>
              </button>
            </div>
          )}

          {/* Seção Superior: "Continuar Lendo" & Painel de Estatísticas */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Coluna Esquerda: Cartão "Continuar Lendo" ou Estado Vazio Apropriado */}
            <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E8E2D9] p-6 sm:p-7 shadow-xs relative overflow-hidden">
              {currentReadingBook ? (
                // 1. Há um livro em leitura (progressPercent > 0 && progressPercent < 100)
                <div className="flex flex-col sm:flex-row gap-6 sm:gap-7 items-start">
                  {/* Capa */}
                  <div 
                    onClick={() => onOpenBook(currentReadingBook)}
                    className="relative w-36 sm:w-44 aspect-[3/4] bg-stone-100 rounded-lg shadow-md overflow-hidden shrink-0 cursor-pointer group"
                  >
                    <div className="absolute top-0 left-3 w-4 h-9 bg-[#9A3412] shadow-sm z-10 clip-ribbon" />

                    {currentReadingBook.coverUrl ? (
                      <img
                        src={currentReadingBook.coverUrl}
                        alt={currentReadingBook.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full p-4 flex flex-col justify-between bg-stone-900 text-stone-100">
                        <span className="text-[10px] uppercase text-amber-400 font-sans">AURA</span>
                        <h3 className="font-serif-display font-bold text-sm leading-snug">{currentReadingBook.title}</h3>
                        <span className="text-xs text-stone-400">{currentReadingBook.author}</span>
                      </div>
                    )}
                    <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-black/40 via-white/10 to-transparent pointer-events-none" />
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 space-y-3.5 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100/70 text-amber-900 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-700 inline-block animate-pulse" />
                          CONTINUAR LENDO
                        </span>
                        {isCloudBook(currentReadingBook) && (
                          <span 
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-900 border border-sky-200"
                            title={currentReadingBook.hasCloudFile ? 'Arquivo original e leitura salvos no Firebase' : 'Sincronizado na nuvem (Google Firestore)'}
                          >
                            <Cloud className="w-3 h-3 text-sky-600" />
                            <span>NA NUVEM</span>
                          </span>
                        )}
                        {currentReadingBook.chapters && currentReadingBook.chapters.length > 0 && (
                          <span className="text-xs text-stone-500 font-sans flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-stone-400" />
                            Capítulo {currentReadingBook.currentChapterIndex + 1} de {currentReadingBook.chapters.length}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => onOpenDetails(currentReadingBook)}
                        className="text-xs text-stone-500 hover:text-stone-900 font-medium underline underline-offset-2 cursor-pointer"
                      >
                        Ver detalhes
                      </button>
                    </div>

                    <div>
                      <h2 
                        onClick={() => onOpenBook(currentReadingBook)}
                        className="font-serif-display text-2xl sm:text-3xl font-bold text-stone-950 hover:text-amber-950 cursor-pointer transition-colors leading-tight truncate"
                      >
                        {currentReadingBook.title}
                      </h2>
                      <p className="text-xs sm:text-sm text-stone-600 font-sans mt-0.5 truncate">
                        {currentReadingBook.author}
                      </p>
                    </div>

                    {/* Book Tags */}
                    {currentReadingBook.tags && currentReadingBook.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {currentReadingBook.tags.map(t => (
                          <span key={t} className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-sans font-medium flex items-center gap-1">
                            <Tag className="w-2.5 h-2.5 text-stone-400" />
                            <span>{t}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Excerpt / Trecho do parágrafo atual */}
                    <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#EFE8DC] space-y-1 relative">
                      <Quote className="w-4 h-4 text-amber-800/40 absolute top-3 left-3" />
                      <p className="font-serif-editorial italic text-xs sm:text-sm text-stone-800 pl-4 leading-relaxed line-clamp-3">
                        {currentReadingBook.chapters[currentReadingBook.currentChapterIndex]?.paragraphs[currentReadingBook.currentParagraphIndex] || currentReadingBook.description || 'Ponto de leitura sincronizado com exatidão no leitor.'}
                      </p>
                      <span className="text-[10px] text-stone-500 block text-right font-sans">
                        Posição memorizada
                      </span>
                    </div>

                    {/* Barra de Progresso Normalizada */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-xs text-stone-600 font-sans tabular-nums">
                        <span>Progresso da Leitura</span>
                        <span className="font-semibold text-stone-900 font-sans">{normalizeProgress(currentReadingBook.progressPercent)}% Concluído</span>
                      </div>
                      <div className="w-full h-2 bg-[#EBE6DF] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#9A3412] rounded-full transition-all duration-300" 
                          style={{ width: `${Math.max(4, normalizeProgress(currentReadingBook.progressPercent))}%` }} 
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2.5 pt-2 flex-wrap">
                      <button
                        onClick={() => onOpenBook(currentReadingBook)}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-stone-950 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        <BookOpen className="w-4 h-4 text-amber-300" />
                        <span>Continuar Leitura</span>
                      </button>

                      <button
                        onClick={() => onPlayAudiobook(currentReadingBook)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FAF6F0] hover:bg-[#F3ECE0] text-stone-900 border border-[#E8DFD1] rounded-lg text-xs font-medium transition-colors cursor-pointer"
                        title="Ouvir em áudio sincronizado"
                      >
                        <Headphones className="w-4 h-4 text-amber-700" />
                        <span className="hidden sm:inline">Ouvir em Áudio</span>
                      </button>

                      <button
                        onClick={() => setTaggingBook(currentReadingBook)}
                        className="p-2.5 rounded-lg border border-[#E8E2D9] text-stone-600 hover:text-stone-950 hover:bg-stone-50 transition-colors cursor-pointer"
                        title="Gerenciar coleções e tags"
                      >
                        <Tag className="w-4 h-4" />
                      </button>

                      <button 
                        onClick={() => onToggleFavorite(currentReadingBook.id)}
                        className="p-2.5 rounded-lg border border-[#E8E2D9] text-stone-600 hover:text-stone-950 hover:bg-stone-50 transition-colors cursor-pointer"
                        title="Favoritar obra"
                      >
                        <Bookmark className={`w-4 h-4 ${currentReadingBook.isFavorite ? 'fill-[#9A3412] text-[#9A3412]' : ''}`} />
                      </button>

                      <button
                        onClick={() => setBookToDelete(currentReadingBook)}
                        className="p-2.5 rounded-lg border border-rose-200 text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
                        title="Excluir livro da biblioteca"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Excluir</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // 2. Estado Vazio: Nenhum livro em leitura no momento (nenhum com 0 < progress < 100)
                <div className="py-8 px-4 sm:px-8 text-center space-y-4 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[260px]">
                  <div className="w-14 h-14 rounded-2xl bg-[#FAF6F0] border border-[#EFE8DC] text-[#9A3412] flex items-center justify-center shadow-2xs">
                    <BookMarked className="w-7 h-7" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-serif-display font-bold text-xl sm:text-2xl text-stone-950">
                      Você ainda não começou nenhum livro
                    </h3>
                    <p className="text-xs sm:text-sm text-stone-600 font-sans leading-relaxed">
                      Selecione qualquer obra do seu acervo na estante abaixo para começar sua leitura ou ouvir a narração em áudio.
                    </p>
                  </div>
                  {books.length > 0 && (
                    <div className="pt-2">
                      <button
                        onClick={() => onOpenBook(books[0])}
                        className="px-5 py-2.5 bg-stone-950 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold font-sans shadow-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
                      >
                        <BookOpen className="w-4 h-4 text-amber-300" />
                        <span>Começar a Ler: {books[0].title}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Coluna Direita: Metas & Reflexão */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white rounded-2xl border border-[#E8E2D9] p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-[#9A3412]" />
                    <h3 className="font-serif-display font-semibold text-stone-950 text-sm">
                      Meta de Leitura
                    </h3>
                  </div>
                  <span className="text-[10px] uppercase font-sans font-semibold px-2 py-0.5 bg-stone-100 text-stone-700 rounded">
                    Pessoal
                  </span>
                </div>

                <div className="flex items-center gap-5">
                  <div className="relative w-18 h-18 shrink-0 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-[#EBE6DF]"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-[#9A3412]"
                        strokeDasharray={`${Math.min(100, completedBooks.length * 25)}, 100`}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute text-center">
                      <span className="font-serif-display font-bold text-sm text-stone-950 block leading-tight">
                        {books.length}
                      </span>
                      <span className="text-[8px] text-stone-500 uppercase tracking-tighter block font-sans">
                        obras
                      </span>
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="font-serif-display text-xl font-bold text-stone-950 tabular-nums">
                      {completedBooks.length} <span className="text-stone-400 font-normal text-sm font-sans">concluídos</span>
                    </div>
                    <p className="text-[11px] text-stone-500 font-sans leading-tight">
                      {inProgressBooks.length} em leitura • {notStartedBooks.length} não iniciados
                    </p>
                  </div>
                </div>
              </div>

              {/* Reflection Card */}
              <div className="rounded-2xl bg-[#14231E] text-stone-100 p-5 shadow-xs relative overflow-hidden">
                <div className="relative z-10 space-y-2">
                  <span className="text-[9.5px] uppercase tracking-[0.2em] text-emerald-400 font-sans font-semibold block">
                    REFLEXÃO DO ARQUIVO
                  </span>
                  <p className="font-serif-display text-base font-normal leading-snug text-stone-100">
                    “Não há amigo tão leal quanto um livro.”
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-stone-400 font-sans">
                      Ernest Hemingway
                    </span>
                    <button className="text-stone-400 hover:text-white p-1">
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <BookOpen className="w-24 h-24 text-emerald-950/40 absolute -right-3 -bottom-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* 3. Seção: Estantes & Acervo Pessoal (Filtros, Busca e Ordenação) */}
          <div className="space-y-5 pt-4 border-t border-[#EBE6DF]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-serif-display text-2xl sm:text-3xl font-bold text-stone-950">
                  Estantes & Acervo Pessoal
                </h2>
                <p className="text-xs sm:text-sm text-stone-500 font-sans">
                  Filtre por estado de leitura, coleções ou faça buscas em seu acervo
                </p>
              </div>

              <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
                {/* Seletor de Ordenação */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E8E2D9] rounded-xl text-xs font-sans shadow-2xs">
                  <ArrowUpDown className="w-3.5 h-3.5 text-stone-500" />
                  <span className="text-stone-400 hidden sm:inline">Ordem:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="bg-transparent text-stone-800 font-medium focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="lastRead">Última leitura</option>
                    <option value="recent">Mais recentes</option>
                    <option value="oldest">Mais antigos</option>
                    <option value="titleAsc">Título (A-Z)</option>
                    <option value="titleDesc">Título (Z-A)</option>
                  </select>
                </div>

                {/* Botão de Adicionar Livro */}
                <button
                  onClick={onOpenUpload}
                  className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold font-sans shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-300" />
                  <span>Adicionar Livro</span>
                </button>
              </div>
            </div>

            {/* Horizontal Tabs: Estados de Leitura, Favoritos e Coleções */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 border-b border-[#EFE8DC]">
              {/* Todas as Obras */}
              <button
                onClick={() => setSelectedTab('todos')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-sans font-medium whitespace-nowrap transition-all cursor-pointer border ${
                  selectedTab === 'todos'
                    ? 'bg-stone-900 text-white border-stone-900 shadow-2xs font-semibold'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                Todas as Obras ({books.length})
              </button>

              {/* Em Leitura */}
              <button
                onClick={() => setSelectedTab('lendo')}
                className={`px-3 py-1.5 rounded-full text-xs font-sans font-medium whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                  selectedTab === 'lendo'
                    ? 'bg-amber-900 text-amber-50 border-amber-900 shadow-2xs font-semibold'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <BookOpen className="w-3 h-3 text-amber-600" />
                <span>Em Leitura ({inProgressBooks.length})</span>
              </button>

              {/* Não Iniciados */}
              <button
                onClick={() => setSelectedTab('nao-iniciados')}
                className={`px-3 py-1.5 rounded-full text-xs font-sans font-medium whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                  selectedTab === 'nao-iniciados'
                    ? 'bg-stone-900 text-white border-stone-900 shadow-2xs font-semibold'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <Clock className="w-3 h-3 text-stone-400" />
                <span>Não Iniciados ({notStartedBooks.length})</span>
              </button>

              {/* Concluídos */}
              <button
                onClick={() => setSelectedTab('concluidos')}
                className={`px-3 py-1.5 rounded-full text-xs font-sans font-medium whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                  selectedTab === 'concluidos'
                    ? 'bg-stone-900 text-white border-stone-900 shadow-2xs font-semibold'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <Check className="w-3 h-3 text-emerald-500" />
                <span>Concluídos ({completedBooks.length})</span>
              </button>

              {/* Favoritos */}
              <button
                onClick={() => setSelectedTab('favoritos')}
                className={`px-3 py-1.5 rounded-full text-xs font-sans font-medium whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                  selectedTab === 'favoritos'
                    ? 'bg-amber-900 text-amber-50 border-amber-900 shadow-2xs font-semibold'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <Bookmark className="w-3 h-3 text-amber-600 fill-amber-600" />
                <span>Favoritos ({favoriteBooks.length})</span>
              </button>

              {/* Na Nuvem (Firebase) */}
              <button
                onClick={() => setSelectedTab('nuvem')}
                className={`px-3 py-1.5 rounded-full text-xs font-sans font-medium whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                  selectedTab === 'nuvem'
                    ? 'bg-sky-950 text-sky-100 border-sky-900 shadow-2xs font-semibold'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <Cloud className="w-3 h-3 text-sky-600" />
                <span>Na Nuvem ({cloudBooks.length})</span>
              </button>

              {/* Custom User Tags */}
              {allTags.map((tag) => {
                const count = books.filter(b => b.tags && Array.isArray(b.tags) && b.tags.includes(tag)).length;
                const isSelected = selectedTab === tag;

                return (
                  <button
                    key={tag}
                    onClick={() => setSelectedTab(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-sans font-medium whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-amber-900 text-amber-50 border-amber-900 shadow-2xs font-semibold'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <Tag className="w-3 h-3 text-stone-400" />
                    <span>{tag} ({count})</span>
                  </button>
                );
              })}

              {/* + Nova Coleção Button */}
              {isCreatingTag ? (
                <form onSubmit={handleCreateTagSubmit} className="flex items-center gap-1 shrink-0">
                  <input
                    type="text"
                    placeholder="Nome da coleção..."
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="px-2.5 py-1 text-xs font-sans bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:border-stone-600 w-36"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="p-1 px-2 bg-stone-900 text-white text-xs rounded-lg font-semibold cursor-pointer"
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreatingTag(false)}
                    className="p-1 text-stone-400 hover:text-stone-700 text-xs"
                  >
                    ✕
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setIsCreatingTag(true)}
                  className="px-3 py-1.5 rounded-full text-xs font-sans font-semibold whitespace-nowrap transition-all cursor-pointer border border-dashed border-stone-300 hover:border-stone-500 bg-transparent text-stone-600 hover:text-stone-900 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3 text-stone-500" />
                  <span>Nova Coleção</span>
                </button>
              )}
            </div>

            {/* Active search filter feedback badge */}
            {searchQuery.trim().length > 0 && (
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200/80 px-4 py-2.5 rounded-xl text-xs font-sans text-stone-800">
                <div className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-amber-700" />
                  <span>
                    Buscando por: <strong className="font-semibold text-stone-950">"{searchQuery}"</strong>
                  </span>
                  <span className="text-stone-400">·</span>
                  <span className="text-stone-600">
                    {catalogFilteredAndSorted.length} {catalogFilteredAndSorted.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}
                  </span>
                </div>
                {onSearchChange && (
                  <button
                    onClick={() => onSearchChange('')}
                    className="text-amber-900 hover:text-amber-950 font-medium underline cursor-pointer text-xs flex items-center gap-1"
                  >
                    <span>Limpar busca</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Books Grid */}
            {catalogFilteredAndSorted.length === 0 ? (
              <div className="p-12 bg-white rounded-2xl border border-[#E5E0D8] text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="font-serif-display font-bold text-lg text-stone-950">
                  Nenhum livro encontrado
                </h3>
                <p className="text-xs text-stone-500 font-sans max-w-sm mx-auto">
                  {searchQuery 
                    ? `Não encontramos títulos, autores ou tags correspondentes a "${searchQuery}".` 
                    : 'Nenhum livro corresponde à categoria ou filtro selecionado.'}
                </p>
                {searchQuery && onSearchChange && (
                  <button
                    onClick={() => onSearchChange('')}
                    className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Limpar Filtros de Busca
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-6">
                {catalogFilteredAndSorted.map(book => {
                  const progress = normalizeProgress(book.progressPercent);
                  const isCompleted = progress >= 100;
                  const isInProgress = progress > 0 && progress < 100;
                  const isNotStarted = progress === 0;

                  return (
                    <div
                      key={book.id}
                      className="group relative bg-white rounded-xl border border-[#E5E0D8] p-2.5 sm:p-3 flex flex-col justify-between space-y-2 sm:space-y-2.5 shadow-2xs hover:shadow-md transition-all active:scale-[0.98]"
                    >
                      {/* Cover Area */}
                      <div 
                        onClick={() => onOpenDetails(book)}
                        className="relative aspect-[3/4] bg-stone-100 rounded-lg overflow-hidden border border-stone-200 shadow-2xs cursor-pointer"
                      >
                        {book.coverUrl ? (
                          <img 
                            src={book.coverUrl} 
                            alt={book.title} 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-103 transition-transform" 
                          />
                        ) : (
                          <div className="w-full h-full p-3 sm:p-4 flex flex-col justify-between bg-stone-850 text-stone-100">
                            <span className="text-[9px] sm:text-[10px] uppercase font-sans text-amber-300">{book.format.toUpperCase()}</span>
                            <h4 className="font-serif-display font-bold text-xs line-clamp-2 leading-tight">{book.title}</h4>
                            <span className="text-[9.5px] sm:text-[10px] text-stone-400 font-sans truncate">{book.author}</span>
                          </div>
                        )}

                        {/* Status Badge: Concluído */}
                        {isCompleted && (
                          <div className="absolute top-2 left-2 bg-stone-950/80 backdrop-blur-xs text-white p-1 rounded-full shadow-xs" title="Concluído (100%)">
                            <Check className="w-3 h-3 text-emerald-400" />
                          </div>
                        )}

                        {/* Status Badge: Em Leitura */}
                        {isInProgress && (
                          <div className="absolute top-2 left-2 bg-amber-900/80 backdrop-blur-xs text-amber-200 px-1.5 py-0.5 rounded text-[9px] font-sans font-semibold shadow-xs">
                            {progress}%
                          </div>
                        )}

                        {/* Status Badge: Na Nuvem (Firebase) */}
                        {isCloudBook(book) ? (
                          <div 
                            className="absolute bottom-2 right-2 bg-stone-950/85 backdrop-blur-xs text-sky-300 border border-sky-400/30 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-xs" 
                            title={book.hasCloudFile ? 'Livro e arquivo completo sincronizados na nuvem' : 'Sincronizado na nuvem (Google Firestore)'}
                          >
                            <Cloud className="w-3 h-3 text-sky-400 shrink-0" />
                            <span className="text-[9px] font-sans font-semibold text-sky-200">Nuvem</span>
                          </div>
                        ) : (
                          <div 
                            className="absolute bottom-2 right-2 bg-stone-900/60 backdrop-blur-xs text-stone-300 px-1.5 py-0.5 rounded flex items-center gap-1 text-[9px] font-sans opacity-70 group-hover:opacity-100 transition-opacity" 
                            title="Armazenado apenas neste dispositivo"
                          >
                            <span>Local</span>
                          </div>
                        )}

                        {/* Quick Delete Trash Button at top right of the cover */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setBookToDelete(book);
                          }}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-white/95 text-stone-400 hover:text-rose-600 hover:bg-rose-50 shadow-xs border border-stone-200 transition-all cursor-pointer opacity-80 group-hover:opacity-100"
                          title={`Excluir ${book.title}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Metadata & Tags */}
                      <div 
                        onClick={() => onOpenDetails(book)}
                        className="space-y-1 sm:space-y-1.5 cursor-pointer"
                      >
                        <h4 className="font-serif-display font-bold text-xs sm:text-sm text-stone-950 group-hover:text-[#9A3412] transition-colors line-clamp-2 leading-snug">
                          {book.title}
                        </h4>
                        <p className="text-[11px] sm:text-xs text-stone-500 font-sans line-clamp-1">
                          {book.author}
                        </p>

                        {/* Tag badges */}
                        {book.tags && Array.isArray(book.tags) && book.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {book.tags.slice(0, 2).map(t => (
                              <span key={t} className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-900 border border-amber-200/60 text-[9px] font-sans font-medium">
                                {t}
                              </span>
                            ))}
                            {book.tags.length > 2 && (
                              <span className="text-[9px] text-stone-400 font-sans">
                                +{book.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Indicador e Barra de Progresso Visual */}
                        <div className="space-y-1 pt-0.5 sm:pt-1">
                          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-stone-500 font-sans">
                            {isCompleted ? (
                              <span className="text-emerald-700 font-medium flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-600" />
                                Concluído
                              </span>
                            ) : isInProgress ? (
                              <span className="text-amber-900 font-medium">{progress}% lido</span>
                            ) : (
                              <span className="text-stone-400">Não iniciado</span>
                            )}

                            <div className="flex items-center gap-1.5">
                              {isCloudBook(book) ? (
                                <span 
                                  className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-sky-800 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200"
                                  title={book.hasCloudFile ? 'Arquivo completo e leitura salvos na nuvem' : 'Progresso sincronizado na nuvem'}
                                >
                                  <Cloud className="w-2.5 h-2.5 text-sky-600" />
                                  <span>Nuvem</span>
                                </span>
                              ) : (
                                <span 
                                  className="text-[9px] text-stone-400 bg-stone-100 px-1.5 py-0.2 rounded"
                                  title="Salvo apenas neste dispositivo"
                                >
                                  Local
                                </span>
                              )}
                              <span className="text-stone-400 uppercase text-[9.5px] sm:text-[10px]">{book.format}</span>
                            </div>
                          </div>

                          <div className="w-full h-1 bg-[#EBE6DF] rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${
                                isCompleted ? 'bg-emerald-600' : isInProgress ? 'bg-[#9A3412]' : 'bg-transparent'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action Bar (Ler, Áudio, Coleções, Excluir) */}
                      <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-1.5">
                        <button
                          onClick={() => onOpenBook(book)}
                          className="flex-1 py-1.5 px-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-[11px] font-semibold font-sans flex items-center justify-center gap-1 cursor-pointer transition-colors active:scale-95"
                          title="Ler livro"
                        >
                          <BookOpen className="w-3 h-3 text-amber-300" />
                          <span>{isInProgress ? 'Continuar' : 'Ler'}</span>
                        </button>

                        <button
                          onClick={() => onPlayAudiobook(book)}
                          className="p-1.5 sm:p-2 rounded-lg bg-[#FAF6F0] hover:bg-[#F3ECE0] text-stone-800 border border-[#E8DFD1] transition-colors cursor-pointer active:scale-95"
                          title="Ouvir audiolivro"
                        >
                          <Headphones className="w-3.5 h-3.5 text-amber-700" />
                        </button>

                        {/* Tag manager button */}
                        <button
                          onClick={() => setTaggingBook(book)}
                          className="p-1.5 rounded text-stone-500 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer"
                          title="Gerenciar coleções deste livro"
                        >
                          <Tag className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setBookToDelete(book)}
                          className="p-1.5 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-stone-200 transition-colors cursor-pointer"
                          title="Excluir livro da estante"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Add Volume Card */}
                <div
                  onClick={onOpenUpload}
                  className="aspect-[3/4] rounded-lg border-2 border-dashed border-[#DDD7CD] hover:border-stone-500 bg-white/60 hover:bg-white flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-[#EFECE6] group-hover:bg-stone-900 group-hover:text-amber-200 text-stone-700 flex items-center justify-center transition-colors mb-2">
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="font-serif-display font-bold text-xs text-stone-900 block">
                    Adicionar Volume
                  </span>
                  <span className="text-[10px] text-stone-400 font-sans mt-0.5 block leading-tight">
                    EPUB ou PDF
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Confirmation Modal to Delete Book */}
      {bookToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif-display font-bold text-lg text-stone-950 leading-snug">
                  Excluir este livro?
                </h3>
                <p className="text-xs text-stone-600 font-sans leading-relaxed">
                  Tem certeza de que deseja remover <strong className="text-stone-900 font-semibold">{bookToDelete.title}</strong> da sua biblioteca? O arquivo, as marcações e todo o histórico de leitura serão excluídos.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100 font-sans">
              <button
                onClick={() => setBookToDelete(null)}
                className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Excluir Livro</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Manager Modal */}
      {taggingBook && (
        <TagManagerModal
          isOpen={true}
          onClose={() => setTaggingBook(null)}
          book={taggingBook}
          allAvailableTags={allTags}
          onSaveTags={(bookId, tags) => {
            onSaveBookTags(bookId, tags);
            setTaggingBook(null);
          }}
          onCreateTag={(newTag) => {
            onCreateTag(newTag);
          }}
        />
      )}
    </div>
  );
};
