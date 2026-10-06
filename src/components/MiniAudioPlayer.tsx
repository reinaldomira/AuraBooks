import React from 'react';
import { Play, Pause, BookOpen, X, Headphones, Gauge } from 'lucide-react';
import { useAudioReader } from '../context/AudioReaderContext';

interface MiniAudioPlayerProps {
  onOpenReader: () => void;
}

export const MiniAudioPlayer: React.FC<MiniAudioPlayerProps> = ({ onOpenReader }) => {
  const {
    currentBook,
    chapterIndex,
    paragraphIndex,
    isPlaying,
    isPaused,
    togglePlayPause,
    stopAudio,
    audioSettings,
  } = useAudioReader();

  if (!currentBook) return null;

  const currentChapter = currentBook.chapters[chapterIndex];

  return (
    <div className="fixed bottom-[68px] left-3 right-3 sm:bottom-6 sm:left-auto sm:right-6 sm:w-96 z-40 bg-stone-900/95 backdrop-blur-md text-stone-100 rounded-2xl shadow-2xl border border-stone-700/80 p-3 sm:p-3.5 animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-center gap-3">
        {/* Thumbnail */}
        <div
          onClick={onOpenReader}
          className="w-12 h-16 rounded-md bg-stone-800 overflow-hidden shrink-0 border border-stone-700 cursor-pointer relative group"
        >
          {currentBook.coverUrl ? (
            <img
              src={currentBook.coverUrl}
              alt={currentBook.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-stone-800 text-stone-400">
              <Headphones className="w-5 h-5 text-amber-400" />
            </div>
          )}
          {isPlaying && !isPaused && (
            <div className="absolute inset-0 bg-stone-950/40 flex items-center justify-center">
              <span className="flex items-center gap-0.5">
                <span className="w-1 h-3 bg-amber-400 rounded-full animate-wave-1" />
                <span className="w-1 h-2 bg-amber-400 rounded-full animate-wave-2" />
                <span className="w-1 h-4 bg-amber-400 rounded-full animate-wave-3" />
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0" onClick={onOpenReader}>
          <div className="cursor-pointer">
            <h4 className="text-xs font-semibold text-white truncate hover:text-amber-300 transition-colors">
              {currentBook.title}
            </h4>
            <p className="text-[11px] text-stone-400 truncate mt-0.5">
              {currentChapter?.title || `Capítulo ${chapterIndex + 1}`}
            </p>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-stone-500 font-medium">
              <span className="text-amber-400/90">{audioSettings.rate.toFixed(2)}x</span>
              <span aria-hidden="true">·</span>
              <span>Parágrafo {paragraphIndex + 1}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={togglePlayPause}
            className="w-9 h-9 rounded-full bg-amber-400 hover:bg-amber-300 text-stone-950 flex items-center justify-center active:scale-95 transition-all shadow-md"
            title={isPlaying && !isPaused ? 'Pausar' : 'Reproduzir'}
          >
            {isPlaying && !isPaused ? (
              <Pause className="w-4 h-4 fill-stone-950" />
            ) : (
              <Play className="w-4 h-4 fill-stone-950 ml-0.5" />
            )}
          </button>

          <button
            onClick={onOpenReader}
            className="p-2 text-stone-300 hover:text-white hover:bg-stone-800 rounded-lg transition-colors"
            title="Abrir no leitor"
          >
            <BookOpen className="w-4 h-4" />
          </button>

          <button
            onClick={stopAudio}
            className="p-1.5 text-stone-500 hover:text-stone-300 hover:bg-stone-800 rounded-lg transition-colors"
            title="Fechar player"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
