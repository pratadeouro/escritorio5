/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppProvider, useAppContext } from './context';
import { View } from './types';
import { Loader2, Save, Ban, LogOut, RefreshCw } from 'lucide-react';
import Layout from './components/Layout';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import Processos from './views/Processos';
import Contatos from './views/Contatos';
import Agenda from './views/Agenda';
import Financeiro from './views/Financeiro';
import Documentos from './views/Documentos';
import Varas from './views/Varas';
import Escritorios from './views/Escritorios';
import Usuarios from './views/Usuarios';
import Tarefas from './views/Tarefas';
import Movimentos from './views/Movimentos';
import Julgadores from './views/Julgadores';
import Servidores from './views/Servidores';
import Recursos from './views/Recursos';
import UPJ from './views/UPJ';
import Modelos from './views/Modelos';
import Etiquetas from './views/Etiquetas';
import Relacionamento from './views/Relacionamento';
import Tribunais from './views/Tribunais';
import Forums from './views/Forums';
import DJEN from './views/DJEN';
import ApiDiario from './views/ApiDiario';
import Leads from './views/Leads';
import CalendarioJudicial from './views/CalendarioJudicial';
import IA from './views/IA';
import Settings from './views/Settings';
import Profile from './views/Profile';
import PendenciasView from './views/PendenciasView';
import Logs from './views/Logs';
import ConfiguracoesGlobais from './views/ConfiguracoesGlobais';
import AguardandoAprovacao from './views/AguardandoAprovacao';

function PlaceholderView({ title }: { title: string }) {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{title}</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
        Esta funcionalidade está em desenvolvimento.
      </div>
    </div>
  );
}

function LogoutLoading() {
  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-100 flex flex-col items-center max-w-sm w-full mx-4">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-25"></div>
          <div className="relative bg-blue-50 p-4 rounded-full">
            <Save className="w-10 h-10 text-blue-600 animate-pulse" />
          </div>
          <div className="absolute -bottom-1 -right-1">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Saindo com segurança</h2>
        <p className="text-gray-600 text-center mb-4">
          Estamos salvando suas alterações na planilha do Google. Por favor, aguarde um momento.
        </p>
        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
          <div className="bg-blue-600 h-full animate-[loading_2s_ease-in-out_infinite] w-1/3 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}

function ContaInativa() {
  const { currentUser, logout, forceLoad, refreshAuthUsers } = useAppContext();
  const [isChecking, setIsChecking] = useState(false);

  const handleRefresh = async () => {
    setIsChecking(true);
    try {
      await refreshAuthUsers();
      await forceLoad();
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-app-surface border border-app-border rounded-3xl shadow-2xl p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center">
          <Ban size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-app-text">Conta Inativa</h1>
          <p className="text-sm text-app-text-muted leading-relaxed">
            O acesso de <strong className="text-app-text">{currentUser?.nome || currentUser?.email}</strong> está temporariamente inativo no sistema. Entre em contato com o administrador do escritório para reativação.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isChecking}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-app-border text-sm font-semibold text-app-text hover:bg-app-secondary/50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={16} className={isChecking ? 'animate-spin' : ''} />
            Verificar Status
          </button>
          <button
            type="button"
            onClick={() => logout()}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <LogOut size={16} />
            Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { currentUser, isLoggingOut, isAdmin } = useAppContext();
  const [currentView, setCurrentView] = useState<View>('dashboard');

  useEffect(() => {
    const handleNavigate = (e: any) => {
      if (e.detail) {
        setCurrentView(e.detail as View);
      }
    };
    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, []);

  if (isLoggingOut) {
    return <LogoutLoading />;
  }

  if (!currentUser) {
    return <Login />;
  }

  const isUserInactive =
    (currentUser.email || '').trim().toLowerCase() !== 'pratadeouro@gmail.com' &&
    String(currentUser.status || 'Ativo').trim().toLowerCase() === 'inativo';

  if (isUserInactive) {
    return <ContaInativa />;
  }

  // Fallback para usuários sem escritório associado (exceto admins)
  const hasNoOffice = !isAdmin() && (!currentUser.escritoriosIds || currentUser.escritoriosIds.length === 0);

  if (hasNoOffice) {
    return <AguardandoAprovacao />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'contatos': return <Contatos />;
      case 'processosAtivos': return <Processos key="ativos" filterStatus="Ativo" />;
      case 'eventos': return <Agenda />;
      case 'financeiro': return <Financeiro />;
      case 'usuarios': return <Usuarios />;
      case 'servidores': return <Servidores />;
      case 'tarefas': return <Tarefas />;
      case 'pendencias': return <PendenciasView />;
      case 'documentos': return <Documentos />;
      case 'varas': return <Varas />;
      case 'forum': return <Forums />;
      case 'escritorios': return <Escritorios />;
      case 'etiquetas': return <Etiquetas />;
      case 'relacionamento': return <Relacionamento />;
      case 'tribunais': return <Tribunais />;
      case 'modelos': return <Modelos />;
      case 'julgadores': return <Julgadores />;
      case 'movimentos': return <Movimentos />;
      case 'recursos': return <Recursos />;
      case 'upj': return <UPJ />;
      case 'djen': return <DJEN />;
      case 'api_diario': return <ApiDiario />;
      case 'leads': return <Leads />;
      case 'calendario': return <CalendarioJudicial />;
      case 'ia': return <IA />;
      case 'processosGeral': return <Processos key="geral" />;
      case 'profile': return <Profile />;
      case 'logs': return <Logs />;
      case 'settings': return <Settings />;
      case 'configuracoesGlobais': return <ConfiguracoesGlobais />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout currentView={currentView} onNavigate={setCurrentView}>
      {renderView()}
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

