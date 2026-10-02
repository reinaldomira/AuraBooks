import React from 'react';
import { BookOpen, Upload, Headphones, Sparkles, Volume2, Cloud, CloudCheck, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { useAudioReader } from '../context/AudioReaderContext';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  currentView: 'library' | 'reader' | 'guide';
  onNavigate: (view: 'library' | 'reader' | 'guide') => void;
  onOpenUpload: () => void;
  hasActiveBook: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  onOpenUpload,
  hasActiveBook,
}) => {
  const { isPlaying, testCurrentVoice } = useAudioReader();
  const { user, login, logout, isSyncing } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-stone-50/95 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('library')}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
          >
            <div className="w-9 h-9 rounded-lg bg-stone-900 text-amber-100 flex items-center justify-center shadow-sm group-hover:bg-amber-950 transition-colors">
              <Headphones className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <span className="font-display text-xl font-bold tracking-tight text-stone-900 block leading-tight">
                AuraBooks
              </span>
              <span className="text-[10px] uppercase tracking-widest text-stone-600 block">
                Leitor & Audiobook
              </span>
            </div>
          </button>
        </div>

        {/* Zone 2: Clean text navigation links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          <button
            onClick={() => onNavigate('library')}
            className={`transition-colors py-1 border-b-2 ${
              currentView === 'library'
                ? 'border-stone-900 text-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            Sua Biblioteca
          </button>

          {hasActiveBook && (
            <button
              onClick={() => onNavigate('reader')}
              className={`flex items-center gap-1.5 transition-colors py-1 border-b-2 ${
                currentView === 'reader'
                  ? 'border-stone-900 text-stone-900 font-semibold'
                  : 'border-transparent text-stone-500 hover:text-stone-900'
              }`}
            >
              <span>Leitor Aberto</span>
              {isPlaying && (
                <span className="flex items-center gap-0.5 ml-1">
                  <span className="w-1 h-3 bg-amber-600 rounded-full animate-wave-1" />
                  <span className="w-1 h-2 bg-amber-600 rounded-full animate-wave-2" />
                  <span className="w-1 h-4 bg-amber-600 rounded-full animate-wave-3" />
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => onNavigate('guide')}
            className={`transition-colors py-1 border-b-2 ${
              currentView === 'guide'
                ? 'border-stone-900 text-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            Formatos & Vozes
          </button>
        </nav>

        {/* Zone 3: Primary actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            onClick={testCurrentVoice}
            title="Testar a voz do sistema"
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors border border-stone-200"
          >
            <Volume2 className="w-3.5 h-3.5 text-stone-600" />
            <span>Testar Voz</span>
          </button>

          {/* Firebase Cloud Sync Button */}
          {user ? (
            <div className="flex items-center gap-1.5 bg-stone-100 border border-stone-200 py-1 px-2 rounded-lg text-xs text-stone-700">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Usuário'}
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <UserIcon className="w-4 h-4 text-stone-500" />
              )}
              <span className="hidden sm:inline font-medium max-w-[90px] truncate">
                {user.displayName?.split(' ')[0] || 'Conectado'}
              </span>
              <span title={isSyncing ? 'Sincronizando com Firestore...' : 'Nuvem Firestore Conectada'}>
                <Cloud className={`w-3.5 h-3.5 ${isSyncing ? 'text-amber-500 animate-pulse' : 'text-emerald-600'}`} />
              </span>
              <button
                onClick={logout}
                title="Desconectar do Firebase"
                className="text-stone-400 hover:text-rose-600 ml-1 p-0.5"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              title="Entrar com o Google para salvar sua estante e progresso na nuvem Firebase"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg border border-stone-200 transition-colors"
            >
              <Cloud className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Nuvem Google</span>
            </button>
          )}

          <button
            onClick={onOpenUpload}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-stone-900 rounded-lg hover:bg-stone-800 active:scale-[0.98] transition-all shadow-sm whitespace-nowrap"
          >
            <Upload className="w-4 h-4 text-amber-300" />
            <span>Carregar Livro</span>
          </button>
        </div>
      </div>
    </header>
  );
};

