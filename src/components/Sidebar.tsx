import React from 'react';
import { 
  BookOpen, Compass, FileText, BookMarked, 
  Layers, Sparkles, Upload, Bookmark, BookOpenText,
  Smartphone 
} from 'lucide-react';

export type AppView = 'library' | 'explore' | 'detail' | 'reader';

interface SidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenUpload: () => void;
  onOpenInstallModal?: () => void;
  isMobile?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  onOpenUpload,
  onOpenInstallModal,
  isMobile = false,
}) => {
  return (
    <aside className={`w-64 bg-[#F9F8F5] border-r border-[#EBE6DF] flex flex-col justify-between p-5 shrink-0 select-none ${
      isMobile ? 'flex h-full min-h-full' : 'hidden md:flex min-h-screen sticky top-0 h-screen'
    }`}>
      {/* Brand Zone */}
      <div className="space-y-8">
        <div 
          onClick={() => onNavigate('library')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded bg-stone-900 text-stone-100 flex items-center justify-center shadow-xs group-hover:bg-amber-900 transition-colors">
            <BookOpen className="w-4 h-4 text-amber-200" />
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="font-serif-display font-bold text-lg text-stone-950 tracking-tight leading-none">
                Lumina
              </span>
              <span className="text-[10px] text-stone-500 font-sans tracking-wide">
                BOOKS
              </span>
            </div>
            <span className="text-[8.5px] uppercase tracking-[0.2em] text-[#9A3412] font-semibold block mt-0.5">
              BIBLIOTECA DE AUTORES
            </span>
          </div>
        </div>

        {/* Navigation Menu Links */}
        <nav className="space-y-1 text-sm font-medium">
          <button
            onClick={() => onNavigate('library')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-all text-left ${
              currentView === 'library'
                ? 'bg-[#EFECE6] text-stone-950 font-semibold shadow-xs'
                : 'text-stone-600 hover:text-stone-950 hover:bg-[#F3EFEA]'
            }`}
          >
            <Layers className="w-4 h-4 text-stone-700 shrink-0" />
            <span>Minha Biblioteca</span>
          </button>

          <button
            onClick={() => onNavigate('explore')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-all text-left ${
              currentView === 'explore'
                ? 'bg-[#EFECE6] text-stone-950 font-semibold shadow-xs'
                : 'text-stone-600 hover:text-stone-950 hover:bg-[#F3EFEA]'
            }`}
          >
            <Compass className="w-4 h-4 text-stone-700 shrink-0" />
            <span>Explorar</span>
          </button>

          <button
            onClick={() => onNavigate('detail')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-all text-left ${
              currentView === 'detail'
                ? 'bg-[#EFECE6] text-stone-950 font-semibold shadow-xs'
                : 'text-stone-600 hover:text-stone-950 hover:bg-[#F3EFEA]'
            }`}
          >
            <BookMarked className="w-4 h-4 text-stone-700 shrink-0" />
            <span>Detalhes do Livro</span>
          </button>

          <button
            onClick={() => onNavigate('reader')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-all text-left ${
              currentView === 'reader'
                ? 'bg-[#EFECE6] text-stone-950 font-semibold shadow-xs'
                : 'text-stone-600 hover:text-stone-950 hover:bg-[#F3EFEA]'
            }`}
          >
            <BookOpenText className="w-4 h-4 text-stone-700 shrink-0" />
            <span>Leitor Imersivo</span>
          </button>
        </nav>
      </div>

      {/* Bottom Annual Goal Widget */}
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-[#EFECE6]/80 border border-[#E5E0D8] space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
            <span className="text-[10px] uppercase tracking-wider text-stone-500 font-sans">
              META ANUAL
            </span>
            <span className="tabular-nums font-mono text-stone-900 font-bold">
              24 / 30
            </span>
          </div>

          <div className="w-full h-1.5 bg-[#DDD7CD] rounded-full overflow-hidden">
            <div className="h-full bg-[#9A3412] w-[80%] rounded-full" />
          </div>

          <p className="text-[11px] text-stone-600 font-sans">
            80% do ritmo concluído
          </p>
        </div>

        <button
          onClick={onOpenUpload}
          className="w-full py-2.5 px-3 bg-stone-900 hover:bg-stone-800 text-stone-100 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 text-amber-300" />
          <span>Importar Livro (EPUB/PDF)</span>
        </button>

        {onOpenInstallModal && (
          <button
            onClick={onOpenInstallModal}
            className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-300/80 text-amber-950 rounded-lg text-xs font-semibold transition-all flex items-center justify-between shadow-2xs cursor-pointer"
            title="Instalar aplicativo no celular ou baixar APK"
          >
            <div className="flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5 text-amber-800" />
              <span>Instalar no Celular</span>
            </div>
            <span className="text-[9px] font-bold bg-amber-200/80 text-amber-900 px-1.5 py-0.2 rounded uppercase">
              APK
            </span>
          </button>
        )}
      </div>
    </aside>
  );
};
