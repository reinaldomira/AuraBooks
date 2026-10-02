import React, { useState } from 'react';
import { 
  X, BookMarked, Trash2, Edit3, ExternalLink, Download, 
  Copy, Check, Search, Filter, Sparkles, FileText, Printer
} from 'lucide-react';
import { Book, BookHighlight, HighlightColor } from '../types/book';

interface NotesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
  highlights: BookHighlight[];
  onDeleteHighlight: (id: string) => void;
  onUpdateNote: (id: string, newNote: string) => void;
  onJumpToHighlight: (chapterIndex: number, paragraphIndex: number) => void;
}

const COLOR_MAP: Record<HighlightColor, { label: string; dot: string; bg: string; border: string }> = {
  yellow: { label: 'Amarelo', dot: 'bg-amber-400', bg: 'bg-amber-50', border: 'border-amber-300' },
  green: { label: 'Verde', dot: 'bg-emerald-400', bg: 'bg-emerald-50', border: 'border-emerald-300' },
  purple: { label: 'Lavanda', dot: 'bg-purple-400', bg: 'bg-purple-50', border: 'border-purple-300' },
  rose: { label: 'Coral', dot: 'bg-rose-400', bg: 'bg-rose-50', border: 'border-rose-300' },
  blue: { label: 'Azul', dot: 'bg-sky-400', bg: 'bg-sky-50', border: 'border-sky-300' },
};

