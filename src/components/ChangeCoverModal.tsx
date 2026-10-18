import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Search, 
  Check, 
  Loader2, 
  AlertCircle, 
  Trash2,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { Book } from '../types/book';
import { 
  setCustomBookCover, 
  removeCustomBookCover, 
  searchOnlineCoverCandidates, 
  CoverCandidate, 
  cleanBookTitleForSearch 
} from '../services/coverService';
import { BookCover } from './BookCover';

interface ChangeCoverModalProps {
  book: Book | null;
  isOpen: boolean;
  onClose: () => void;
  onCoverUpdated: (updatedBook: Book, newCoverUrl: string) => void;
  defaultTab?: 'upload' | 'url' | 'search';
}

export const ChangeCoverModal: React.FC<ChangeCoverModalProps> = ({
  book,
  isOpen,
  onClose,
  onCoverUpdated,
  defaultTab = 'upload',
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'search'>(defaultTab);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Candidatos de busca online
  const [candidates, setCandidates] = useState<CoverCandidate[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sincroniza estado quando o modal abre ou o livro muda
  useEffect(() => {
    if (isOpen && book) {
      setActiveTab(defaultTab);
      setPreviewUrl('');
      setSelectedFile(null);
      setUrlInput('');
      setErrorMessage(null);
      setSuccessMessage(null);
      setSelectedCandidateId(null);

      const defaultSearch = cleanBookTitleForSearch(book.title);
      const initialQuery = book.author && book.author.toLowerCase() !== 'autor desconhecido'
        ? `${defaultSearch} ${book.author}`
        : defaultSearch;
      setSearchQuery(initialQuery);

      if (defaultTab === 'search') {
        performSearch(initialQuery);
      }
    }
  }, [isOpen, book?.id, defaultTab]);

  if (!isOpen || !book) return null;

  const performSearch = async (queryText: string) => {
    const q = queryText.trim() || book.title;
    if (!q) return;

    setIsSearchingOnline(true);
    setErrorMessage(null);
    setHasSearched(true);
    try {
      const results = await searchOnlineCoverCandidates(q, book.author);
      setCandidates(results);
      if (results.length === 0) {
        setErrorMessage('Nenhuma capa fotográfica encontrada para esta busca. Tente simplificar o nome da obra ou enviar uma imagem do seu dispositivo.');
      } else {
        // Pré-seleciona o primeiro candidato
        setSelectedCandidateId(results[0].id);
        setPreviewUrl(results[0].fullUrl || results[0].thumbnailUrl);
      }
    } catch {
      setErrorMessage('Falha temporária ao pesquisar capas online. Você pode tentar novamente ou carregar uma imagem do seu dispositivo.');
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processIncomingFile(file);
  };

  const processIncomingFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WEBP, AVIF).');
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processIncomingFile(file);
    }
  };

  const handleApplyFileCover = async () => {
    if (!selectedFile || !book) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const newCover = await setCustomBookCover(book, selectedFile);
      const updatedBook: Book = { ...book, coverUrl: newCover, customCoverApplied: true };
      setSuccessMessage('✓ Capa atualizada e otimizada com sucesso!');
      onCoverUpdated(updatedBook, newCover);
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
        setSelectedFile(null);
        setPreviewUrl('');
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar imagem selecionada.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyUrlCover = async () => {
    const targetUrl = urlInput.trim();
    if (!targetUrl || !book) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const newCover = await setCustomBookCover(book, targetUrl);
      const updatedBook: Book = { ...book, coverUrl: newCover, customCoverApplied: true };
      setSuccessMessage('✓ Capa importada e salva com sucesso!');
      onCoverUpdated(updatedBook, newCover);
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
        setUrlInput('');
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao carregar a imagem da URL.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyCandidateCover = async () => {
    if (!previewUrl || !book) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const newCover = await setCustomBookCover(book, previewUrl);
      const updatedBook: Book = { ...book, coverUrl: newCover, customCoverApplied: true };
      setSuccessMessage('✓ Capa oficial aplicada e sincronizada!');
      onCoverUpdated(updatedBook, newCover);
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao salvar capa selecionada.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetCover = async () => {
    if (!book) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const restored = await removeCustomBookCover(book);
      const updatedBook: Book = { ...book, coverUrl: restored, customCoverApplied: false };
      setSuccessMessage('✓ Capa restaurada ao padrão original.');
      onCoverUpdated(updatedBook, restored);
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao restaurar capa.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center shrink-0">
              <ImageIcon className="w-4 h-4 text-amber-800" />
            </div>
            <div className="min-w-0">
              <h3 className="font-serif-display font-bold text-stone-900 text-base leading-tight truncate">
                Carregar / Alterar Capa
              </h3>
              <p className="text-[11px] text-stone-500 font-sans truncate max-w-xs sm:max-w-md">
                {book.title} • {book.author}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-200 px-4 sm:px-6 bg-stone-50/50">
          <button
            onClick={() => { setActiveTab('upload'); setErrorMessage(null); }}
            className={`py-3 px-3 text-xs font-semibold font-sans flex items-center gap-1.5 sm:gap-2 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'upload'
                ? 'border-amber-800 text-amber-950 font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Enviar do Dispositivo</span>
          </button>

          <button
            onClick={() => { setActiveTab('search'); setErrorMessage(null); if (!hasSearched) performSearch(searchQuery); }}
            className={`py-3 px-3 text-xs font-semibold font-sans flex items-center gap-1.5 sm:gap-2 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'search'
                ? 'border-amber-800 text-amber-950 font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Buscar Capa na Web</span>
          </button>

          <button
            onClick={() => { setActiveTab('url'); setErrorMessage(null); }}
            className={`py-3 px-3 text-xs font-semibold font-sans flex items-center gap-1.5 sm:gap-2 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'url'
                ? 'border-amber-800 text-amber-950 font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Colar Link (URL)</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Feedback messages */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-sans flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-sans flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Current vs Preview Comparison Frame */}
          <div className="flex items-center gap-4 sm:gap-5 p-3.5 sm:p-4 rounded-xl bg-[#FAF7F2] border border-[#EBE4D8]">
            <div className="w-20 sm:w-24 aspect-[3/4] rounded-lg overflow-hidden shadow-xs border border-stone-300 shrink-0 relative bg-stone-100">
              {previewUrl ? (
                <img 
                  src={previewUrl} 
                  alt="Nova Capa Preview" 
                  className="w-full h-full object-cover" 
                  onError={() => {
                    setErrorMessage('A imagem selecionada não pôde ser carregada.');
                    setPreviewUrl('');
                  }}
                />
              ) : (
                <BookCover book={book} />
              )}
            </div>

            <div className="space-y-1 text-xs font-sans flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-stone-900 block text-xs sm:text-sm">
                  {previewUrl ? 'Nova Capa Selecionada' : 'Capa Atual da Obra'}
                </span>
                {book.customCoverApplied && !previewUrl && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-semibold border border-amber-300">
                    Personalizada
                  </span>
                )}
              </div>
              <p className="text-stone-500 leading-relaxed text-[11px] sm:text-[11.5px]">
                {previewUrl
                  ? 'A imagem selecionada será convertida e otimizada automaticamente (~40KB) para carregar instantaneamente neste e em todos os seus outros dispositivos.'
                  : book.customCoverApplied
                  ? 'Você já definiu uma capa personalizada para este exemplar. Ela é preservada e sincronizada com a nuvem.'
                  : 'Capa atual registrada na sua estante. Você pode substituí-la enviando uma foto do seu computador, buscando na internet ou colando uma URL.'}
              </p>

              {book.customCoverApplied && !previewUrl && (
                <button
                  onClick={handleResetCover}
                  disabled={isProcessing}
                  className="mt-1 text-[11px] text-rose-700 hover:text-rose-900 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Restaurar capa original</span>
                </button>
              )}
            </div>
          </div>

          {/* TAB 1: Enviar do Dispositivo */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp, image/avif, image/gif"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all space-y-2.5 ${
                  isDragging 
                    ? 'border-amber-600 bg-amber-50 scale-[1.01]' 
                    : 'border-stone-300 hover:border-amber-700 bg-white hover:bg-amber-50/30'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-900 mx-auto flex items-center justify-center">
                  <Upload className="w-6 h-6 text-amber-800" />
                </div>
                <div>
                  <span className="font-semibold text-xs sm:text-sm text-stone-900 block font-sans">
                    Arraste uma imagem aqui ou clique para selecionar
                  </span>
                  <span className="text-[11px] text-stone-500 block mt-0.5 font-sans">
                    Formatos suportados: JPG, PNG, WEBP, AVIF (qualquer tamanho)
                  </span>
                </div>
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between text-xs text-stone-700 font-sans p-2.5 bg-stone-100 rounded-lg">
                  <span className="truncate max-w-[240px] sm:max-w-[320px] font-medium">{selectedFile.name}</span>
                  <span className="text-stone-500">{(selectedFile.size / 1024).toFixed(0)} KB</span>
                </div>
              )}

              <button
                onClick={handleApplyFileCover}
                disabled={!selectedFile || isProcessing}
                className="w-full py-2.5 px-4 bg-stone-950 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 text-amber-300 animate-spin" />
                    <span>Salvando capa no livro...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-amber-300" />
                    <span>Salvar Esta Capa no Livro</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: Buscar Capa Oficial na Web */}
          {activeTab === 'search' && (
            <div className="space-y-4">
              <div className="space-y-1.5 font-sans">
                <label className="text-xs font-semibold text-stone-800 block">
                  Pesquisar por título, autor ou ISBN
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ex: Dom Casmurro Machado de Assis"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        performSearch(searchQuery);
                      }
                    }}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs text-stone-900 focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700 bg-white"
                  />
                  <button
                    onClick={() => performSearch(searchQuery)}
                    disabled={isSearchingOnline || isProcessing}
                    className="px-4 py-2.5 bg-amber-900 hover:bg-amber-950 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 shadow-xs"
                  >
                    {isSearchingOnline ? (
                      <Loader2 className="w-4 h-4 text-amber-300 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4 text-amber-300" />
                    )}
                    <span>Buscar</span>
                  </button>
                </div>
                <span className="text-[11px] text-stone-500 block">
                  Dica: Se o nome do arquivo veio com tags (como [z-lib] ou números), ajuste para o título simples da obra.
                </span>
              </div>

              {/* Lista de capas encontradas */}
              {isSearchingOnline && (
                <div className="py-8 flex flex-col items-center justify-center text-stone-500 text-xs space-y-2">
                  <Loader2 className="w-6 h-6 text-amber-800 animate-spin" />
                  <span>Consultando acervos oficiais e edições públicas...</span>
                </div>
              )}

              {!isSearchingOnline && candidates.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-stone-800 block font-sans">
                    Escolha a capa oficial desejada ({candidates.length} edições encontradas):
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-56 overflow-y-auto p-1">
                    {candidates.map((cand) => {
                      const isSelected = selectedCandidateId === cand.id;
                      return (
                        <div
                          key={cand.id}
                          onClick={() => {
                            setSelectedCandidateId(cand.id);
                            setPreviewUrl(cand.fullUrl || cand.thumbnailUrl);
                            setErrorMessage(null);
                          }}
                          className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 cursor-pointer transition-all group bg-stone-100 ${
                            isSelected
                              ? 'border-emerald-600 ring-2 ring-emerald-400/50 shadow-md scale-[1.02]'
                              : 'border-stone-200 hover:border-amber-600 shadow-2xs'
                          }`}
                        >
                          <img
                            src={cand.thumbnailUrl}
                            alt={cand.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            loading="lazy"
                          />
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 bg-emerald-600 text-white rounded-full p-0.5 shadow-xs">
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-stone-950/80 p-1 text-[9px] text-stone-200 truncate font-sans">
                            {cand.year ? `${cand.year} • ` : ''}{cand.author || cand.title}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleApplyCandidateCover}
                    disabled={!previewUrl || isProcessing}
                    className="w-full mt-2 py-2.5 px-4 bg-stone-950 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs font-sans"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 text-amber-300 animate-spin" />
                        <span>Aplicando capa selecionada...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 text-amber-300" />
                        <span>Aplicar Capa Selecionada</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Colar Link (URL) */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              <div className="space-y-1.5 font-sans">
                <label className="text-xs font-semibold text-stone-800 block">
                  Link direto da imagem na web
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://exemplo.com/capa-do-livro.jpg"
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                    }}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs text-stone-900 focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700 bg-white"
                  />
                  <button
                    onClick={() => {
                      if (urlInput.trim()) {
                        setPreviewUrl(urlInput.trim());
                        setErrorMessage(null);
                      }
                    }}
                    className="px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold transition-colors border border-stone-300 cursor-pointer"
                  >
                    Visualizar
                  </button>
                </div>
                <span className="text-[11px] text-stone-500 block">
                  Cole o endereço de imagem de qualquer site (ex: Amazon, Goodreads, Skoob, Google Imagens).
                </span>
              </div>

              <button
                onClick={handleApplyUrlCover}
                disabled={!urlInput.trim() || isProcessing}
                className="w-full py-2.5 px-4 bg-stone-950 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs font-sans"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 text-amber-300 animate-spin" />
                    <span>Baixando e otimizando imagem...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-amber-300" />
                    <span>Salvar Esta Imagem como Capa</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-stone-100 border-t border-stone-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-700 hover:text-stone-900 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
