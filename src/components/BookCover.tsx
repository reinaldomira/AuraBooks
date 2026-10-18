import React, { useState, useEffect } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { Book } from '../types/book';
import { repairMissingBookCover, isValidCoverUrl, normalizeCoverUrl } from '../services/coverService';

interface BookCoverProps {
  book: Book;
  className?: string;
  imgClassName?: string;
  showSpineEffect?: boolean;
  onCoverRepaired?: (newCover: string) => void;
}

/**
 * Paleta de cores para o fallback visual imediato
 */
function getFallbackTheme(title: string, author?: string) {
  const combined = `${title || ''}-${author || ''}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }
  const themes = [
    {
      bg: 'from-[#381E11] via-[#2A140A] to-[#180A04]',
      badge: 'bg-amber-400/20 text-amber-300 border-amber-400/30',
      title: 'text-amber-50',
      divider: 'bg-amber-500/50',
      author: 'text-amber-200/70',
      icon: 'text-amber-300/70'
    },
    {
      bg: 'from-[#0F172A] via-[#0B1120] to-[#030712]',
      badge: 'bg-sky-400/20 text-sky-300 border-sky-400/30',
      title: 'text-slate-50',
      divider: 'bg-amber-400/50',
      author: 'text-slate-300/70',
      icon: 'text-amber-300/70'
    },
    {
      bg: 'from-[#064E3B] via-[#043327] to-[#021C16]',
      badge: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30',
      title: 'text-emerald-50',
      divider: 'bg-emerald-400/50',
      author: 'text-emerald-200/70',
      icon: 'text-emerald-300/70'
    },
    {
      bg: 'from-[#4C0519] via-[#330310] to-[#1A0108]',
      badge: 'bg-rose-400/20 text-rose-300 border-rose-400/30',
      title: 'text-rose-50',
      divider: 'bg-rose-400/50',
      author: 'text-rose-200/70',
      icon: 'text-rose-300/70'
    },
    {
      bg: 'from-[#18181B] via-[#121214] to-[#09090B]',
      badge: 'bg-stone-400/20 text-stone-200 border-stone-400/30',
      title: 'text-stone-50',
      divider: 'bg-amber-400/40',
      author: 'text-stone-400',
      icon: 'text-amber-300/60'
    }
  ];
  return themes[Math.abs(hash) % themes.length];
}

export const BookCover: React.FC<BookCoverProps> = ({
  book,
  className = '',
  imgClassName = '',
  showSpineEffect = true,
  onCoverRepaired,
}) => {
  const [imgError, setImgError] = useState(false);
  const normalizedInitial = normalizeCoverUrl(book.coverUrl);
  const [currentCoverUrl, setCurrentCoverUrl] = useState<string>(normalizedInitial);
  const [isRepairing, setIsRepairing] = useState(false);

  useEffect(() => {
    const cleanUrl = normalizeCoverUrl(book.coverUrl);
    const valid = isValidCoverUrl(cleanUrl);
    setCurrentCoverUrl(cleanUrl);
    setImgError(!valid);
  }, [book.coverUrl]);

  // Atualização em tempo real quando a capa deste livro for salva em segundo plano
  useEffect(() => {
    const handleUpdated = (e: CustomEvent<Book>) => {
      if (e.detail && e.detail.id === book.id && e.detail.coverUrl) {
        const clean = normalizeCoverUrl(e.detail.coverUrl);
        if (isValidCoverUrl(clean)) {
          setCurrentCoverUrl(clean);
          setImgError(false);
        }
      }
    };
    window.addEventListener('aurabooks_book_updated', handleUpdated as EventListener);
    return () => {
      window.removeEventListener('aurabooks_book_updated', handleUpdated as EventListener);
    };
  }, [book.id]);

  const hasValidCover = !imgError && isValidCoverUrl(currentCoverUrl);

  // Auto-repara capas ausentes ou quebradas em segundo plano se não houver capa válida
  useEffect(() => {
    let isCancelled = false;
    const cleanUrl = normalizeCoverUrl(book.coverUrl);
    const isCoverMissing = !isValidCoverUrl(cleanUrl) || imgError;

    if (isCoverMissing && !isRepairing) {
      setIsRepairing(true);
      repairMissingBookCover(book, {
        forceRegenerate: imgError,
        brokenUrl: imgError ? currentCoverUrl : undefined,
      })
        .then((newCover) => {
          if (!isCancelled && newCover && isValidCoverUrl(newCover)) {
            setCurrentCoverUrl(newCover);
            setImgError(false);
            if (onCoverRepaired) {
              onCoverRepaired(newCover);
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!isCancelled) setIsRepairing(false);
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [book.id, book.coverUrl, imgError]);

  const theme = getFallbackTheme(book.title, book.author);

  return (
    <div className={`relative w-full h-full overflow-hidden select-none ${className}`}>
      {hasValidCover ? (
        <img
          src={currentCoverUrl}
          alt={book.title}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            setImgError(true);
          }}
          className={`w-full h-full object-cover transition-transform duration-300 ${imgClassName}`}
        />
      ) : (
        /* Fallback visual de altíssimo padrão: NUNCA exibe caixa cinza em branco! */
        <div className={`w-full h-full p-3 sm:p-4 flex flex-col justify-between bg-gradient-to-br ${theme.bg} relative`}>
          <div className="flex items-center justify-between">
            <span className={`text-[9px] uppercase font-sans font-bold tracking-wider px-1.5 py-0.5 rounded border ${theme.badge}`}>
              {(book.format || 'livro').toUpperCase()}
            </span>
            {isRepairing ? (
              <Loader2 className="w-3.5 h-3.5 text-amber-300 animate-spin opacity-80" />
            ) : (
              <BookOpen className={`w-3.5 h-3.5 ${theme.icon}`} />
            )}
          </div>

          <div className="space-y-1.5 my-auto">
            <h4 className={`font-serif-display font-bold text-xs sm:text-sm line-clamp-3 leading-snug ${theme.title}`}>
              {book.title}
            </h4>
            <div className={`w-6 h-0.5 rounded-full ${theme.divider}`} />
          </div>

          <span className={`text-[9.5px] sm:text-[10px] font-sans truncate block ${theme.author}`}>
            {book.author && book.author.toLowerCase() !== 'autor desconhecido' ? book.author : 'Biblioteca Lumina'}
          </span>
        </div>
      )}

      {/* Simulação física da lombada do livro com iluminação e vinco suave */}
      {showSpineEffect && (
        <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-black/45 via-white/10 to-transparent pointer-events-none" />
      )}
    </div>
  );
};
