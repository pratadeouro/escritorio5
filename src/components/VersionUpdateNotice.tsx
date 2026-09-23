import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  RefreshCw, 
  ArrowUpCircle, 
  AlertTriangle, 
  X, 
  CheckCircle2, 
  ChevronRight,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../context';
import { 
  CURRENT_APP_VERSION, 
  checkAppVersion, 
  reloadAppForUpdate, 
  isNoticeDismissedForSession, 
  dismissNoticeForSession 
} from '../services/versionService';

interface VersionUpdateNoticeProps {
  /**
   * Se true, renderiza inline no topo da página. Se false, como toast/floating.
   * Padrão: banner no topo do conteúdo.
   */
  inline?: boolean;
}

export default function VersionUpdateNotice({ inline = true }: VersionUpdateNoticeProps) {
  const { state, escritorioAtivoId } = useAppContext();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Busca a versão definida na planilha (Configurações globais ou Escritório ativo)
  const activeOffice = state.escritorios.find(e => e.id === escritorioAtivoId);
  const rawRemoteVersion = 
    state.settings.appVersion || 
    activeOffice?.appVersion || 
    (state.allSettings && state.allSettings.find(s => s.appVersion)?.appVersion) || 
    '';

  const checkResult = checkAppVersion(rawRemoteVersion, CURRENT_APP_VERSION);

  useEffect(() => {
    if (checkResult.isOutdated && checkResult.remoteVersion) {
      const dismissed = isNoticeDismissedForSession(checkResult.remoteVersion);
      setIsDismissed(dismissed);
    } else {
      setIsDismissed(false);
    }
  }, [checkResult.isOutdated, checkResult.remoteVersion]);

  // Se não estiver desatualizado, não renderiza nada
  if (!checkResult.isOutdated) {
    return null;
  }

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await reloadAppForUpdate();
    } catch {
      setIsUpdating(false);
    }
  };

  const handleDismiss = () => {
    if (checkResult.remoteVersion) {
      dismissNoticeForSession(checkResult.remoteVersion);
    }
    setIsDismissed(true);
  };

  // Se dispensado pelo usuário na sessão, exibe apenas um mini-badge discreto flutuante
  if (isDismissed) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <button
          onClick={() => setIsDismissed(false)}
          className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-lg shadow-amber-500/20 text-xs font-semibold transition-all hover:scale-105 active:scale-95"
          title="Nova versão disponível na planilha. Clique para ver detalhes."
        >
          <Sparkles size={14} className="animate-spin-slow" />
          <span>Nova versão v{checkResult.remoteVersion}</span>
          <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  const isCritical = checkResult.isCritical;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.25 }}
        className="w-full z-30"
      >
        <div 
          className={`
            border-b px-4 py-3 sm:px-6 transition-colors shadow-sm
            ${isCritical 
              ? 'bg-gradient-to-r from-red-500/10 via-amber-500/10 to-red-500/5 border-red-500/30 text-red-950 dark:text-red-100' 
              : 'bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/5 border-amber-500/30 text-amber-950 dark:text-amber-100'
            }
          `}
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Ícone e Texto Explicativo */}
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className={`p-2 rounded-xl flex-shrink-0 ${
                isCritical 
                  ? 'bg-red-500/20 text-red-600 dark:text-red-400' 
                  : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
              }`}>
                {isCritical ? (
                  <AlertTriangle size={20} className="animate-pulse" />
                ) : (
                  <ArrowUpCircle size={20} className="animate-bounce" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sm tracking-tight">
                    {isCritical ? 'Atualização Obrigatória do Sistema' : 'Nova Versão do Sistema Disponível'}
                  </span>
                  
                  {/* Badges de Versão */}
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10">
                    Sua versão: <strong className="ml-1">v{checkResult.clientVersion}</strong>
                  </span>

                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                    Planilha: <strong className="ml-1">v{checkResult.remoteVersion}</strong>
                  </span>
                </div>

                <p className="text-xs text-app-text-muted mt-0.5 leading-relaxed">
                  {checkResult.message} Para garantir compatibilidade com a planilha e evitar divergências de dados, atualize o sistema.
                </p>
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className={`
                  flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all shadow-sm
                  ${isCritical
                    ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                    : 'bg-primary hover:bg-primary-hover active:scale-95'
                  }
                  disabled:opacity-60 disabled:cursor-not-allowed
                `}
              >
                {isUpdating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Atualizando...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    <span>Atualizar Agora</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDismiss}
                className="p-1.5 text-app-text-muted hover:text-app-text hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                title="Lembrar mais tarde (ocultar nesta sessão)"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
