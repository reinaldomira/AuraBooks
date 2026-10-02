import React, { useState } from 'react';
import { 
  Play, Pause, BookOpen, Clock, Heart, Search, 
  Trash2, Headphones, Sparkles, Filter, ChevronRight,
  BookMarked, Check, Info, Flame, Bookmark, Quote, 
  Share2, Plus, LayoutGrid, List as ListIcon, Award,
  Upload, AlertTriangle, X, Tag, FolderPlus
} from 'lucide-react';
import { Book } from '../types/book';
import { useAudioReader } from '../context/AudioReaderContext';
import { useAuth } from '../context/AuthContext';
import { TagManagerModal } from './TagManagerModal';

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
}) => {
  const { currentBook, isPlaying, isPaused, togglePlayPause } = useAudioReader();
  const { user } = useAuth();
  const [selectedTag, setSelectedTag] = useState<string>('todos');
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [taggingBook, setTaggingBook] = useState<Book | null>(null);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const displayName = user?.displayName ? user.displayName.split(' ')[0] : 'Reinaldo';

  // Primary featured book (most recently read)
  const featuredBook = books[0] || null;

  // Filter catalog based on selected tag or standard filters
  const filteredCatalog = books.filter(b => {
    if (selectedTag === 'todos') return true;
    if (selectedTag === 'favoritos') return b.isFavorite;
    if (selectedTag === 'concluidos') return b.progressPercent >= 100;
    if (selectedTag === 'lendo') return b.progressPercent > 0 && b.progressPercent < 100;
    
    // Custom tag filter
    return b.tags && b.tags.includes(selectedTag);
  });

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
      setSelectedTag(newTagName.trim());
      setNewTagName('');
      setIsCreatingTag(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-10 bg-[#F9F8F5]">
      {/* 1. Daily Session Greeting Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-stone-600 font-semibold font-sans">
            <span className="w-2 h-2 rounded-full bg-[#9A3412] inline-block animate-pulse" />
            <span>SESSÃO DIÁRIA ATIVA</span>
            <span aria-hidden="true">·</span>
            <span>Estante Pessoal</span>
          </div>

          <h1 className="font-serif-display text-3xl sm:text-4xl lg:text-[42px] font-medium tracking-tight text-stone-950 leading-tight">
            Bem-vindo de volta, <span className="italic font-normal">{displayName}.</span>
          </h1>

          <p className="text-sm text-stone-600 font-sans max-w-xl">
            {books.length > 0 
              ? 'Sua biblioteca, audiolivros e coleções estão organizados. Escolha uma obra para ler, ouvir ou organizar suas anotações.'
              : 'Sua estante pessoal está pronta. Adicione seus livros em EPUB ou PDF para ler no formato editorial ou ouvir em áudio.'}
          </p>
        </div>

        {/* Status card */}
        <div className="flex items-center gap-3.5 p-3.5 px-5 bg-white rounded-2xl border border-[#E8E2D9] shadow-2xs self-start md:self-auto">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700">
            <Flame className="w-5 h-5 fill-amber-500 text-amber-600" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-stone-500 font-sans font-semibold block">
              ACERVO PESSOAL
            </span>
            <span className="font-serif-display text-lg font-bold text-stone-950 block leading-tight">
              {books.length} {books.length === 1 ? 'Livro' : 'Livros'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Empty Library State if no books yet */}
      {books.length === 0 ? (
        <div className="p-8 sm:p-14 bg-white rounded-3xl border border-[#E8E2D9] shadow-xs text-center space-y-6 max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-[#FAF6F0] border border-[#EFE8DC] text-[#9A3412] flex items-center justify-center mx-auto shadow-2xs">
            <BookOpen className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="font-serif-display text-2xl sm:text-3xl font-bold text-stone-950">
              Sua estante está livre, Reinaldo
            </h2>
            <p className="text-sm text-stone-600 font-sans max-w-md mx-auto leading-relaxed">
              Arraste e solte seus arquivos de livros em <strong>EPUB</strong> ou <strong>PDF</strong>. O aplicativo organiza os capítulos, memoriza exatamente onde você parar, oferece marca-texto com anotações e lê em voz alta com áudio natural.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onOpenUpload}
              className="w-full sm:w-auto px-6 py-3 bg-stone-950 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold font-sans shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-amber-300" />
              <span>Importar Meu Primeiro Livro (EPUB / PDF)</span>
            </button>
          </div>

          <div className="pt-6 border-t border-[#F0EBE3] grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#EFE8DC]">
              <span className="font-serif-display font-bold text-xs text-stone-900 block">Marca-Texto & Notas</span>
              <p className="text-[11px] text-stone-500 font-sans mt-0.5">Destaques em cores e caderno de estudos exportável em .md.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#EFE8DC]">
              <span className="font-serif-display font-bold text-xs text-stone-900 block">Coleções & Tags</span>
              <p className="text-[11px] text-stone-500 font-sans mt-0.5">Organize seus livros por temas como Filosofia, Estudos e Favoritos.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#EFE8DC]">
              <span className="font-serif-display font-bold text-xs text-stone-900 block">Audiolivro TTS</span>
              <p className="text-[11px] text-stone-500 font-sans mt-0.5">Narração por voz com controle de velocidade e timer de sono.</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Featured "Lendo Agora" & Stats Dual Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Featured Currently Reading Card */}
            {featuredBook && (
              <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E8E2D9] p-6 sm:p-7 shadow-xs relative overflow-hidden">
                <div className="flex flex-col sm:flex-row gap-6 sm:gap-7 items-start">
                  {/* Book Cover */}
                  <div 
                    onClick={() => onOpenBook(featuredBook)}
                    className="relative w-36 sm:w-44 aspect-[3/4] bg-stone-100 rounded-lg shadow-md overflow-hidden shrink-0 cursor-pointer group"
                  >
                    <div className="absolute top-0 left-3 w-4 h-9 bg-[#9A3412] shadow-sm z-10 clip-ribbon" />

                    {featuredBook.coverUrl ? (
                      <img
                        src={featuredBook.coverUrl}
                        alt={featuredBook.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full p-4 flex flex-col justify-between bg-stone-900 text-stone-100">
                        <span className="text-[10px] uppercase text-amber-400 font-sans">LUMINA</span>
                        <h3 className="font-serif-display font-bold text-sm">{featuredBook.title}</h3>
                        <span className="text-xs text-stone-400">{featuredBook.author}</span>
                      </div>
                    )}
                    <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-black/40 via-white/10 to-transparent pointer-events-none" />
                  </div>

                  {/* Book Content */}
                  <div className="flex-1 space-y-3.5 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100/70 text-amber-900 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-700 inline-block" />
                          LENDO AGORA
                        </span>
                        <span className="text-xs text-stone-500 font-sans flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-stone-400" />
                          Capítulo {featuredBook.currentChapterIndex + 1} de {featuredBook.chapters.length}
                        </span>
                      </div>

                      <button
                        onClick={() => onOpenDetails(featuredBook)}
                        className="text-xs text-stone-500 hover:text-stone-900 font-medium underline underline-offset-2"
                      >
                        Ver detalhes
                      </button>
                    </div>

                    <div>
                      <h2 
                        onClick={() => onOpenBook(featuredBook)}
                        className="font-serif-display text-2xl sm:text-3xl font-bold text-stone-950 hover:text-amber-950 cursor-pointer transition-colors leading-tight truncate"
                      >
                        {featuredBook.title}
                      </h2>
                      <p className="text-xs sm:text-sm text-stone-600 font-sans mt-0.5 truncate">
                        {featuredBook.author}
                      </p>
                    </div>

                    {/* Book Tags */}
                    {featuredBook.tags && featuredBook.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {featuredBook.tags.map(t => (
                          <span key={t} className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-sans font-medium flex items-center gap-1">
                            <Tag className="w-2.5 h-2.5 text-stone-400" />
                            <span>{t}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Excerpt */}
                    <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#EFE8DC] space-y-1 relative">
                      <Quote className="w-4 h-4 text-amber-800/40 absolute top-3 left-3" />
                      <p className="font-serif-editorial italic text-xs sm:text-sm text-stone-800 pl-4 leading-relaxed line-clamp-3">
                        {featuredBook.chapters[featuredBook.currentChapterIndex]?.paragraphs[featuredBook.currentParagraphIndex] || featuredBook.description}
                      </p>
                      <span className="text-[10px] text-stone-500 block text-right font-sans">
                        Parágrafo {featuredBook.currentParagraphIndex + 1}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-xs text-stone-600 font-sans tabular-nums">
                        <span>Progresso</span>
                        <span className="font-semibold text-stone-900 font-sans">{featuredBook.progressPercent}% Concluído</span>
                      </div>
                      <div className="w-full h-2 bg-[#EBE6DF] rounded-full overflow-hidden">
                        <div className="h-full bg-[#9A3412] rounded-full transition-all duration-300" style={{ width: `${Math.max(4, featuredBook.progressPercent)}%` }} />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2.5 pt-2 flex-wrap">
                      <button
                        onClick={() => onOpenBook(featuredBook)}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-stone-950 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        <BookOpen className="w-4 h-4 text-amber-300" />
                        <span>Continuar Leitura</span>
                      </button>

                      <button
                        onClick={() => onPlayAudiobook(featuredBook)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FAF6F0] hover:bg-[#F3ECE0] text-stone-900 border border-[#E8DFD1] rounded-lg text-xs font-medium transition-colors cursor-pointer"
                        title="Ouvir em áudio sincronizado"
                      >
                        <Headphones className="w-4 h-4 text-amber-700" />
                        <span className="hidden sm:inline">Ouvir em Áudio</span>
                      </button>

                      {/* Tag collection manager button */}
                      <button
                        onClick={() => setTaggingBook(featuredBook)}
                        className="p-2.5 rounded-lg border border-[#E8E2D9] text-stone-600 hover:text-stone-950 hover:bg-stone-50 transition-colors cursor-pointer"
                        title="Gerenciar coleções e tags"
                      >
                        <Tag className="w-4 h-4" />
                      </button>

                      <button 
                        onClick={() => onToggleFavorite(featuredBook.id)}
                        className="p-2.5 rounded-lg border border-[#E8E2D9] text-stone-600 hover:text-stone-950 hover:bg-stone-50 transition-colors cursor-pointer"
                        title="Favoritar obra"
                      >
                        <Bookmark className={`w-4 h-4 ${featuredBook.isFavorite ? 'fill-[#9A3412] text-[#9A3412]' : ''}`} />
                      </button>

                      {/* Delete Button with clear feedback */}
                      <button
                        onClick={() => setBookToDelete(featuredBook)}
                        className="p-2.5 rounded-lg border border-rose-200 text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
                        title="Excluir livro da biblioteca"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Excluir</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Right Column: Reading Pace & Stats */}
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
                        strokeDasharray={`${Math.min(100, books.length * 20)}, 100`}
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
                      {books.filter(b => b.progressPercent >= 100).length} <span className="text-stone-400 font-normal text-sm font-sans">concluídos</span>
                    </div>
                    <p className="text-[11px] text-stone-500 font-sans leading-tight">
                      {books.length} títulos no acervo • {allTags.length} coleções
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

          {/* 3. Section: "Estantes & Acervo Pessoal" + Coleções Bar */}
          <div className="space-y-5 pt-4 border-t border-[#EBE6DF]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-serif-display text-2xl sm:text-3xl font-bold text-stone-950">
                  Estantes & Acervo Pessoal
                </h2>
                <p className="text-xs sm:text-sm text-stone-500 font-sans">
                  Filtre por coleções, marque passagens com cores e organize seus títulos
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={onOpenUpload}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold font-sans shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-300" />
                  <span>Adicionar Novo Livro</span>
                </button>
              </div>
            </div>

            {/* Horizontal Collections / Tags Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 border-b border-[#EFE8DC]">
              {/* All Books */}
              <button
                onClick={() => setSelectedTag('todos')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-sans font-medium whitespace-nowrap transition-all cursor-pointer border ${
                  selectedTag === 'todos'
                    ? 'bg-stone-900 text-white border-stone-900 shadow-2xs font-semibold'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                Todas as Obras ({books.length})
              </button>

              {/* Favorites */}
              <button
                onClick={() => setSelectedTag('favoritos')}
                className={`px-3 py-1.5 rounded-full text-xs font-sans font-medium whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                  selectedTag === 'favoritos'
                    ? 'bg-amber-900 text-amber-50 border-amber-900 shadow-2xs font-semibold'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <Bookmark className="w-3 h-3 text-amber-600 fill-amber-600" />
                <span>Favoritos ({books.filter(b => b.isFavorite).length})</span>
              </button>

              {/* Finished */}
              <button
                onClick={() => setSelectedTag('concluidos')}
                className={`px-3 py-1.5 rounded-full text-xs font-sans font-medium whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                  selectedTag === 'concluidos'
                    ? 'bg-stone-900 text-white border-stone-900 shadow-2xs font-semibold'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <Check className="w-3 h-3 text-emerald-500" />
                <span>Concluídos ({books.filter(b => b.progressPercent >= 100).length})</span>
              </button>

              {/* Custom User Tags */}
              {allTags.map((tag) => {
                const count = books.filter(b => b.tags && b.tags.includes(tag)).length;
                const isSelected = selectedTag === tag;

                return (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
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

            {/* Books Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {filteredCatalog.map(book => {
                const isCompleted = book.progressPercent >= 100;

                return (
                  <div
                    key={book.id}
                    className="group relative bg-white rounded-xl border border-[#E5E0D8] p-3 flex flex-col justify-between space-y-2.5 shadow-2xs hover:shadow-md transition-all"
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
                        <div className="w-full h-full p-4 flex flex-col justify-between bg-stone-850 text-stone-100">
                          <span className="text-[10px] uppercase font-sans text-amber-300">{book.format.toUpperCase()}</span>
                          <h4 className="font-serif-display font-bold text-xs">{book.title}</h4>
                          <span className="text-[10px] text-stone-400 font-sans">{book.author}</span>
                        </div>
                      )}

                      {isCompleted && (
                        <div className="absolute top-2 left-2 bg-stone-950/80 backdrop-blur-xs text-white p-1 rounded-full shadow-xs">
                          <Check className="w-3 h-3 text-emerald-400" />
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
                      className="space-y-1 cursor-pointer"
                    >
                      <h4 className="font-serif-display font-bold text-sm text-stone-950 group-hover:text-[#9A3412] transition-colors line-clamp-1 leading-snug">
                        {book.title}
                      </h4>
                      <p className="text-xs text-stone-500 font-sans line-clamp-1">
                        {book.author}
                      </p>

                      {/* Tag badges */}
                      {book.tags && book.tags.length > 0 && (
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
                      
                      <div className="flex items-center justify-between text-[11px] text-stone-500 font-sans pt-0.5">
                        <span>{book.progressPercent}% lido</span>
                        <span className="text-stone-400 uppercase">{book.format}</span>
                      </div>
                    </div>

                    {/* Action Bar (Ler, Áudio, Coleções, Excluir) */}
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-1">
                      <button
                        onClick={() => onOpenBook(book)}
                        className="flex-1 py-1.5 px-2 bg-stone-900 hover:bg-stone-800 text-white rounded text-[11px] font-semibold font-sans flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        title="Ler livro"
                      >
                        <BookOpen className="w-3 h-3 text-amber-300" />
                        <span>Ler</span>
                      </button>

                      <button
                        onClick={() => onPlayAudiobook(book)}
                        className="p-1.5 rounded bg-[#FAF6F0] hover:bg-[#F3ECE0] text-stone-800 border border-[#E8DFD1] transition-colors cursor-pointer"
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
