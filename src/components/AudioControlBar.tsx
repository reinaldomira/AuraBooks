import React, { useState } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, 
  Sliders, Moon, Gauge, Mic, Sparkles, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAudioReader } from '../context/AudioReaderContext';
import { AudioSettingsModal } from './AudioSettingsModal';

interface AudioControlBarProps {
  totalParagraphs: number;
  totalChapters: number;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
}

export const AudioControlBar: React.FC<AudioControlBarProps> = ({
  totalParagraphs,
  totalChapters,
  autoScroll,
  onToggleAutoScroll,
}) => {
  const {
    currentBook,
    chapterIndex,
    paragraphIndex,
    isPlaying,
    isPaused,
    togglePlayPause,
    nextParagraph,
    previousParagraph,
    audioSettings,
    setRate,
    sleepTimerRemainingSec,
  } = useAudioReader();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const speedCycle = [1.0, 1.25, 1.5, 1.75, 2.0, 0.75];
  const handleCycleSpeed = () => {
    const cur = audioSettings.rate;
    const closestIdx = speedCycle.findIndex(s => Math.abs(s - cur) < 0.15);
    const nextIdx = (closestIdx + 1) % speedCycle.length;
    setRate(speedCycle[nextIdx]);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <>
      <div className="sticky bottom-0 z-40 bg-stone-900 text-stone-100 border-t border-stone-800 shadow-2xl backdrop-blur-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Left: Current Track/Position Indicator */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              {/* Playing Animated Bars */}
              <div className="flex items-center gap-1 w-6 h-5 justify-center">
                {isPlaying && !isPaused ? (
                  <>
                    <span className="w-1 bg-amber-400 rounded-full animate-wave-1" />
                    <span className="w-1 bg-amber-400 rounded-full animate-wave-2" />
                    <span className="w-1 bg-amber-400 rounded-full animate-wave-3" />
                    <span className="w-1 bg-amber-400 rounded-full animate-wave-4" />
                  </>
                ) : (
                  <>
                    <span className="w-1 h-2 bg-stone-600 rounded-full" />
                    <span className="w-1 h-3 bg-stone-600 rounded-full" />
                    <span className="w-1 h-1.5 bg-stone-600 rounded-full" />
                    <span className="w-1 h-2.5 bg-stone-600 rounded-full" />
                  </>
                )}
              </div>

              <div>
                <div className="text-xs font-medium text-stone-200 truncate max-w-[200px] sm:max-w-[240px]">
                  {currentBook?.chapters[chapterIndex]?.title || `Capítulo ${chapterIndex + 1}`}
                </div>
                <div className="text-[11px] text-stone-400 tabular-nums">
                  Parágrafo {paragraphIndex + 1} de {Math.max(1, totalParagraphs)} · Cap. {chapterIndex + 1}/{totalChapters}
                </div>
              </div>

              {/* Mobile Auto-scroll switch */}
              <button
                onClick={onToggleAutoScroll}
                className={`sm:hidden text-[11px] px-2 py-1 rounded transition-colors ${
                  autoScroll ? 'bg-amber-500/20 text-amber-300' : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                Rolar: {autoScroll ? 'Sim' : 'Não'}
              </button>
            </div>

            {/* Center: Playback Controls (Previous, Play/Pause, Next) */}
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={previousParagraph}
                title="Parágrafo anterior (Shift + ←)"
                className="p-2 text-stone-400 hover:text-white hover:bg-stone-800 rounded-full transition-colors active:scale-95"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              <button
                onClick={togglePlayPause}
                title={isPlaying && !isPaused ? 'Pausar narração' : 'Iniciar narração em áudio'}
                className="w-12 h-12 rounded-full bg-amber-400 hover:bg-amber-300 text-stone-950 flex items-center justify-center shadow-lg active:scale-95 transition-all"
              >
                {isPlaying && !isPaused ? (
                  <Pause className="w-6 h-6 fill-stone-950" />
                ) : (
                  <Play className="w-6 h-6 fill-stone-950 ml-0.5" />
                )}
              </button>

              <button
                onClick={nextParagraph}
                title="Próximo parágrafo (Shift + →)"
                className="p-2 text-stone-400 hover:text-white hover:bg-stone-800 rounded-full transition-colors active:scale-95"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* Right: Quick Speed, Sleep, Settings */}
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
              {/* Auto scroll toggle on desktop */}
              <button
                onClick={onToggleAutoScroll}
                title="Acompanhar e rolar a página automaticamente enquanto a voz lê"
                className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors ${
                  autoScroll
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                <span>Auto-rolar</span>
              </button>

              {/* Speed cycle button */}
              <button
                onClick={handleCycleSpeed}
                title="Alternar velocidade de leitura"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-300 hover:text-amber-200 text-xs font-semibold rounded-lg border border-stone-700 transition-colors tabular-nums"
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>{audioSettings.rate.toFixed(2)}x</span>
              </button>

              {/* Sleep timer status if running */}
              {sleepTimerRemainingSec !== null && sleepTimerRemainingSec > 0 && (
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  title="Timer de sono ativo"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-950/80 text-indigo-300 text-xs font-medium rounded-lg border border-indigo-800 tabular-nums animate-pulse"
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>{formatTimer(sleepTimerRemainingSec)}</span>
                </button>
              )}

              {/* Full Settings Modal button */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                title="Ajustar voz, velocidade, tom e timer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white text-xs font-medium rounded-lg border border-stone-700 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 text-stone-400" />
                <span className="hidden sm:inline">Voz & Ajustes</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      <AudioSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
};
