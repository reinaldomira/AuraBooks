import React, { useState, useEffect } from 'react';
import { 
  X, BookA, Volume2, Search, Sparkles, Copy, 
  Check, ArrowRight, BookMarked, ExternalLink, Loader2 
} from 'lucide-react';
import { lookupDictionaryWord, DictionaryEntry } from '../services/dictionaryService';

interface DictionaryModalProps {
  word: string | null;
  onClose: () => void;
  onSaveAsNote?: (word: string, definition: string) => void;
}

export const DictionaryModal: React.FC<DictionaryModalProps> = ({
  word,
  onClose,
  onSaveAsNote,
}) => {
  const [currentWord, setCurrentWord] = useState<string>(word || '');
  const [searchInput, setSearchInput] = useState<string>('');
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  useEffect(() => {
    if (word) {
      setCurrentWord(word);
      setSearchInput(word);
      fetchDefinition(word);
    }
  }, [word]);

  const fetchDefinition = async (term: string) => {
    if (!term || term.trim().length === 0) return;
    setIsLoading(true);
    try {
      const res = await lookupDictionaryWord(term);
      setEntry(res);
    } catch (err) {
      console.error('Error fetching definition:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setCurrentWord(searchInput.trim());
      fetchDefinition(searchInput.trim());
    }
  };

  const handleSpeak = () => {
    if (!currentWord || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentWord);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.9;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopyDefinition = async () => {
    if (!entry) return;
    const text = `${entry.word} (${entry.grammaticalClass})\n${entry.definitions.join('\n')}\nSinônimos: ${entry.synonyms.join(', ')}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  if (!word) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#FAF9F6] rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        
        {/* Header with Search and Close */}
        <div className="p-4 sm:p-5 bg-white border-b border-[#E8E2D9] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100/80 border border-amber-200 flex items-center justify-center text-amber-900">
                <BookA className="w-4 h-4" />
              </div>
              <span className="font-serif-display font-bold text-sm text-stone-900">
                Dicionário da Língua Portuguesa
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-800 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick search input */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Consultar outro vocábulo..."
                className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-sans text-stone-900 focus:outline-none focus:border-stone-500"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-sans font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Buscar
            </button>
          </form>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-amber-800 animate-spin mx-auto" />
              <p className="text-xs font-sans text-stone-500">
                Consultando definições e sinônimos de <strong>"{currentWord}"</strong>...
              </p>
            </div>
          ) : entry ? (
            <div className="space-y-4">
              {/* Word Title & Pronunciation */}
              <div className="space-y-1 pb-3 border-b border-stone-200">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-serif-display text-2xl sm:text-3xl font-bold text-stone-950 capitalize tracking-tight">
                    {entry.word}
                  </h3>

                  <button
                    onClick={handleSpeak}
                    className={`p-2 rounded-full border transition-all cursor-pointer ${
                      isSpeaking
                        ? 'bg-amber-100 text-amber-900 border-amber-300 scale-105 animate-pulse'
                        : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                    title="Ouvir pronúncia em português"
                  >
                    <Volume2 className="w-4 h-4 text-amber-800" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 font-sans text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 font-semibold text-[11px]">
                    {entry.grammaticalClass}
                  </span>

                  {entry.etymology && (
                    <span className="text-stone-500 italic text-xs">
                      {entry.etymology}
                    </span>
                  )}
                </div>
              </div>

              {/* Definitions list */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-stone-400 font-sans tracking-wider block">
                  Significados & Aceções
                </span>

                <ol className="space-y-2 list-decimal list-inside text-xs sm:text-sm text-stone-800 font-serif leading-relaxed">
                  {entry.definitions.map((def, idx) => (
                    <li key={idx} className="p-2 rounded-lg bg-white border border-stone-200/80 shadow-2xs">
                      <span className="font-normal">{def}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Synonyms list (clickable) */}
              {entry.synonyms && entry.synonyms.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-[10px] uppercase font-bold text-stone-400 font-sans tracking-wider block">
                    Sinônimos & Termos Afins (clique para consultar)
                  </span>

                  <div className="flex flex-wrap gap-1.5">
                    {entry.synonyms.map((syn) => (
                      <button
                        key={syn}
                        onClick={() => {
                          setCurrentWord(syn);
                          setSearchInput(syn);
                          fetchDefinition(syn);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-50 text-stone-700 hover:text-amber-950 border border-stone-200 hover:border-amber-300 text-xs font-sans transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <span>{syn}</span>
                        <ArrowRight className="w-2.5 h-2.5 opacity-50" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Source attribution */}
              <div className="pt-2 text-[10px] text-stone-400 font-sans flex items-center justify-between">
                <span>Fonte: {entry.source}</span>
                <span>Português do Brasil</span>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center space-y-2 text-stone-400 font-sans">
              <p className="text-sm text-stone-600 font-semibold">
                Nenhuma definição encontrada para "{currentWord}".
              </p>
              <p className="text-xs text-stone-400 max-w-xs mx-auto">
                Tente buscar a forma no infinitivo ou no masculino singular.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-[#E8E2D9] flex items-center justify-between gap-2 font-sans text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyDefinition}
              disabled={!entry}
              className="py-1.5 px-3 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-700 font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>

            {onSaveAsNote && entry && (
              <button
                onClick={() => {
                  const firstDef = entry.definitions[0] || '';
                  onSaveAsNote(entry.word, `[Dicionário: ${entry.grammaticalClass}] ${firstDef}`);
                  onClose();
                }}
                className="py-1.5 px-3 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-medium flex items-center gap-1 transition-colors cursor-pointer"
                title="Salvar como anotação no caderno do livro"
              >
                <BookMarked className="w-3.5 h-3.5" />
                <span>Salvar nas Notas</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
