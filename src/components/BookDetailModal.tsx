import React, { useState, useEffect } from 'react';
import { X, BookOpen, Clock, FileText, Heart, Trash2, Calendar, FileBox, RotateCcw, Headphones, ImagePlus } from 'lucide-react';
import { Book } from '../types/book';
import { BookCover } from './BookCover';
import { ChangeCoverModal } from './ChangeCoverModal';

interface BookDetailModalProps {
  book: Book | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenBook: (book: Book) => void;
  onPlayBook: (book: Book) => void;
  onDeleteBook: (id: string) => void;
  onResetProgress: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onRefreshBooks?: () => Promise<void>;
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({
  book,
  isOpen,
  onClose,
  onOpenBook,
  onPlayBook,
  onDeleteBook,
  onResetProgress,
  onToggleFavorite,
  onRefreshBooks,
}) => {
  const [currentBook, setCurrentBook] = useState<Book | null>(book);
  const [isChangingCover, setIsChangingCover] = useState(false);

  useEffect(() => {
    setCurrentBook(book);
  }, [book]);

  if (!isOpen || !currentBook) return null;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
            <div className="flex items-center gap-2 text-stone-600 text-xs">
              <span className="uppercase font-semibold tracking-wider text-stone-800">{currentBook.format}</span>
              <span aria-hidden="true">·</span>
              <span>{currentBook.category}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            <div className="flex gap-5">
              {/* Book Cover with Change Button */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="w-24 sm:w-28 h-36 sm:h-40 rounded-lg bg-stone-100 overflow-hidden border border-stone-300 shadow-md relative group">
                  <BookCover book={currentBook} />
                </div>
                <button
                  onClick={() => setIsChangingCover(true)}
                  className="text-[10.5px] text-amber-900 hover:text-amber-950 font-semibold flex items-center gap-1 cursor-pointer py-0.5 hover:underline"
                  title="Carregar ou alterar capa do livro"
                >
                  <ImagePlus className="w-3 h-3 text-amber-800" />
                  <span>Carregar Capa</span>
                </button>
              </div>

              {/* Info */}
              <div className="space-y-1.5 flex-1 min-w-0">
                <h3 className="font-editorial-title text-xl font-bold text-stone-900 leading-snug">
                  {currentBook.title}
                </h3>
                <p className="text-xs text-stone-600 font-medium">{currentBook.author}</p>

                {currentBook.description && (
                  <p className="text-xs text-stone-500 line-clamp-3 pt-1 leading-relaxed">
                    {currentBook.description}
                  </p>
                )}

                {/* Progress */}
                <div className="pt-2 space-y-1">
                  <div className="flex justify-between text-xs text-stone-600 tabular-nums">
                    <span>Progresso da leitura</span>
                    <span className="font-semibold text-stone-900">{currentBook.progressPercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-600 transition-all"
                      style={{ width: `${currentBook.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600">
              <div>
                <span className="text-[10px] uppercase text-stone-400 block">Capítulos</span>
                <span className="font-semibold text-stone-900 tabular-nums text-sm">
                  {currentBook.chapters.length}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-stone-400 block">Total de Palavras</span>
                <span className="font-semibold text-stone-900 tabular-nums text-sm">
                  {currentBook.totalWords.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-stone-400 block">Tempo em Áudio</span>
                <span className="font-semibold text-stone-900 tabular-nums text-sm">
                  ~{currentBook.estimatedAudioMinutes} min
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-stone-400 block">Tamanho</span>
                <span className="font-semibold text-stone-900 tabular-nums text-sm">
                  {formatSize(currentBook.fileSize)}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] uppercase text-stone-400 block">Adicionado em</span>
                <span className="font-medium text-stone-800 text-xs">
                  {formatDate(currentBook.addedAt)}
                </span>
              </div>
            </div>

            {/* Primary actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  onPlayBook(currentBook);
                  onClose();
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-400 hover:bg-amber-300 text-stone-950 font-semibold text-xs sm:text-sm rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <Headphones className="w-4 h-4 fill-stone-950" />
                <span>Ouvir em Áudio</span>
              </button>

              <button
                onClick={() => {
                  onOpenBook(currentBook);
                  onClose();
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs sm:text-sm rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-amber-300" />
                <span>Abrir Texto</span>
              </button>
            </div>

            {/* Utility row */}
            <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
              <button
                onClick={() => onResetProgress(currentBook.id)}
                className="inline-flex items-center gap-1.5 hover:text-stone-900 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reiniciar progresso para 0%</span>
              </button>

              <button
                onClick={() => {
                  if (confirm('Tem certeza que deseja excluir este livro da biblioteca?')) {
                    onDeleteBook(currentBook.id);
                    onClose();
                  }
                }}
                className="inline-flex items-center gap-1.5 text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir livro</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para carregar capa */}
      {isChangingCover && (
        <ChangeCoverModal
          book={currentBook}
          isOpen={true}
          onClose={() => setIsChangingCover(false)}
          onCoverUpdated={async (updated, newCover) => {
            setCurrentBook({ ...updated, coverUrl: newCover });
            if (onRefreshBooks) await onRefreshBooks();
            setIsChangingCover(false);
          }}
        />
      )}
    </>
  );
};
