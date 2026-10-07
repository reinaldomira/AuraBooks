/**
 * googleDriveBackupService.ts
 * 
 * Funcionalidade de 'Backup Automático' e 'Restauração Imediata' no Google Drive para o AuraBooks / Lumina.
 * 
 * Sincroniza periodicamente:
 * 1. Metadados completos da biblioteca (título, autor, formato, capa, driveFileId, status, tags, etc.)
 * 2. Progresso de leitura de cada livro (porcentagem, último capítulo lido, posição CFI no EPUB/MOBI/AZW3, data)
 * 3. Marcações de texto (highlights) e anotações
 * 4. Sessões e estatísticas de leitura (reading sessions)
 * 5. Tags/Coleções personalizadas criadas pelo usuário
 * 6. Configurações de leitura (tema, tamanho de fonte, espaçamento)
 * 
 * Garante que se o usuário abrir o app em outro computador ou celular,
 * basta um clique em 'Restaurar do Google Drive' (ou detecção automática) para
 * recuperar a biblioteca inteira instantaneamente.
 */

import { ensureDriveAccessToken, findBooksFolder, isDriveAuthorized } from './googleDriveService';
import { 
  getAllBooks, saveBook, getHighlights, saveHighlight, 
  getAllReadingSessions, saveReadingSession, getUserCustomTags, 
  saveUserCustomTags, getReaderSettings, saveReaderSettings 
} from './storageService';
import { Book, BookHighlight, ReadingSession, ReaderSettings } from '../types/book';

export const BACKUP_FILE_NAME = 'aurabooks_library_backup.json';
export const BACKUP_VERSION = 1;

export interface LibraryBackupSummary {
  totalBooks: number;
  readingBooksCount: number;
  completedBooksCount: number;
  highlightsCount: number;
  readingSessionsCount: number;
}

export interface LibraryBackupData {
  version: number;
  app: 'AuraBooks';
  createdAt: string;
  timestamp: number;
  deviceInfo: string;
  summary: LibraryBackupSummary;
  books: Book[];
  highlights: Record<string, BookHighlight[]>;
  readingSessions: ReadingSession[];
  customTags: string[];
  readerSettings?: ReaderSettings;
}

export interface AutoBackupConfig {
  enabled: boolean;
  intervalMinutes: number; // 5, 10, 15, 30
  backupOnProgressChange: boolean;
  lastBackupAt: number | null;
  lastBackupStatus: 'idle' | 'backing_up' | 'success' | 'error';
  lastBackupError: string | null;
  lastBackupSummary: LibraryBackupSummary | null;
}

const CONFIG_STORAGE_KEY = 'aurabooks_auto_backup_config';

const DEFAULT_CONFIG: AutoBackupConfig = {
  enabled: true,
  intervalMinutes: 5,
  backupOnProgressChange: true,
  lastBackupAt: null,
  lastBackupStatus: 'idle',
  lastBackupError: null,
  lastBackupSummary: null
};

/**
 * Obtém as configurações atuais de Backup Automático
 */
export function getAutoBackupConfig(): AutoBackupConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.warn('Erro ao ler configuração de backup automático:', err);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Salva as configurações de Backup Automático
 */
export function saveAutoBackupConfig(config: Partial<AutoBackupConfig>): AutoBackupConfig {
  const current = getAutoBackupConfig();
  const updated = { ...current, ...config };
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updated));
    notifyBackupListeners(updated);
  } catch (err) {
    console.warn('Erro ao salvar configuração de backup:', err);
  }
  return updated;
}

// Ouvintes de status de backup
type BackupListener = (config: AutoBackupConfig) => void;
const listeners = new Set<BackupListener>();

export function subscribeToAutoBackup(listener: BackupListener): () => void {
  listeners.add(listener);
  listener(getAutoBackupConfig());
  return () => {
    listeners.delete(listener);
  };
}

function notifyBackupListeners(config: AutoBackupConfig) {
  listeners.forEach(cb => {
    try { cb(config); } catch (e) { console.error(e); }
  });
  window.dispatchEvent(new CustomEvent('aurabooks_backup_changed', { detail: config }));
}

/**
 * Coleta todos os dados locais e monta o payload completo de backup
 */
