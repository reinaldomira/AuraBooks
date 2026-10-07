import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, X, BookOpen, Sparkles, Loader2, Cloud } from 'lucide-react';
import { parseEpubFile } from '../services/epubParser';
import { parsePdfFile } from '../services/pdfParser';
import { parseTxtFile } from '../services/txtParser';
import { parseMobiOrAzw3File } from '../services/mobiParser';
import { saveBook } from '../services/storageService';
import { saveOriginalEpub, getOriginalEpub } from '../services/epubStorageService';
import { Book } from '../types/book';
import { useAuth } from '../context/AuthContext';
import { findBookByName, uploadBookToDrive, isDriveAuthorized } from '../services/googleDriveService';
import { requestGoogleDriveAccessToken } from '../services/firebase';
import { generatePdfFromBook } from '../services/pdfGenerator';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookImported: (book: Book, originalFile?: Blob | File, openReader?: boolean) => void;
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
  const [driveSyncNote, setDriveSyncNote] = useState<string>('');
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setStatus('parsing');
    setErrorMessage('');
    setDriveSyncNote('');
    setParsedBook(null);
    setLastUploadedFile(file);

    const ext = file.name.split('.').pop()?.toLowerCase();

    try {
      // ETAPA 1: Processamento e Armazenamento Local (IndexedDB & Foliate)
      let book: Book;
      if (ext === 'epub') {
        setStatusMessage('Extraindo capítulos, metadados e sumário do EPUB...');
        book = await parseEpubFile(file);
        // Preserva o arquivo EPUB original intacto no armazenamento local para o Foliate.js
        await saveOriginalEpub(book.id, file);
      } else if (ext === 'pdf') {
        setStatusMessage('Renderizando capa e extraindo páginas do PDF...');
        book = await parsePdfFile(file);
        // Preserva o arquivo PDF original intacto no armazenamento local
        await saveOriginalEpub(book.id, file);
      } else if (ext === 'mobi' || ext === 'azw3' || ext === 'kf8') {
        setStatusMessage(`Decodificando metadados, capa e seções do arquivo ${ext.toUpperCase()}...`);
        book = await parseMobiOrAzw3File(file, file.name);
        // Preserva o arquivo original intacto no armazenamento local para o leitor imersivo
        await saveOriginalEpub(book.id, file);
      } else if (ext === 'txt' || ext === 'md') {
        setStatusMessage('Organizando seções e parágrafos do texto...');
        book = await parseTxtFile(file);
      } else {
        throw new Error('Formato não suportado. Por favor, envie um arquivo .epub, .pdf, .mobi, .azw3 ou .txt');
      }

      setStatusMessage('✓ Livro salvo com segurança na biblioteca local...');
      await saveBook(book);

      // ETAPA 2: Envio do Arquivo Original (EPUB / PDF / MOBI / AZW3) para o Google Drive (/Livros)
      if (ext === 'epub' || ext === 'pdf' || ext === 'mobi' || ext === 'azw3' || ext === 'kf8') {
        if (isDriveAuthorized()) {
          try {
            setStatusMessage('☁ Verificando pasta "Livros" no Google Drive...');
            // Procura antes pelo nome na pasta "Livros" para não duplicar arquivos
            const existingDriveFile = await findBookByName(file.name);

            if (existingDriveFile) {
              book.driveFileId = existingDriveFile.id;
              book.driveFileName = existingDriveFile.name;
              book.driveLastSyncedAt = Date.now();
              book.driveSyncStatus = 'synced';
              setStatusMessage('✓ Vinculado ao arquivo existente no Google Drive (/Livros)');
            } else {
              setStatusMessage(`☁ Enviando ${ext.toUpperCase()} original para Google Drive (/Livros)...`);
              const driveFile = await uploadBookToDrive(file, file.name);
              book.driveFileId = driveFile.id;
              book.driveFileName = driveFile.name;
              book.driveLastSyncedAt = Date.now();
              book.driveSyncStatus = 'synced';
              setStatusMessage('✓ Salvo no Google Drive (/Livros)');
            }

            // Atualiza o livro no IndexedDB com o driveFileId obtido
            await saveBook(book);
          } catch (driveErr: any) {
            console.warn('Falha na sincronização com o Google Drive:', driveErr);
            book.driveSyncStatus = 'error';
            await saveBook(book);
            setDriveSyncNote(driveErr?.message || 'Falha na comunicação com o Google Drive');
          }
        } else {
          // Google Drive não conectado nesta sessão
          book.driveSyncStatus = 'not_connected';
          await saveBook(book);
        }
      }

      setParsedBook(book);
      setStatus('success');
      // Atualiza a biblioteca em segundo plano sem fechar o modal
      onBookImported(book, file, false);
    } catch (err: any) {
      console.error('Error parsing book file:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Falha ao processar o arquivo. Verifique se o arquivo não está corrompido.');
    }
  };

  const handleConnectDriveAndUpload = async () => {
    if (!parsedBook) return;
    setIsConnectingDrive(true);
    setDriveSyncNote('');
    try {
      let fileToUpload = lastUploadedFile || (await getOriginalEpub(parsedBook.id));
      if (!fileToUpload) {
        if (parsedBook.format === 'pdf') {
          fileToUpload = await generatePdfFromBook(parsedBook);
          await saveOriginalEpub(parsedBook.id, fileToUpload);
        } else {
          throw new Error('Arquivo original não encontrado para envio ao Google Drive.');
        }
      }
      await requestGoogleDriveAccessToken();
      const fileName = fileToUpload instanceof File ? fileToUpload.name : `${parsedBook.title}.${parsedBook.format || 'pdf'}`;
      const existing = await findBookByName(fileName);
      const updatedBook: Book = { ...parsedBook };

      if (existing) {
        updatedBook.driveFileId = existing.id;
        updatedBook.driveFileName = existing.name;
        updatedBook.driveLastSyncedAt = Date.now();
        updatedBook.driveSyncStatus = 'synced';
      } else {
        const driveFile = await uploadBookToDrive(fileToUpload, fileName);
        updatedBook.driveFileId = driveFile.id;
        updatedBook.driveFileName = driveFile.name;
        updatedBook.driveLastSyncedAt = Date.now();
        updatedBook.driveSyncStatus = 'synced';
      }

      await saveBook(updatedBook);
      setParsedBook(updatedBook);
      onBookImported(updatedBook, fileToUpload, false);
    } catch (err: any) {
      console.warn('Erro ao conectar e enviar para o Google Drive:', err);
      setDriveSyncNote(err?.message || 'Não foi possível conectar com o Google Drive');
    } finally {
      setIsConnectingDrive(false);
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
      onBookImported(parsedBook, lastUploadedFile || undefined, true);
    }
    handleClose();
  };

  const handleClose = () => {
    setStatus('idle');
    setErrorMessage('');
    setDriveSyncNote('');
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
                  accept=".epub,.pdf,.mobi,.azw3,.kf8,.txt,.md"
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
                  <span className="font-semibold text-stone-700">PDF</span>,{' '}
                  <span className="font-semibold text-stone-700">MOBI</span>,{' '}
                  <span className="font-semibold text-stone-700">AZW3</span> ou{' '}
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

              <div className="bg-white p-3.5 rounded-xl border border-stone-200 text-left text-xs space-y-1.5 mb-4">
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

              {/* Status de Sincronização Google Drive / Local */}
              {(parsedBook.format === 'epub' || parsedBook.format === 'pdf' || parsedBook.format === 'mobi' || parsedBook.format === 'azw3') && (
                <div className="mb-5 text-left">
                  {parsedBook.driveSyncStatus === 'synced' ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold block text-emerald-950">✓ Salvo no Google Drive (/Livros)</span>
                          <span className="text-emerald-700 text-[11px] block">
                            Arquivo original {parsedBook.format.toUpperCase()} sincronizado na nuvem e preservado localmente.
                          </span>
                          {parsedBook.driveFileId && (
                            <span className="block text-[10px] text-emerald-600 font-mono mt-0.5 truncate">
                              ID: {parsedBook.driveFileId}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleConnectDriveAndUpload}
                        disabled={isConnectingDrive}
                        className="px-2.5 py-1.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg font-medium text-xs shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                        title="Reenviar arquivo para o Google Drive"
                      >
                        {isConnectingDrive ? 'Enviando...' : 'Reenviar'}
                      </button>
                    </div>
                  ) : (
                    <div className={`p-3 rounded-xl border text-xs flex flex-col gap-2.5 ${
                      parsedBook.driveSyncStatus === 'error' 
                        ? 'bg-rose-50/80 border-rose-200 text-rose-900' 
                        : 'bg-stone-100 border-stone-200 text-stone-700'
                    }`}>
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-start gap-2 min-w-0">
                          {parsedBook.driveSyncStatus === 'error' ? (
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          ) : (
                            <Cloud className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <span className="font-semibold block text-stone-900">
                              {parsedBook.driveSyncStatus === 'error' 
                                ? 'Erro ao enviar para o Google Drive' 
                                : 'Salvo na biblioteca local'}
                            </span>
                            <span className="text-stone-600 block text-[11px] mt-0.5">
                              {driveSyncNote 
                                ? driveSyncNote 
                                : `Clique ao lado para salvar uma cópia do ${parsedBook.format.toUpperCase()} na pasta Livros do Google Drive.`}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleConnectDriveAndUpload}
                          disabled={isConnectingDrive}
                          className="px-3.5 py-2 bg-amber-900 hover:bg-amber-950 text-white rounded-lg font-semibold text-xs shrink-0 transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {isConnectingDrive ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                              <span>Enviando...</span>
                            </>
                          ) : (
                            <>
                              <Cloud className="w-3.5 h-3.5 text-amber-300" />
                              <span>Salvar no Drive</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
