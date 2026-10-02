import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  ArrowLeft, ChevronLeft, ChevronRight, BookOpen, 
  RotateCcw, AlertCircle, Loader2, Sparkles
} from 'lucide-react';
import { Book, ReaderSettings } from '../types/book';
import { getOriginalEpub } from '../services/epubStorageService';
import { updateBookProgress, saveBook } from '../services/storageService';

// Registra o Custom Element <foliate-view>
import 'foliate-js/view.js';

interface EpubReaderViewProps {
  book: Book;
  onBackToLibrary: () => void;
  onFallbackToDefaultReader: () => void;
  readerSettings?: ReaderSettings;
}

/**
 * Calcula o progresso global aproximado do livro inteiro (0 a 100%)
 * utilizando as informações reais da API do Foliate.js.
 */
function calculateGlobalProgress(detail: any, viewEl: any): number {
  if (!detail && !viewEl) return 0;

  // 1. Se o SectionProgress do Foliate calculou a fração global ponderada pelo tamanho total de bytes
  // Em foliate-js, detail.fraction quando detail.section existe representa (nextSize / sizeTotal)
  if (
    typeof detail?.fraction === 'number' &&
    !isNaN(detail.fraction) &&
    isFinite(detail.fraction) &&
    detail.section?.total &&
    typeof detail.section.total === 'number' &&
    detail.section.total > 0
  ) {
    const clamped = Math.min(1, Math.max(0, detail.fraction));
    return Math.round(clamped * 100);
  }

  // 2. Se o Foliate forneceu detail.location com current e total
  if (
    detail?.location &&
    typeof detail.location.current === 'number' &&
    typeof detail.location.total === 'number' &&
    detail.location.total > 0
  ) {
    const locProgress = (detail.location.current / detail.location.total) * 100;
    if (!isNaN(locProgress) && isFinite(locProgress)) {
      return Math.min(100, Math.max(0, Math.round(locProgress)));
    }
  }

  // 3. Fallback estrutural baseado nas seções do livro no Foliate
  const totalSections = detail?.section?.total || viewEl?.book?.sections?.length || 0;
  const currentSection = typeof detail?.section?.current === 'number'
    ? detail.section.current
    : (typeof detail?.index === 'number' ? detail.index : 0);

  if (totalSections > 0) {
    const intraSectionFrac = (typeof detail?.fraction === 'number' && !isNaN(detail.fraction) && detail.fraction >= 0 && detail.fraction <= 1)
      ? detail.fraction
      : 0;

    const computed = ((currentSection + intraSectionFrac) / totalSections) * 100;
    return Math.min(100, Math.max(0, Math.round(computed)));
  }

  return 0;
}

/**
 * Obtém a localização persistente (CFI) a partir do evento relocate e da instância do Foliate.
 */
function extractLocationCfi(detail: any, viewEl: any): string | null {
  if (typeof detail?.cfi === 'string' && detail.cfi.trim().length > 0) {
    return detail.cfi.trim();
  }

  if (typeof viewEl?.lastLocation?.cfi === 'string' && viewEl.lastLocation.cfi.trim().length > 0) {
    return viewEl.lastLocation.cfi.trim();
  }

  if (typeof viewEl?.getCFI === 'function' && typeof detail?.index === 'number' && detail?.range) {
    try {
      const generated = viewEl.getCFI(detail.index, detail.range);
      if (typeof generated === 'string' && generated.trim().length > 0) {
        return generated.trim();
      }
    } catch {
      // Ignora falhas silenciosamente
    }
  }

  return null;
}

