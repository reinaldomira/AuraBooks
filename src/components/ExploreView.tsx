import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, BookOpen, Clock, Bookmark, 
  Plus, Check, Sparkles, Globe, Upload, Loader2,
  BookMarked, ExternalLink
} from 'lucide-react';
import { Book } from '../types/book';
import { saveBook } from '../services/storageService';

interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  number_of_pages_median?: number;
  subject?: string[];
}

interface ExploreViewProps {
  onOpenBook: (book: Book) => void;
  onOpenUpload: () => void;
  onBookAdded?: (book: Book) => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  onOpenBook,
  onOpenUpload,
  onBookAdded,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [results, setResults] = useState<OpenLibraryDoc[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addedKeys, setAddedKeys] = useState<Record<string, boolean>>({});

  const categories = [
    { id: 'classicos-brasileiros', label: 'Clássicos Brasileiros', query: 'literatura brasileira classicos' },
    { id: 'filosofia', label: 'Filosofia & Ensaio', query: 'filosofia ensaio' },
    { id: 'ficcao-cientifica', label: 'Ficção Científica', query: 'ficcao cientifica' },
    { id: 'poesia', label: 'Poesia Universal', query: 'poesia clássica' },
    { id: 'romance-historico', label: 'História & Crônica', query: 'historia cronica' },
  ];

  const searchBooks = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=15`
      );
      if (response.ok) {
        const data = await response.json();
        setResults(data.docs || []);
      }
    } catch (err) {
      console.warn('Erro ao consultar catálogo aberto:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryClick = (cat: typeof categories[0]) => {
    if (activeCategory === cat.id) {
      setActiveCategory('');
      setSearchQuery('');
      setResults([]);
    } else {
      setActiveCategory(cat.id);
      setSearchQuery(cat.label);
      searchBooks(cat.query);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchBooks(searchQuery);
  };

  const handleAddBookToLibrary = async (item: OpenLibraryDoc) => {
    const author = item.author_name ? item.author_name[0] : 'Autor Desconhecido';
    const pages = item.number_of_pages_median || 240;
    const coverUrl = item.cover_i 
      ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg` 
      : '';

    const newBook: Book = {
      id: `ol-${item.key.replace(/\//g, '-')}`,
      title: item.title,
      author,
      format: 'epub',
      coverUrl,
      category: item.subject ? item.subject[0]?.slice(0, 50) : 'Literatura',
      progressPercent: 0,
      currentChapterIndex: 0,
      currentParagraphIndex: 0,
      lastReadAt: Date.now(),
      isFavorite: false,
      fileSize: 450000,
      addedAt: Date.now(),
      language: 'pt-BR',
      description: `Edição catalogada de ${item.title} por ${author}. Publicado originalmente em ${item.first_publish_year || 'edição clássica'}.`,
      totalWords: pages * 250,
      estimatedReadingMinutes: Math.round(pages * 1.5),
      estimatedAudioMinutes: Math.round(pages * 2.2),
      chapters: [
        {
          id: 'cap-1',
          title: 'Capítulo I — Abertura',
          wordCount: 800,
          paragraphs: [
            `Início da obra ${item.title}, de autoria de ${author}.`,
            'Este tomo foi adicionado ao seu acervo pessoal a partir do catálogo digital universal.',
            'Você pode carregar o arquivo integral correspondente em EPUB ou PDF a qualquer momento para leitura completa e audiolivro.'
          ]
        }
      ]
    };

