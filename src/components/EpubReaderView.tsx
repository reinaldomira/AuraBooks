import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  ArrowLeft, ChevronLeft, ChevronRight, 
  RotateCcw, AlertCircle, Loader2, Bookmark, Check
} from 'lucide-react';
import { Book, ReaderSettings, ReadingSession } from '../types/book';
import { getOriginalEpub, saveOriginalEpub } from '../services/epubStorageService';
import { updateBookProgress, saveReadingSession } from '../services/storageService';
import { auth, downloadBookFileFromCloud, syncProgressToCloud } from '../services/firebase';

// Registra o Custom Element <foliate-view>
import 'foliate-js/view.js';
// Importa a implementação oficial de CFI do Foliate.js
// @ts-ignore
import * as CFI from 'foliate-js/epubcfi.js';

interface EpubReaderViewProps {
  book: Book;
  onBackToLibrary: () => void;
  onFallbackToDefaultReader: () => void;
  readerSettings?: ReaderSettings;
}

/**
 * Calcula o progresso global do livro inteiro (0 a 100%)
 * baseado estritamente na API e propriedades reais do Foliate.js:
 * - viewElement.book.sections com propriedades reais: size e linear
 * - detail.index e detail.fraction (progresso interno da seção)
 * - Seções com linear === "no" não fazem parte do progresso linear
 */
function calculateGlobalProgress(detail: any, viewEl: any, lastValidProgress: number): number {
  if (!viewEl?.book?.sections || typeof detail?.index !== 'number') {
    return lastValidProgress;
  }

  const sections = viewEl.book.sections as Array<{ size?: number; linear?: string }>;
  const currentIndex = detail.index;
  const currentSection = sections[currentIndex];

  // Seção não-linear (linear === "no"): não faz parte do progresso linear.
  // Preserva o último progresso linear conhecido em vez de voltar para 0 ou produzir valores incoerentes.
  if (currentSection && currentSection.linear === 'no') {
    return lastValidProgress;
  }

  const fraction = (typeof detail?.fraction === 'number' && !isNaN(detail.fraction) && isFinite(detail.fraction))
    ? Math.max(0, Math.min(1, detail.fraction))
    : 0;

  // 1. Somar o tamanho em bytes de todas as seções lineares (linear !== "no")
  let totalLinearSize = 0;
  let linearSectionCount = 0;

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    if (s && s.linear !== 'no') {
      linearSectionCount++;
      const sz = typeof s.size === 'number' && !isNaN(s.size) && s.size > 0 ? s.size : 0;
      totalLinearSize += sz;
    }
  }

  // 2. Se as seções lineares possuírem tamanhos em bytes válidos
  if (totalLinearSize > 0) {
    // completedSize: soma do size das seções lineares estritamente anteriores à seção atual
    let completedSize = 0;
    for (let i = 0; i < currentIndex && i < sections.length; i++) {
      const s = sections[i];
      if (s && s.linear !== 'no') {
        const sz = typeof s.size === 'number' && !isNaN(s.size) && s.size > 0 ? s.size : 0;
        completedSize += sz;
      }
    }

    // currentSectionProgress: contribuição proporcional da seção atual caso seja linear
    let currentSectionProgress = 0;
    if (currentSection && currentSection.linear !== 'no') {
      const sz = typeof currentSection.size === 'number' && !isNaN(currentSection.size) && currentSection.size > 0
        ? currentSection.size
        : 0;
      currentSectionProgress = sz * fraction;
    }

    const calculated = ((completedSize + currentSectionProgress) / totalLinearSize) * 100;
    if (isNaN(calculated) || !isFinite(calculated)) {
      return lastValidProgress;
    }
    return Math.min(100, Math.max(0, Math.round(calculated)));
  }

  // 3. Fallback defensivo para seções sem size: distribui uniformemente entre as seções lineares
  if (linearSectionCount > 0) {
    let completedLinearSections = 0;
    for (let i = 0; i < currentIndex && i < sections.length; i++) {
      if (sections[i] && sections[i].linear !== 'no') {
        completedLinearSections++;
      }
    }

    const isCurLinear = currentSection && currentSection.linear !== 'no';
    const sectionWeight = isCurLinear ? fraction : 0;

    const fallbackProgress = ((completedLinearSections + sectionWeight) / linearSectionCount) * 100;
    if (isNaN(fallbackProgress) || !isFinite(fallbackProgress)) {
      return lastValidProgress;
    }
    return Math.min(100, Math.max(0, Math.round(fallbackProgress)));
  }

  return lastValidProgress;
}

