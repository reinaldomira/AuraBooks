export interface Chapter {
  id: string;
  title: string;
  paragraphs: string[];
  wordCount: number;
  pageNumber?: number;
}

export type HighlightColor = 'yellow' | 'green' | 'purple' | 'rose' | 'blue';

export interface BookHighlight {
  id: string;
  bookId: string;
  chapterIndex: number;
  chapterTitle?: string;
  paragraphIndex: number;
  color: HighlightColor;
  text: string;
  note?: string;
  createdAt: number;
  pageNumber?: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  format: 'epub' | 'pdf' | 'txt';
  coverUrl: string;
  chapters: Chapter[];
  totalWords: number;
  estimatedReadingMinutes: number;
  estimatedAudioMinutes: number;
  category: string;
  tags?: string[];
  progressPercent: number;
  currentChapterIndex: number;
  currentParagraphIndex: number;
  lastReadAt: number;
  isFavorite: boolean;
  fileSize: number;
  addedAt: number;
  description?: string;
  language?: string;
  epubLocationCfi?: string;
}

export type ReaderTheme = 'alabaster' | 'sepia' | 'dark' | 'mint';
export type ReaderFontFamily = 'serif' | 'sans' | 'mono';
export type ReaderLineHeight = 'normal' | 'relaxed' | 'loose';
export type ReaderColumnWidth = 'narrow' | 'medium' | 'wide';

export interface ReaderSettings {
  theme: ReaderTheme;
  fontSize: number; // 14 to 28 px
  fontFamily: ReaderFontFamily;
  lineHeight: ReaderLineHeight;
  columnWidth: ReaderColumnWidth;
  autoScrollAudio: boolean;
}

export interface AudioSettings {
  voiceURI: string | null;
  rate: number; // 0.5 to 2.5
  pitch: number; // 0.7 to 1.3
  volume: number; // 0.1 to 1.0
  sleepTimerMinutes: number | null; // minutes or null, or -1 for 'end of chapter'
  sleepTimerEndsAt: number | null;
}

export interface Bookmark {
  id: string;
  bookId: string;
  chapterIndex: number;
  paragraphIndex: number;
  textSnippet: string;
  createdAt: number;
  note?: string;
}
