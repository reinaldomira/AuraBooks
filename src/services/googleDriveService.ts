/**
 * googleDriveService.ts
 * 
 * Camada de integração com a Google Drive API v3 para o AuraBooks.
 * Responsável por gerenciar o armazenamento e leitura de arquivos EPUB
 * diretamente na pasta existente "Livros" do Google Drive do usuário.
 * 
 * Escopo utilizado: https://www.googleapis.com/auth/drive.file (mínimo privilégio)
 */

import { getDriveAccessToken, requestGoogleDriveAccessToken, auth, syncBookToCloud } from './firebase';
import { getBook, saveBook, getAllBooks } from './storageService';
import { hasOriginalEpub, saveOriginalEpub, getOriginalEpub } from './epubStorageService';
import { parseEpubFile } from './epubParser';
import { parsePdfFile } from './pdfParser';
import { generatePdfFromBook } from './pdfGenerator';
import { Book } from '../types/book';

export const BOOKS_FOLDER_NAME = 'Livros';
export const EPUB_MIME_TYPE = 'application/epub+zip';
export const PDF_MIME_TYPE = 'application/pdf';

export interface DriveBookFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number | string;
  modifiedTime?: string;
  createdTime?: string;
}

// Cache em memória do ID da pasta "Livros" para evitar requisições redundantes de busca
let cachedBooksFolderId: string | null = null;
const STORAGE_FOLDER_KEY = 'aurabooks_drive_books_folder_id';

/**
 * Obtém o folderId persistido em localStorage
 */
export function getCustomBooksFolderId(): string | null {
  try {
    return localStorage.getItem(STORAGE_FOLDER_KEY);
  } catch {
    return null;
  }
}

/**
 * Define ou limpa o folderId persistido
 */
export function setCustomBooksFolderId(folderId: string | null): void {
  try {
    if (folderId) {
      localStorage.setItem(STORAGE_FOLDER_KEY, folderId);
      cachedBooksFolderId = folderId;
    } else {
      localStorage.removeItem(STORAGE_FOLDER_KEY);
      cachedBooksFolderId = null;
    }
  } catch {
    cachedBooksFolderId = folderId;
  }
}

/**
 * Limpa o cache local do ID da pasta
 */
export function clearBooksFolderCache(): void {
  cachedBooksFolderId = null;
  setCustomBooksFolderId(null);
}

/**
 * Garante que temos um token OAuth válido em memória.
 * Se o token não estiver presente (ex: página recarregada), solicita autorização ao usuário.
 */
export async function ensureDriveAccessToken(): Promise<string> {
  const token = getDriveAccessToken();
  if (token) {
    return token;
  }
  // Solicita autorização via popup OAuth do Google
  return await requestGoogleDriveAccessToken();
}

/**
 * Verifica se o aplicativo atualmente possui um token em memória
 */
export function isDriveAuthorized(): boolean {
  return Boolean(getDriveAccessToken());
}

/**
 * Localiza a pasta existente chamada "Livros" no Google Drive.
 * 
 * SOBRE O ESCOPO drive.file:
 * O escopo restrito https://www.googleapis.com/auth/drive.file acessa apenas
 * arquivos/pastas criados pelo app ou selecionados pelo usuário.
 * Pastas criadas externamente no drive.google.com não são visíveis via query.
 * 
 * FLUXO RESILIENTE:
 * 1. Se já houver um ID verificado em cache ou localStorage, reutiliza.
 * 2. Consulta a API procurando pasta com nome "Livros" no escopo autorizado.
 * 3. Se encontrada, utiliza o ID existente.
 * 4. Se não encontrada, cria a pasta "Livros" no Google Drive do usuário,
 *    garantindo autorização total no escopo drive.file para armazenar os EPUBs.
 */
