import React from 'react';
import { 
  X, Volume2, Mic, Gauge, Sliders, Moon, Check, 
  Sparkles, RotateCcw, Play 
} from 'lucide-react';
import { useAudioReader } from '../context/AudioReaderContext';

interface AudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AudioSettingsModal: React.FC<AudioSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    audioSettings,
    voices,
    setRate,
    setPitch,
    setVoice,
    setVolume,
    setSleepTimer,
    sleepTimerRemainingSec,
    testCurrentVoice
  } = useAudioReader();

  if (!isOpen) return null;

  // Split voices into Portuguese and others
  const ptVoices = voices.filter(v => v.isPortuguese);
  const otherVoices = voices.filter(v => !v.isPortuguese);

  const speedPresets = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
  const sleepPresets = [
    { label: 'Desativado', value: null },
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '45 min', value: 45 },
    { label: '60 min', value: 60 },
    { label: 'Fim do Capítulo', value: -1 },
  ];

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-900 text-amber-300 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-editorial-title text-lg font-semibold text-stone-900">
                Ajustes de Voz & Velocidade
              </h3>
              <p className="text-xs text-stone-500">
                Personalize a experiência de leitura em áudio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* 1. Voice Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-amber-600" />
                <span>Voz da Leitura</span>
              </label>
              <button
                onClick={testCurrentVoice}
                className="inline-flex items-center gap-1 text-xs text-stone-700 hover:text-stone-950 font-medium bg-stone-100 hover:bg-stone-200 px-2.5 py-1 rounded-md transition-colors"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Ouvir Teste</span>
              </button>
            </div>

            <select
              value={audioSettings.voiceURI || ''}
              onChange={(e) => setVoice(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-stone-50 rounded-lg border border-stone-300 text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-500 font-medium"
            >
              {ptVoices.length > 0 && (
                <optgroup label="🇧🇷 / 🇵🇹 Vozes em Português">
                  {ptVoices.map(v => (
                    <option key={v.voice.voiceURI} value={v.voice.voiceURI}>
                      {v.name} ({v.lang}) {v.isDefault ? '— Padrão' : ''}
                    </option>
                  ))}
                </optgroup>
              )}
              {otherVoices.length > 0 && (
                <optgroup label="🌐 Outras Vozes Instaladas">
                  {otherVoices.map(v => (
                    <option key={v.voice.voiceURI} value={v.voice.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="text-[11px] text-stone-500">
              {voices.length} vozes detectadas no seu navegador/sistema operacional.
            </p>
          </div>

          {/* 2. Speed / Rate Control */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-amber-600" />
                <span>Velocidade de Leitura</span>
              </label>
              <span className="text-xs font-bold text-stone-900 tabular-nums bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded">
                {audioSettings.rate.toFixed(2)}x
              </span>
            </div>

            {/* Speed Presets */}
            <div className="grid grid-cols-6 gap-1.5">
              {speedPresets.map(preset => {
                const isActive = Math.abs(audioSettings.rate - preset) < 0.05;
                return (
                  <button
                    key={preset}
                    onClick={() => setRate(preset)}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      isActive
                        ? 'bg-stone-900 text-white shadow-sm'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                    }`}
                  >
                    {preset}x
                  </button>
                );
              })}
            </div>

            {/* Slider */}
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.05"
              value={audioSettings.rate}
              onChange={(e) => setRate(parseFloat(e.target.value))}
              className="w-full accent-stone-900 cursor-pointer h-1.5 bg-stone-200 rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-stone-600">
              <span>0.5x (Lento)</span>
              <span>1.0x (Natural)</span>
              <span>2.5x (Rápido)</span>
            </div>
          </div>

          {/* 3. Pitch (Tom de Voz) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                Tom da Voz (Pitch)
              </label>
              <span className="text-xs text-stone-600 tabular-nums">
                {audioSettings.pitch.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.3"
              step="0.1"
              value={audioSettings.pitch}
              onChange={(e) => setPitch(parseFloat(e.target.value))}
              className="w-full accent-stone-900 cursor-pointer h-1.5 bg-stone-200 rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-stone-600">
              <span>Grave</span>
              <span>Equilibrado</span>
              <span>Agudo</span>
            </div>
          </div>

          {/* 4. Sleep Timer (Temporizador de Sono) */}
          <div className="space-y-3 pt-2 border-t border-stone-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                <span>Timer de Sono (Desligamento)</span>
              </label>
              {sleepTimerRemainingSec !== null && sleepTimerRemainingSec > 0 && (
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded tabular-nums animate-pulse">
                  Desliga em {formatTimer(sleepTimerRemainingSec)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {sleepPresets.map(preset => {
                const isActive = audioSettings.sleepTimerMinutes === preset.value;
                return (
                  <button
                    key={preset.label}
                    onClick={() => setSleepTimer(preset.value)}
                    className={`py-2 px-2 text-xs font-medium rounded-lg text-center transition-all ${
                      isActive
                        ? 'bg-indigo-900 text-white shadow-sm'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors shadow-sm"
          >
            Salvar e Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
