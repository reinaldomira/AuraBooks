import React, { useState, useEffect } from 'react';
import { 
  X, Cloud, RefreshCw, CheckCircle2, AlertCircle, HardDrive, 
  Clock, ShieldCheck, ArrowDownCircle, ArrowUpCircle, Laptop, 
  Smartphone, BookOpen, BookmarkCheck, FileText, Sparkles, Loader2 
} from 'lucide-react';
import { 
  getAutoBackupConfig, saveAutoBackupConfig, performDriveBackup, 
  fetchDriveBackupData, restoreLibraryFromBackup, 
  LibraryBackupData, AutoBackupConfig, BACKUP_FILE_NAME 
} from '../services/googleDriveBackupService';
import { isDriveAuthorized, ensureDriveAccessToken } from '../services/googleDriveService';

interface DriveBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLibraryRestored?: () => Promise<void> | void;
}

export const DriveBackupModal: React.FC<DriveBackupModalProps> = ({
  isOpen,
  onClose,
  onLibraryRestored
}) => {
  const [config, setConfig] = useState<AutoBackupConfig>(getAutoBackupConfig());
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(isDriveAuthorized());
  
  // Estados de Backup Manual
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupStepMsg, setBackupStepMsg] = useState('');
  const [backupSuccessMsg, setBackupSuccessMsg] = useState('');
  const [backupErrorMsg, setBackupErrorMsg] = useState('');

  // Estados de Restauração
  const [isLoadingDriveBackup, setIsLoadingDriveBackup] = useState(false);
  const [remoteBackup, setRemoteBackup] = useState<LibraryBackupData | null>(null);
  const [remoteFileInfo, setRemoteFileInfo] = useState<{ id: string; modifiedTime?: string; size?: string } | null>(null);
  const [restoreFetchError, setRestoreFetchError] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreStepMsg, setRestoreStepMsg] = useState('');
  const [restoreResult, setRestoreResult] = useState<{
    success: boolean;
    books: number;
    highlights: number;
    sessions: number;
  } | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');

  useEffect(() => {
    if (isOpen) {
      setConfig(getAutoBackupConfig());
      setIsDriveConnected(isDriveAuthorized());
      setBackupSuccessMsg('');
      setBackupErrorMsg('');
      setRestoreResult(null);
      setRestoreFetchError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleAutoBackup = (enabled: boolean) => {
    const updated = saveAutoBackupConfig({ enabled });
    setConfig(updated);
  };

  const handleIntervalChange = (intervalMinutes: number) => {
    const updated = saveAutoBackupConfig({ intervalMinutes });
    setConfig(updated);
  };

  const handleToggleProgressSync = (backupOnProgressChange: boolean) => {
    const updated = saveAutoBackupConfig({ backupOnProgressChange });
    setConfig(updated);
  };

  const handleTriggerBackupNow = async () => {
    setIsBackingUp(true);
    setBackupStepMsg('Iniciando backup...');
    setBackupSuccessMsg('');
    setBackupErrorMsg('');

    try {
      const res = await performDriveBackup((msg) => setBackupStepMsg(msg));
      if (res.success) {
        setIsDriveConnected(true);
        setConfig(getAutoBackupConfig());
        setBackupSuccessMsg('Backup realizado com sucesso no Google Drive!');
      } else {
        setBackupErrorMsg(res.error || 'Falha ao realizar backup.');
      }
    } catch (err: any) {
      setBackupErrorMsg(err?.message || 'Erro inesperado ao realizar backup.');
    } finally {
      setIsBackingUp(false);
      setBackupStepMsg('');
    }
  };

  const handleFetchRemoteBackup = async () => {
    setIsLoadingDriveBackup(true);
    setRemoteBackup(null);
    setRemoteFileInfo(null);
    setRestoreFetchError('');
    setRestoreResult(null);

    try {
      await ensureDriveAccessToken();
      setIsDriveConnected(true);

      const res = await fetchDriveBackupData();
      if (res.success && res.backup) {
        setRemoteBackup(res.backup);
        setRemoteFileInfo(res.fileInfo || null);
      } else {
        setRestoreFetchError(res.error || 'Nenhum backup encontrado no Google Drive.');
      }
    } catch (err: any) {
      setRestoreFetchError(err?.message || 'Erro ao comunicar com o Google Drive.');
    } finally {
      setIsLoadingDriveBackup(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!remoteBackup) return;

    setIsRestoring(true);
    setRestoreStepMsg('Iniciando restauração da biblioteca...');

    try {
      const res = await restoreLibraryFromBackup(remoteBackup, restoreMode, (step) => {
        setRestoreStepMsg(step);
      });

      if (res.success) {
        setRestoreResult({
          success: true,
          books: res.restoredBooks,
          highlights: res.restoredHighlights,
          sessions: res.restoredSessions
        });

        if (onLibraryRestored) {
          await onLibraryRestored();
        }
      } else {
        setRestoreFetchError(res.error || 'Falha ao restaurar dados do backup.');
      }
    } catch (err: any) {
      setRestoreFetchError(err?.message || 'Erro ao restaurar backup.');
    } finally {
      setIsRestoring(false);
      setRestoreStepMsg('');
    }
  };

  const formatDate = (timestamp?: number | string | null) => {
    if (!timestamp) return 'Nunca realizado';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Data desconhecida';
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-[#FAF8F5] border border-[#E5E0D8] rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#EBE6DF] bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100/90 text-amber-900 border border-amber-300 flex items-center justify-center shadow-2xs">
              <Cloud className="w-5 h-5 text-amber-800" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif-display font-bold text-lg text-stone-900">
                  Backup Automático & Restauração
                </h2>
                <span className="text-[10px] bg-amber-200/80 text-amber-950 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Google Drive
                </span>
              </div>
              <p className="text-xs text-stone-500 font-sans">
                Seus livros, progresso de leitura e marcações salvos na nuvem para qualquer dispositivo.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-stone-800 font-sans text-xs">
          
          {/* Status Banner */}
          <div className="bg-gradient-to-r from-amber-50 to-stone-50 border border-amber-200/90 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-stone-900 text-sm">
                  Proteção e Continuidade entre Dispositivos
                </span>
              </div>
              <p className="text-stone-600 text-[11.5px] leading-relaxed">
                O arquivo de backup (<code className="bg-white/80 px-1 py-0.5 rounded border border-amber-200 font-mono text-[10.5px]">{BACKUP_FILE_NAME}</code>) é armazenado na pasta <strong>Livros</strong> do seu próprio Google Drive.
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                config.enabled 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                  : 'bg-stone-100 text-stone-600 border-stone-300'
              }`}>
                <span className={`w-2 h-2 rounded-full ${config.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`} />
                {config.enabled ? 'Backup Ativo' : 'Pausado'}
              </span>
            </div>
          </div>

          {/* SEÇÃO 1: Configurações de Backup Automático */}
          <div className="bg-white border border-[#E8E2D9] rounded-xl p-4 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-700" />
                  Sincronização Periódica Automática
                </h3>
                <p className="text-[11px] text-stone-500">
                  Garante que alterações recentes sejam salvas sem você precisar se preocupar.
                </p>
              </div>

              {/* Toggle Principal */}
              <button
                onClick={() => handleToggleAutoBackup(!config.enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                  config.enabled ? 'bg-amber-800' : 'bg-stone-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {config.enabled && (
              <div className="space-y-3 pt-1">
                {/* Intervalo */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-stone-700 text-xs font-medium">
                    Frequência de sincronização periódica:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[5, 10, 15, 30].map((mins) => (
                      <button
                        key={mins}
                        onClick={() => handleIntervalChange(mins)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                          config.intervalMinutes === mins
                            ? 'bg-amber-100 text-amber-950 border-amber-400 shadow-2xs'
                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sincronizar ao progredir na leitura */}
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={config.backupOnProgressChange}
                    onChange={(e) => handleToggleProgressSync(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-700 focus:ring-amber-500 border-stone-300"
                  />
                  <span className="text-stone-700 text-[11.5px]">
                    Sincronizar automaticamente quando eu virar páginas ou progredir na leitura (com debounce inteligente)
                  </span>
                </label>
              </div>
            )}

            {/* Informações do Último Backup */}
            <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-stone-700">Último backup:</span>
                <span>{formatDate(config.lastBackupAt)}</span>
                {config.lastBackupSummary && (
                  <span className="text-stone-400">
                    ({config.lastBackupSummary.totalBooks} livros, {config.lastBackupSummary.highlightsCount} notas)
                  </span>
                )}
              </div>

              {/* Botão Fazer Backup Agora */}
              <button
                onClick={handleTriggerBackupNow}
                disabled={isBackingUp}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg font-semibold text-xs transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {isBackingUp ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                    <span>{backupStepMsg || 'Fazendo backup...'}</span>
                  </>
                ) : (
                  <>
                    <ArrowUpCircle className="w-3.5 h-3.5 text-amber-300" />
                    <span>Fazer Backup Agora</span>
                  </>
                )}
              </button>
            </div>

            {backupSuccessMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 flex items-center gap-2 text-[11px]">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{backupSuccessMsg}</span>
              </div>
            )}

            {backupErrorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 flex items-center gap-2 text-[11px]">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{backupErrorMsg}</span>
              </div>
            )}
          </div>

          {/* SEÇÃO 2: Restauração Imediata no Google Drive (Troca de Dispositivo) */}
          <div className="bg-white border border-[#E8E2D9] rounded-xl p-4 space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-1.5">
                  <ArrowDownCircle className="w-4 h-4 text-emerald-700" />
                  Restauração Imediata (Troca de Dispositivo)
                </h3>
                <p className="text-[11px] text-stone-500">
                  Abriu o AuraBooks em um novo computador ou celular? Restaure sua biblioteca em um clique.
                </p>
              </div>

              <button
                onClick={handleFetchRemoteBackup}
                disabled={isLoadingDriveBackup}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 rounded-lg font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isLoadingDriveBackup ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-800" />
                    <span>Verificando Drive...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-amber-800" />
                    <span>Localizar Backup no Drive</span>
                  </>
                )}
              </button>
            </div>

            {restoreFetchError && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-stone-800 text-[11.5px] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-stone-900">Aviso:</span>
                  <span>{restoreFetchError}</span>
                </div>
              </div>
            )}

            {/* Pré-visualização do Backup Encontrado */}
            {remoteBackup && (
              <div className="bg-stone-50/80 border border-amber-200 rounded-xl p-3.5 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-stone-900 text-xs">
                      Backup Encontrado com Sucesso!
                    </span>
                  </div>
                  <span className="text-[10px] text-stone-500 font-mono">
                    Salvo em: {formatDate(remoteBackup.timestamp)}
                  </span>
                </div>

                {/* Métricas do Backup */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-white p-2 rounded-lg border border-stone-200 shadow-2xs">
                    <span className="text-[10px] text-stone-500 uppercase block font-semibold">Total de Livros</span>
                    <span className="text-base font-bold text-stone-900">
                      {remoteBackup.summary?.totalBooks || remoteBackup.books?.length || 0}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-stone-200 shadow-2xs">
                    <span className="text-[10px] text-stone-500 uppercase block font-semibold">Em Leitura</span>
                    <span className="text-base font-bold text-amber-800">
                      {remoteBackup.summary?.readingBooksCount || 0}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-stone-200 shadow-2xs">
                    <span className="text-[10px] text-stone-500 uppercase block font-semibold">Marcações/Notas</span>
                    <span className="text-base font-bold text-stone-900">
                      {remoteBackup.summary?.highlightsCount || 0}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-stone-200 shadow-2xs">
                    <span className="text-[10px] text-stone-500 uppercase block font-semibold">Dispositivo</span>
                    <span className="text-[11px] font-semibold text-stone-700 truncate block mt-1">
                      {remoteBackup.deviceInfo || 'Web'}
                    </span>
                  </div>
                </div>

                {/* Opção de Modo */}
                <div className="flex items-center gap-4 text-[11px] text-stone-700 pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="restoreMode"
                      value="merge"
                      checked={restoreMode === 'merge'}
                      onChange={() => setRestoreMode('merge')}
                      className="text-amber-800 focus:ring-amber-500"
                    />
                    <span>Mesclar com livros locais (Recomendado)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="restoreMode"
                      value="replace"
                      checked={restoreMode === 'replace'}
                      onChange={() => setRestoreMode('replace')}
                      className="text-amber-800 focus:ring-amber-500"
                    />
                    <span>Substituir biblioteca</span>
                  </label>
                </div>

                {/* Botão de Restauração */}
                <button
                  onClick={handleExecuteRestore}
                  disabled={isRestoring}
                  className="w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isRestoring ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
                      <span>{restoreStepMsg || 'Restaurando sua biblioteca...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-emerald-300" />
                      <span>Restaurar Biblioteca Agora</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {restoreResult && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Restauração Concluída com Sucesso!</span>
                </div>
                <p className="text-[11.5px] text-emerald-800">
                  {restoreResult.books} livros, {restoreResult.highlights} anotações e {restoreResult.sessions} sessões de leitura foram recuperados. Seus livros estão prontos para leitura contínua!
                </p>
              </div>
            )}
          </div>

          {/* Dica de como funciona a troca de dispositivo */}
          <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/70 text-[11px] text-stone-600 leading-relaxed space-y-1.5">
            <span className="font-semibold text-stone-900 block flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5 text-amber-800" />
              Como funciona em outro celular ou computador?
            </span>
            <p>
              1. Acesse o AuraBooks no novo dispositivo.<br />
              2. Abra esta tela e clique em <strong>"Localizar Backup no Drive"</strong>.<br />
              3. Clique em <strong>"Restaurar Biblioteca Agora"</strong>.<br />
              4. Os livros com arquivos no Google Drive serão baixados automaticamente quando você abrir para ler offline!
            </p>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[#EBE6DF] bg-stone-100/70 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-stone-500">
            Armazenamento seguro em: Google Drive / Livros / {BACKUP_FILE_NAME}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
