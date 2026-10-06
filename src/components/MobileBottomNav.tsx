import React from 'react';
import { Layers, Compass, BookOpenText, Plus, Cloud, User as UserIcon, Headphones } from 'lucide-react';
import { AppView } from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { useAudioReader } from '../context/AudioReaderContext';

interface MobileBottomNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenUpload: () => void;
  onOpenAuthModal?: () => void;
  hasActiveBook: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate,
  onOpenUpload,
  onOpenAuthModal,
  hasActiveBook,
}) => {
  const { user, isSyncing } = useAuth();
  const { isPlaying, isPaused } = useAudioReader();

  return (
    <nav 
      aria-label="Navegação móvel"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FAF9F5]/95 backdrop-blur-md border-t border-[#E8E2D9] shadow-lg px-2 pb-[env(safe-area-inset-bottom,8px)] pt-1"
    >
      <div className="grid grid-cols-5 items-center h-14 max-w-md mx-auto">
        {/* Tab 1: Biblioteca */}
        <button
          onClick={() => onNavigate('library')}
          className={`flex flex-col items-center justify-center py-1 transition-all active:scale-95 cursor-pointer ${
            currentView === 'library'
              ? 'text-stone-950 font-semibold'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <div className="relative">
            <Layers className={`w-5 h-5 ${currentView === 'library' ? 'stroke-[2.3]' : 'stroke-[1.8]'}`} />
            {currentView === 'library' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#9A3412] rounded-full" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1">Estante</span>
        </button>

        {/* Tab 2: Explorar */}
        <button
          onClick={() => onNavigate('explore')}
          className={`flex flex-col items-center justify-center py-1 transition-all active:scale-95 cursor-pointer ${
            currentView === 'explore'
              ? 'text-stone-950 font-semibold'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <div className="relative">
            <Compass className={`w-5 h-5 ${currentView === 'explore' ? 'stroke-[2.3]' : 'stroke-[1.8]'}`} />
            {currentView === 'explore' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#9A3412] rounded-full" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1">Explorar</span>
        </button>

        {/* Tab 3: Botão Central de Adicionar Livro (+) */}
        <button
          onClick={onOpenUpload}
          className="flex flex-col items-center justify-center py-0.5 active:scale-90 transition-transform cursor-pointer group"
          aria-label="Adicionar novo livro"
        >
          <div className="w-10 h-10 rounded-full bg-stone-900 text-stone-100 flex items-center justify-center shadow-md group-hover:bg-amber-950 transition-colors">
            <Plus className="w-5 h-5 text-amber-300 stroke-[2.2]" />
          </div>
          <span className="text-[9px] text-stone-700 font-medium tracking-tight mt-0.5">Novo Livro</span>
        </button>

        {/* Tab 4: Leitor Imersivo */}
        <button
          onClick={() => onNavigate('reader')}
          disabled={!hasActiveBook}
          className={`flex flex-col items-center justify-center py-1 transition-all active:scale-95 cursor-pointer relative ${
            !hasActiveBook 
              ? 'opacity-40 cursor-not-allowed text-stone-400' 
              : currentView === 'reader'
                ? 'text-stone-950 font-semibold'
                : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <div className="relative">
            {isPlaying && !isPaused ? (
              <div className="flex items-center gap-0.5 h-5">
                <span className="w-0.5 h-3 bg-amber-600 rounded-full animate-wave-1" />
                <span className="w-0.5 h-4 bg-amber-600 rounded-full animate-wave-2" />
                <span className="w-0.5 h-2 bg-amber-600 rounded-full animate-wave-3" />
              </div>
            ) : (
              <BookOpenText className={`w-5 h-5 ${currentView === 'reader' ? 'stroke-[2.3]' : 'stroke-[1.8]'}`} />
            )}
            {currentView === 'reader' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#9A3412] rounded-full" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1">Leitor</span>
        </button>

        {/* Tab 5: Conta / Nuvem */}
        <button
          onClick={() => onOpenAuthModal && onOpenAuthModal()}
          className="flex flex-col items-center justify-center py-1 transition-all active:scale-95 cursor-pointer text-stone-600 hover:text-stone-900"
        >
          <div className="relative">
            {user ? (
              <div className="w-5 h-5 rounded-full overflow-hidden ring-1.5 ring-stone-900 bg-stone-900 text-amber-200 flex items-center justify-center text-[9px] font-bold">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Perfil" className="w-full h-full object-cover" />
                ) : (
                  <span>{(user.displayName || user.email || 'U')[0].toUpperCase()}</span>
                )}
              </div>
            ) : (
              <Cloud className="w-5 h-5 stroke-[1.8] text-stone-600" />
            )}
            {isSyncing && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1">
            {user ? 'Conta' : 'Entrar'}
          </span>
        </button>
      </div>
    </nav>
  );
};
