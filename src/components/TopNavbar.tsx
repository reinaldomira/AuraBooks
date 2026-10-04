import React from 'react';
import { 
  Search, Sun, Moon, Bell, Sparkles, Cloud, 
  Menu, LogIn, LogOut, CheckCircle2, RefreshCw, Smartphone 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AppView } from './Sidebar';

interface TopNavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onToggleMobileMenu: () => void;
  onNavigate: (view: AppView) => void;
  onOpenInstallModal?: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  searchQuery,
  onSearchChange,
  onToggleMobileMenu,
  onNavigate,
  onOpenInstallModal,
}) => {
  const { user, login, logout, isSyncing, syncMessage, syncAll } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-[#F9F8F5]/90 backdrop-blur-md border-b border-[#EBE6DF] px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
      {/* Mobile Menu Button & Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-200/60"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar título, autor ou gênero..."
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white rounded-lg border border-[#E5E0D8] text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-800/10 focus:border-stone-400 transition-all shadow-2xs"
          />
        </div>
      </div>

      {/* Right Controls: Ambient light, Notifications, User profile */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Ambient theme pill */}
        <div className="hidden sm:flex items-center bg-[#ECE8E1] rounded-lg p-0.5 border border-[#DDD7CD]">
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

        {/* Botão Instalar App no Celular */}
        {onOpenInstallModal && (
          <button
            onClick={onOpenInstallModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300/80 text-amber-950 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Instalar no celular / Baixar APK"
          >
            <Smartphone className="w-3.5 h-3.5 text-amber-800" />
            <span className="hidden sm:inline">App Celular</span>
            <span className="text-[9px] bg-amber-200/90 text-amber-950 font-bold px-1 py-0.2 rounded">APK</span>
          </button>
        )}

        {/* Notifications */}
        <button 
          title="Notificações do clube de leitura"
          className="relative p-2 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-200/50 transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#9A3412] rounded-full" />
        </button>

        {/* User Profile / Cloud Sync Badge */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-[#E5E0D8]">
          {user ? (
            <>
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full overflow-hidden bg-stone-900 text-amber-200 ring-2 ring-[#E5E0D8] shrink-0 flex items-center justify-center font-bold text-xs">
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
                  <span className="font-semibold text-xs text-stone-900 block leading-tight max-w-[120px] truncate">
                    {user.displayName || user.email?.split('@')[0] || 'Usuário'}
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
                <span className="text-[10px] text-stone-500 block truncate max-w-[140px]">
                  {isSyncing ? (syncMessage || 'Sincronizando...') : 'Nuvem Conectada'}
                </span>
              </div>

              {/* Sync Button */}
              <button
                onClick={() => syncAll()}
                disabled={isSyncing}
                title="Sincronizar com a nuvem agora"
                className="hidden sm:flex text-stone-400 hover:text-stone-700 p-1.5 rounded-md hover:bg-stone-200/50 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-600' : ''}`} />
              </button>

              {/* Logout Button */}
              <button
                onClick={logout}
                title="Desconectar da conta Google"
                className="text-stone-400 hover:text-rose-600 p-1.5 rounded-md hover:bg-stone-200/50 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={login}
              title="Entrar com o Google para salvar livros e progresso na nuvem e abrir em qualquer PC"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-stone-100 rounded-lg text-xs font-medium shadow-xs transition-all hover:shadow-sm"
            >
              <Cloud className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Conectar Nuvem</span>
              <span className="sm:hidden">Entrar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
