import React from 'react';
import { X, Type, Sun, Moon, Eye, Palette, Check } from 'lucide-react';
import { ReaderSettings, ReaderTheme, ReaderFontFamily, ReaderLineHeight, ReaderColumnWidth } from '../types/book';

interface ReaderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onChangeSettings: (settings: ReaderSettings) => void;
}

export const ReaderSettingsModal: React.FC<ReaderSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onChangeSettings,
}) => {
  if (!isOpen) return null;

  const themes: { id: ReaderTheme; name: string; bg: string; text: string; border: string }[] = [
    { id: 'alabaster', name: 'Alabastro', bg: 'bg-[#FBF9F5]', text: 'text-stone-900', border: 'border-stone-300' },
    { id: 'sepia', name: 'Sépia Clássico', bg: 'bg-[#F4ECD8]', text: 'text-[#433422]', border: 'border-[#D9CCA8]' },
    { id: 'dark', name: 'Noturno OLED', bg: 'bg-[#121214]', text: 'text-stone-200', border: 'border-stone-800' },
    { id: 'mint', name: 'Menta Suave', bg: 'bg-[#EBF2EC]', text: 'text-[#193324]', border: 'border-[#C2D8C6]' },
  ];

  const update = (partial: Partial<ReaderSettings>) => {
    onChangeSettings({ ...settings, ...partial });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-stone-700" />
            <h3 className="font-editorial-title text-lg font-semibold text-stone-900">
              Aparência do Leitor
            </h3>
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
          {/* Theme selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-700">
              Tema de Fundo & Papel
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {themes.map(t => {
                const isSelected = settings.theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => update({ theme: t.id })}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${t.bg} ${t.text} ${t.border} ${
                      isSelected ? 'ring-2 ring-stone-900 shadow-md' : 'hover:scale-[1.02]'
                    }`}
                  >
                    <span className="text-xs font-medium">{t.name}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Typography size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                Tamanho da Fonte
              </label>
              <span className="text-xs font-bold text-stone-900 tabular-nums">
                {settings.fontSize}px
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => update({ fontSize: Math.max(14, settings.fontSize - 1) })}
                className="w-10 h-10 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-sm flex items-center justify-center transition-colors"
                title="Diminuir fonte"
              >
                A-
              </button>
              <input
                type="range"
                min="14"
                max="26"
                step="1"
                value={settings.fontSize}
                onChange={(e) => update({ fontSize: parseInt(e.target.value) })}
                className="flex-1 accent-stone-900 cursor-pointer h-1.5 bg-stone-200 rounded-lg"
              />
              <button
                onClick={() => update({ fontSize: Math.min(26, settings.fontSize + 1) })}
                className="w-10 h-10 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-base flex items-center justify-center transition-colors"
                title="Aumentar fonte"
              >
                A+
              </button>
            </div>
          </div>

          {/* Font family */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-700">
              Família Tipográfica
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => update({ fontFamily: 'serif' })}
                className={`py-2 px-3 text-xs rounded-lg border text-center transition-all ${
                  settings.fontFamily === 'serif'
                    ? 'bg-stone-900 text-white border-stone-900 font-serif'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200 font-serif'
                }`}
              >
                Serifada (Lora)
              </button>
              <button
                onClick={() => update({ fontFamily: 'sans' })}
                className={`py-2 px-3 text-xs rounded-lg border text-center transition-all ${
                  settings.fontFamily === 'sans'
                    ? 'bg-stone-900 text-white border-stone-900 font-sans'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200 font-sans'
                }`}
              >
                Sem Serifa
              </button>
              <button
                onClick={() => update({ fontFamily: 'mono' })}
                className={`py-2 px-3 text-xs rounded-lg border text-center transition-all ${
                  settings.fontFamily === 'mono'
                    ? 'bg-stone-900 text-white border-stone-900 font-mono'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200 font-mono'
                }`}
              >
                Mono
              </button>
            </div>
          </div>

          {/* Line spacing & column width */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                Espaçamento
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(['normal', 'relaxed', 'loose'] as ReaderLineHeight[]).map(lh => (
                  <button
                    key={lh}
                    onClick={() => update({ lineHeight: lh })}
                    className={`py-1.5 text-[11px] rounded capitalize transition-colors ${
                      settings.lineHeight === lh
                        ? 'bg-stone-900 text-white font-medium'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                    }`}
                  >
                    {lh === 'normal' ? 'Normal' : lh === 'relaxed' ? 'Relax' : 'Amplo'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                Largura da Coluna
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(['narrow', 'medium', 'wide'] as ReaderColumnWidth[]).map(w => (
                  <button
                    key={w}
                    onClick={() => update({ columnWidth: w })}
                    className={`py-1.5 text-[11px] rounded capitalize transition-colors ${
                      settings.columnWidth === w
                        ? 'bg-stone-900 text-white font-medium'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                    }`}
                  >
                    {w === 'narrow' ? 'Estreita' : w === 'medium' ? 'Média' : 'Larga'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-stone-50 border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors"
          >
            Pronto
          </button>
        </div>
      </div>
    </div>
  );
};