export async function findBooksFolder(forceRefresh: boolean = false): Promise<string> {
  if (cachedBooksFolderId && !forceRefresh) {
    return cachedBooksFolderId;
  }

  const token = await ensureDriveAccessToken();

  // 1. Verifica se já temos um folderId persistido em localStorage
  const storedFolderId = getCustomBooksFolderId();
  if (storedFolderId && !forceRefresh) {
    try {
      const verifyRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${storedFolderId}?fields=id,name,mimeType,trashed`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
          }
        }
      );
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json();
        if (verifyData && !verifyData.trashed && verifyData.id) {
          const verifiedId = String(verifyData.id);
          cachedBooksFolderId = verifiedId;
          return verifiedId;
        }
      }
    } catch {
      // Se falhar a verificação do ID em cache, continua para busca ou criação
    }
  }

  // 2. Busca pastas existentes com o nome "Livros" que não estejam na lixeira
  const query = `mimeType = 'application/vnd.google-apps.folder' and (name = '${BOOKS_FOLDER_NAME}' or name = '${BOOKS_FOLDER_NAME.toLowerCase()}') and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent('files(id, name, mimeType, trashed)')}&spaces=drive`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Falha ao consultar pastas no Google Drive (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const folders: { id: string; name: string }[] = data.files || [];

  if (folders.length > 0 && folders[0].id) {
    // Encontrou a pasta existente acessível no Drive
    const foundId = String(folders[0].id);
    cachedBooksFolderId = foundId;
    setCustomBooksFolderId(foundId);
    return foundId;
  }

  // 3. Se a pasta não foi localizada (por restrição do escopo drive.file em pastas externas),
  // cria a pasta "Livros" no Google Drive para que o app tenha permissão imediata de salvar os livros.
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      name: BOOKS_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!createRes.ok) {
    const errorBody = await createRes.text();
    throw new Error(
      `Não foi possível localizar ou criar a pasta "${BOOKS_FOLDER_NAME}" no seu Google Drive (${createRes.status}): ${errorBody}`
    );
  }

  const newFolder = await createRes.json();
  if (!newFolder?.id) {
    throw new Error(`A Google Drive API não retornou o ID da pasta "${BOOKS_FOLDER_NAME}".`);
  }

  const createdId = String(newFolder.id);
  cachedBooksFolderId = createdId;
  setCustomBooksFolderId(createdId);
  return createdId;
}

/**
 * Envia um arquivo (EPUB ou PDF) original para a pasta "Livros" no Google Drive.
 * 
 * Utiliza o protocolo Resumable Upload da Google Drive API v3:
 * - Adequado para arquivos grandes (vários MB)
 * - Evita carregar cópias duplicadas do arquivo em memória (streaming direto do Blob/File)
 * - Define a pasta pai como o ID da pasta "Livros"
 * - Preserva o MIME type original (application/epub+zip ou application/pdf)
 */
export async function uploadBookToDrive(
  file: File | Blob,
  customFileName?: string
): Promise<DriveBookFile> {
  const token = await ensureDriveAccessToken();
  const folderId = await findBooksFolder();

  // Determina nome e MIME type com base na extensão ou tipo do arquivo
  let fileName = customFileName || (file instanceof File ? file.name : 'livro.epub');
  const isPdf = fileName.toLowerCase().endsWith('.pdf') || (file.type && file.type.includes('pdf'));
  const isMobi = fileName.toLowerCase().endsWith('.mobi');
  const isAzw3 = fileName.toLowerCase().endsWith('.azw3') || fileName.toLowerCase().endsWith('.kf8');
  
  let mimeType = EPUB_MIME_TYPE;
  if (isPdf) {
    mimeType = PDF_MIME_TYPE;
    if (!fileName.toLowerCase().endsWith('.pdf')) {
      fileName = `${fileName}.pdf`;
    }
  } else if (isMobi) {
    mimeType = 'application/x-mobipocket-ebook';
    if (!fileName.toLowerCase().endsWith('.mobi')) {
      fileName = `${fileName}.mobi`;
    }
  } else if (isAzw3) {
    mimeType = 'application/vnd.amazon.ebook';
    if (!fileName.toLowerCase().endsWith('.azw3')) {
      fileName = `${fileName}.azw3`;
    }
  } else {
    if (!fileName.toLowerCase().endsWith('.epub')) {
      fileName = `${fileName}.epub`;
    }
  }

  const fileSize = file.size;

  // 1. Inicia a sessão de upload resumable enviando os metadados
  const metadata = {
    name: fileName,
    mimeType,
    parents: [folderId]
  };

  const initiateUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';
  const initiateRes = await fetch(initiateUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': fileSize.toString()
    },
    body: JSON.stringify(metadata)
  });

  if (!initiateRes.ok) {
    const errorBody = await initiateRes.text();
    throw new Error(`Falha ao iniciar upload no Google Drive (${initiateRes.status}): ${errorBody}`);
  }

  const uploadLocationUrl = initiateRes.headers.get('Location');
  if (!uploadLocationUrl) {
    throw new Error('A Google Drive API não retornou o endereço de upload (Location header ausente).');
  }

  // 2. Envia os bytes do arquivo diretamente via PUT para o link de upload
  // O navegador transmite o Blob diretamente via rede sem alocação extra de memória
  const uploadRes = await fetch(uploadLocationUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'Content-Length': fileSize.toString()
    },
    body: file
  });

  if (!uploadRes.ok) {
    const errorBody = await uploadRes.text();
    throw new Error(`Falha ao transmitir arquivo para o Google Drive (${uploadRes.status}): ${errorBody}`);
  }

  const resultData = await uploadRes.json();

  return {
    id: resultData.id,
    name: resultData.name,
    mimeType: resultData.mimeType,
    size: resultData.size || fileSize,
    modifiedTime: resultData.modifiedTime
  };
}

/**
 * Baixa o conteúdo binário de um livro (EPUB ou PDF) do Google Drive pelo ID do arquivo.
 */
export async function downloadBookFromDrive(fileId: string): Promise<Blob> {
  const token = await ensureDriveAccessToken();

  let mimeType = EPUB_MIME_TYPE;
  try {
    const meta = await getBookFile(fileId);
    if (meta.mimeType) {
      mimeType = meta.mimeType;
    } else if (meta.name && meta.name.toLowerCase().endsWith('.pdf')) {
      mimeType = PDF_MIME_TYPE;
    }
  } catch {
    // Segue com fallback
  }

  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const response = await fetch(downloadUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Falha ao baixar arquivo do Google Drive (${response.status}): ${errorBody}`);
  }

  const blob = await response.blob();
  return new Blob([blob], { type: mimeType });
}

