import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, X, BookOpen, Sparkles, Loader2, Cloud } from 'lucide-react';
import { parseEpubFile } from '../services/epubParser';
import { parsePdfFile } from '../services/pdfParser';
import { parseTxtFile } from '../services/txtParser';
import { saveBook } from '../services/storageService';
import { saveOriginalEpub } from '../services/epubStorageService';
import { Book } from '../types/book';
import { useAuth } from '../context/AuthContext';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookImported: (book: Book, originalFile?: Blob | File) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onBookImported,
}) => {
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [parsedBook, setParsedBook] = useState<Book | null>(null);
  const [lastUploadedFile, setLastUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setStatus('parsing');
    setErrorMessage('');
    setParsedBook(null);
    setLastUploadedFile(file);

    const ext = file.name.split('.').pop()?.toLowerCase();

    try {
      let book: Book;
      if (ext === 'epub') {
        setStatusMessage('Extraindo capítulos, metadados e sumário do EPUB...');
        book = await parseEpubFile(file);
        // Preserva o arquivo EPUB original intacto no armazenamento para o Foliate.js
        await saveOriginalEpub(book.id, file);
      } else if (ext === 'pdf') {
        setStatusMessage('Renderizando capa e extraindo páginas do PDF...');
        book = await parsePdfFile(file);
      } else if (ext === 'txt' || ext === 'md') {
        setStatusMessage('Organizando seções e parágrafos do texto...');
        book = await parseTxtFile(file);
      } else {
        throw new Error('Formato não suportado. Por favor, envie um arquivo .epub, .pdf ou .txt');
      }

      setStatusMessage('Gravando na sua biblioteca local com segurança...');
      await saveBook(book);
      setParsedBook(book);
      setStatus('success');
      // Immediately refresh books in parent component with original file for cloud backup
      onBookImported(book, file);
    } catch (err: any) {
      console.error('Error parsing book file:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Falha ao processar o arquivo. Verifique se o arquivo não está corrompido.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFinish = () => {
    if (parsedBook) {
      onBookImported(parsedBook, lastUploadedFile || undefined);
    }
    handleClose();
  };

  const handleClose = () => {
    setStatus('idle');
    setErrorMessage('');
    setParsedBook(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-stone-50 rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-white">
          <div>
            <h3 className="font-editorial-title text-xl font-semibold text-stone-900">
              Adicionar Livro à Biblioteca
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Organização automática de capítulos, capa e áudio
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {status === 'idle' && (
            <div>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-amber-600 bg-amber-50/60 scale-[1.01]'
                    : 'border-stone-300 hover:border-stone-400 bg-white'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".epub,.pdf,.txt,.md"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFile(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-14 h-14 mx-auto rounded-full bg-amber-100/70 text-amber-800 flex items-center justify-center mb-4">
                  <Upload className="w-6 h-6 text-amber-900" />
                </div>

                <p className="font-medium text-stone-900 text-sm">
                  Arraste seu livro aqui ou clique para selecionar
                </p>
                <p className="text-xs text-stone-500 mt-1.5">
                  Suporta arquivos <span className="font-semibold text-stone-700">EPUB</span>,{' '}
                  <span className="font-semibold text-stone-700">PDF</span> ou{' '}
                  <span className="font-semibold text-stone-700">TXT</span>
                </p>

                <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-center gap-6 text-xs text-stone-400">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" /> EPUB (Ideal p/ áudio)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-rose-600" /> PDF Digital
                  </span>
                </div>
              </div>

              <div className="mt-4 p-3.5 rounded-lg bg-stone-100 border border-stone-200 text-xs text-stone-600 space-y-1">
                <p className="font-medium text-stone-800">
                  Como funciona a organização automática:
                </p>
                <p>
                  O AuraBooks analisa o arquivo, gera capa em alta definição, separa por capítulos, calcula a duração estimada de leitura e converte tudo em áudio falado por parágrafo.
                </p>
              </div>

              {!user && (
                <div className="mt-3 p-3 rounded-lg bg-amber-50/90 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                  <Cloud className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-amber-950">Acessar livros em múltiplos computadores?</span>
                    <span className="text-amber-800">
                      Conecte sua conta Google no botão <strong>"Conectar Nuvem"</strong> da barra superior para sincronizar seus livros e continuar lendo em qualquer PC.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {status === 'parsing' && (
            <div className="py-12 text-center">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <Loader2 className="w-16 h-16 text-amber-600 animate-spin" />
                <BookOpen className="w-6 h-6 text-amber-800 absolute inset-0 m-auto" />
              </div>
              <h4 className="font-medium text-stone-900 text-base mb-1">
                Organizando Livro...
              </h4>
              <p className="text-xs text-stone-500 max-w-xs mx-auto animate-pulse">
                {statusMessage}
              </p>
            </div>
          )}

          {status === 'success' && parsedBook && (
            <div className="py-4 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-editorial-title text-xl font-bold text-stone-900 mb-1">
                {parsedBook.title}
              </h4>
              <p className="text-xs text-stone-500 mb-4">
                {parsedBook.author} · {parsedBook.chapters.length} Capítulos · {parsedBook.estimatedAudioMinutes} min de áudio
              </p>

              <div className="bg-white p-3.5 rounded-xl border border-stone-200 text-left text-xs space-y-1.5 mb-6">
                <div className="flex justify-between text-stone-600">
                  <span>Formato detectado:</span>
                  <span className="font-medium text-stone-900 uppercase">{parsedBook.format}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Total de palavras:</span>
                  <span className="font-medium text-stone-900 tabular-nums">
                    {parsedBook.totalWords.toLocaleString()} palavras
                  </span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Pronto para áudio:</span>
                  <span className="font-medium text-emerald-700 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Leitura por voz ativada
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleFinish}
                  className="flex-1 py-2.5 px-4 bg-stone-900 text-white rounded-lg font-medium text-sm hover:bg-stone-800 transition-colors shadow-sm"
                >
                  Abrir no Leitor Agora
                </button>
                <button
                  onClick={handleClose}
                  className="py-2.5 px-4 bg-stone-200 text-stone-700 rounded-lg font-medium text-sm hover:bg-stone-300 transition-colors"
                >
                  Ver na Biblioteca
                </button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="py-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-stone-900 text-base mb-1">
                Erro ao processar livro
              </h4>
              <p className="text-xs text-rose-600 max-w-sm mx-auto mb-6">
                {errorMessage}
              </p>
              <button
                onClick={() => setStatus('idle')}
                className="py-2 px-5 bg-stone-900 text-white text-xs font-medium rounded-lg hover:bg-stone-800 transition-colors"
              >
                Tentar outro arquivo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