export const EpubReaderView: React.FC<EpubReaderViewProps> = ({
  book,
  onBackToLibrary,
  onFallbackToDefaultReader,
  readerSettings,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const saveTimeoutRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentCfi, setCurrentCfi] = useState<string>(book.epubLocationCfi || '');
  const [currentProgress, setCurrentProgress] = useState<number>(book.progressPercent || 0);
  const [currentSectionTitle, setCurrentSectionTitle] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    let viewElement: any = null;

    async function loadEpubWithFoliate() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        // 1. Recuperar o arquivo EPUB original (Blob) do IndexedDB
        const epubBlob = await getOriginalEpub(book.id);

        if (!epubBlob) {
          throw new Error('Arquivo original deste EPUB não foi encontrado no armazenamento local.');
        }

        if (!containerRef.current || !isMounted) return;

        // Limpar qualquer conteúdo anterior do container
        containerRef.current.innerHTML = '';

        // 2. Criar e configurar o elemento <foliate-view>
        viewElement = document.createElement('foliate-view');
        viewElement.style.width = '100%';
        viewElement.style.height = '100%';
        viewElement.style.display = 'block';

        containerRef.current.appendChild(viewElement);
        viewRef.current = viewElement;

        // 3. Ouvir evento de mudança de posição (relocate) para atualizar e persistir o progresso
        viewElement.addEventListener('relocate', (e: any) => {
          if (!isMounted) return;
          const detail = e.detail;
          if (!detail) return;

          // TAREFA 1: Extrair localização persistente de forma robusta
          const locationCfi = extractLocationCfi(detail, viewElement);
          if (locationCfi) {
            setCurrentCfi(locationCfi);
          }

          // Atualizar título do capítulo/seção atual
          if (detail.tocItem && typeof detail.tocItem.label === 'string') {
            setCurrentSectionTitle(detail.tocItem.label.trim());
          }

          // TAREFA 3: Calcular progresso global do livro inteiro
          const globalPercent = calculateGlobalProgress(detail, viewElement);
          setCurrentProgress(globalPercent);

          // TAREFA 4 e 5: Salvar progresso sem alterar índices do parser clássico
          // Debounce para evitar sobrecarga de gravações rápidas no IndexedDB
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }

          saveTimeoutRef.current = setTimeout(() => {
            if (!isMounted) return;
            // Preserva currentChapterIndex e currentParagraphIndex do parser original
            updateBookProgress(
              book.id,
              book.currentChapterIndex,
              book.currentParagraphIndex,
              globalPercent,
              locationCfi || book.epubLocationCfi
            ).catch(err => {
              console.warn('Erro ao persistir progresso do EPUB:', err);
            });

            // Atualiza o objeto em memória para refletir a nova posição
            book.progressPercent = globalPercent;
            if (locationCfi) {
              book.epubLocationCfi = locationCfi;
            }
          }, 400);
        });

        // 4. Abrir o EPUB original através do Foliate.js
        await viewElement.open(epubBlob);

        // 5. TAREFA 2: Restaurar a posição salva com segurança
        const savedCfi = book.epubLocationCfi;
        if (savedCfi && typeof savedCfi === 'string' && savedCfi.trim().length > 0) {
          try {
            if (typeof viewElement.init === 'function') {
              await viewElement.init({ lastLocation: savedCfi });
            } else if (typeof viewElement.goTo === 'function') {
              await viewElement.goTo(savedCfi);
            }
          } catch (restoreErr) {
            console.warn('Não foi possível restaurar a posição salva via CFI. Abrindo no início do texto:', restoreErr);
            try {
              if (typeof viewElement.init === 'function') {
                await viewElement.init({ showTextStart: true });
              } else if (typeof viewElement.next === 'function') {
                await viewElement.next();
              }
            } catch (fallbackNavErr) {
              console.warn('Falha na navegação inicial de fallback:', fallbackNavErr);
            }
          }
        } else {
          // Sem posição salva: inicia no começo do texto
          try {
            if (typeof viewElement.init === 'function') {
              await viewElement.init({ showTextStart: true });
            } else if (typeof viewElement.next === 'function') {
              await viewElement.next();
            }
          } catch (initErr) {
            console.warn('Falha ao abrir início do livro:', initErr);
          }
        }

        if (isMounted) {
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('Falha ao renderizar EPUB com Foliate.js:', err);
        if (isMounted) {
          setIsLoading(false);
          setErrorMessage(err?.message || 'Falha ao inicializar o motor Foliate.js para este arquivo.');
        }
      }
    }

    loadEpubWithFoliate();

    // Cleanup: remover listener e referências ao desmontar
    return () => {
      isMounted = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (viewRef.current) {
        viewRef.current = null;
      }
    };
  }, [book.id]);

  // Navegação entre páginas
  const handleNext = () => {
    if (viewRef.current && typeof viewRef.current.next === 'function') {
      viewRef.current.next();
    }
  };

  const handlePrev = () => {
    if (viewRef.current && typeof viewRef.current.prev === 'function') {
      viewRef.current.prev();
    }
  };

  // Suporte a teclas direcionais (setas do teclado)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F1EA] text-stone-900 select-text transition-colors duration-200">
      {/* 1. Header do Leitor Foliate.js (Consistente com AuraBooks) */}
      <header className="sticky top-0 z-40 bg-[#F9F8F5]/95 backdrop-blur-md border-b border-[#E8E2D9] px-4 sm:px-8 h-14 flex items-center justify-between gap-4">
        {/* Voltar à Biblioteca */}
        <button
          onClick={onBackToLibrary}
          className="inline-flex items-center gap-2 text-xs font-semibold text-stone-700 hover:text-stone-950 px-2.5 py-1.5 rounded-lg hover:bg-stone-200/50 transition-colors font-sans cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Biblioteca</span>
        </button>

        {/* Título do Livro & Seção Atual */}
        <div className="text-center truncate px-2">
          <div className="flex items-center justify-center gap-2">
            <h2 className="font-serif-display font-bold text-sm sm:text-base text-stone-950 truncate leading-snug">
              {book.title}
            </h2>
            <span className="text-[10px] uppercase font-sans font-bold px-1.5 py-0.5 rounded bg-amber-100/80 text-amber-900 border border-amber-200 shrink-0">
              Foliate.js
            </span>
          </div>
          <p className="text-[11px] text-stone-500 font-sans truncate">
            {currentSectionTitle || book.author} • {currentProgress}% concluído
          </p>
        </div>

        {/* Botão de Fallback para o Leitor Padrão */}
        <div className="flex items-center gap-2">
          <button
            onClick={onFallbackToDefaultReader}
            className="inline-flex items-center gap-1.5 text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 px-2.5 py-1.5 rounded-lg border border-stone-200/80 transition-colors font-sans cursor-pointer shadow-2xs"
            title="Alternar para o Leitor Clássico do AuraBooks"
          >
            <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
            <span className="hidden sm:inline font-medium">Leitor Clássico</span>
          </button>
        </div>
      </header>

      {/* 2. Área Principal de Leitura */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-2 sm:p-6 flex items-center justify-center relative">
        {/* Botão de Página Anterior Flutuante */}
        <button
          onClick={handlePrev}
          disabled={isLoading || errorMessage !== null}
          className="absolute left-1 sm:left-2 z-20 w-11 h-11 rounded-full bg-white/95 border border-stone-300 text-stone-800 shadow-md hover:bg-stone-900 hover:text-white hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
          title="Página Anterior (Seta Esquerda ←)"
        >
          <ChevronLeft className="w-6 h-6 -translate-x-0.5" />
        </button>

        {/* Botão de Próxima Página Flutuante */}
        <button
          onClick={handleNext}
          disabled={isLoading || errorMessage !== null}
          className="absolute right-1 sm:right-2 z-20 w-11 h-11 rounded-full bg-white/95 border border-stone-300 text-stone-800 shadow-md hover:bg-stone-900 hover:text-white hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
          title="Próxima Página (Seta Direita →)"
        >
          <ChevronRight className="w-6 h-6 translate-x-0.5" />
        </button>

        {/* Canvas de Renderização do Foliate.js */}
        <div className="w-full h-[76vh] sm:h-[82vh] bg-white rounded-2xl shadow-xl border border-[#E8E2D9] overflow-hidden relative flex flex-col">
          {/* Loading State */}
          {isLoading && (
            <div className="absolute inset-0 z-30 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 space-y-3">
              <Loader2 className="w-8 h-8 text-amber-800 animate-spin" />
              <p className="font-serif text-sm font-semibold text-stone-800">
                Renderizando EPUB via Foliate.js...
              </p>
              <p className="text-xs text-stone-500 font-sans">
                Carregando diagramação e tipografia original do livro.
              </p>
            </div>
          )}

          {/* Error State com Fallback Imediato */}
          {errorMessage && (
            <div className="absolute inset-0 z-30 bg-white flex flex-col items-center justify-center p-6 space-y-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h3 className="font-serif-display font-bold text-lg text-stone-950">
                  Não foi possível abrir com Foliate.js
                </h3>
                <p className="text-xs text-stone-600 font-sans leading-relaxed">
                  {errorMessage}
                </p>
              </div>
              <button
                onClick={onFallbackToDefaultReader}
                className="px-5 py-2.5 bg-stone-950 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold font-sans shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-amber-300" />
                <span>Abrir com o Leitor Padrão do AuraBooks</span>
              </button>
            </div>
          )}

          {/* O elemento <foliate-view> será montado aqui */}
          <div ref={containerRef} className="w-full h-full flex-1" />
        </div>
      </main>

      {/* 3. Rodapé com Indicador de Progresso e Navegação */}
      <footer className="sticky bottom-0 z-30 bg-[#F9F8F5]/95 backdrop-blur-md border-t border-[#E8E2D9] px-4 sm:px-8 py-3">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-sans text-stone-600">
          {/* Indicador de Progresso */}
          <div className="flex items-center gap-3">
            <span className="font-bold text-stone-900 tabular-nums">{currentProgress}%</span>
            <span aria-hidden="true">·</span>
            <span className="truncate max-w-[280px]">
              {currentSectionTitle || book.title}
            </span>
          </div>

          {/* Botões de Navegação no Rodapé */}
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrev}
              disabled={isLoading || errorMessage !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 hover:text-stone-950 font-semibold disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer text-xs"
              title="Voltar página (←)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <span className="text-[11px] text-stone-400 hidden md:inline">
              Use as setas do teclado para folhear
            </span>

            <button
              onClick={handleNext}
              disabled={isLoading || errorMessage !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 hover:text-stone-950 font-semibold disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer text-xs"
              title="Avançar página (→)"
            >
              <span>Próxima</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Badge Informativa */}
          <div className="text-[11px] text-stone-400 hidden sm:block">
            Motor: Foliate.js (EPUB Original)
          </div>
        </div>
      </footer>
    </div>
  );
};