/**
 * Gera o CFI preciso da posição atual utilizando a API real do Foliate.js e foliate-js/epubcfi.js:
 * - detail.index para localizar a seção no spine
 * - section.cfi como base CFI oficial da seção (resources.cfis)
 * - detail.range colapsado no início (start) para obter o ponto inicial exato do conteúdo visível
 * - CFI.fromRange em range colapsado gera um CFI de ponto (sem commas/ancestrais de range)
 * - CFI.joinIndir para unificar o baseCFI e o relativeCFI em uma CFI canônica completa
 */
function generateCfiFromRelocate(detail: any, viewEl: any): { cfi: string; isPoint: boolean } | null {
  if (!detail || typeof detail.index !== 'number') return null;

  const sectionIndex = detail.index;
  const sections = viewEl?.book?.sections;
  const section = sections ? sections[sectionIndex] : null;

  // Apenas utiliza o CFI oficial fornecido pela seção do Foliate (resources.cfis)
  const baseCFI = section?.cfi;
  if (!baseCFI || typeof baseCFI !== 'string' || baseCFI.trim().length === 0) {
    return null;
  }

  try {
    // Se houver um Range do documento visível, colapsa para o ponto inicial (start)
    // O Foliate espera um ponto preciso como âncora para restaurar exatamente a página que contém esse início
    if (detail.range && typeof detail.range.cloneRange === 'function' && typeof CFI.fromRange === 'function' && typeof CFI.joinIndir === 'function') {
      const pointRange = detail.range.cloneRange();
      pointRange.collapse(true); // Colapsa no ponto inicial (startContainer, startOffset)

      const relativeCFI = CFI.fromRange(pointRange);
      if (relativeCFI) {
        const fullCFI = CFI.joinIndir(baseCFI, relativeCFI);
        if (typeof fullCFI === 'string' && fullCFI.trim().length > 0) {
          return { cfi: fullCFI.trim(), isPoint: true };
        }
      }
    }

    // Se não houver range, combina com o baseCFI da seção
    if (typeof CFI.joinIndir === 'function') {
      const fullCFI = CFI.joinIndir(baseCFI);
      if (typeof fullCFI === 'string' && fullCFI.trim().length > 0) {
        return { cfi: fullCFI.trim(), isPoint: false };
      }
    }
  } catch (err) {
    console.warn('Erro ao gerar CFI a partir da posição do Foliate:', err);
  }

  return null;
}

const MIN_SESSION_SECONDS = 5;