/**
 * Remove um arquivo (EPUB ou PDF) do Google Drive.
 * 
 * Requisito de segurança: Inclui diálogo de confirmação prévio para operações
 * destrutivas em dados do usuário no Google Workspace, com opção de cancelamento.
 */
export async function deleteBookFromDrive(fileId: string, skipConfirm: boolean = false): Promise<void> {
  if (!skipConfirm) {
    const confirmed = window.confirm('Deseja excluir este livro do seu Google Drive? Esta ação não pode ser desfeita.');
    if (!confirmed) {
      throw new Error('Exclusão cancelada pelo usuário.');
    }
  }

  const token = await ensureDriveAccessToken();
  const deleteUrl = `https://www.googleapis.com/drive/v3/files/${fileId}`;

  const response = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok && response.status !== 404) {
    const errorBody = await response.text();
    throw new Error(`Falha ao excluir arquivo do Google Drive (${response.status}): ${errorBody}`);
  }
}

/**
 * Procura um livro (EPUB ou PDF) dentro da pasta "Livros" pelo nome exato do arquivo.
 * Retorna os metadados do arquivo ou null se não for encontrado.
 */
export async function findBookByName(fileName: string): Promise<DriveBookFile | null> {
  const token = await ensureDriveAccessToken();
  const folderId = await findBooksFolder();

  const isPdf = fileName.toLowerCase().endsWith('.pdf');
  const targetName = isPdf 
    ? fileName 
    : (fileName.toLowerCase().endsWith('.epub') ? fileName : `${fileName}.epub`);

  const safeName = targetName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const safeOriginalName = fileName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  
  const query = targetName !== fileName
    ? `'${folderId}' in parents and (name = '${safeName}' or name = '${safeOriginalName}') and trashed = false`
    : `'${folderId}' in parents and name = '${safeName}' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent('files(id, name, mimeType, size, modifiedTime, createdTime)')}&spaces=drive`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Falha ao procurar arquivo "${fileName}" no Google Drive (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const files: DriveBookFile[] = data.files || [];

  return files.length > 0 ? files[0] : null;
}

/**
 * Obtém informações detalhadas de um arquivo no Google Drive pelo seu ID.
 */
export async function getBookFile(fileId: string): Promise<DriveBookFile> {
  const token = await ensureDriveAccessToken();
  const fields = 'id, name, mimeType, size, modifiedTime, createdTime';
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=${encodeURIComponent(fields)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Falha ao obter dados do arquivo ${fileId} no Google Drive (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    mimeType: data.mimeType,
    size: data.size,
    modifiedTime: data.modifiedTime,
    createdTime: data.createdTime
  };
}

/**
 * Lista todos os arquivos de livros (EPUB e PDF) contidos dentro da pasta "Livros"
 * ou acessíveis no Google Drive autorizados para este aplicativo.
 */
export async function listBooksInDrive(): Promise<DriveBookFile[]> {
  const token = await ensureDriveAccessToken();
  const folderId = await findBooksFolder();

  const folderQuery = `'${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(folderQuery)}&fields=${encodeURIComponent('files(id, name, mimeType, size, modifiedTime, createdTime)')}&orderBy=name&spaces=drive`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Falha ao listar livros do Google Drive (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const folderFiles: DriveBookFile[] = data.files || [];

  // Também busca arquivos .epub e .pdf acessíveis no Drive caso tenham sido salvos em outra pasta
  try {
    const appQuery = `trashed = false and (name contains '.epub' or name contains '.pdf' or mimeType = 'application/epub+zip' or mimeType = 'application/pdf')`;
    const appUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(appQuery)}&fields=${encodeURIComponent('files(id, name, mimeType, size, modifiedTime, createdTime)')}&orderBy=name&spaces=drive`;
    const appRes = await fetch(appUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });
    if (appRes.ok) {
      const appData = await appRes.json();
      const extraFiles: DriveBookFile[] = appData.files || [];
      const seenIds = new Set(folderFiles.map(f => f.id));
      for (const ef of extraFiles) {
        if (!seenIds.has(ef.id)) {
          folderFiles.push(ef);
          seenIds.add(ef.id);
        }
      }
    }
  } catch {
    // Silencioso se busca ampla falhar, mantém arquivos da pasta Livros
  }

  return folderFiles;
}

export interface ImportDriveProgress {
  step: string;
  current?: number;
  total?: number;
  bookTitle?: string;
}

export interface ImportDriveResult {
  success: boolean;
  totalFound: number;
  imported: number;
  alreadyPresent: number;
  errors: string[];
}

/**
 * Varre o Google Drive (pasta "Livros" e arquivos acessíveis),
 * identifica todos os livros em EPUB e PDF salvos anteriormente e restaura
 * para a biblioteca local deste computador (IndexedDB), com capa, capítulos, áudio e sincronização.
 */
export async function importBooksFromDrive(
  onProgress?: (progress: ImportDriveProgress) => void
): Promise<ImportDriveResult> {
  const errors: string[] = [];
  try {
    if (onProgress) {
      onProgress({ step: 'Conectando ao Google Drive...' });
    }
    await ensureDriveAccessToken();

    if (onProgress) {
      onProgress({ step: 'Localizando pasta "Livros" no Google Drive...' });
    }
    await findBooksFolder();

    if (onProgress) {
      onProgress({ step: 'Buscando livros salvos no seu Drive...' });
    }
    const driveFiles = await listBooksInDrive();

    // Filtra apenas arquivos que são livros digitais válidos
    const bookFiles = driveFiles.filter(f => {
      const lower = f.name.toLowerCase();
      const isPdf = lower.endsWith('.pdf') || (f.mimeType && f.mimeType.includes('pdf'));
      const isEpub = lower.endsWith('.epub') || (f.mimeType && f.mimeType.includes('epub'));
      return isPdf || isEpub;
    });

    if (bookFiles.length === 0) {
      return {
        success: true,
        totalFound: 0,
        imported: 0,
        alreadyPresent: 0,
        errors: []
      };
    }

    const localBooks = await getAllBooks();
    let imported = 0;
    let alreadyPresent = 0;

    for (let i = 0; i < bookFiles.length; i++) {
      const file = bookFiles[i];
      const isPdf = file.name.toLowerCase().endsWith('.pdf') || (file.mimeType && file.mimeType.includes('pdf'));
      const cleanFileName = file.name.replace(/\.(epub|pdf)$/i, '').trim();

      if (onProgress) {
        onProgress({
          step: `Processando (${i + 1}/${bookFiles.length}): ${cleanFileName}`,
          current: i + 1,
          total: bookFiles.length,
          bookTitle: cleanFileName
        });
      }

      // 1. Procura se o livro já existe localmente
      const existing = localBooks.find(b => 
        b.driveFileId === file.id || 
        b.driveFileName === file.name ||
        b.title.toLowerCase() === cleanFileName.toLowerCase()
      );

      if (existing) {
        existing.driveFileId = file.id;
        existing.driveFileName = file.name;
        existing.driveSyncStatus = 'synced';
        existing.hasCloudFile = true;
        existing.driveLastSyncedAt = Date.now();
        await saveBook(existing);

        // Se o arquivo físico original não estiver no IndexedDB deste PC, baixa do Drive
        const isLocallyAvailable = await hasOriginalEpub(existing.id);
        if (!isLocallyAvailable) {
          try {
            if (onProgress) {
              onProgress({
                step: `Baixando cópia offline de "${existing.title}"...`,
                current: i + 1,
                total: bookFiles.length,
                bookTitle: existing.title
              });
            }
            const blob = await downloadBookFromDrive(file.id);
            await saveOriginalEpub(existing.id, blob);
          } catch (dlErr: any) {
            console.warn(`Aviso ao baixar cópia de ${existing.title}:`, dlErr);
          }
        }

        alreadyPresent++;
        continue;
      }

      // 2. Livro novo presente no Google Drive que não existe neste PC!
      try {
        if (onProgress) {
          onProgress({
            step: `Baixando e indexando "${cleanFileName}" do Google Drive...`,
            current: i + 1,
            total: bookFiles.length,
            bookTitle: cleanFileName
          });
        }

        const blob = await downloadBookFromDrive(file.id);
        if (!blob || blob.size === 0) {
          throw new Error('Arquivo retornado pelo Google Drive está vazio.');
        }

        let newBook: Book;
        const mime = isPdf ? PDF_MIME_TYPE : EPUB_MIME_TYPE;
        const fileObj = new File([blob], file.name, { type: mime });

        try {
          if (isPdf) {
            newBook = await parsePdfFile(fileObj);
          } else {
            newBook = await parseEpubFile(fileObj);
          }
        } catch (parseErr) {
          console.warn(`Fallback de parsing para ${file.name}:`, parseErr);
          // Fallback resiliente: cria entrada com capa padrão
          newBook = {
            id: `user-book-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            title: cleanFileName,
            author: 'Autor',
            format: isPdf ? 'pdf' : 'epub',
            coverUrl: '',
            chapters: [],
            totalWords: 0,
            estimatedReadingMinutes: 1,
            estimatedAudioMinutes: 1,
            category: isPdf ? 'Documentos & PDFs' : 'Literatura',
            progressPercent: 0,
            currentChapterIndex: 0,
            currentParagraphIndex: 0,
            lastReadAt: Date.now(),
            isFavorite: false,
            fileSize: blob.size,
            addedAt: Date.now()
          };
        }

        newBook.driveFileId = file.id;
        newBook.driveFileName = file.name;
        newBook.driveSyncStatus = 'synced';
        newBook.driveLastSyncedAt = Date.now();
        newBook.hasCloudFile = true;

        // Salva arquivo físico original no IndexedDB
        await saveOriginalEpub(newBook.id, fileObj);
        // Salva metadados do livro na estante
        await saveBook(newBook);

        // Se logado no Firebase, sincroniza metadados com Firestore
        if (auth.currentUser) {
          try {
            await syncBookToCloud(auth.currentUser.uid, newBook);
          } catch (cloudErr) {
            console.warn('Aviso ao sincronizar metadados no Firestore:', cloudErr);
          }
        }

        imported++;
      } catch (bookErr: any) {
        console.error(`Erro ao restaurar livro ${file.name} do Drive:`, bookErr);
        errors.push(`Erro em "${file.name}": ${bookErr?.message || String(bookErr)}`);
      }
    }

    if (onProgress) {
      onProgress({
        step: `Concluído! ${imported} livros importados, ${alreadyPresent} sincronizados.`
      });
    }

    return {
      success: true,
      totalFound: bookFiles.length,
      imported,
      alreadyPresent,
      errors
    };
  } catch (err: any) {
    console.error('Erro ao sincronizar livros do Google Drive:', err);
    return {
      success: false,
      totalFound: 0,
      imported: 0,
      alreadyPresent: 0,
      errors: [err?.message || 'Falha ao sincronizar com o Google Drive.']
    };
  }
}

