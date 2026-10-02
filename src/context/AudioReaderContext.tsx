import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Book, AudioSettings } from '../types/book';
import { ttsService, TTSVoiceOption } from '../services/ttsService';
import { updateBookProgress, getAudioSettings, saveAudioSettings } from '../services/storageService';

interface AudioReaderContextType {
  currentBook: Book | null;
  chapterIndex: number;
  paragraphIndex: number;
  isPlaying: boolean;
  isPaused: boolean;
  audioSettings: AudioSettings;
  voices: TTSVoiceOption[];
  sleepTimerRemainingSec: number | null;
  loadBook: (book: Book) => void;
  updatePosition: (chapterIdx: number, paragraphIdx: number) => void;
  playBook: (book: Book, startChap?: number, startPara?: number) => void;
  pauseAudio: () => void;
  resumeAudio: () => void;
  togglePlayPause: () => void;
  stopAudio: () => void;
  nextParagraph: () => void;
  previousParagraph: () => void;
  jumpToParagraph: (index: number) => void;
  jumpToChapter: (index: number) => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
  setVoice: (uri: string) => void;
  setVolume: (vol: number) => void;
  setSleepTimer: (minutes: number | null) => void;
  testCurrentVoice: () => void;
}

const AudioReaderContext = createContext<AudioReaderContextType | null>(null);