export async function buildLibraryBackupPayload(): Promise<LibraryBackupData> {
  const books = await getAllBooks();
  const readingSessions = await getAllReadingSessions();
  const customTags = getUserCustomTags();
  const readerSettings = await getReaderSettings();

  const highlights: Record<string, BookHighlight[]> = {};
  let totalHighlights = 0;

  for (const book of books) {
    try {
      const bookHls = await getHighlights(book.id);
      if (bookHls && bookHls.length > 0) {
        highlights[book.id] = bookHls;
        totalHighlights += bookHls.length;
      }
    } catch {
      // continua para o próximo
    }
  }

  const readingBooksCount = books.filter(b => (b.progressPercent || 0) > 0 && (b.progressPercent || 0) < 100).length;
  const completedBooksCount = books.filter(b => (b.progressPercent || 0) >= 100).length;

  const now = Date.now();
  const deviceInfo = typeof navigator !== 'undefined' 
    ? `${navigator.userAgent.includes('Mobile') ? 'Celular' : 'Computador'} (${navigator.platform || 'Web'})`
    : 'Web';

  return {
    version: BACKUP_VERSION,
    app: 'AuraBooks',
    createdAt: new Date(now).toISOString(),
    timestamp: now,
    deviceInfo,
    summary: {
      totalBooks: books.length,
      readingBooksCount,
      completedBooksCount,
      highlightsCount: totalHighlights,
      readingSessionsCount: readingSessions.length
    },
    books,
    highlights,
    readingSessions,
    customTags,
    readerSettings
  };
}

/**
 * Localiza o arquivo de backup no Google Drive
 */
export async function findDriveBackupFile(): Promise<{ id: string; modifiedTime?: string; size?: string } | null> {
  const token = await ensureDriveAccessToken();
  const folderId = await findBooksFolder();

  // Procura por BACKUP_FILE_NAME na pasta Livros ou no Drive
  const query = `name = '${BACKUP_FILE_NAME}' and trashed = false and '${folderId}' in parents`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime,size)&spaces=drive`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  if (!res.ok) {
    // Tenta busca global caso o arquivo tenha sido criado em nível superior
    const globalQuery = `name = '${BACKUP_FILE_NAME}' and trashed = false`;
    const globalRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(globalQuery)}&fields=files(id,name,modifiedTime,size)&spaces=drive`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      }
    );
    if (globalRes.ok) {
      const gData = await globalRes.json();
      if (gData.files && gData.files.length > 0) {
        return gData.files[0];
      }
    }
    return null;
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0];
  }
  return null;
}

/**
 * Realiza o backup dos metadados e progresso da biblioteca no Google Drive.
 */
export async function performDriveBackup(onProgress?: (msg: string) => void): Promise<{
  success: boolean;
  fileId?: string;
  summary?: LibraryBackupSummary;
  timestamp?: number;
  error?: string;
}> {
  try {
    saveAutoBackupConfig({ lastBackupStatus: 'backing_up', lastBackupError: null });

    if (onProgress) onProgress('Preparando dados da biblioteca e progresso...');
    const backupData = await buildLibraryBackupPayload();
    const jsonString = JSON.stringify(backupData, null, 2);

    if (onProgress) onProgress('Conectando ao Google Drive...');
    const token = await ensureDriveAccessToken();
    const folderId = await findBooksFolder();

    if (onProgress) onProgress('Verificando arquivo de backup no Google Drive...');
    const existingFile = await findDriveBackupFile();

    let backupFileId: string;

    if (existingFile?.id) {
      backupFileId = existingFile.id;
      if (onProgress) onProgress('Atualizando backup no Google Drive...');
      
      const updateRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${backupFileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=UTF-8'
          },
          body: jsonString
        }
      );

      if (!updateRes.ok) {
        const errText = await updateRes.text();
        throw new Error(`Erro ao atualizar backup no Drive (${updateRes.status}): ${errText}`);
      }
    } else {
      if (onProgress) onProgress('Criando arquivo de backup na pasta Livros...');
      // 1. Cria o metadata do arquivo
      const createMetaRes = await fetch(
        'https://www.googleapis.com/drive/v3/files',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=UTF-8'
          },
          body: JSON.stringify({
            name: BACKUP_FILE_NAME,
            mimeType: 'application/json',
            description: 'Backup automático de metadados, progresso de leitura e marcações do AuraBooks',
            parents: [folderId]
          })
        }
      );

      if (!createMetaRes.ok) {
        const errText = await createMetaRes.text();
        throw new Error(`Erro ao inicializar arquivo no Google Drive (${createMetaRes.status}): ${errText}`);
      }

      const metaData = await createMetaRes.json();
      backupFileId = metaData.id;

      // 2. Envia o conteúdo do backup
      const uploadBodyRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${backupFileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=UTF-8'
          },
          body: jsonString
        }
      );

      if (!uploadBodyRes.ok) {
        const errText = await uploadBodyRes.text();
        throw new Error(`Erro ao gravar conteúdo do backup no Drive: ${errText}`);
      }
    }

    const completedTime = Date.now();
    saveAutoBackupConfig({
      lastBackupAt: completedTime,
      lastBackupStatus: 'success',
      lastBackupError: null,
      lastBackupSummary: backupData.summary
    });

    if (onProgress) onProgress('✓ Backup concluído com sucesso no Google Drive');

    return {
      success: true,
      fileId: backupFileId,
      summary: backupData.summary,
      timestamp: completedTime
    };
  } catch (err: any) {
    console.error('Erro ao realizar backup no Google Drive:', err);
    const errorMsg = err?.message || 'Falha ao sincronizar backup com o Google Drive';
    saveAutoBackupConfig({
      lastBackupStatus: 'error',
      lastBackupError: errorMsg
    });
    return {
      success: false,
      error: errorMsg
    };
  }
}