export const NotesDrawer: React.FC<NotesDrawerProps> = ({
  isOpen,
  onClose,
  book,
  highlights,
  onDeleteHighlight,
  onUpdateNote,
  onJumpToHighlight,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const filtered = highlights.filter(hl => {
    if (selectedColor !== 'all' && hl.color !== selectedColor) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inText = hl.text.toLowerCase().includes(q);
      const inNote = hl.note ? hl.note.toLowerCase().includes(q) : false;
      return inText || inNote;
    }
    return true;
  });

  const handleStartEdit = (hl: BookHighlight) => {
    setEditingId(hl.id);
    setEditingText(hl.note || '');
  };

  const handleSaveEdit = (id: string) => {
    onUpdateNote(id, editingText.trim());
    setEditingId(null);
  };

  const handleExportMarkdown = () => {
    let md = `# Caderno de Citações & Anotações\n`;
    md += `**Livro:** ${book.title}\n`;
    md += `**Autor:** ${book.author}\n`;
    md += `**Data:** ${new Date().toLocaleDateString('pt-BR')}\n`;
    md += `**Total de Destaques:** ${highlights.length}\n\n---\n\n`;

    highlights.forEach((hl, i) => {
      const chapName = hl.chapterTitle || `Capítulo ${hl.chapterIndex + 1}`;
      md += `### ${i + 1}. ${chapName}\n`;
      md += `> "${hl.text}"\n\n`;
      if (hl.note) {
        md += `*Nota pessoal:* ${hl.note}\n\n`;
      }
      md += `*Cor:* ${hl.color} • *Data:* ${new Date(hl.createdAt).toLocaleDateString('pt-BR')}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Anotacoes_${book.title.replace(/\s+/g, '_')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = async () => {
    let text = `Citações & Anotações: ${book.title} (${book.author})\n\n`;
    highlights.forEach((hl, i) => {
      text += `[${i + 1}] "${hl.text}"\n`;
      if (hl.note) text += `Nota: ${hl.note}\n`;
      text += `\n`;
    });

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-stone-950/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#FAF9F5] h-full shadow-2xl flex flex-col justify-between border-l border-[#EBE6DF] overflow-hidden animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-5 border-b border-[#E8E2D9] bg-white space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100/70 border border-amber-200 flex items-center justify-center text-amber-900">
                <BookMarked className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-serif-display font-bold text-base text-stone-950">
                  Caderno de Anotações
                </h3>
                <span className="text-[11px] text-stone-500 font-sans">
                  {highlights.length} {highlights.length === 1 ? 'marcação' : 'marcações salvas'}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-800 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Actions (Exportar Markdown, Copiar, Imprimir) */}
          <div className="flex items-center gap-1.5 pt-1">
            <button
              onClick={handleExportMarkdown}
              disabled={highlights.length === 0}
              className="flex-1 py-1.5 px-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white rounded-lg text-xs font-semibold font-sans flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="Baixar arquivo Markdown para estudos (.md)"
            >
              <Download className="w-3.5 h-3.5 text-amber-300" />
              <span>Exportar .MD</span>
            </button>

            <button
              onClick={handleCopyToClipboard}
              disabled={highlights.length === 0}
              className="py-1.5 px-3 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg text-xs font-medium font-sans flex items-center gap-1 transition-colors cursor-pointer"
              title="Copiar todas as citações para colar onde quiser"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={highlights.length === 0}
              className="p-1.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg text-xs transition-colors cursor-pointer"
              title="Imprimir / Salvar em PDF"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search bar & Color Filter */}
          <div className="space-y-2 pt-1">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Pesquisar nas anotações..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-stone-100/80 border border-stone-200 rounded-lg text-xs font-sans text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-400"
              />
            </div>

            {/* Color chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <button
                onClick={() => setSelectedColor('all')}
                className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold border transition-all cursor-pointer ${
                  selectedColor === 'all'
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                Todas
              </button>
              {(Object.keys(COLOR_MAP) as HighlightColor[]).map(c => (
                <button
                  key={c}
                  onClick={() => setSelectedColor(c)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-medium flex items-center gap-1 border transition-all cursor-pointer ${
                    selectedColor === c
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${COLOR_MAP[c].dot}`} />
                  <span>{COLOR_MAP[c].label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="py-20 text-center space-y-3 text-stone-400">
              <div className="w-12 h-12 rounded-full bg-stone-200/50 flex items-center justify-center mx-auto text-stone-400">
                <Edit3 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="font-serif-display text-sm font-semibold text-stone-600">
                  Nenhuma anotação encontrada
                </p>
                <p className="text-xs text-stone-400 max-w-xs mx-auto font-sans leading-relaxed">
                  Para criar um destaque, selecione qualquer trecho no leitor e escolha uma cor de marca-texto.
                </p>
              </div>
            </div>
          ) : (
            filtered.map((hl) => {
              const colorInfo = COLOR_MAP[hl.color] || COLOR_MAP.yellow;
              const isEditing = editingId === hl.id;

              return (
                <div
                  key={hl.id}
                  className={`p-3.5 rounded-xl border ${colorInfo.border} bg-white shadow-2xs space-y-2.5 transition-all hover:shadow-xs`}
                >
                  {/* Card Header: Chapter info & Color badge */}
                  <div className="flex items-center justify-between text-[11px] font-sans">
                    <span className="font-semibold text-stone-700 flex items-center gap-1.5 truncate max-w-[200px]">
                      <span className={`w-2 h-2 rounded-full ${colorInfo.dot}`} />
                      <span className="truncate">{hl.chapterTitle || `Capítulo ${hl.chapterIndex + 1}`}</span>
                    </span>

                    <span className="text-[10px] text-stone-400">
                      {new Date(hl.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  {/* Highlight text quote */}
                  <div
                    onClick={() => {
                      onJumpToHighlight(hl.chapterIndex, hl.paragraphIndex);
                      onClose();
                    }}
                    className={`p-2.5 rounded-lg ${colorInfo.bg} border-l-2 ${colorInfo.border} cursor-pointer group`}
                    title="Clique para ir direto até este trecho no livro"
                  >
                    <p className="font-serif italic text-xs sm:text-sm text-stone-900 leading-relaxed line-clamp-4 group-hover:text-amber-950 transition-colors">
                      “{hl.text}”
                    </p>
                  </div>

                  {/* Marginalia Note */}
                  {isEditing ? (
                    <div className="space-y-2 pt-1 font-sans">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        placeholder="Escreva sua reflexão ou anotação pessoal..."
                        rows={2}
                        className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:border-stone-500"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2 text-xs">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 text-stone-500 hover:text-stone-800"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleSaveEdit(hl.id)}
                          className="px-3 py-1 bg-stone-900 text-white rounded-md font-semibold hover:bg-stone-800"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  ) : hl.note ? (
                    <div className="p-2 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-700 font-sans space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-wider">
                        Sua Nota:
                      </span>
                      <p className="leading-snug">{hl.note}</p>
                    </div>
                  ) : null}

                  {/* Card Footer Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-xs font-sans text-stone-500">
                    <button
                      onClick={() => handleStartEdit(hl)}
                      className="hover:text-stone-900 flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{hl.note ? 'Editar nota' : '+ Adicionar nota'}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          onJumpToHighlight(hl.chapterIndex, hl.paragraphIndex);
                          onClose();
                        }}
                        className="text-stone-600 hover:text-stone-950 flex items-center gap-1 text-[11px] cursor-pointer font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Ir para trecho</span>
                      </button>

                      <button
                        onClick={() => onDeleteHighlight(hl.id)}
                        className="text-stone-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                        title="Excluir destaque"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E8E2D9] bg-white flex items-center justify-between text-xs font-sans text-stone-500">
          <span>{book.title}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
