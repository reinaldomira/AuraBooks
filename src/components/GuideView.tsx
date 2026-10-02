import React from 'react';
import { 
  BookOpen, Mic, Gauge, FileText, CheckCircle2, 
  Sparkles, Headphones, Layers, HelpCircle, ArrowRight
} from 'lucide-react';
import { useAudioReader } from '../context/AudioReaderContext';

interface GuideViewProps {
  onOpenUpload: () => void;
  onGoToLibrary: () => void;
}

export const GuideView: React.FC<GuideViewProps> = ({ onOpenUpload, onGoToLibrary }) => {
  const { voices, testCurrentVoice } = useAudioReader();
  const ptVoices = voices.filter(v => v.isPortuguese);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Title */}
      <div className="text-center space-y-3">
        <span className="text-xs uppercase tracking-widest text-stone-600 font-semibold block">
          Guia & Recursos
        </span>
        <h1 className="font-editorial-title text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-stone-900">
          Como Funciona o AuraBooks
        </h1>
        <p className="text-stone-600 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
          Entenda como seus arquivos EPUB e PDF são organizados e como a leitura por voz inteligente transforma qualquer texto em audiolivro.
        </p>
      </div>

      {/* 3 Core Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-2xl border border-stone-200 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="font-editorial-title text-lg font-semibold text-stone-900">
            1. Organização Automática
          </h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Ao carregar um <strong>EPUB</strong> ou <strong>PDF</strong>, o sistema lê metadados, divide o livro em capítulos reais, detecta o título e autor, e gera uma capa em alta resolução.
          </p>
        </div>

        <div className="p-6 bg-white rounded-2xl border border-stone-200 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-stone-900 text-amber-300 flex items-center justify-center">
            <Mic className="w-5 h-5" />
          </div>
          <h3 className="font-editorial-title text-lg font-semibold text-stone-900">
            2. Leitura em Áudio (TTS)
          </h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Utiliza a tecnologia de síntese de voz nativa com zero latência. Não consome franquia de dados e permite sincronia parágrafo por parágrafo com destaque visual.
          </p>
        </div>

        <div className="p-6 bg-white rounded-2xl border border-stone-200 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-900 flex items-center justify-center">
            <Gauge className="w-5 h-5" />
          </div>
          <h3 className="font-editorial-title text-lg font-semibold text-stone-900">
            3. Controle Total de Ritmo
          </h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Ajuste a velocidade de 0.5x até 2.5x com presets rápidos, mude o tom (grave ou agudo), selecione vozes femininas ou masculinas e use o timer de desligamento automático.
          </p>
        </div>
      </div>

      {/* Voice Status & Tips */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
          <div>
            <h3 className="font-editorial-title text-xl font-bold text-stone-900">
              Vozes Disponíveis no seu Navegador
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {voices.length} vozes detectadas ({ptVoices.length} em Português)
            </p>
          </div>
          <button
            onClick={testCurrentVoice}
            className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-lg hover:bg-stone-800 transition-colors shrink-0 shadow-sm"
          >
            <Headphones className="w-3.5 h-3.5 text-amber-300" />
            <span>Testar Voz Selecionada</span>
          </button>
        </div>

        {/* List of Portuguese Voices */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-600">
            Vozes Recomendadas em Português:
          </h4>
          {ptVoices.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ptVoices.map(v => (
                <div
                  key={v.voice.voiceURI}
                  className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-stone-900 block">{v.name}</span>
                    <span className="text-stone-500 text-[11px]">{v.lang} {v.isDefault ? '· Padrão do Sistema' : ''}</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    Disponível
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
              Nenhuma voz nativa em português detectada no momento. O navegador usará a melhor voz padrão instalada no seu sistema operacional.
            </div>
          )}
        </div>

        {/* Formats Comparison */}
        <div className="space-y-3 pt-4 border-t border-stone-100">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-600">
            Formatos Recomendados:
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-1">
              <span className="font-semibold text-stone-900 text-sm flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Arquivos EPUB (Melhor escolha)
              </span>
              <p className="text-xs text-stone-600">
                O formato EPUB é o padrão ouro de e-books. Contém metadados completos de capítulos, capas originais e texto fluido perfeito para síntese de áudio.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-1">
              <span className="font-semibold text-stone-900 text-sm flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Arquivos PDF (Digital / Texto)
              </span>
              <p className="text-xs text-stone-600">
                Funciona muito bem com PDFs que contêm texto selecionável. A primeira página é automaticamente renderizada como a capa do livro na sua estante.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-end">
          <button
            onClick={onGoToLibrary}
            className="px-5 py-2.5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg transition-colors"
          >
            Ver Minha Estante
          </button>
          <button
            onClick={onOpenUpload}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white rounded-lg shadow-sm transition-colors"
          >
            <span>Carregar Novo Livro</span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-300" />
          </button>
        </div>
      </div>
    </div>
  );
};