    await saveBook(newBook);
    setAddedKeys(prev => ({ ...prev, [item.key]: true }));
    if (onBookAdded) {
      onBookAdded(newBook);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-10 bg-[#F9F8F5]">
      {/* 1. Header & Title */}
      <div className="space-y-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#9A3412] font-semibold font-sans block mb-1">
            ARQUIVO & ACERVO DIGITAL
          </span>
          <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-stone-950 tracking-tight">
            Explorar Catálogo Mundial
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 font-sans mt-1">
            Pesquise obras reais pelo título, autor ou gênero para adicionar diretamente à sua estante pessoal.
          </p>
        </div>

        {/* Real Live Search Box */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Digite o título de um livro ou autor (ex: Machado de Assis, Dostoievski, Clarice Lispector)..."
              className="w-full pl-10 pr-4 py-3 text-xs sm:text-sm bg-white rounded-xl border border-[#E5E0D8] text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-800/10 focus:border-stone-400 shadow-2xs font-sans"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !searchQuery.trim()}
            className="px-5 py-3 bg-stone-950 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold font-sans shadow-2xs transition-colors flex items-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span className="hidden sm:inline">Pesquisar Catálogo</span>
          </button>
        </form>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-sans">
          <span className="text-stone-400 text-xs shrink-0">Temas sugeridos:</span>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                activeCategory === cat.id
                  ? 'bg-stone-900 text-white font-medium'
                  : 'bg-white border border-[#E5E0D8] text-stone-700 hover:bg-stone-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Direct Import Banner for personal files */}
      <div className="p-6 rounded-2xl bg-white border border-[#E8E2D9] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#FAF6F0] border border-[#EFE8DC] text-[#9A3412] flex items-center justify-center shrink-0">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-serif-display font-bold text-base text-stone-950">
              Tem seus próprios arquivos de livros?
            </h3>
            <p className="text-xs text-stone-500 font-sans mt-0.5">
              Importe arquivos <strong>EPUB</strong> ou <strong>PDF</strong> do seu computador ou celular para ler no leitor editorial e ouvir em audiolivro.
            </p>
          </div>
        </div>

        <button
          onClick={onOpenUpload}
          className="px-5 py-2.5 bg-[#FAF6F0] hover:bg-[#F4ECE0] text-stone-900 border border-[#E5DDD0] rounded-xl text-xs font-semibold font-sans transition-colors whitespace-nowrap cursor-pointer shrink-0 flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5 text-amber-700" />
          <span>Importar Arquivo (EPUB/PDF)</span>
        </button>
      </div>

      {/* 3. Search Results or Clean Guidance */}
      {isLoading ? (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#9A3412] animate-spin mx-auto" />
          <p className="text-xs font-sans text-stone-500">Consultando catálogo literário...</p>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif-display font-bold text-xl text-stone-950">
              Obras encontradas ({results.length})
            </h3>
            <span className="text-xs text-stone-500 font-sans">
              Dados do Acervo Digital Aberto
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {results.map((item) => {
              const coverUrl = item.cover_i 
                ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg` 
                : null;
              const isAdded = !!addedKeys[item.key];

              return (
                <div
                  key={item.key}
                  className="bg-white rounded-xl border border-[#E8E2D9] p-3 flex flex-col justify-between space-y-3 shadow-2xs hover:shadow-xs transition-all"
                >
                  <div className="space-y-2">
                    <div className="relative aspect-[3/4] rounded-lg bg-stone-100 overflow-hidden border border-stone-200 shadow-2xs">
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={item.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full p-3 flex flex-col justify-between bg-stone-900 text-stone-100">
                          <span className="text-[9px] uppercase tracking-wider text-amber-300 font-sans">OBRA</span>
                          <h4 className="font-serif-display font-bold text-xs line-clamp-3">{item.title}</h4>
                          <span className="text-[10px] text-stone-400 font-sans line-clamp-1">
                            {item.author_name ? item.author_name[0] : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <h4 className="font-serif-display font-bold text-xs sm:text-sm text-stone-950 line-clamp-2 leading-tight">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-stone-500 font-sans line-clamp-1">
                        {item.author_name ? item.author_name[0] : 'Autor desconhecido'}
                      </p>
                      {item.first_publish_year && (
                        <span className="text-[10px] text-stone-400 font-sans block">
                          Publicado em {item.first_publish_year}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleAddBookToLibrary(item)}
                    disabled={isAdded}
                    className={`w-full py-2 px-2.5 rounded-lg text-xs font-semibold font-sans transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isAdded
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-stone-900 hover:bg-stone-800 text-white shadow-2xs'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Na Minha Estante</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5 text-amber-300" />
                        <span>Adicionar à Estante</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="py-12 text-center max-w-md mx-auto space-y-3">
          <BookOpen className="w-10 h-10 text-stone-300 mx-auto" />
          <h3 className="font-serif-display font-bold text-lg text-stone-900">
            Pesquise autores ou livros clássicos
          </h3>
          <p className="text-xs text-stone-500 font-sans leading-relaxed">
            Use a barra de busca acima para pesquisar qualquer autor, obra literária ou assunto do acervo mundial para adicionar à sua biblioteca.
          </p>
        </div>
      )}
    </div>
  );
};
