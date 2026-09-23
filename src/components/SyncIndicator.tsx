import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { useAppContext } from '../context';
import { SyncCenterModal } from './SyncCenterModal';

const SyncIndicator: React.FC = () => {
  const { state, lastSyncTime } = useAppContext();
  const { syncStatus } = state;
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getStatusDetails = () => {
    switch (syncStatus) {
      case 'saving':
        return { 
          icon: <RefreshCw size={14} className="animate-spin text-primary" />, 
          text: 'Sincronizando...',
          color: 'text-primary' 
        };
      case 'loading':
        return { 
          icon: <RefreshCw size={14} className="animate-spin text-emerald-500" />, 
          text: 'Carregando...',
          color: 'text-emerald-500' 
        };
      case 'error':
        return { 
          icon: <XCircle size={14} className="text-red-500" />, 
          text: 'Erro Sincronia',
          color: 'text-red-500' 
        };
      default:
        return { 
          icon: <CheckCircle2 size={14} className="text-green-500" />, 
          text: 'Sincronizado',
          color: 'text-app-text-muted' 
        };
    }
  };

  const { icon, text, color } = getStatusDetails();

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center space-x-2 bg-app-surface border border-app-border px-3 py-1.5 rounded-full hover:bg-app-secondary transition-all active:scale-95 group shadow-sm"
        title="Abrir Centro de Sincronia"
        id="btn-open-sync-center"
      >
        <div className="relative">
          {icon}
          {(syncStatus === 'saving' || syncStatus === 'loading') && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-ping" />
          )}
        </div>
        
        <div className="flex flex-col items-start leading-none">
          <span className={`text-[10px] font-bold uppercase tracking-tight ${color}`}>
            {text}
          </span>
          {lastSyncTime && syncStatus === 'idle' && (
            <span className="text-[9px] text-app-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
              Último: {new Date(lastSyncTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </button>

      <SyncCenterModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
};

export default SyncIndicator;
