import React, { useState } from 'react';
import { 
  Search, Sun, Moon, Bell, Sparkles, Cloud, 
  Menu, LogIn, LogOut, CheckCircle2, RefreshCw, Smartphone, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AppView } from './Sidebar';

interface TopNavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onToggleMobileMenu: () => void;
  onNavigate: (view: AppView) => void;
  onOpenInstallModal?: () => void;
  onOpenAuthModal?: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  searchQuery,
  onSearchChange,
  onToggleMobileMenu,
  onNavigate,
  onOpenInstallModal,
  onOpenAuthModal,
}) => {
  const { user, login, logout, isSyncing, syncMessage, syncAll } = useAuth();
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const handleLoginClick = () => {
    if (onOpenAuthModal) {
      onOpenAuthModal();
    } else {
      login();
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-[#F9F8F5]/95 backdrop-blur-md border-b border-[#EBE6DF]">
      {/* Main Top Bar */}
      <div className="px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Mobile Menu & App Branding (on mobile) or Desktop Search */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <button
            onClick={onToggleMobileMenu}
            aria-label="Abrir menu"
            className="md:hidden p-2 text-stone-700 hover:text-stone-900 rounded-lg hover:bg-stone-200/60 active:scale-95 transition-all shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mobile Branding (Shows only on mobile to give a clean native app header) */}
          <button
            onClick={() => onNavigate('library')}
            className="md:hidden flex items-center gap-1.5 text-left focus:outline-none shrink-0"
          >
            <span className="font-serif text-base font-bold text-stone-900 tracking-tight">
              Lumina
            </span>
            <span className="text-[10px] text-amber-900 font-semibold bg-amber-100/90 px-1.5 py-0.5 rounded tracking-wide">
              Books
            </span>
          </button>

          {/* Desktop Search Bar (Hidden on mobile) */}
          <div className="hidden md:block relative w-full max-w-md lg:max-w-lg">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar título, autor ou gênero..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white rounded-lg border border-[#E5E0D8] text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all shadow-2xs"
            />
          </div>
        </div>

        {/* Right Controls: Search toggle (mobile), Ambient pills, Notifications, User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Mobile Search Toggle Icon */}
          <button
            onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
            aria-label="Buscar livros"
            className={`md:hidden p-2 rounded-lg transition-colors ${
              isMobileSearchOpen || searchQuery
                ? 'bg-amber-100/80 text-amber-900'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
            }`}
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Ambient theme pill (Desktop only) */}
          <div className="hidden lg:flex items-center bg-[#ECE8E1] rounded-lg p-0.5 border border-[#DDD7CD]">
            <button 
              title="Modo Claro"
              className="p-1.5 rounded-md bg-white text-stone-900 shadow-2xs"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button 
              title="Sépia Leitura"
              className="p-1.5 rounded-md text-stone-500 hover:text-stone-800"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
            <button 
              title="Modo Noturno"
              className="p-1.5 rounded-md text-stone-500 hover:text-stone-800"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Botão Instalar App no Celular (Visível apenas em telas maiores / Desktop) */}
          {onOpenInstallModal && (
            <button
              onClick={onOpenInstallModal}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300/80 text-amber-950 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Instalar no celular / Gerar APK"
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-800" />
              <span className="hidden sm:inline">App Celular</span>
              <span className="text-[9px] bg-amber-200/90 text-amber-950 font-bold px-1 py-0.2 rounded">APK</span>
            </button>
          )}

          {/* Notifications */}
          <button 
            title="Notificações"
            className="relative p-2 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-200/50 transition-colors"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#9A3412] rounded-full" />
          </button>

          {/* User Profile / Cloud Sync Badge */}
          <div className="flex items-center gap-2 pl-1.5 sm:pl-2.5 border-l border-[#E5E0D8]">
            {user ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Avatar */}
                <div 
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-stone-900 text-amber-200 ring-2 ring-[#E5E0D8] shrink-0 flex items-center justify-center font-bold text-xs cursor-pointer"
                  title={user.displayName || user.email || 'Conta Conectada'}
                  onClick={() => syncAll()}
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Usuário'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{(user.displayName || user.email || 'U')[0].toUpperCase()}</span>
                  )}
                </div>

                {/* User Info & Cloud Sync Indicator */}
                <div className="hidden lg:block text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-stone-900 block leading-tight max-w-[110px] truncate">
                      {user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'Usuário'}
                    </span>
                    <button
                      onClick={() => syncAll()}
                      disabled={isSyncing}
                      title={isSyncing ? (syncMessage || 'Sincronizando nuvem...') : 'Nuvem Ativa - Clique para sincronizar agora'}
                      className="hover:scale-110 transition-transform"
                    >
                      <Cloud className={`w-3.5 h-3.5 ${isSyncing ? 'text-amber-500 animate-pulse' : 'text-emerald-600'}`} />
                    </button>
                  </div>
                  <span className="text-[10px] text-stone-500 block truncate max-w-[130px]">
                    {isSyncing ? (syncMessage || 'Sincronizando...') : 'Nuvem Conectada'}
                  </span>
                </div>

                {/* Cloud Status Pill on Mobile */}
                <span 
                  className="lg:hidden p-1 text-emerald-600 cursor-pointer"
                  onClick={() => syncAll()}
                  title={isSyncing ? 'Sincronizando...' : 'Nuvem Conectada'}
                >
                  <Cloud className={`w-3.5 h-3.5 ${isSyncing ? 'text-amber-500 animate-pulse' : 'text-emerald-600'}`} />
                </span>

                {/* Logout Button */}
                <button
                  onClick={logout}
                  title="Desconectar da conta"
                  className="text-stone-400 hover:text-rose-600 p-1.5 rounded-md hover:bg-stone-200/50 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleLoginClick}
                title="Entrar para sincronizar seus livros e progresso na nuvem"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-stone-100 rounded-lg text-xs font-medium shadow-xs transition-all hover:shadow-sm cursor-pointer whitespace-nowrap shrink-0"
              >
                <Cloud className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-semibold">Entrar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Search Input Drawer (Shows smoothly when toggle is clicked) */}
      {isMobileSearchOpen && (
        <div className="md:hidden px-3 pb-3 pt-1 border-t border-stone-200/60 bg-[#F4EFEA]/80 animate-in slide-in-from-top-1">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar título, autor ou gênero..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-white rounded-lg border border-[#E5E0D8] text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

