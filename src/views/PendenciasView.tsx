import React, { useState } from 'react';
import Processos from './Processos';
import { AlertCircle, Clock } from 'lucide-react';
import { useAppContext } from '../context';

export default function PendenciasView() {
  const { state, setViewParams } = useAppContext();
  const [activeTab, setActiveTab] = useState<'pendencias' | 'morosidade'>(
    state.viewParams?.activeTab === 'morosidade' 
      ? 'morosidade' 
      : 'pendencias'
  );

  // Limpar os parâmetros após o uso inicial para evitar que persistam ao navegar de volta
  React.useEffect(() => {
    if (state.viewParams?.activeTab) {
      setViewParams(undefined);
    }
  }, [state.viewParams, setViewParams]);

  const diasMorosidade = state.settings.diasMorosidade || 30;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-app-bg text-app-text">
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 bg-app-surface border-b border-app-border">
        <h1 className="text-lg sm:text-2xl font-bold text-app-text mb-4 sm:mb-6">Pendências e Morosidade</h1>
        
        <div className="flex gap-2 sm:gap-4 overflow-x-auto scrollbar-none">
          <button
            id="tab-pendencias"
            onClick={() => setActiveTab('pendencias')}
            className={`flex items-center gap-1.5 sm:gap-2 pb-3 sm:pb-4 px-1.5 sm:px-2 border-b-2 transition-all font-medium text-xs sm:text-sm whitespace-nowrap ${
              activeTab === 'pendencias' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-app-text-muted hover:text-app-text'
            }`}
          >
            <AlertCircle size={16} className="sm:w-[18px] sm:h-[18px]" />
            Processos Limitados (Tag Pendência)
          </button>
          
          <button
            id="tab-morosidade"
            onClick={() => setActiveTab('morosidade')}
            className={`flex items-center gap-1.5 sm:gap-2 pb-3 sm:pb-4 px-1.5 sm:px-2 border-b-2 transition-all font-medium text-xs sm:text-sm whitespace-nowrap ${
              activeTab === 'morosidade' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-app-text-muted hover:text-app-text'
            }`}
          >
            <Clock size={16} className="sm:w-[18px] sm:h-[18px]" />
            Processos Parados (+{diasMorosidade} dias)
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'pendencias' && (
          <Processos key="pendencias-tab" filterStatus="Ativo" filterTag="pendencia" hideTitle={true} />
        )}

        {activeTab === 'morosidade' && (
          <Processos key="morosidade-tab" filterStatus="Ativo" filterMorosidade={true} hideTitle={true} />
        )}
      </div>
    </div>
  );
}
