import React, { useState } from 'react';
import { X, Tag, Plus, Check, FolderPlus, Bookmark } from 'lucide-react';
import { Book } from '../types/book';

interface TagManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
  allAvailableTags: string[];
  onSaveTags: (bookId: string, tags: string[]) => void;
  onCreateTag: (newTag: string) => void;
}

export const TagManagerModal: React.FC<TagManagerModalProps> = ({
  isOpen,
  onClose,
  book,
  allAvailableTags,
  onSaveTags,
  onCreateTag,
}) => {
  const [selectedTags, setSelectedTags] = useState<string[]>(book.tags || []);
  const [newTagInput, setNewTagInput] = useState('');

  if (!isOpen) return null;

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleCreateAndSelect = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTagInput.trim();
    if (!trimmed) return;
    onCreateTag(trimmed);
    if (!selectedTags.includes(trimmed)) {
      setSelectedTags([...selectedTags, trimmed]);
    }
    setNewTagInput('');
  };

  const handleSave = () => {
    onSaveTags(book.id, selectedTags);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 p-6 space-y-5 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100/70 border border-amber-200 flex items-center justify-center text-amber-900">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif-display font-bold text-base text-stone-950">
                Coleções & Tags
              </h3>
              <p className="text-xs text-stone-500 font-sans truncate max-w-[260px]">
                {book.title}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create new collection input */}
        <form onSubmit={handleCreateAndSelect} className="flex gap-2">
          <input
            type="text"
            placeholder="Nova coleção (ex: Filosofia, Estudos)..."
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.target.value)}
            className="flex-1 px-3 py-2 text-xs font-sans bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:outline-none focus:border-stone-500 placeholder-stone-400"
          />
          <button
            type="submit"
            disabled={!newTagInput.trim()}
            className="px-3 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white rounded-xl text-xs font-semibold font-sans flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Criar</span>
          </button>
        </form>

        {/* Existing Collections Chips */}
        <div className="space-y-2">
          <span className="text-[10px] uppercase font-bold text-stone-400 font-sans tracking-wider block">
            Selecione as coleções deste livro:
          </span>

          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
            {allAvailableTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleTag(tag)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-sans font-medium transition-all flex items-center gap-1.5 cursor-pointer border ${
                    isSelected
                      ? 'bg-amber-900 text-amber-50 border-amber-900 shadow-2xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <Tag className={`w-3 h-3 ${isSelected ? 'text-amber-300' : 'text-stone-400'}`} />
                  <span>{tag}</span>
                  {isSelected && <Check className="w-3 h-3 text-amber-300 ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-100 font-sans">
          <span className="text-xs text-stone-400">
            {selectedTags.length} {selectedTags.length === 1 ? 'coleção selecionada' : 'coleções selecionadas'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-stone-950 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Salvar Coleções
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