/**
 * Verifica o status de conexão com o Google Drive e se a pasta "Livros" está acessível.
 */
export async function checkDriveConnection(): Promise<{
  connected: boolean;
  booksFolderId?: string;
  error?: string;
}> {
  try {
    const folderId = await findBooksFolder();
    return {
      connected: true,
      booksFolderId: folderId
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err?.message || String(err)
    };
  }
}

export interface RestoreBookResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * FASE 3A: Recuperação do EPUB original armazenado no Google Drive para o IndexedDB local.
 * 
 * Regras:
 * 1. Localiza o livro na biblioteca local (getBook).
 * 2. Verifica se o EPUB original já existe no IndexedDB (hasOriginalEpub).
 * 3. Se já existir, NÃO faz download novamente.
 * 4. Se não existir, verifica se o livro possui driveFileId. Se não possuir, retorna erro claro.
 * 5. Baixa o EPUB utilizando downloadBookFromDrive(driveFileId).
 * 6. Salva o Blob diretamente no IndexedDB via saveOriginalEpub(bookId, blob).
 * 7. Confirma que o arquivo foi gravado com sucesso.
 * 8. Retorna sucesso ou erro sem apagar nem modificar metadados se o Drive falhar.
 */
export async function restoreBookFromDrive(
  bookId: string,
  onProgressMessage?: (msg: string) => void
): Promise<RestoreBookResult> {
  try {
    // 1. Localiza o livro
    const book = await getBook(bookId);
    if (!book) {
      return {
        success: false,
        error: `Livro "${bookId}" não encontrado na biblioteca local.`
      };
    }

    // 2 & 3. Verifica se o arquivo original já existe localmente no IndexedDB
    const fmtLabel = book.format ? book.format.toUpperCase() : 'arquivo';
    const alreadyLocal = await hasOriginalEpub(bookId);
    if (alreadyLocal) {
      return {
        success: true,
        message: `O arquivo ${fmtLabel} já está disponível localmente no seu dispositivo.`
      };
    }

    // 4. Se não existir localmente, verifica se possui driveFileId
    if (!book.driveFileId) {
      return {
        success: false,
        error: `O livro "${book.title}" não possui uma cópia vinculada ao Google Drive (driveFileId ausente).`
      };
    }

    // 5. Baixa o arquivo original utilizando downloadBookFromDrive
    if (onProgressMessage) {
      onProgressMessage(`Baixando ${fmtLabel} do Google Drive...`);
    }
    const blob = await downloadBookFromDrive(book.driveFileId);
    if (!blob || blob.size === 0) {
      return {
        success: false,
        error: 'O arquivo retornado pelo Google Drive está vazio ou corrompido.'
      };
    }

    // 6. Salva o Blob no armazenamento local existente (IndexedDB isolado)
    if (onProgressMessage) {
      onProgressMessage('Salvando localmente...');
    }
    await saveOriginalEpub(bookId, blob);

    // 7. Confirma que o arquivo foi salvo
    const savedLocally = await hasOriginalEpub(bookId);
    if (!savedLocally) {
      return {
        success: false,
        error: `Falha ao confirmar a gravação do arquivo ${fmtLabel} no armazenamento local (IndexedDB).`
      };
    }

    // Atualiza o registro do livro indicando disponibilidade
    book.hasCloudFile = true;
    book.driveSyncStatus = 'synced';
    await saveBook(book);

    if (onProgressMessage) {
      onProgressMessage('✓ Livro disponível offline');
    }

    // 8. Retorna sucesso
    return {
      success: true,
      message: 'Livro baixado com sucesso do Google Drive e armazenado no IndexedDB para leitura offline.'
    };
  } catch (err: any) {
    console.error(`Erro ao restaurar livro ${bookId} do Google Drive:`, err);
    return {
      success: false,
      error: err?.message || 'Falha ao comunicar com o Google Drive. O livro e seus dados permanecem seguros localmente.'
    };
  }
}

