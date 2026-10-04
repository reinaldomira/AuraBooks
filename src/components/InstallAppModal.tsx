import React, { useState } from 'react';
import { 
  Smartphone, Download, Check, X, ExternalLink, 
  Sparkles, Cloud, ShieldCheck, RefreshCw, Copy 
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  if (!isOpen) return null;

  const appUrl = window.location.origin;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleTriggerInstall = async () => {
    setIsInstalling(true);
    const success = await install();
    setIsInstalling(false);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-[#FDFBF7] w-full max-w-lg rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-br from-stone-900 via-stone-850 to-stone-950 text-white relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-stone-300 hover:text-white transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center p-1.5 shadow-inner">
              <img src="/pwa-192x192.png" alt="AuraBooks" className="w-full h-full object-contain rounded-lg" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif-display font-bold text-lg text-white">Instalar no Celular</h3>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  APK &amp; PWA
                </span>
              </div>
              <p className="text-xs text-stone-300">Sincronização contínua com a versão Web</p>
            </div>
          </div>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto space-y-6 text-stone-800 text-xs sm:text-sm">
          {/* Card de sincronização */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-3">
            <Cloud className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-950 text-xs sm:text-sm mb-0.5">Sincronização 100% Automática</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Ao fazer login com a mesma conta Google no computador e no celular, seus <strong>livros, progresso de leitura, páginas salvas, audiolivros e anotações</strong> ficam sincronizados instantaneamente em tempo real.
              </p>
            </div>
          </div>

          {/* Opção 1: Instalação Rápida Direta */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Opção 1 — Instalação Direta (Mais Rápida)
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Recomendado
              </span>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Abra este app no navegador do seu celular (Google Chrome no Android ou Safari no iOS). O app é instalado como um aplicativo nativo (tela cheia, offline, sem barra de navegação).
            </p>

            {isInstallable && (
              <button
                onClick={handleTriggerInstall}
                disabled={isInstalling}
                className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <Download className="w-4 h-4" />
                <span>{isInstalling ? 'Instalando...' : 'Instalar Agora no Celular'}</span>
              </button>
            )}

            {isInstalled && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-center gap-2 text-xs font-medium">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>O aplicativo já está instalado no seu dispositivo!</span>
              </div>
            )}

            {/* URL para abrir no celular */}
            <div className="p-3 bg-stone-100 rounded-xl border border-stone-200 flex items-center justify-between gap-2">
              <div className="truncate">
                <span className="text-[10px] text-stone-500 font-bold block uppercase tracking-wider">Link para abrir no celular:</span>
                <span className="font-mono text-xs text-stone-800 select-all truncate block">{appUrl}</span>
              </div>
              <button
                onClick={handleCopyUrl}
                className="shrink-0 px-3 py-1.5 bg-white hover:bg-stone-200 border border-stone-300 rounded-lg text-xs font-medium text-stone-700 transition-colors flex items-center gap-1 cursor-pointer"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Opção 2: Gerar o arquivo .APK Oficial para Android */}
          <div className="space-y-3 pt-4 border-t border-stone-200">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block">
              Opção 2 — Gerar Arquivo .APK (Android Package)
            </span>
            <p className="text-xs text-stone-600 leading-relaxed">
              O AuraBooks já está configurado com os padrões do Google (PWA, Service Worker, Manifest e Ícones Maskable). Você pode transformar o link em um pacote <strong>.APK instalável</strong> em 1 minuto usando a ferramenta oficial <strong>PWABuilder</strong>:
            </p>

            <ol className="text-xs text-stone-700 space-y-1.5 list-decimal list-inside bg-stone-50 p-3 rounded-xl border border-stone-200">
              <li>Acesse <strong className="font-medium">pwabuilder.com</strong> no seu navegador.</li>
              <li>Cole a URL deste app e clique em <strong className="font-medium">Start</strong>.</li>
              <li>Clique em <strong className="font-medium">Package for Stores</strong> &gt; <strong className="font-medium">Android</strong>.</li>
              <li>Baixe o pacote com o seu <strong>.apk</strong> e instale no celular!</li>
            </ol>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <a
                href={`https://www.pwabuilder.com?url=${encodeURIComponent(appUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
              >
                <span>Abrir PWABuilder</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <a
                href="/pwa-512x512.png"
                download="pwa-512x512.png"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg text-xs font-medium text-stone-700 transition-colors"
                title="Baixar ícone para enviar no PWABuilder se solicitado"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Ícone 512px (PNG)</span>
              </a>

              <button
                onClick={handleCopyUrl}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg text-xs font-medium text-stone-700 transition-colors cursor-pointer"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Link Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-stone-100 border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Entendi, fechar
          </button>
        </div>
      </div>
    </div>
  );
};
