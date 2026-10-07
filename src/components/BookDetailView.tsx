import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, BookOpen, Headphones, Share2, Bookmark, 
  Clock, CheckCircle2, Star, ThumbsUp, MessageSquare, 
  ChevronRight, Sparkles, Layers, Quote, Trash2, AlertTriangle, AlertCircle, Tag, Plus, Cloud, Loader2 
} from 'lucide-react';
import { Book } from '../types/book';
import { useAudioReader } from '../context/AudioReaderContext';
import { useAuth } from '../context/AuthContext';
import { TagManagerModal } from './TagManagerModal';
import { syncBookToDrive } from '../services/googleDriveService';
import { hasOriginalEpub } from '../services/epubStorageService';

interface BookDetailViewProps {
  book: Book;
  onBack: () => void;
  onOpenReader: (book: Book) => void;
  onPlayAudiobook: (book: Book) => void;
  onDeleteBook: (bookId: string) => void;
  allTags: string[];
  onSaveBookTags: (bookId: string, tags: string[]) => void;
  onCreateTag: (newTag: string) => void;
  onRefreshBooks?: () => Promise<void>;
}

export const BookDetailView: React.FC<BookDetailViewProps> = ({
  book,
  onBack,
  onOpenReader,
  onPlayAudiobook,
  onDeleteBook,
  allTags,
  onSaveBookTags,
  onCreateTag,
  onRefreshBooks,
}) => {
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const { user, isBookInCloud, syncCurrentBook, isSyncing } = useAuth();

  const [syncingToDrive, setSyncingToDrive] = useState(false);
  const [driveSyncMsg, setDriveSyncMsg] = useState('');
  const [driveSyncError, setDriveSyncError] = useState<string | null>(null);
  const [isLocalEpub, setIsLocalEpub] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (book.format === 'epub' || book.format === 'pdf' || book.format === 'mobi' || book.format === 'azw3') {
      hasOriginalEpub(book.id).then(exists => {
        if (isMounted) setIsLocalEpub(exists);
      });
    } else {
      setIsLocalEpub(true);
    }
    return () => { isMounted = false; };
  }, [book.id, book.format]);

  const handleRetrySync = async (fileOverride?: File) => {
    if (syncingToDrive) return;
    setSyncingToDrive(true);
    setDriveSyncMsg('Conectando ao Google Drive...');
    setDriveSyncError(null);

    const result = await syncBookToDrive(
      book.id,
      (step) => setDriveSyncMsg(step),
      true,
      fileOverride
    );

    if (result.success) {
      setDriveSyncMsg('✓ Sincronizado no Google Drive');
      setIsLocalEpub(true);
      if (onRefreshBooks) {
        await onRefreshBooks();
      }
      setTimeout(() => {
        setSyncingToDrive(false);
        setDriveSyncMsg('');
      }, 1500);
    } else {
      setDriveSyncError(result.error || 'Erro ao sincronizar com o Google Drive');
      setSyncingToDrive(false);
      setDriveSyncMsg('');
      if (onRefreshBooks) {
        await onRefreshBooks();
      }
    }
  };

  const isCloud = !!book.syncedToCloud || (isBookInCloud ? isBookInCloud(book.id) : false);
  const isFormatSupported = book.format === 'epub' || book.format === 'pdf' || book.format === 'mobi' || book.format === 'azw3';
  const isDriveSynced = isFormatSupported && !!book.driveFileId && book.driveSyncStatus === 'synced';
  const isDriveError = isFormatSupported && isLocalEpub !== false && book.driveSyncStatus === 'error';
  const isDriveNotSynced = isFormatSupported && isLocalEpub !== false && (!book.driveFileId || book.driveSyncStatus === 'not_connected' || (!isDriveSynced && !isDriveError));
  const hasDriveSyncIssue = isDriveError || isDriveNotSynced;

  const handleConfirmDelete = () => {
    onDeleteBook(book.id);
    onBack();
  };

  return (
    <div className="max-w-6xl mx-auto px-3.5 sm:px-8 py-5 sm:py-8 space-y-6 sm:space-y-10 bg-[#F9F8F5] pb-28 md:pb-8">
      {/* Breadcrumb matching Screen 3 */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-sans text-stone-500 border-b border-[#EBE6DF] pb-4">
        <div className="flex items-center gap-2">
          <button 
            onClick={onBack}
            className="hover:text-stone-900 transition-colors uppercase tracking-wider font-semibold text-[11px]"
          >
            BIBLIOTECA
          </button>
          <span>›</span>
          <span className="uppercase tracking-wider font-semibold text-[11px]">FICÇÃO LITERÁRIA</span>
          <span>›</span>
          <span className="uppercase tracking-wider font-bold text-stone-900 text-[11px] truncate max-w-[200px]">
            {book.title}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-amber-800 text-[11px] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-700" />
          <span>Edição Comemorativa 50 Anos</span>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Column: 3D Book Cover & Primary CTAs */}
        <div className="lg:col-span-4 space-y-6">
          {/* Book Cover Frame */}
          <div className="relative aspect-[3/4] rounded-2xl bg-white p-3 border border-[#E8E2D9] shadow-lg group">
            {/* "COLECIONADOR" ribbon */}
            <div className="absolute top-5 right-5 bg-amber-950/80 backdrop-blur-xs text-amber-200 text-[10px] uppercase font-sans font-bold px-2 py-0.5 rounded shadow-xs z-10 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>COLECIONADOR</span>
            </div>

            <div className="w-full h-full rounded-xl overflow-hidden bg-stone-100 shadow-inner relative">
              {book.coverUrl ? (
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full p-6 flex flex-col justify-between bg-stone-900 text-stone-100">
                  <span className="text-xs uppercase text-amber-300 font-sans tracking-widest">{book.category}</span>
                  <h3 className="font-serif-display font-bold text-xl">{book.title}</h3>
                  <span className="text-xs text-stone-400 font-sans">{book.author}</span>
                </div>
              )}
              {/* Spine highlight */}
              <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-black/40 via-white/10 to-transparent pointer-events-none" />
            </div>
          </div>

          {/* Availability & Pace row */}
          <div className="grid grid-cols-2 gap-3 text-center text-xs font-sans">
            <div className="p-3 rounded-xl bg-white border border-[#E8E2D9] space-y-0.5">
              <span className="text-[10px] uppercase text-stone-600 block font-semibold">Disponibilidade</span>
              <span className="font-bold text-stone-900 block flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Em Acervo
              </span>
            </div>
            <div className="p-3 rounded-xl bg-white border border-[#E8E2D9] space-y-0.5">
              <span className="text-[10px] uppercase text-stone-600 block font-semibold">Ritmo Médio</span>
              <span className="font-bold text-stone-900 block flex items-center justify-center gap-1">
                <Clock className="w-3.5 h-3.5 text-stone-500" /> 9h 40m
              </span>
            </div>
          </div>

          {/* Cloud Sync Status Card */}
          <div className="p-3.5 rounded-xl bg-white border border-[#E8E2D9] flex items-center justify-between gap-3 text-xs font-sans shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isCloud ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-stone-100 text-stone-500'}`}>
                <Cloud className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-stone-900 block leading-tight truncate">
                  {isCloud ? 'Salvo na Nuvem' : 'Armazenado Localmente'}
                </span>
                <span className="text-[11px] text-stone-500 block truncate">
                  {isCloud 
                    ? (book.hasCloudFile ? 'Arquivo completo sincronizado no Firebase' : 'Metadados e progresso na nuvem') 
                    : 'Disponível apenas neste dispositivo'}
                </span>
              </div>
            </div>

            {user && !isCloud && (
              <button
                onClick={async () => {
                  await syncCurrentBook(book, undefined, true);
                }}
                disabled={isSyncing}
                className="px-2.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
                title="Tentar salvar este livro no Google Firebase agora"
              >
                <Cloud className="w-3 h-3 text-amber-300" />
                <span>{isSyncing ? 'Sincronizando...' : 'Fazer Backup'}</span>
              </button>
            )}

            {!user && !isCloud && (
              <span className="text-[10px] text-amber-900 bg-amber-50 px-2 py-1 rounded border border-amber-200 font-medium">
                Conecte a conta para salvar na nuvem
              </span>
            )}
          </div>

          {/* Google Drive "Livros" Sync Status Card (para arquivos EPUB e PDF) */}
          {(book.format === 'epub' || book.format === 'pdf') && (
            <div className={`p-3.5 rounded-xl border flex flex-col gap-2.5 text-xs font-sans shadow-2xs ${
              isDriveError 
                ? 'bg-rose-50/70 border-rose-200' 
                : isDriveSynced 
                  ? 'bg-white border-[#E8E2D9]' 
                  : 'bg-amber-50/60 border-amber-200/80'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isDriveError
                      ? 'bg-rose-100 text-rose-800'
                      : isDriveSynced
                        ? 'bg-sky-50 text-sky-700 border border-sky-200'
                        : 'bg-amber-100 text-amber-800'
                  }`}>
                    <Cloud className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-stone-900 block leading-tight truncate">
                        Google Drive (Livros)
                      </span>
                      {isDriveSynced ? (
                        <span className="text-[9.5px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-medium">
                          ✓ Sincronizado
                        </span>
                      ) : isDriveError ? (
                        <span className="text-[9.5px] bg-rose-100 text-rose-900 border border-rose-300 px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5">
                          <AlertCircle className="w-2.5 h-2.5" /> Erro
                        </span>
                      ) : (
                        <span className="text-[9.5px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-medium">
                          Pendente
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-stone-500 block truncate">
                      {isDriveSynced
                        ? (book.driveFileName ? `Arquivo: ${book.driveFileName}` : `Original salvo na pasta Livros`)
                        : isDriveError
                          ? `Ocorreu um erro ao sincronizar o ${book.format.toUpperCase()} com o Drive`
                          : 'Cópia na nuvem pendente de sincronização'}
                    </span>
                  </div>
                </div>

                {/* Botão sempre ativo para salvar ou atualizar no Drive */}
                <button
                  onClick={() => handleRetrySync()}
                  disabled={syncingToDrive}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 ${
                    isDriveError
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                      : isDriveSynced
                        ? 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200'
                        : 'bg-amber-900 hover:bg-amber-950 text-white shadow-xs'
                  }`}
                  title={`Salvar arquivo ${book.format.toUpperCase()} na pasta Livros do Google Drive`}
                  aria-label="Salvar no Drive"
                >
                  {syncingToDrive ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                      <span>{driveSyncMsg || 'Salvando no Drive...'}</span>
                    </>
                  ) : (
                    <>
                      <Cloud className={`w-3.5 h-3.5 ${isDriveSynced ? 'text-emerald-600' : 'text-amber-300'}`} />
                      <span>
                        {isDriveError
                          ? 'Tentar Novamente'
                          : isDriveSynced
                            ? 'Atualizar no Drive'
                            : `Salvar ${book.format.toUpperCase()} no Drive`}
                      </span>
                    </>
                  )}
                </button>
              </div>

              {driveSyncError && (
                <div className="bg-rose-100/80 border border-rose-300 rounded-lg p-2 text-[10.5px] text-rose-900 flex items-start justify-between gap-1">
                  <span className="leading-tight">{driveSyncError}</span>
                  <button
                    onClick={() => setDriveSyncError(null)}
                    className="text-rose-700 hover:text-rose-950 font-bold shrink-0 px-1"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2.5">
            <button
              onClick={() => onOpenReader(book)}
              className="w-full py-3 px-4 bg-stone-950 hover:bg-stone-800 text-white font-sans font-semibold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <BookOpen className="w-4 h-4 text-amber-300" />
              <span>Começar Leitura Imersiva</span>
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => onPlayAudiobook(book)}
                className="py-2.5 px-3 bg-white hover:bg-stone-50 text-stone-800 border border-[#E8E2D9] rounded-xl text-xs font-semibold font-sans transition-colors flex items-center justify-center gap-1.5"
              >
                <Headphones className="w-3.5 h-3.5 text-amber-700" />
                <span>Audiolivro</span>
              </button>

              <button
                className="py-2.5 px-3 bg-white hover:bg-stone-50 text-stone-800 border border-[#E8E2D9] rounded-xl text-xs font-semibold font-sans transition-colors flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5 text-stone-500" />
                <span>Emprestar</span>
              </button>
            </div>

            <button
              className="w-full py-2.5 px-3 text-xs text-stone-600 hover:text-stone-950 font-sans font-medium flex items-center justify-center gap-1.5"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Adicionar à Lista de Desejos</span>
            </button>

            {/* Excluir Livro da Biblioteca */}
            <button
              onClick={() => setIsConfirmDeleteOpen(true)}
              className="w-full py-2.5 px-3 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold font-sans transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              title="Excluir livro da biblioteca"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Excluir Livro da Biblioteca</span>
            </button>
          </div>

          {/* Coleções & Tags do Livro */}
          <div className="p-4 rounded-xl bg-white border border-[#E8E2D9] space-y-2.5">
            <div className="flex items-center justify-between text-xs font-sans">
              <span className="font-semibold text-stone-900 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-800" />
                <span>Coleções & Tags</span>
              </span>
              <button
                onClick={() => setIsTagModalOpen(true)}
                className="text-[11px] text-amber-800 hover:text-amber-950 font-semibold flex items-center gap-0.5 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Gerenciar</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {book.tags && book.tags.length > 0 ? (
                book.tags.map(t => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 text-xs font-sans font-medium flex items-center gap-1"
                  >
                    <span>{t}</span>
                  </span>
                ))
              ) : (
                <p className="text-[11px] text-stone-400 font-sans italic">
                  Nenhuma coleção atribuída a este livro.
                </p>
              )}
            </div>
          </div>

          {/* Retention Stats */}
          <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#EFE8DC] space-y-1 text-xs font-sans">
            <div className="flex justify-between items-center text-stone-700 font-medium">
              <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">
                PÁGINAS CONCLUÍDAS POR COLEGAS
              </span>
              <span className="font-bold text-stone-900 tabular-nums">78% retém</span>
            </div>
            <div className="w-full h-1.5 bg-[#E5DDD0] rounded-full overflow-hidden">
              <div className="h-full bg-amber-700 w-[78%] rounded-full" />
            </div>
            <p className="text-[11px] text-stone-500 pt-1 leading-tight">
              Índice extraordinário de finalização sem interrupções nos primeiros 4 capítulos.
            </p>
          </div>
        </div>

        {/* Right Column: Literary Specs & Editorial Content */}
        <div className="lg:col-span-8 space-y-7">
          {/* Header & Badges */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-sans">
              <span className="px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900 text-[10px] uppercase tracking-wider">
                REALISMO MÁGICO
              </span>
              <span className="text-stone-400">·</span>
              <span className="text-stone-600">Obra-Prima Universal</span>
              <span className="text-stone-400">·</span>
              <span className="text-stone-500">Lançamento 1967</span>
            </div>

            <h1 className="font-serif-display text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-950 tracking-tight leading-tight">
              {book.title}
            </h1>

            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-stone-600 font-sans">
              <span>Por <strong className="text-stone-900 font-semibold">{book.author}</strong></span>
              <span className="text-stone-300">/</span>
              <span className="text-stone-500">Tradução premiada por Eric Nepomuceno</span>
            </div>

            {/* Ratings */}
            <div className="flex items-center gap-3 pt-1 text-xs font-sans text-stone-600">
              <div className="flex items-center gap-1 font-bold text-stone-900">
                <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                <span>4.8</span>
                <span className="font-normal text-stone-400">/ 5.0</span>
              </div>
              <span className="text-stone-300">·</span>
              <span className="text-stone-600">1.420 avaliações de leitores</span>
              <span className="text-stone-300">·</span>
              <span className="text-emerald-700 font-medium">✓ 98% de aclamação</span>
            </div>
          </div>

          {/* Sinopse da Obra */}
          <div className="p-5 rounded-2xl bg-white border border-[#E8E2D9] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-serif-display font-bold text-sm text-stone-900">
                Sinopse da Obra
              </h3>
              <span className="text-[10px] uppercase tracking-widest text-[#9A3412] font-sans font-bold">
                MACONDO & OS BUENDÍA
              </span>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 font-sans leading-relaxed">
              {book.description || 'Em Macondo, pequena aldeia fictícia encravada na América Latina, acompanhamos a saga épica de sete gerações da família Buendía. Do patriarca José Arcadio Buendía — visionário deslumbrado por alquimia e invenções ciganas trazidas por Melquíades — até o declínio inevitável de sua linhagem sob o signo indelével da solidão.'}
            </p>
            <button className="text-xs text-[#9A3412] hover:text-[#78280E] font-medium font-sans flex items-center gap-1">
              <span>Continuar lendo</span>
              <span className="text-[10px]">⌵</span>
            </button>
          </div>

          {/* Large Quote Box */}
          <div className="p-6 rounded-2xl bg-[#FAF6F0] border border-[#EFE8DC] space-y-2 relative">
            <Quote className="w-6 h-6 text-amber-800/30" />
            <p className="font-serif-editorial italic text-base sm:text-lg text-stone-900 leading-relaxed pl-2">
              “Muitos anos depois, diante do pelotão de fuzilamento, o Coronel Aureliano Buendía havia de recordar aquela tarde remota em que seu pai o levou para conhecer o gelo.”
            </p>
            <span className="text-[11px] uppercase tracking-widest font-sans font-semibold text-stone-600 block pl-2">
              — ABERTURA LENDÁRIA, CAPÍTULO I
            </span>
          </div>

          {/* Ficha Técnica & Edição Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-serif-display font-bold text-sm text-stone-900">
                Ficha Técnica & Edição
              </h3>
              <span className="text-[10px] text-stone-400 font-mono">
                REF: GGM-1967-COL
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-sans">
              <div className="p-3 rounded-xl bg-white border border-[#E8E2D9]">
                <span className="text-[10px] uppercase text-stone-400 block font-semibold">EDITORA</span>
                <span className="font-semibold text-stone-900">Record Clássicos</span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#E8E2D9]">
                <span className="text-[10px] uppercase text-stone-400 block font-semibold">EDIÇÃO</span>
                <span className="font-semibold text-stone-900">94ª Edição Revista</span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#E8E2D9]">
                <span className="text-[10px] uppercase text-stone-400 block font-semibold">EXTENSÃO</span>
                <span className="font-semibold text-stone-900">448 páginas</span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#E8E2D9]">
                <span className="text-[10px] uppercase text-stone-400 block font-semibold">IDIOMA</span>
                <span className="font-semibold text-stone-900">Português (Brasil)</span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#E8E2D9]">
                <span className="text-[10px] uppercase text-stone-400 block font-semibold">ISBN-13</span>
                <span className="font-semibold text-stone-900 font-mono">978-8501012073</span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#E8E2D9]">
                <span className="text-[10px] uppercase text-stone-400 block font-semibold">FORMATO</span>
                <span className="font-semibold text-stone-900">Capa Dura & E-book</span>
              </div>
            </div>
          </div>

          {/* Atmosfera & Cadência Narrativa (Community consensus meters) */}
          <div className="p-5 rounded-2xl bg-white border border-[#E8E2D9] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif-display font-bold text-sm text-stone-900">
                Atmosfera & Cadência Narrativa
              </h3>
              <span className="text-[10px] text-stone-500 font-sans">
                Consenso da Comunidade Lumina
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-sans">
              <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#EFE8DC] space-y-1.5">
                <div className="flex justify-between font-bold text-stone-900">
                  <span>Poético & Lírico</span>
                  <span className="text-amber-800">95%</span>
                </div>
                <div className="w-full h-1.5 bg-[#E5DDD0] rounded-full overflow-hidden">
                  <div className="h-full bg-amber-700 w-[95%] rounded-full" />
                </div>
                <p className="text-[10.5px] text-stone-500">Prosa rica em imagética densa</p>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#EFE8DC] space-y-1.5">
                <div className="flex justify-between font-bold text-stone-900">
                  <span>Mágico & Onírico</span>
                  <span className="text-amber-800">92%</span>
                </div>
                <div className="w-full h-1.5 bg-[#E5DDD0] rounded-full overflow-hidden">
                  <div className="h-full bg-amber-700 w-[92%] rounded-full" />
                </div>
                <p className="text-[10.5px] text-stone-500">Distorção sutil da realidade</p>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#EFE8DC] space-y-1.5">
                <div className="flex justify-between font-bold text-stone-900">
                  <span>Complexidade Genealógica</span>
                  <span className="text-amber-800">88%</span>
                </div>
                <div className="w-full h-1.5 bg-[#E5DDD0] rounded-full overflow-hidden">
                  <div className="h-full bg-amber-700 w-[88%] rounded-full" />
                </div>
                <p className="text-[10.5px] text-stone-500">Requer árvore genealógica de apoio</p>
              </div>
            </div>
          </div>

          {/* Diários de Leitura & Resenhas */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif-display font-bold text-base text-stone-900">
                  Diários de Leitura & Resenhas
                </h3>
                <p className="text-xs text-stone-500 font-sans">
                  Anotações e reflexões de leitores da comunidade
                </p>
              </div>
              <div className="flex gap-1 text-[11px] font-sans">
                <button className="px-2.5 py-1 rounded-md bg-stone-900 text-white font-medium">Mais Úteis</button>
                <button className="px-2.5 py-1 rounded-md text-stone-600 hover:bg-stone-100">Recentes</button>
              </div>
            </div>

            {/* Review Cards */}
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-white border border-[#E8E2D9] space-y-2">
                <div className="flex items-center justify-between text-xs font-sans">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center text-[10px]">
                      RM
                    </div>
                    <span className="font-semibold text-stone-900">Rodrigo Medeiros</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 font-medium">
                      ✓ Leitura Verificada
                    </span>
                  </div>
                  <span className="text-amber-500">★★★★★</span>
                </div>
                <p className="text-xs sm:text-sm text-stone-700 font-serif leading-relaxed">
                  “García Márquez constrói algo que transcende a ficção convencional. A sensação ao ler as páginas finais é de ter habitado um universo inteiro que existiu e se desfez num sopro bíblico. Aconselho fortemente utilizar o mapa genealógico integrado do leitor Lumina para não se perder entre os múltiplos Aurelianos e Josés Arcadios.”
                </p>
                <div className="flex items-center justify-between text-[11px] text-stone-500 font-sans pt-1">
                  <span className="flex items-center gap-1 text-stone-600 hover:text-stone-900 cursor-pointer">
                    <ThumbsUp className="w-3 h-3" /> 142 acharam útil
                  </span>
                  <span>Há 2 semanas</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#E8E2D9] space-y-2">
                <div className="flex items-center justify-between text-xs font-sans">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-stone-300 text-stone-800 font-bold flex items-center justify-center text-[10px]">
                      CF
                    </div>
                    <span className="font-semibold text-stone-900">Clarice Fontoura</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 font-medium">
                      ✓ Leitura Verificada
                    </span>
                  </div>
                  <span className="text-amber-500">★★★★★</span>
                </div>
                <p className="text-xs sm:text-sm text-stone-700 font-serif leading-relaxed">
                  “Úrsula Iguarán é a espinha dorsal de tudo. A força com que ela sustenta a casa contra a maré do tempo e a loucura dos homens de sua família é inigualável. Uma experiência obrigatória para qualquer leitor que ame as palavras.”
                </p>
                <div className="flex items-center justify-between text-[11px] text-stone-500 font-sans pt-1">
                  <span className="flex items-center gap-1 text-stone-600 hover:text-stone-900 cursor-pointer">
                    <ThumbsUp className="w-3 h-3" /> 96 acharam útil
                  </span>
                  <span>Há 1 mês</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal to Delete Book */}
      {isConfirmDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif-display font-bold text-lg text-stone-950 leading-snug">
                  Excluir este livro?
                </h3>
                <p className="text-xs text-stone-600 font-sans leading-relaxed">
                  Tem certeza de que deseja remover <strong className="text-stone-900 font-semibold">{book.title}</strong> da sua biblioteca? O arquivo e as posições de leitura serão excluídos localmente.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100 font-sans">
              <button
                onClick={() => setIsConfirmDeleteOpen(false)}
                className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Excluir Livro</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Manager Modal */}
      {isTagModalOpen && (
        <TagManagerModal
          isOpen={true}
          onClose={() => setIsTagModalOpen(false)}
          book={book}
          allAvailableTags={allTags}
          onSaveTags={(bookId, tags) => {
            onSaveBookTags(bookId, tags);
            setIsTagModalOpen(false);
          }}
          onCreateTag={onCreateTag}
        />
      )}
    </div>
  );
};