export interface SyncBookToDriveResult {
  success: boolean;
  driveFileId?: string;
  driveFileName?: string;
  error?: string;
}

/**
 * Re-sincroniza / reenvia um livro EPUB local para o Google Drive na pasta "Livros".
 * Utilizado pelo botão "Retry Sync" na biblioteca quando o livro estiver com status 'error',
 * 'not_connected' ou ainda não tiver driveFileId.
 */
export async function syncBookToDrive(
  bookId: string,
  onProgressMessage?: (msg: string) => void,
  forceUpload: boolean = false,
  fileOverride?: File | Blob
): Promise<SyncBookToDriveResult> {
  try {
    // 1. Obtém o livro do banco local
    const book = await getBook(bookId);
    if (!book) {
      return {
        success: false,
        error: `Livro "${bookId}" não encontrado na biblioteca local.`
      };
    }

    const isSupported = book.format === 'epub' || book.format === 'pdf' || book.format === 'mobi' || book.format === 'azw3';
    if (!isSupported) {
      return {
        success: false,
        error: 'O envio para o Google Drive está disponível para arquivos EPUB, PDF, MOBI e AZW3.'
      };
    }

    // 2. Obtém o arquivo original (EPUB, PDF, MOBI ou AZW3)
    if (fileOverride) {
      await saveOriginalEpub(bookId, fileOverride);
    }

    let blob = fileOverride || (await getOriginalEpub(bookId));
    if (!blob || blob.size === 0) {
      if (book.format === 'pdf') {
        if (onProgressMessage) {
          onProgressMessage('Preparando arquivo PDF para envio ao Google Drive...');
        }
        blob = await generatePdfFromBook(book);
        await saveOriginalEpub(bookId, blob);
      } else {
        return {
          success: false,
          error: `Arquivo ${book.format.toUpperCase()} não encontrado no dispositivo.`
        };
      }
    }

    if (onProgressMessage) {
      onProgressMessage(`Recuperando arquivo ${book.format.toUpperCase()}...`);
    }

    // 3. Garante que o Google Drive está autorizado
    if (onProgressMessage) {
      onProgressMessage('Conectando ao Google Drive...');
    }
    await ensureDriveAccessToken();

    // 4. Determina o nome do arquivo e verifica se já existe na pasta "Livros"
    let extension = '.epub';
    if (book.format === 'pdf') extension = '.pdf';
    else if (book.format === 'mobi') extension = '.mobi';
    else if (book.format === 'azw3') extension = '.azw3';

    const defaultName = `${book.title}${extension}`;
    let targetFileName = book.driveFileName || (blob instanceof File ? blob.name : defaultName);
    if (!targetFileName.toLowerCase().endsWith(extension)) {
      targetFileName = `${targetFileName}${extension}`;
    }
    if (onProgressMessage) {
      onProgressMessage('Verificando pasta "Livros" no Drive...');
    }
    const existingFile = await findBookByName(targetFileName);

    let driveFileId: string;
    let driveFileName: string;

    // Se forceUpload for false e o arquivo já existir íntegro com tamanho correspondente
    if (!forceUpload && existingFile && Number(existingFile.size) === blob.size) {
      driveFileId = existingFile.id;
      driveFileName = existingFile.name;
    } else {
      // Se for forceUpload (Retry Sync) ou se o arquivo existente estiver incompleto/corrompido
      if (existingFile?.id) {
        try {
          // Remove a versão corrompida/incompleta anterior para evitar duplicatas na pasta Livros
          await deleteBookFromDrive(existingFile.id, true);
        } catch (delErr) {
          console.warn('Aviso ao remover versão anterior do Drive antes do reenvio:', delErr);
        }
      }
      if (onProgressMessage) {
        onProgressMessage(`Enviando ${book.format.toUpperCase()} para a pasta Livros...`);
      }
      const uploaded = await uploadBookToDrive(blob, targetFileName);
      driveFileId = uploaded.id;
      driveFileName = uploaded.name;
    }

    // 5. Atualiza o livro no IndexedDB local com o ID do Drive
    book.driveFileId = driveFileId;
    book.driveFileName = driveFileName;
    book.driveLastSyncedAt = Date.now();
    book.driveSyncStatus = 'synced';
    book.hasCloudFile = true;
    await saveBook(book);

    // 6. Sincroniza metadados com o Firestore se usuário logado
    if (auth.currentUser) {
      await syncBookToCloud(auth.currentUser.uid, book);
    }

    if (onProgressMessage) {
      onProgressMessage('✓ Sincronizado no Google Drive');
    }

    return {
      success: true,
      driveFileId,
      driveFileName
    };
  } catch (err: any) {
    console.error(`Erro ao reenviar livro ${bookId} para o Google Drive:`, err);
    // Atualiza status para 'error' no IndexedDB para permitir novo Retry Sync
    const book = await getBook(bookId);
    if (book) {
      book.driveSyncStatus = 'error';
      await saveBook(book);
    }
    return {
      success: false,
      error: err?.message || 'Falha ao sincronizar com o Google Drive.'
    };
  }
}
