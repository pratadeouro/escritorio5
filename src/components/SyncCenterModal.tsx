import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileText, 
  Database, 
  AlertTriangle,
  ChevronRight,
  HardDrive,
  Download
} from 'lucide-react';
import { useAppContext } from '../context';
import { formatDate } from '../utils/date';

interface SyncCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SyncCenterModal({ isOpen, onClose }: SyncCenterModalProps) {
  const { state, forceSave, forceLoad, lastSyncTime, syncLogs } = useAppContext();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isContentEditable = (document.activeElement as HTMLElement)?.isContentEditable;
      const isInputActive = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || isContentEditable;
      if (isInputActive) return;

      if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const getStatusIcon = () => {
    switch (state.syncStatus) {
      case 'saving':
      case 'loading':
        return <RefreshCw className="w-10 h-10 text-primary animate-spin" />;
      case 'error':
        return <XCircle className="w-10 h-10 text-red-500" />;
      default:
        return <CheckCircle2 className="w-10 h-10 text-green-500" />;
    }
  };

  const getStatusText = () => {
    switch (state.syncStatus) {
      case 'saving': return 'Sincronizando dados...';
      case 'loading': return 'Carregando dados...';
      case 'error': return 'Erro na sincronização';
      default: return 'Sistema Sincronizado';
    }
  };

  const handleManualSync = async () => {
    await forceSave();
  };

  const handleManualLoad = async () => {
    if (window.confirm('Isso irá recarregar todos os dados da planilha. Alterações não salvas podem ser perdidas. Continuar?')) {
      await forceLoad();
    }
  };

  const lastSyncFormatted = lastSyncTime 
    ? new Date(lastSyncTime).toLocaleString('pt-BR') 
    : 'Nunca sincronizado';

  const backupTimestamp = localStorage.getItem('advocacia_backup_timestamp');
  const lastBackupFormatted = backupTimestamp 
    ? new Date(parseInt(backupTimestamp)).toLocaleString('pt-BR')
    : 'Nenhum backup local';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[600px] bg-app-bg border border-app-border rounded-2xl shadow-2xl z-[101] overflow-hidden"
          >
            {/* Header */}
            <div className="bg-app-surface px-6 py-4 border-b border-app-border flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <RefreshCw className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-app-text">Centro de Sincronia</h3>
                  <p className="text-xs text-app-text-muted">Gerencie a integridade dos seus dados</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-app-secondary rounded-full transition-colors"
                id="close-sync-modal"
              >
                <XCircle className="w-5 h-5 text-app-text-muted" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              
              {/* Status Card */}
              <div className="bg-app-surface border border-app-border rounded-xl p-6 flex flex-col items-center text-center space-y-4">
                {getStatusIcon()}
                <div>
                  <h4 className="text-xl font-bold text-app-text">{getStatusText()}</h4>
                  <p className="text-sm text-app-text-muted mt-1">
                    Conexão ativa com o Google Sheets via GAS
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 w-full pt-4">
                  <div className="p-3 bg-app-bg rounded-lg border border-app-border flex flex-col items-center">
                    <Clock className="w-4 h-4 text-primary mb-1" />
                    <span className="text-[10px] uppercase font-bold text-app-text-muted">Última Nuvem</span>
                    <span className="text-xs font-medium text-app-text">{lastSyncFormatted}</span>
                  </div>
                  <div className="p-3 bg-app-bg rounded-lg border border-app-border flex flex-col items-center">
                    <HardDrive className="w-4 h-4 text-green-500 mb-1" />
                    <span className="text-[10px] uppercase font-bold text-app-text-muted">Último Backup Local</span>
                    <span className="text-xs font-medium text-app-text">{lastBackupFormatted}</span>
                  </div>
                </div>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={handleManualSync}
                    disabled={state.syncStatus === 'saving' || state.syncStatus === 'loading'}
                    className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center space-x-2 disabled:opacity-50"
                    id="btn-sync-now"
                  >
                    <RefreshCw className={`w-5 h-5 ${state.syncStatus === 'saving' ? 'animate-spin' : ''}`} />
                    <span>Salvar Agora</span>
                  </button>
                  <button
                    onClick={handleManualLoad}
                    disabled={state.syncStatus === 'saving' || state.syncStatus === 'loading'}
                    className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 disabled:opacity-50"
                    id="btn-load-now"
                  >
                    <Download className={`w-5 h-5 ${state.syncStatus === 'loading' ? 'animate-bounce' : ''}`} />
                    <span>Baixar Nuvem</span>
                  </button>
                </div>
              </div>

              {/* History */}
              <div className="space-y-3">
                <h5 className="text-sm font-bold text-app-text flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span>Histórico de Operações</span>
                </h5>
                <div className="space-y-2">
                  {syncLogs.length === 0 ? (
                    <div className="text-center py-8 bg-app-surface/50 border border-dashed border-app-border rounded-xl">
                      <p className="text-sm text-app-text-muted">Nenhuma atividade registrada ainda.</p>
                    </div>
                  ) : (
                    syncLogs.map((log, i) => (
                      <div 
                        key={i}
                        className="flex items-center justify-between p-3 bg-app-surface border border-app-border rounded-lg group hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${log.status === 'success' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                            {log.status === 'success' ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-app-text">{log.action}</p>
                            <p className="text-[10px] text-app-text-muted">{new Date(log.timestamp).toLocaleString('pt-BR')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-[10px] px-2 py-1 rounded-full uppercase font-bold ${
                            log.status === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                          }`}>
                            {log.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Security notice */}
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-600 uppercase">Segurança de Dados</p>
                  <p className="text-[11px] text-app-text-muted leading-relaxed">
                    Seu sistema salva alterações localmente instantaneamente e tenta sincronizar com a nuvem a cada 3 segundos de inatividade. Em caso de falha na rede, os dados permanecem salvos no seu navegador (Backup Local) até a próxima conexão bem-sucedida.
                  </p>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 bg-app-surface border-t border-app-border text-center">
              <p className="text-[10px] text-app-text-muted">
                Versão do Sincronizador: 2.1.0 (AppSheet Enhanced Engine)
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