export const EpubReaderView: React.FC<EpubReaderViewProps> = ({
  book,
  onBackToLibrary,
  onFallbackToDefaultReader,
  readerSettings,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const saveTimeoutRef = useRef<any>(null);
  const isRestoringRef = useRef<boolean>(true);
  const hasUserNavigatedRef = useRef<boolean>(false);
  const lastValidProgressRef = useRef<number>(book.progressPercent || 0);
  const pendingSaveRef = useRef<{ cfi: string | null; progress: number } | null>(null);

  // Memória da Sessão de Leitura
  const sessionStartedAtRef = useRef<number | null>(null);
  const sessionStartProgressRef = useRef<number>(0);
  const sessionStartCfiRef = useRef<string | undefined>(undefined);
  const sessionAccumulatedSecondsRef = useRef<number>(0);
  const sessionLastActiveTimestampRef = useRef<number | null>(null);
  const sessionIsActiveRef = useRef<boolean>(false);
  const sessionEndedRef = useRef<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentCfi, setCurrentCfi] = useState<string>(book.epubLocationCfi || '');
  const currentCfiRef = useRef<string>(book.epubLocationCfi || '');
  const [currentProgress, setCurrentProgress] = useState<number>(book.progressPercent || 0);
  const [currentSectionTitle, setCurrentSectionTitle] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveStatusTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Salva imediatamente qualquer progresso pendente de forma assíncrona (IndexedDB e Nuvem)
  const flushPendingSave = useCallback(async (): Promise<void> => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const pending = pendingSaveRef.current;
    if (pending && !isRestoringRef.current) {
      const cfiToSave = pending.cfi || currentCfiRef.current || book.epubLocationCfi;
      try {
        await updateBookProgress(
          book.id,
          book.currentChapterIndex,
          book.currentParagraphIndex,
          pending.progress,
          cfiToSave
        );
      } catch (err) {
        console.warn('Erro ao descarregar progresso pendente no IndexedDB:', err);
      }

      // Sincroniza imediatamente com a nuvem Firebase se o usuário estiver autenticado
      if (auth.currentUser) {
        syncProgressToCloud(
          auth.currentUser.uid,
          book.id,
          book.currentChapterIndex,
          book.currentParagraphIndex,
          pending.progress,
          cfiToSave
        ).catch(err => {
          console.warn('Erro ao sincronizar progresso com a nuvem:', err);
        });
      }

      book.progressPercent = pending.progress;
      if (cfiToSave) {
        book.epubLocationCfi = cfiToSave;
      }
    }
  }, [book]);

  // Salvar manual da posição atual acionado pelo usuário
  const handleManualSave = useCallback(async () => {
    if (saveStatus === 'saving') return;
    setSaveStatus('saving');
    try {
      await flushPendingSave();
      setSaveStatus('saved');
      if (saveStatusTimerRef.current) {
        clearTimeout(saveStatusTimerRef.current);
      }
      saveStatusTimerRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch {
      setSaveStatus('idle');
    }
  }, [flushPendingSave, saveStatus]);

  // Inicia a sessão de leitura assim que o livro e a restauração de posição estiverem prontos
  const startReadingSession = useCallback((initialProgress: number, initialCfi?: string) => {
    if (sessionIsActiveRef.current || sessionEndedRef.current) return;

    const now = Date.now();
    sessionStartedAtRef.current = now;
    sessionStartProgressRef.current = initialProgress;
    sessionStartCfiRef.current = initialCfi;
    sessionAccumulatedSecondsRef.current = 0;
    sessionLastActiveTimestampRef.current = document.visibilityState === 'visible' ? now : null;
    sessionIsActiveRef.current = true;
    sessionEndedRef.current = false;
  }, []);

  // Encerra a sessão de leitura uma única vez e persiste no IndexedDB se tiver pelo menos 5s
  const endReadingSession = useCallback(() => {
    if (!sessionIsActiveRef.current || sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    sessionIsActiveRef.current = false;

    const now = Date.now();
    // Se a aba estava visível, acumula o tempo da última janela ativa
    if (sessionLastActiveTimestampRef.current !== null) {
      const elapsed = (now - sessionLastActiveTimestampRef.current) / 1000;
      sessionAccumulatedSecondsRef.current += Math.max(0, elapsed);
      sessionLastActiveTimestampRef.current = null;
    }

    const durationSeconds = Math.round(sessionAccumulatedSecondsRef.current);

    // Regra: Não salvar sessões com menos de MIN_SESSION_SECONDS (5s)
    if (durationSeconds < MIN_SESSION_SECONDS) {
      return;
    }

    const startedAt = sessionStartedAtRef.current || now;
    const startProgress = sessionStartProgressRef.current ?? 0;
    const startCfi = sessionStartCfiRef.current;

    // Regra: endProgress e endCfi usam o último progresso e CFI válidos conhecidos pelo leitor
    const endProgress = pendingSaveRef.current?.progress ?? lastValidProgressRef.current ?? book.progressPercent ?? 0;
    const endCfi = pendingSaveRef.current?.cfi || currentCfiRef.current || book.epubLocationCfi || undefined;

    const session: ReadingSession = {
      id: 'session_' + startedAt + '_' + Math.random().toString(36).substring(2, 9),
      bookId: book.id,
      startedAt,
      endedAt: now,
      durationSeconds,
      startProgress: Math.max(0, Math.min(100, Math.round(startProgress))),
      endProgress: Math.max(0, Math.min(100, Math.round(endProgress))),
      ...(startCfi ? { startCfi } : {}),
      ...(endCfi ? { endCfi } : {}),
    };

    saveReadingSession(session).catch(err => {
      console.warn('Erro ao salvar sessão de leitura:', err);
    });
  }, [book.id, book.progressPercent, book.epubLocationCfi]);

  const handleBackToLibrary = useCallback(async () => {
    await flushPendingSave();
    endReadingSession();
    onBackToLibrary();
  }, [flushPendingSave, endReadingSession, onBackToLibrary]);

  const handleFallbackToDefaultReader = useCallback(async () => {
    await flushPendingSave();
    endReadingSession();
    onFallbackToDefaultReader();
  }, [flushPendingSave, endReadingSession, onFallbackToDefaultReader]);

  useEffect(() => {
    let isMounted = true;
    let viewElement: any = null;
    isRestoringRef.current = true;
    let restorationFailed = false;

    async function loadEpubWithFoliate() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        // 1. Recuperar o arquivo EPUB original (Blob) do IndexedDB
        let epubBlob = await getOriginalEpub(book.id);

        // Se não existir localmente mas o usuário estiver autenticado, tenta baixar da nuvem
        if (!epubBlob && auth.currentUser) {
          try {
            epubBlob = await downloadBookFileFromCloud(auth.currentUser.uid, book.id);
            if (epubBlob) {
              await saveOriginalEpub(book.id, epubBlob);
            }
          } catch (cloudErr) {
            console.warn('Tentativa de recuperar EPUB da nuvem falhou:', cloudErr);
          }
        }

        if (!epubBlob) {
          throw new Error('Arquivo original deste EPUB não foi encontrado no armazenamento local ou na nuvem.');
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

        // 3. Ouvir evento de mudança de posição (relocate)
        viewElement.addEventListener('relocate', (e: any) => {
          if (!isMounted) return;
          const detail = e.detail;
          if (!detail) return;

          // Protege o registro de posição: enquanto o livro estiver no processo inicial
          // de abertura e restauração (executando open e goTo), NÃO processa o relocate
          // transitório do layout inicial (seção 0) para não contaminar o CFI salvo.
          if (isRestoringRef.current) {
            return;
          }

          // Gera o CFI canônico de ponto a partir do início visível usando foliate-js/epubcfi.js
          const cfiResult = generateCfiFromRelocate(detail, viewElement);
          const locationCfi = cfiResult?.cfi || null;

          if (locationCfi) {
            currentCfiRef.current = locationCfi;
            setCurrentCfi(locationCfi);
          }

          // Diagnóstico temporário em ambiente de desenvolvimento
          if (import.meta.env.DEV) {
            console.log('[FOLIATE POSITION]', {
              'section index': detail.index,
              'fraction': detail.fraction,
              'range': detail.range,
              'generated CFI': locationCfi,
              'CFI é ponto ou range': cfiResult?.isPoint ? 'ponto (collapsed start)' : 'seção'
            });
          }

          // Atualizar título do capítulo/seção atual se disponível no TOC
          if (detail.tocItem && typeof detail.tocItem.label === 'string') {
            setCurrentSectionTitle(detail.tocItem.label.trim());
          }

          // Calcular progresso global do livro inteiro usando viewElement.book.sections (size e linear)
          const globalPercent = calculateGlobalProgress(detail, viewElement, lastValidProgressRef.current);
          lastValidProgressRef.current = globalPercent;
          setCurrentProgress(globalPercent);

          // Registra posição atual como candidata a salvar
          pendingSaveRef.current = { cfi: locationCfi, progress: globalPercent };

          // Se a restauração do CFI falhou e o usuário ainda não navegou,
          // NÃO grava a posição inicial de fallback sobre o CFI antigo
          if (restorationFailed && !hasUserNavigatedRef.current) {
            return;
          }

          // Salvar progresso com debounce de 400ms
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }

          saveTimeoutRef.current = setTimeout(() => {
            if (!isMounted) return;
            const cfiToSave = locationCfi || book.epubLocationCfi;
            // Preserva book.currentChapterIndex e book.currentParagraphIndex originais do AuraBooks
            updateBookProgress(
              book.id,
              book.currentChapterIndex,
              book.currentParagraphIndex,
              globalPercent,
              cfiToSave
            ).catch(err => {
              console.warn('Erro ao persistir progresso do EPUB no IndexedDB:', err);
            });

            // Atualiza o objeto em memória
            book.progressPercent = globalPercent;
            if (cfiToSave) {
              book.epubLocationCfi = cfiToSave;
            }
          }, 400);
        });

        // 4. Abrir o EPUB original através do Foliate.js
        await viewElement.open(epubBlob);

        // 5. Restaurar a posição salva usando viewElement.goTo(book.epubLocationCfi)
        const savedCfi = book.epubLocationCfi;

        if (savedCfi && typeof savedCfi === 'string' && savedCfi.trim().length > 0) {
          if (import.meta.env.DEV) {
            console.log('[FOLIATE RESTORE]', {
              'saved CFI': savedCfi
            });
          }

          try {
            await viewElement.goTo(savedCfi.trim());
            currentCfiRef.current = savedCfi.trim();
            pendingSaveRef.current = { cfi: savedCfi.trim(), progress: book.progressPercent ?? 0 };
          } catch (restoreErr) {
            restorationFailed = true;
            console.warn('Não foi possível restaurar a posição salva via CFI no Foliate.js. Abrindo no início:', restoreErr);
            try {
              await viewElement.goTo(0);
            } catch (fallbackErr) {
              try {
                await viewElement.next();
              } catch (nextErr) {
                console.warn('Falha na navegação inicial de fallback:', nextErr);
              }
            }
          }
        } else {
          // Sem posição salva: inicia na primeira posição disponível
          try {
            await viewElement.goTo(0);
          } catch {
            try {
              await viewElement.next();
            } catch (nextErr) {
              console.warn('Falha ao abrir início do livro:', nextErr);
            }
          }
        }

        // Restauração concluída: libera para que os eventos relocate do usuário sejam salvos
        isRestoringRef.current = false;

        if (isMounted) {
          setIsLoading(false);
          const initialProg = lastValidProgressRef.current ?? book.progressPercent ?? 0;
          const initialCfi = currentCfiRef.current || book.epubLocationCfi || undefined;
          startReadingSession(initialProg, initialCfi);
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

    // Pausar/retomar tempo ativo da sessão de leitura com base em document.visibilityState
    const handleVisibilityChange = () => {
      if (!sessionIsActiveRef.current || sessionEndedRef.current) return;
      const now = Date.now();
      if (document.visibilityState === 'hidden') {
        if (sessionLastActiveTimestampRef.current !== null) {
          const elapsed = (now - sessionLastActiveTimestampRef.current) / 1000;
          sessionAccumulatedSecondsRef.current += Math.max(0, elapsed);
          sessionLastActiveTimestampRef.current = null;
        }
      } else if (document.visibilityState === 'visible') {
        sessionLastActiveTimestampRef.current = now;
      }
    };

    // Listener para descarregar save e encerrar sessão caso a aba seja fechada
    const handleBeforeUnload = () => {
      flushPendingSave();
      endReadingSession();
    };

    const handlePageHide = () => {
      flushPendingSave();
      endReadingSession();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    // Cleanup: descarregar saves pendentes, encerrar sessão, remover timers e listeners ao desmontar
    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      flushPendingSave();
      endReadingSession();

      if (viewElement && typeof viewElement.close === 'function') {
        try {
          viewElement.close();
        } catch {
          // ignora
        }
      }
      if (viewRef.current) {
        viewRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [book.id, book.progressPercent, book.epubLocationCfi, flushPendingSave, startReadingSession, endReadingSession]);

  // Navegação entre páginas
  const handleNext = () => {
    hasUserNavigatedRef.current = true;
    if (viewRef.current && typeof viewRef.current.next === 'function') {
      viewRef.current.next();
    }
  };

  const handlePrev = () => {
    hasUserNavigatedRef.current = true;
    if (viewRef.current && typeof viewRef.current.prev === 'function') {
      viewRef.current.prev();
    }
  };

  // Suporte a teclas direcionais (setas do teclado)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        hasUserNavigatedRef.current = true;
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        hasUserNavigatedRef.current = true;
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
          onClick={handleBackToLibrary}
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

        {/* Botões de Ação do Cabeçalho */}
        <div className="flex items-center gap-2">
          {/* Botão Salvar onde parei */}
          <button
            onClick={handleManualSave}
            disabled={isLoading || errorMessage !== null || saveStatus === 'saving'}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 font-sans cursor-pointer shadow-xs ${
              saveStatus === 'saved'
                ? 'bg-emerald-100 border-emerald-400 text-emerald-950 font-semibold'
                : 'bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-950 font-semibold'
            }`}
            title="Salvar onde parei de ler (grava no banco de dados local e nuvem)"
          >
            {saveStatus === 'saving' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-amber-800 animate-spin" />
                <span className="font-semibold hidden sm:inline">Salvando...</span>
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-700 stroke-[2.5]" />
                <span className="font-bold text-emerald-800">Posição salva!</span>
              </>
            ) : (
              <>
                <Bookmark className="w-3.5 h-3.5 text-amber-800 fill-amber-700/20" />
                <span className="font-semibold">Salvar onde parei</span>
              </>
            )}
          </button>

          {/* Botão de Fallback para o Leitor Padrão */}
          <button
            onClick={handleFallbackToDefaultReader}
            className="inline-flex items-center gap-1.5 text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 px-2.5 py-1.5 rounded-lg border border-stone-200/80 transition-colors font-sans cursor-pointer shadow-2xs"
            title="Alternar para o Leitor Clássico do AuraBooks"
          >
            <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
            <span className="hidden md:inline font-medium">Leitor Clássico</span>
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
                onClick={handleFallbackToDefaultReader}
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
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            {/* Quick Save in Footer */}
            <button
              onClick={handleManualSave}
              disabled={isLoading || errorMessage !== null || saveStatus === 'saving'}
              className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition-colors cursor-pointer border ${
                saveStatus === 'saved'
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
                  : 'bg-stone-100 text-stone-700 hover:text-stone-950 border-stone-200 hover:bg-stone-200'
              }`}
              title="Salvar onde parei de ler"
            >
              {saveStatus === 'saved' ? (
                <>
                  <Check className="w-3 h-3 text-emerald-700" />
                  <span>Salvo!</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-3 h-3 text-amber-800" />
                  <span>Salvar posição</span>
                </>
              )}
            </button>
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
