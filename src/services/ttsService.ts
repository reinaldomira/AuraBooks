import { AudioSettings } from '../types/book';

export interface TTSVoiceOption {
  voice: SpeechSynthesisVoice;
  name: string;
  lang: string;
  isPortuguese: boolean;
  isDefault: boolean;
}

class TTSService {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private onVoicesChangedCallbacks: Array<(voices: TTSVoiceOption[]) => void> = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
    const formatted = this.getVoiceOptions();
    this.onVoicesChangedCallbacks.forEach(cb => cb(formatted));
  }

  public subscribeVoices(cb: (voices: TTSVoiceOption[]) => void): () => void {
    this.onVoicesChangedCallbacks.push(cb);
    if (this.voices.length > 0) {
      cb(this.getVoiceOptions());
    } else {
      this.loadVoices();
    }
    return () => {
      this.onVoicesChangedCallbacks = this.onVoicesChangedCallbacks.filter(c => c !== cb);
    };
  }

  public getVoiceOptions(): TTSVoiceOption[] {
    if (!this.synth) return [];
    const list = this.synth.getVoices();
    return list.map(v => ({
      voice: v,
      name: v.name,
      lang: v.lang,
      isPortuguese: v.lang.toLowerCase().startsWith('pt'),
      isDefault: v.default
    }));
  }

  public getBestDefaultVoice(): SpeechSynthesisVoice | null {
    if (!this.synth) return null;
    const voices = this.synth.getVoices();
    // 1. Try pt-BR
    const ptBr = voices.find(v => v.lang === 'pt-BR' || v.lang.toLowerCase().includes('pt-br'));
    if (ptBr) return ptBr;
    // 2. Try any Portuguese
    const anyPt = voices.find(v => v.lang.toLowerCase().startsWith('pt'));
    if (anyPt) return anyPt;
    // 3. System default or first
    const def = voices.find(v => v.default);
    return def || voices[0] || null;
  }

  public findVoiceByURI(uri: string | null): SpeechSynthesisVoice | null {
    if (!uri || !this.synth) return this.getBestDefaultVoice();
    const voices = this.synth.getVoices();
    return voices.find(v => v.voiceURI === uri) || this.getBestDefaultVoice();
  }

  public testVoice(voice: SpeechSynthesisVoice, rate: number = 1.0, pitch: number = 1.0) {
    if (!this.synth) return;
    this.stop();
    const text = voice.lang.toLowerCase().startsWith('pt')
      ? 'Olá! Esta é uma demonstração de voz para a leitura dos seus livros.'
      : 'Hello! This is a voice preview for reading your books.';
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.rate = rate;
    utterance.pitch = pitch;
    this.synth.speak(utterance);
  }

  public stop() {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  public pause() {
    if (this.synth && this.synth.speaking) {
      this.synth.pause();
    }
  }

  public resume() {
    if (this.synth && this.synth.paused) {
      this.synth.resume();
    }
  }

  public speakParagraph(
    text: string,
    settings: AudioSettings,
    onBoundary?: (charIndex: number) => void,
    onEnd?: () => void,
    onError?: (err: any) => void
  ): SpeechSynthesisUtterance | null {
    if (!this.synth) return null;
    this.synth.cancel();

    // Clean text for speech synthesis (avoid weird symbols)
    const clean = text.replace(/[*_#~`]/g, '').trim();
    if (!clean) {
      onEnd?.();
      return null;
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    const voice = this.findVoiceByURI(settings.voiceURI);
    if (voice) {
      utterance.voice = voice;
    }
    utterance.rate = Math.max(0.5, Math.min(2.5, settings.rate));
    utterance.pitch = Math.max(0.6, Math.min(1.4, settings.pitch));
    utterance.volume = Math.max(0, Math.min(1.0, settings.volume));

    if (onBoundary) {
      utterance.onboundary = (event) => {
        if (event.name === 'word' || event.name === 'sentence') {
          onBoundary(event.charIndex);
        }
      };
    }

    utterance.onend = () => {
      onEnd?.();
    };

    utterance.onerror = (e) => {
      // 'interrupted' is normal when user skips or pauses
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn('SpeechSynthesis error:', e);
        onError?.(e);
      }
    };

    this.synth.speak(utterance);
    return utterance;
  }
}

export const ttsService = new TTSService();