/**
 * Busca e lê o backup existente do Google Drive (para pré-visualização e restauração)
 */
export async function fetchDriveBackupData(): Promise<{
  success: boolean;
  backup?: LibraryBackupData;
  fileInfo?: { id: string; modifiedTime?: string; size?: string };
  error?: string;
}> {
  try {
    const token = await ensureDriveAccessToken();
    const fileInfo = await findDriveBackupFile();

    if (!fileInfo) {
      return {
        success: false,
        error: 'Nenhum arquivo de backup encontrado na sua pasta Livros do Google Drive.'
      };
    }

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileInfo.id}?alt=media`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!res.ok) {
      throw new Error(`Erro ao baixar arquivo de backup do Google Drive (${res.status}).`);
    }

    const backupJson: LibraryBackupData = await res.json();
    return {
      success: true,
      backup: backupJson,
      fileInfo
    };
  } catch (err: any) {
    console.error('Erro ao baixar dados de backup do Drive:', err);
    return {
      success: false,
      error: err?.message || 'Falha ao buscar dados de backup no Google Drive.'
    };
  }
}

/**
 * Restaura toda a biblioteca e progresso a partir de um backup do Google Drive
 */
export async function restoreLibraryFromBackup(
  backupData: LibraryBackupData,
  mode: 'merge' | 'replace' = 'merge',
  onProgress?: (msg: string) => void
): Promise<{
  success: boolean;
  restoredBooks: number;
  restoredHighlights: number;
  restoredSessions: number;
  error?: string;
}> {
  try {
    if (onProgress) onProgress('Iniciando restauração da biblioteca...');

    const localBooks = await getAllBooks();
    const localBooksMap = new Map<string, Book>();
    localBooks.forEach(b => localBooksMap.set(b.id, b));

    let restoredBooksCount = 0;
    const backupBooks = backupData.books || [];

    for (let i = 0; i < backupBooks.length; i++) {
      const b = backupBooks[i];
      if (onProgress) {
        onProgress(`Restaurando livro (${i + 1}/${backupBooks.length}): ${b.title}...`);
      }

      const existing = localBooksMap.get(b.id);
      if (existing && mode === 'merge') {
        // Se já existe localmente, preserva o arquivo local mas atualiza se o backup tiver leitura mais recente
        const backupTime = b.lastReadAt || 0;
        const localTime = existing.lastReadAt || 0;

        if (backupTime >= localTime) {
          existing.progressPercent = b.progressPercent ?? existing.progressPercent;
          existing.currentChapterIndex = b.currentChapterIndex ?? existing.currentChapterIndex;
          existing.currentParagraphIndex = b.currentParagraphIndex ?? existing.currentParagraphIndex;
          existing.epubLocationCfi = b.epubLocationCfi || existing.epubLocationCfi;
          existing.lastReadAt = b.lastReadAt || existing.lastReadAt;
        }

        if (b.driveFileId && !existing.driveFileId) {
          existing.driveFileId = b.driveFileId;
          existing.driveFileName = b.driveFileName;
          existing.driveSyncStatus = 'synced';
          existing.hasCloudFile = true;
        }

        await saveBook(existing);
      } else {
        // Livro novo ou modo replace
        const newBook: Book = {
          ...b,
          hasCloudFile: Boolean(b.driveFileId)
        };
        await saveBook(newBook);
      }
      restoredBooksCount++;
    }

    // Restaura marcações (highlights)
    let restoredHlCount = 0;
    if (backupData.highlights) {
      if (onProgress) onProgress('Restaurando marcações e anotações...');
      for (const bookId in backupData.highlights) {
        const hls = backupData.highlights[bookId];
        if (Array.isArray(hls)) {
          for (const hl of hls) {
            await saveHighlight(hl);
            restoredHlCount++;
          }
        }
      }
    }

    // Restaura sessões de leitura
    let restoredSessionsCount = 0;
    if (backupData.readingSessions && Array.isArray(backupData.readingSessions)) {
      if (onProgress) onProgress('Restaurando histórico de sessões de leitura...');
      for (const session of backupData.readingSessions) {
        await saveReadingSession(session);
        restoredSessionsCount++;
      }
    }

    // Restaura coleções e tags personalizadas
    if (backupData.customTags && Array.isArray(backupData.customTags)) {
      const currentTags = getUserCustomTags();
      const mergedTags = Array.from(new Set([...currentTags, ...backupData.customTags]));
      saveUserCustomTags(mergedTags);
    }

    // Restaura configurações de leitor se disponíveis
    if (backupData.readerSettings) {
      saveReaderSettings(backupData.readerSettings);
    }

    if (onProgress) onProgress('✓ Biblioteca restaurada com sucesso!');

    return {
      success: true,
      restoredBooks: restoredBooksCount,
      restoredHighlights: restoredHlCount,
      restoredSessions: restoredSessionsCount
    };
  } catch (err: any) {
    console.error('Erro durante a restauração do backup:', err);
    return {
      success: false,
      restoredBooks: 0,
      restoredHighlights: 0,
      restoredSessions: 0,
      error: err?.message || 'Falha ao restaurar dados do backup.'
    };
  }
}

/* ================= MOTOR DE BACKUP AUTOMÁTICO PERIÓDICO ================= */

let autoBackupTimer: any = null;
let progressDebounceTimer: any = null;
let isBackupRunning = false;
let isServiceStarted = false;

/**
 * Notifica que houve alteração no progresso de leitura ou na biblioteca,
 * agendando uma sincronização automática inteligente com debounce.
 */
export function scheduleAutoBackupOnProgressChange() {
  const config = getAutoBackupConfig();
  if (!config.enabled || !config.backupOnProgressChange) return;
  if (!isDriveAuthorized()) return;

  if (progressDebounceTimer) {
    clearTimeout(progressDebounceTimer);
  }

  // Debounce de 25 segundos para não sobrecarregar a API do Drive durante a leitura ativa
  progressDebounceTimer = setTimeout(() => {
    if (!isBackupRunning && isDriveAuthorized()) {
      isBackupRunning = true;
      performDriveBackup()
        .catch(err => console.warn('Aviso no backup automático pós-progresso:', err))
        .finally(() => {
          isBackupRunning = false;
        });
    }
  }, 25000);
}

/**
 * Inicia o serviço em segundo plano de Backup Automático periódico
 */
export function startAutoBackupService() {
  if (isServiceStarted) return;
  isServiceStarted = true;

  const runCheck = async () => {
    const config = getAutoBackupConfig();
    if (!config.enabled) return;
    if (!isDriveAuthorized()) return;
    if (isBackupRunning) return;

    const now = Date.now();
    const intervalMs = (config.intervalMinutes || 5) * 60 * 1000;
    const lastBackup = config.lastBackupAt || 0;

    // Se já passou o intervalo configurado desde o último backup
    if (now - lastBackup >= intervalMs) {
      try {
        isBackupRunning = true;
        await performDriveBackup();
      } catch (err) {
        console.warn('Erro no ciclo de backup automático:', err);
      } finally {
        isBackupRunning = false;
      }
    }
  };

  // Verifica a cada 60 segundos se está na hora de rodar o backup
  autoBackupTimer = setInterval(runCheck, 60000);

  // Também roda ao mudar a visibilidade da aba (quando o usuário sai ou fecha o app)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        const config = getAutoBackupConfig();
        if (config.enabled && isDriveAuthorized() && !isBackupRunning) {
          runCheck().catch(() => {});
        }
      }
    });
  }
}

/**
 * Para o serviço de backup automático
 */
export function stopAutoBackupService() {
  if (autoBackupTimer) {
    clearInterval(autoBackupTimer);
    autoBackupTimer = null;
  }
  if (progressDebounceTimer) {
    clearTimeout(progressDebounceTimer);
    progressDebounceTimer = null;
  }
  isServiceStarted = false;
}