export const AudioReaderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [chapterIndex, setChapterIndex] = useState<number>(0);
  const [paragraphIndex, setParagraphIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [voices, setVoices] = useState<TTSVoiceOption[]>([]);
  const [audioSettings, setAudioSettingsState] = useState<AudioSettings>({
    voiceURI: null,
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    sleepTimerMinutes: null,
    sleepTimerEndsAt: null
  });
  const [sleepTimerRemainingSec, setSleepTimerRemainingSec] = useState<number | null>(null);

  // References for playback loop
  const isPlayingRef = useRef<boolean>(false);
  isPlayingRef.current = isPlaying;
  const isPausedRef = useRef<boolean>(false);
  isPausedRef.current = isPaused;
  const bookRef = useRef<Book | null>(null);
  bookRef.current = currentBook;
  const chapIndexRef = useRef<number>(0);
  chapIndexRef.current = chapterIndex;
  const paraIndexRef = useRef<number>(0);
  paraIndexRef.current = paragraphIndex;
  const settingsRef = useRef<AudioSettings>(audioSettings);
  settingsRef.current = audioSettings;

  // Load saved audio settings and subscribe to TTS voices
  useEffect(() => {
    getAudioSettings().then(saved => {
      setAudioSettingsState(saved);
      settingsRef.current = saved;
    });

    const unsubscribe = ttsService.subscribeVoices((availableVoices) => {
      setVoices(availableVoices);
      // If voice not selected, select best default
      setAudioSettingsState(prev => {
        if (!prev.voiceURI) {
          const best = ttsService.getBestDefaultVoice();
          if (best) {
            const next = { ...prev, voiceURI: best.voiceURI };
            saveAudioSettings(next);
            return next;
          }
        }
        return prev;
      });
    });

    return () => {
      unsubscribe();
      ttsService.stop();
    };
  }, []);

  // Sleep timer ticker
  useEffect(() => {
    if (!audioSettings.sleepTimerEndsAt) {
      setSleepTimerRemainingSec(null);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.round((audioSettings.sleepTimerEndsAt! - now) / 1000));
      setSleepTimerRemainingSec(diff);

      if (diff <= 0) {
        // Sleep timer reached!
        ttsService.stop();
        setIsPlaying(false);
        setIsPaused(false);
        setAudioSettingsState(prev => {
          const next = { ...prev, sleepTimerMinutes: null, sleepTimerEndsAt: null };
          saveAudioSettings(next);
          return next;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [audioSettings.sleepTimerEndsAt]);

  // Read current paragraph
  const readCurrentParagraph = useCallback(() => {
    const book = bookRef.current;
    if (!book) return;

    const chap = book.chapters[chapIndexRef.current];
    if (!chap || !chap.paragraphs || chap.paragraphs.length === 0) {
      setIsPlaying(false);
      return;
    }

    const currentParaText = chap.paragraphs[paraIndexRef.current];
    if (!currentParaText) {
      // Reached end of chapter
      if (settingsRef.current.sleepTimerMinutes === -1) {
        // End of chapter sleep timer
        ttsService.stop();
        setIsPlaying(false);
        setIsPaused(false);
        setAudioSettingsState(prev => ({ ...prev, sleepTimerMinutes: null, sleepTimerEndsAt: null }));
        return;
      }

      if (chapIndexRef.current + 1 < book.chapters.length) {
        // Advance to next chapter
        const nextChap = chapIndexRef.current + 1;
        setChapterIndex(nextChap);
        chapIndexRef.current = nextChap;
        setParagraphIndex(0);
        paraIndexRef.current = 0;
        updateBookProgress(book.id, nextChap, 0);
        setTimeout(() => readCurrentParagraph(), 500);
      } else {
        // Finished book!
        setIsPlaying(false);
        setIsPaused(false);
        ttsService.stop();
        updateBookProgress(book.id, chapIndexRef.current, chap.paragraphs.length - 1, 100);
      }
      return;
    }

    // Speak this paragraph
    ttsService.speakParagraph(
      currentParaText,
      settingsRef.current,
      undefined,
      // onEnd
      () => {
        if (!isPlayingRef.current || isPausedRef.current) return;

        const nextPara = paraIndexRef.current + 1;
        if (nextPara < chap.paragraphs.length) {
          setParagraphIndex(nextPara);
          paraIndexRef.current = nextPara;
          updateBookProgress(book.id, chapIndexRef.current, nextPara);
          // Brief breathing room between paragraphs (200ms)
          setTimeout(() => {
            if (isPlayingRef.current && !isPausedRef.current) {
              readCurrentParagraph();
            }
          }, 250);
        } else {
          // Check sleep timer 'end of chapter'
          if (settingsRef.current.sleepTimerMinutes === -1) {
            ttsService.stop();
            setIsPlaying(false);
            setIsPaused(false);
            setAudioSettingsState(prev => ({ ...prev, sleepTimerMinutes: null, sleepTimerEndsAt: null }));
            return;
          }

          // Advance to next chapter
          if (chapIndexRef.current + 1 < book.chapters.length) {
            const nextChap = chapIndexRef.current + 1;
            setChapterIndex(nextChap);
            chapIndexRef.current = nextChap;
            setParagraphIndex(0);
            paraIndexRef.current = 0;
            updateBookProgress(book.id, nextChap, 0);
            setTimeout(() => {
              if (isPlayingRef.current && !isPausedRef.current) {
                readCurrentParagraph();
              }
            }, 600);
          } else {
            // Book completed
            setIsPlaying(false);
            setIsPaused(false);
            updateBookProgress(book.id, chapIndexRef.current, chap.paragraphs.length - 1, 100);
          }
        }
      },
      // onError
      (err) => {
        console.warn('Speech error:', err);
      }
    );
  }, []);

  const loadBook = useCallback((book: Book) => {
    // If different book, stop any current speech
    if (bookRef.current?.id !== book.id) {
      ttsService.stop();
      setIsPlaying(false);
      isPlayingRef.current = false;
      setIsPaused(false);
      isPausedRef.current = false;
    }

    const cIdx = Math.max(0, Math.min(book.chapters.length - 1, book.currentChapterIndex || 0));
    const chap = book.chapters[cIdx];
    const maxParas = chap ? Math.max(0, chap.paragraphs.length - 1) : 0;
    const pIdx = Math.max(0, Math.min(maxParas, book.currentParagraphIndex || 0));

    setCurrentBook(book);
    bookRef.current = book;
    setChapterIndex(cIdx);
    chapIndexRef.current = cIdx;
    setParagraphIndex(pIdx);
    paraIndexRef.current = pIdx;
  }, []);

  const updatePosition = useCallback((cIdx: number, pIdx: number) => {
    const book = bookRef.current;
    if (!book) return;

    setChapterIndex(cIdx);
    chapIndexRef.current = cIdx;
    setParagraphIndex(pIdx);
    paraIndexRef.current = pIdx;
    updateBookProgress(book.id, cIdx, pIdx);
  }, []);

  const playBook = useCallback((book: Book, startChap?: number, startPara?: number) => {
    const cIdx = startChap !== undefined ? startChap : (book.currentChapterIndex || 0);
    const pIdx = startPara !== undefined ? startPara : (book.currentParagraphIndex || 0);

    setCurrentBook(book);
    bookRef.current = book;
    setChapterIndex(cIdx);
    chapIndexRef.current = cIdx;
    setParagraphIndex(pIdx);
    paraIndexRef.current = pIdx;
    setIsPlaying(true);
    isPlayingRef.current = true;
    setIsPaused(false);
    isPausedRef.current = false;

    updateBookProgress(book.id, cIdx, pIdx);
    setTimeout(() => {
      readCurrentParagraph();
    }, 100);
  }, [readCurrentParagraph]);

  const pauseAudio = useCallback(() => {
    ttsService.pause();
    setIsPaused(true);
    isPausedRef.current = true;
  }, []);

  const resumeAudio = useCallback(() => {
    if (isPaused) {
      ttsService.resume();
      setIsPaused(false);
      isPausedRef.current = false;
    } else {
      setIsPlaying(true);
      isPlayingRef.current = true;
      readCurrentParagraph();
    }
  }, [isPaused, readCurrentParagraph]);

  const togglePlayPause = useCallback(() => {
    if (!isPlaying) {
      if (currentBook) {
        setIsPlaying(true);
        isPlayingRef.current = true;
        readCurrentParagraph();
      }
    } else if (isPaused) {
      resumeAudio();
    } else {
      pauseAudio();
    }
  }, [isPlaying, isPaused, currentBook, pauseAudio, resumeAudio, readCurrentParagraph]);

  const stopAudio = useCallback(() => {
    ttsService.stop();
    setIsPlaying(false);
    isPlayingRef.current = false;
    setIsPaused(false);
    isPausedRef.current = false;
  }, []);

  const nextParagraph = useCallback(() => {
    if (!currentBook) return;
    const chap = currentBook.chapters[chapIndexRef.current];
    if (!chap) return;

    if (paraIndexRef.current + 1 < chap.paragraphs.length) {
      const nextP = paraIndexRef.current + 1;
      setParagraphIndex(nextP);
      paraIndexRef.current = nextP;
      updateBookProgress(currentBook.id, chapIndexRef.current, nextP);
      if (isPlayingRef.current && !isPausedRef.current) {
        readCurrentParagraph();
      }
    } else if (chapIndexRef.current + 1 < currentBook.chapters.length) {
      const nextC = chapIndexRef.current + 1;
      setChapterIndex(nextC);
      chapIndexRef.current = nextC;
      setParagraphIndex(0);
      paraIndexRef.current = 0;
      updateBookProgress(currentBook.id, nextC, 0);
      if (isPlayingRef.current && !isPausedRef.current) {
        readCurrentParagraph();
      }
    }
  }, [currentBook, readCurrentParagraph]);

  const previousParagraph = useCallback(() => {
    if (!currentBook) return;

    if (paraIndexRef.current > 0) {
      const prevP = paraIndexRef.current - 1;
      setParagraphIndex(prevP);
      paraIndexRef.current = prevP;
      updateBookProgress(currentBook.id, chapIndexRef.current, prevP);
      if (isPlayingRef.current && !isPausedRef.current) {
        readCurrentParagraph();
      }
    } else if (chapIndexRef.current > 0) {
      const prevC = chapIndexRef.current - 1;
      const prevChap = currentBook.chapters[prevC];
      const lastP = prevChap ? Math.max(0, prevChap.paragraphs.length - 1) : 0;
      setChapterIndex(prevC);
      chapIndexRef.current = prevC;
      setParagraphIndex(lastP);
      paraIndexRef.current = lastP;
      updateBookProgress(currentBook.id, prevC, lastP);
      if (isPlayingRef.current && !isPausedRef.current) {
        readCurrentParagraph();
      }
    }
  }, [currentBook, readCurrentParagraph]);

  const jumpToParagraph = useCallback((targetParaIdx: number) => {
    if (!currentBook) return;
    setParagraphIndex(targetParaIdx);
    paraIndexRef.current = targetParaIdx;
    updateBookProgress(currentBook.id, chapIndexRef.current, targetParaIdx);

    // If already playing, immediately speak from this paragraph
    if (isPlayingRef.current && !isPausedRef.current) {
      readCurrentParagraph();
    } else {
      // Auto-start playback on click
      setIsPlaying(true);
      isPlayingRef.current = true;
      setIsPaused(false);
      isPausedRef.current = false;
      readCurrentParagraph();
    }
  }, [currentBook, readCurrentParagraph]);

  const jumpToChapter = useCallback((targetChapIdx: number) => {
    if (!currentBook) return;
    setChapterIndex(targetChapIdx);
    chapIndexRef.current = targetChapIdx;
    setParagraphIndex(0);
    paraIndexRef.current = 0;
    updateBookProgress(currentBook.id, targetChapIdx, 0);

    if (isPlayingRef.current && !isPausedRef.current) {
      readCurrentParagraph();
    }
  }, [currentBook, readCurrentParagraph]);

  const setRate = useCallback((rate: number) => {
    const clamped = Math.max(0.5, Math.min(2.5, Number(rate.toFixed(2))));
    setAudioSettingsState(prev => {
      const next = { ...prev, rate: clamped };
      saveAudioSettings(next);
      return next;
    });
    // Restart current paragraph with new speed if actively playing
    if (isPlayingRef.current && !isPausedRef.current) {
      readCurrentParagraph();
    }
  }, [readCurrentParagraph]);

  const setPitch = useCallback((pitch: number) => {
    const clamped = Math.max(0.6, Math.min(1.4, Number(pitch.toFixed(2))));
    setAudioSettingsState(prev => {
      const next = { ...prev, pitch: clamped };
      saveAudioSettings(next);
      return next;
    });
    if (isPlayingRef.current && !isPausedRef.current) {
      readCurrentParagraph();
    }
  }, [readCurrentParagraph]);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1.0, vol));
    setAudioSettingsState(prev => {
      const next = { ...prev, volume: clamped };
      saveAudioSettings(next);
      return next;
    });
  }, []);

  const setVoice = useCallback((uri: string) => {
    setAudioSettingsState(prev => {
      const next = { ...prev, voiceURI: uri };
      saveAudioSettings(next);
      return next;
    });
    if (isPlayingRef.current && !isPausedRef.current) {
      readCurrentParagraph();
    }
  }, [readCurrentParagraph]);

  const setSleepTimer = useCallback((minutes: number | null) => {
    let endsAt: number | null = null;
    if (minutes && minutes > 0) {
      endsAt = Date.now() + minutes * 60 * 1000;
    }
    setAudioSettingsState(prev => {
      const next = { ...prev, sleepTimerMinutes: minutes, sleepTimerEndsAt: endsAt };
      saveAudioSettings(next);
      return next;
    });
  }, []);

  const testCurrentVoice = useCallback(() => {
    const voice = ttsService.findVoiceByURI(audioSettings.voiceURI);
    if (voice) {
      ttsService.testVoice(voice, audioSettings.rate, audioSettings.pitch);
    }
  }, [audioSettings.voiceURI, audioSettings.rate, audioSettings.pitch]);

  return (
    <AudioReaderContext.Provider
      value={{
        currentBook,
        chapterIndex,
        paragraphIndex,
        isPlaying,
        isPaused,
        audioSettings,
        voices,
        sleepTimerRemainingSec,
        loadBook,
        updatePosition,
        playBook,
        pauseAudio,
        resumeAudio,
        togglePlayPause,
        stopAudio,
        nextParagraph,
        previousParagraph,
        jumpToParagraph,
        jumpToChapter,
        setRate,
        setPitch,
        setVoice,
        setVolume,
        setSleepTimer,
        testCurrentVoice
      }}
    >
      {children}
    </AudioReaderContext.Provider>
  );
};

export const useAudioReader = () => {
  const context = useContext(AudioReaderContext);
  if (!context) {
    throw new Error('useAudioReader must be used within an AudioReaderProvider');
  }
  return context;
};
