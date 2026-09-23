/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppProvider, useAppContext } from './context';
import { View } from './types';
import { Loader2, Save, ShieldAlert } from 'lucide-react';
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

function NoOfficeError({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-app-bg flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-app-surface rounded-2xl shadow-xl border border-app-border p-8 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-10 h-10 text-amber-500" strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-bold text-app-text mb-4">Acesso Restrito</h2>
        <p className="text-app-text-muted mb-8 text-lg">
          Usuário sem vínculo com escritório, contate o administrador.
        </p>
        <button
          onClick={onLogout}
          className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95"
        >
          Sair do Sistema
        </button>
      </div>
    </div>
  );
}

function AppContent() {
  const { currentUser, isLoggingOut, isAdmin, logout } = useAppContext();
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

  // Fallback para usuários sem escritório associado (exceto admins)
  const hasNoOffice = !isAdmin() && (!currentUser.escritoriosIds || currentUser.escritoriosIds.length === 0);

  if (hasNoOffice) {
    return <NoOfficeError onLogout={logout} />;
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

