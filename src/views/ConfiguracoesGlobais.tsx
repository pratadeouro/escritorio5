import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context';
import { 
  Globe, 
  Key, 
  ShieldCheck, 
  Palette, 
  Sliders, 
  Database, 
  Mail, 
  Save, 
  Copy, 
  Check, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  Sun, 
  Moon, 
  Eye, 
  EyeOff, 
  Loader2, 
  Scale, 
  Clock,
  FileSpreadsheet,
  Send
} from 'lucide-react';
import { isSupabaseConfigured } from '../services/supabaseService';
import { sendTestEmailExternal, triggerAutomatedEmails } from '../services/googleAppsScript';
import { EnvironmentMode } from '../types';
import { SupabaseMigrationTab } from '../components/SupabaseMigrationTab';

const PRIMARY_COLORS = [
  { name: 'Índigo Moderno', hex: '#4f46e5' },
  { name: 'Safira Clássico', hex: '#2563eb' },
  { name: 'Esmeralda Nobre', hex: '#059669' },
  { name: 'Borgonha Elegante', hex: '#991b1b' },
  { name: 'Púrpura Imperial', hex: '#7c3aed' },
  { name: 'Dourado / Âmbar', hex: '#d97706' },
];

export default function ConfiguracoesGlobais() {
  const { 
    state, 
    updateSettings, 
    forceSave,
    forceLoad,
    isAdmin, 
    currentUser, 
    applyTheme, 
    dataSource,
    setDataSource,
    activeOfficeName,
    environmentMode,
    environmentSource,
    isProductionMode,
    saveEnvironmentMode
  } = useAppContext();

  // Proteção de segurança estrita para administradores
  if (!isAdmin()) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-2xl font-black text-app-text mb-2">Acesso Restrito ao Administrador</h2>
        <p className="text-sm text-app-text-muted max-w-md mb-6 leading-relaxed">
          Esta área é reservada exclusivamente para o administrador do sistema. Se você acredita que deveria ter acesso, contate o administrador principal.
        </p>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<'google' | 'identity' | 'theme' | 'operations' | 'email' | 'migration'>('google');

  useEffect(() => {
    if (isProductionMode && activeTab === 'migration') {
      setActiveTab('google');
    }
  }, [isProductionMode, activeTab]);
  
  // Estados do formulário global
  const [googleClientId, setGoogleClientId] = useState(() => {
    return state.settings.googleClientId || 
           (typeof localStorage !== 'undefined' ? localStorage.getItem('advocacia_google_client_id') || '' : '') || 
           (import.meta as any).env.VITE_GOOGLE_CLIENT_ID || '';
  });
  const [showGoogleId, setShowGoogleId] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<{ active: boolean; message: string }>({
    active: false,
    message: ''
  });

  const [siteName, setSiteName] = useState(() => {
    return state.settings.siteName || 
           (typeof localStorage !== 'undefined' ? localStorage.getItem('advocacia_site_name') || '' : '') || 
           (activeOfficeName && activeOfficeName !== 'Todos os Escritórios' && activeOfficeName !== 'LexGestão' ? activeOfficeName : 'Meu Escritório Jurídico');
  });
  const [siteSubtitle, setSiteSubtitle] = useState(() => {
    return state.settings.siteSubtitle || 'Sistema de Gestão Jurídica e Processual';
  });

  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    return state.settings.theme || 'light';
  });
  const [primaryColor, setPrimaryColor] = useState(() => {
    return state.settings.primaryColor || '#4f46e5';
  });

  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    return state.settings.itemsPerPage || 10;
  });
  const [diasMorosidade, setDiasMorosidade] = useState<number>(() => {
    return state.settings.diasMorosidade || 30;
  });
  const [timezone, setTimezone] = useState(() => {
    return state.settings.timezone || 'America/Sao_Paulo';
  });
  const [showMovimentos, setShowMovimentos] = useState<boolean>(() => {
    return state.settings.showMovimentos !== false;
  });

  // Notificações e e-mails globais
  const [enableEmailNotifications, setEnableEmailNotifications] = useState<boolean>(() => {
    return !!state.settings.enableEmailNotifications;
  });
  const [emailDailyReport, setEmailDailyReport] = useState<boolean>(() => {
    return !!state.settings.emailDailyReport;
  });
  const [emailWeeklyReport, setEmailWeeklyReport] = useState<boolean>(() => {
    return !!state.settings.emailWeeklyReport;
  });
  const [emailDispatchTime, setEmailDispatchTime] = useState(() => {
    return state.settings.emailDispatchTime || '08:00';
  });
  const [useExternalSmtp, setUseExternalSmtp] = useState<boolean>(() => {
    return !!state.settings.useExternalSmtp;
  });
  const [smtpHost, setSmtpHost] = useState(() => state.settings.smtpHost || '');
  const [smtpPort, setSmtpPort] = useState<number>(() => state.settings.smtpPort || 465);
  const [smtpSecure, setSmtpSecure] = useState<boolean>(() => state.settings.smtpSecure !== false);
  const [emailUser, setEmailUser] = useState(() => state.settings.emailUser || '');
  const [emailPass, setEmailPass] = useState(() => state.settings.emailPass || '');
  const [showEmailPass, setShowEmailPass] = useState(false);

  // Modo de operação do sistema (Homologação vs Produção) e Fonte de Dados (Supabase vs Google Sheets)
  const [selectedEnvMode, setSelectedEnvMode] = useState<EnvironmentMode>(environmentMode);
  const [isSwitchingEnv, setIsSwitchingEnv] = useState(false);
  const [isSwitchingDataSource, setIsSwitchingDataSource] = useState(false);
  const [dataSourceFeedback, setDataSourceFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  const supabaseReadyInEnv = isSupabaseConfigured();
  const sheetsReadyInEnv = !!String(state.settings.spreadsheetId || '').trim();

  useEffect(() => {
    setSelectedEnvMode(environmentMode);
  }, [environmentMode]);

  // Estados de feedback de gravação
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [copiedClientId, setCopiedClientId] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState(() => currentUser?.email || '');
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [isRunningAutomation, setIsRunningAutomation] = useState<'daily' | 'weekly' | null>(null);
  const [emailActionFeedback, setEmailActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  // Verifica o status do Google Client ID
  useEffect(() => {
    if (!googleClientId) {
      setGoogleStatus({
        active: false,
        message: 'Google Client ID não configurado. O botão de login com o Google ficará inativo na tela de login.'
      });
    } else if (googleClientId.includes('.apps.googleusercontent.com')) {
      setGoogleStatus({
        active: true,
        message: 'Formato válido de Client ID do Google OAuth 2.0.'
      });
    } else {
      setGoogleStatus({
        active: false,
        message: 'Aviso: O Client ID do Google normalmente termina com ".apps.googleusercontent.com".'
      });
    }
  }, [googleClientId]);

  const handleCopyOrigin = () => {
    if (!currentOrigin) return;
    navigator.clipboard.writeText(currentOrigin);
    setCopiedOrigin(true);
    setTimeout(() => setCopiedOrigin(false), 2000);
  };

  const handleApplyThemeNow = () => {
    applyTheme(themeMode, primaryColor, '#ffffff', '#f8fafc', siteName);
  };

  const handleQuickSwitchEnvironment = async (targetMode: EnvironmentMode) => {
    setSelectedEnvMode(targetMode);
    setIsSwitchingEnv(true);
    try {
      await saveEnvironmentMode(targetMode);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } finally {
      setIsSwitchingEnv(false);
    }
  };

  const handleSwitchDataSource = async (targetSource: 'supabase' | 'sheets') => {
    if (isSwitchingDataSource || dataSource === targetSource) return;

    if (targetSource === 'supabase' && !supabaseReadyInEnv) {
      setDataSourceFeedback({
        type: 'error',
        message: 'Supabase não está configurado no arquivo .env (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).'
      });
      return;
    }

    if (targetSource === 'sheets' && !sheetsReadyInEnv) {
      setDataSourceFeedback({
        type: 'error',
        message: 'Google Sheets não está configurado no arquivo .env (VITE_SPREADSHEET_ID).'
      });
      return;
    }

    setIsSwitchingDataSource(true);
    setDataSourceFeedback(null);
    try {
      await setDataSource(targetSource);
      await forceLoad();
      setDataSourceFeedback({
        type: 'success',
        message: targetSource === 'supabase'
          ? 'Fonte de dados alterada para Supabase Cloud (.env atualizado e dados recarregados).'
          : 'Fonte de dados alterada para Google Sheets (.env atualizado e dados recarregados).'
      });
      setTimeout(() => setDataSourceFeedback(null), 4000);
    } catch (err: any) {
      setDataSourceFeedback({
        type: 'error',
        message: err?.message || 'Erro ao alternar fonte de dados.'
      });
    } finally {
      setIsSwitchingDataSource(false);
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const updatedSettings = {
        ...state.settings,
        googleClientId: googleClientId.trim(),
        siteName: siteName.trim(),
        siteSubtitle: siteSubtitle.trim(),
        theme: themeMode,
        primaryColor,
        itemsPerPage: Number(itemsPerPage),
        diasMorosidade: Number(diasMorosidade),
        timezone,
        showMovimentos,
        enableEmailNotifications,
        emailDailyReport,
        emailWeeklyReport,
        emailDispatchTime,
        useExternalSmtp,
        smtpHost: smtpHost.trim(),
        smtpPort: Number(smtpPort),
        smtpSecure,
        emailUser: emailUser.trim(),
        emailPass: emailPass.trim(),
        environmentMode: selectedEnvMode,
      };

      // 1. Salva no contexto
      updateSettings(updatedSettings);

      // 2. Persiste em localStorage para disponibilidade imediata antes do login
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('advocacia_google_client_id', googleClientId.trim());
        localStorage.setItem('advocacia_site_name', siteName.trim());
        localStorage.setItem('advocacia_environment_mode', selectedEnvMode);
        localStorage.setItem('advocacia_theme_cache', JSON.stringify({
          officeName: siteName.trim(),
          theme: themeMode,
          primaryColor
        }));
      }

      // 3. Aplica estilos globais
      applyTheme(themeMode, primaryColor, '#ffffff', '#f8fafc', siteName.trim());

      // 4. Grava modo de ambiente no .env do servidor atual e sincroniza no app_settings do Supabase
      await saveEnvironmentMode(selectedEnvMode);

      // 5. Grava diretamente no .env do servidor para persistência total independente de cache
      try {
        await fetch('/api/admin/save-google-client-id', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ googleClientId: googleClientId.trim() })
        });
      } catch (envErr) {
        console.warn('Falha ao gravar .env no servidor:', envErr);
      }

      // 6. Salva no banco de dados Supabase / Sheets
      await forceSave();

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('Erro ao salvar configurações globais:', err);
      setSaveError(err?.message || 'Erro ao salvar configurações globais no servidor/banco de dados.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      {/* Header com Ações e Badge de Administrador */}
      <div className="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center shrink-0">
              <Globe size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-black text-app-text tracking-tight">Configurações Globais do Sistema</h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <ShieldCheck size={13} />
                  Admin Exclusivo ({currentUser?.email})
                </span>
              </div>
              <p className="text-xs text-app-text-muted mt-1">
                Parâmetros mestre que afetam a tela de login, Google OAuth, identidade visual, banco de dados e todo o sistema.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isSaving ? 'Salvando...' : 'Salvar Configurações Globais'}
            </button>
          </div>
        </div>

        {saveSuccess && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-bounce">
            <CheckCircle2 size={16} className="shrink-0" />
            Configurações globais salvas com sucesso no servidor (.env) e sincronizadas!
          </div>
        )}
        {saveError && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            {saveError}
          </div>
        )}
      </div>

      {/* Painel Rápido: Modo do Ambiente (Homologação vs Produção) */}
      <div className="bg-app-surface border border-app-border rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-app-text">Modo de Operação do Ambiente</h2>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                selectedEnvMode === 'producao'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${selectedEnvMode === 'producao' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                {selectedEnvMode === 'producao' ? 'Produção Ativa' : 'Homologação Ativa'}
              </span>
              <span className="text-[11px] text-app-text-muted">
                (Origem atual: {environmentSource === 'env' ? '.env do servidor' : environmentSource === 'supabase' ? 'Supabase app_settings' : 'Padrão'})
              </span>
            </div>
            <p className="text-xs text-app-text-muted mt-1">
              Alterna este servidor entre Homologação e Produção, gravando no <code className="font-mono">.env</code> local e sincronizando com o Supabase.
            </p>
          </div>
          {isSwitchingEnv && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Loader2 size={14} className="animate-spin" /> Aplicando modo...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isSwitchingEnv}
            onClick={() => handleQuickSwitchEnvironment('homologacao')}
            className={`text-left p-4 rounded-2xl border transition-all ${
              selectedEnvMode === 'homologacao'
                ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20'
                : 'border-app-border bg-app-bg hover:border-amber-500/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-bold text-app-text flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                Modo Homologação (Testes)
              </span>
              {selectedEnvMode === 'homologacao' && <CheckCircle2 size={18} className="text-amber-500" />}
            </div>
            <p className="text-xs text-app-text-muted leading-relaxed">
              Exibe os avisos de <strong>Ambiente de Homologação</strong> (Login, Sidebar, Topo e Dashboard) e libera as abas de carga em massa: <strong>Migração Supabase</strong>, <strong>Importar para Supabase Auth</strong> e <strong>Importar Processos</strong>.
            </p>
          </button>

          <button
            type="button"
            disabled={isSwitchingEnv}
            onClick={() => handleQuickSwitchEnvironment('producao')}
            className={`text-left p-4 rounded-2xl border transition-all ${
              selectedEnvMode === 'producao'
                ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20'
                : 'border-app-border bg-app-bg hover:border-emerald-500/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-bold text-app-text flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Modo Produção (Operação Real)
              </span>
              {selectedEnvMode === 'producao' && <CheckCircle2 size={18} className="text-emerald-500" />}
            </div>
            <p className="text-xs text-app-text-muted leading-relaxed">
              Remove todos os avisos de homologação da interface e oculta as abas de carga em massa (<strong>Migração Supabase</strong>, <strong>Importar para Supabase Auth</strong> e <strong>Importar Processos</strong>), mantendo ativos o botão <strong>Google Forms</strong> e o <strong>DJEN</strong>.
            </p>
          </button>
        </div>
      </div>

      {/* Painel Rápido: Fonte de Dados Principal (Supabase vs Google Sheets) */}
      <div className="bg-app-surface border border-app-border rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-app-text">Fonte de Dados Principal</h2>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                dataSource === 'supabase'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dataSource === 'supabase' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500 animate-pulse'}`} />
                {dataSource === 'supabase' ? 'Supabase Cloud Ativo' : 'Google Sheets Ativo'}
              </span>
            </div>
            <p className="text-xs text-app-text-muted mt-1">
              Alterna a fonte de dados ativa entre Supabase Cloud e Google Sheets usando exclusivamente as credenciais do <code className="font-mono">.env</code>.
            </p>
          </div>
          {isSwitchingDataSource && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Loader2 size={14} className="animate-spin" /> Alterando e recarregando...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isSwitchingDataSource}
            onClick={() => handleSwitchDataSource('supabase')}
            className={`text-left p-4 rounded-2xl border transition-all disabled:opacity-60 ${
              dataSource === 'supabase'
                ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20'
                : 'border-app-border bg-app-bg hover:border-emerald-500/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5 gap-2">
              <span className="text-sm font-bold text-app-text flex items-center gap-2">
                <Database size={16} className="text-emerald-500 shrink-0" />
                Supabase Cloud (PostgreSQL)
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  supabaseReadyInEnv
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                }`}>
                  {supabaseReadyInEnv ? '.env configurado' : 'Ausente no .env'}
                </span>
                {dataSource === 'supabase' && <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />}
              </div>
            </div>
            <p className="text-xs text-app-text-muted leading-relaxed">
              Operações em tempo real no banco relacional PostgreSQL com autenticação Supabase Auth e regras RLS.
            </p>
          </button>

          <button
            type="button"
            disabled={isSwitchingDataSource}
            onClick={() => handleSwitchDataSource('sheets')}
            className={`text-left p-4 rounded-2xl border transition-all disabled:opacity-60 ${
              dataSource === 'sheets'
                ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/20'
                : 'border-app-border bg-app-bg hover:border-blue-500/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5 gap-2">
              <span className="text-sm font-bold text-app-text flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-blue-500 shrink-0" />
                Google Sheets (Planilha)
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  sheetsReadyInEnv
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                }`}>
                  {sheetsReadyInEnv ? '.env configurado' : 'Ausente no .env'}
                </span>
                {dataSource === 'sheets' && <CheckCircle2 size={18} className="text-blue-500 shrink-0" />}
              </div>
            </div>
            <p className="text-xs text-app-text-muted leading-relaxed">
              Leitura e gravação na planilha Google configurada nas variáveis <code className="font-mono">VITE_SPREADSHEET_ID</code> e <code className="font-mono">VITE_SCRIPT_URL</code> do <code className="font-mono">.env</code>.
            </p>
          </button>
        </div>

        {dataSourceFeedback && (
          <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            dataSourceFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
          }`}>
            {dataSourceFeedback.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
            <span>{dataSourceFeedback.message}</span>
          </div>
        )}
      </div>

      {/* Navegação por Abas das Configurações Globais */}
      <div className="flex items-center gap-2 border-b border-app-border overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('google')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
            activeTab === 'google'
              ? 'bg-primary text-white shadow-md'
              : 'text-app-text-muted hover:text-app-text hover:bg-app-surface'
          }`}
        >
          <Key size={15} />
          Login Google & OAuth
        </button>

        <button
          onClick={() => setActiveTab('identity')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
            activeTab === 'identity'
              ? 'bg-primary text-white shadow-md'
              : 'text-app-text-muted hover:text-app-text hover:bg-app-surface'
          }`}
        >
          <Scale size={15} />
          Identidade do Sistema
        </button>

        <button
          onClick={() => setActiveTab('theme')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
            activeTab === 'theme'
              ? 'bg-primary text-white shadow-md'
              : 'text-app-text-muted hover:text-app-text hover:bg-app-surface'
          }`}
        >
          <Palette size={15} />
          Tema & Aparência Global
        </button>

        <button
          onClick={() => setActiveTab('operations')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
            activeTab === 'operations'
              ? 'bg-primary text-white shadow-md'
              : 'text-app-text-muted hover:text-app-text hover:bg-app-surface'
          }`}
        >
          <Sliders size={15} />
          Operações & Prazos
        </button>

        <button
          onClick={() => setActiveTab('email')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
            activeTab === 'email'
              ? 'bg-primary text-white shadow-md'
              : 'text-app-text-muted hover:text-app-text hover:bg-app-surface'
          }`}
        >
          <Mail size={15} />
          E-mails & Disparos
        </button>

        {!isProductionMode && (
          <button
            onClick={() => setActiveTab('migration')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
              activeTab === 'migration'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <Database size={15} />
            Migração Supabase
          </button>
        )}
      </div>

      {/* Conteúdo da Aba 1: Google OAuth & Login */}
      {activeTab === 'google' && (
        <div className="space-y-6">
          <div className="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-app-text">Google Client ID (OAuth 2.0)</h3>
                <p className="text-xs text-app-text-muted">
                  Habilita o botão oficial de Login com o Google na tela de entrada do sistema para todos os escritórios e usuários.
                </p>
              </div>
            </div>

            {/* Status da Integração */}
            <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
              googleStatus.active 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
            }`}>
              {googleStatus.active ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <AlertCircle size={18} className="shrink-0 mt-0.5" />}
              <div>
                <strong className="block font-bold mb-0.5">
                  {googleStatus.active ? 'Login com o Google Habilitado' : 'Aguardando Configuração do Google Client ID'}
                </strong>
                <span>{googleStatus.message}</span>
              </div>
            </div>

            {/* Campo do Google Client ID */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider block">
                Google Client ID (OAuth 2.0)
              </label>
              <div className="relative">
                <input
                  type={showGoogleId ? 'text' : 'password'}
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  placeholder="Ex: 1234567890-abcdefgh12345.apps.googleusercontent.com"
                  className="w-full px-4 py-3 rounded-2xl border border-app-border bg-app-bg text-sm text-app-text font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary pr-24"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowGoogleId(!showGoogleId)}
                    className="p-2 text-app-text-muted hover:text-app-text rounded-xl"
                    title={showGoogleId ? 'Ocultar' : 'Exibir'}
                  >
                    {showGoogleId ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  {googleClientId && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(googleClientId);
                        setCopiedClientId(true);
                        setTimeout(() => setCopiedClientId(false), 2000);
                      }}
                      className="p-2 text-app-text-muted hover:text-primary rounded-xl"
                      title="Copiar"
                    >
                      {copiedClientId ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-app-text-muted">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                  <CheckCircle2 size={12} /> Salvo no .env do servidor
                </span>
                <span>Configuração global para todos os escritórios, imune à limpeza de cache do navegador.</span>
              </div>
            </div>

            {/* Painel de URLs para Google Cloud Console */}
            <div className="bg-app-bg/50 border border-app-border rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-app-text uppercase tracking-wider">
                    Configuração no Google Cloud Console
                  </h4>
                  <p className="text-xs text-app-text-muted mt-0.5">
                    Adicione o domínio abaixo nas credenciais OAuth do seu projeto Google Cloud.
                  </p>
                </div>
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-bold"
                >
                  Abrir Console Google <ExternalLink size={13} />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-app-surface border border-app-border rounded-xl space-y-1.5">
                  <span className="text-[10px] font-bold text-app-text-muted uppercase">
                    Origens JavaScript Autorizadas
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs font-mono text-app-text truncate">{currentOrigin}</code>
                    <button
                      type="button"
                      onClick={handleCopyOrigin}
                      className="p-1.5 bg-app-bg hover:bg-app-secondary border border-app-border rounded-lg text-app-text-muted hover:text-primary shrink-0 transition-colors"
                      title="Copiar Origem"
                    >
                      {copiedOrigin ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-app-surface border border-app-border rounded-xl space-y-1.5">
                  <span className="text-[10px] font-bold text-app-text-muted uppercase">
                    URIs de Redirecionamento Autorizados
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs font-mono text-app-text truncate">{currentOrigin}</code>
                    <button
                      type="button"
                      onClick={handleCopyOrigin}
                      className="p-1.5 bg-app-bg hover:bg-app-secondary border border-app-border rounded-lg text-app-text-muted hover:text-primary shrink-0 transition-colors"
                      title="Copiar URI"
                    >
                      {copiedOrigin ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 2: Identidade do Sistema */}
      {activeTab === 'identity' && (
        <div className="space-y-6">
          <div className="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-app-text">Identidade Visual & Marca Global</h3>
              <p className="text-xs text-app-text-muted">
                Define o nome mestre do sistema, o título exibido na tela de login e nas abas do navegador.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider block">
                  Nome do Sistema / Título da Marca
                </label>
                <input
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="Meu Escritório Jurídico"
                  className="w-full px-4 py-3 rounded-2xl border border-app-border bg-app-bg text-sm text-app-text font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <p className="text-[11px] text-app-text-muted">
                  Substitui a marca padrão em todo o site e na tela de login.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider block">
                  Subtítulo / Slogan
                </label>
                <input
                  type="text"
                  value={siteSubtitle}
                  onChange={(e) => setSiteSubtitle(e.target.value)}
                  placeholder="Sistema de Gestão Jurídica e Processual"
                  className="w-full px-4 py-3 rounded-2xl border border-app-border bg-app-bg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <p className="text-[11px] text-app-text-muted">
                  Aparece logo abaixo do nome do escritório na tela de autenticação.
                </p>
              </div>
            </div>

            {/* Pré-visualização da Identidade */}
            <div className="p-6 bg-app-bg/50 border border-app-border rounded-2xl text-center space-y-2">
              <span className="text-[10px] font-bold uppercase text-app-text-muted tracking-widest block">
                Prévia da Apresentação
              </span>
              <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto">
                <Scale size={28} />
              </div>
              <h2 className="text-2xl font-black text-app-text tracking-tight">
                {siteName || 'Meu Escritório Jurídico'}
              </h2>
              <p className="text-xs text-app-text-muted font-medium">
                {siteSubtitle || 'Sistema de Gestão Jurídica e Processual'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 3: Tema e Cores Globais */}
      {activeTab === 'theme' && (
        <div className="space-y-6">
          <div className="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-app-text">Tema & Cores Globais</h3>
              <p className="text-xs text-app-text-muted">
                Configura o esquema de cores e o modo de iluminação padrão aplicado a todas as páginas e componentes.
              </p>
            </div>

            {/* Modo Claro / Escuro / Sistema */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider block">
                Modo de Aparência Padrão
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setThemeMode('light')}
                  className={`flex items-center justify-center gap-2 p-4 rounded-2xl border font-bold text-xs transition-all ${
                    themeMode === 'light'
                      ? 'border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/20'
                      : 'border-app-border bg-app-bg text-app-text-muted hover:text-app-text'
                  }`}
                >
                  <Sun size={18} />
                  Modo Claro
                </button>

                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  className={`flex items-center justify-center gap-2 p-4 rounded-2xl border font-bold text-xs transition-all ${
                    themeMode === 'dark'
                      ? 'border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/20'
                      : 'border-app-border bg-app-bg text-app-text-muted hover:text-app-text'
                  }`}
                >
                  <Moon size={18} />
                  Modo Escuro
                </button>

                <button
                  type="button"
                  onClick={() => setThemeMode('system')}
                  className={`flex items-center justify-center gap-2 p-4 rounded-2xl border font-bold text-xs transition-all ${
                    themeMode === 'system'
                      ? 'border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/20'
                      : 'border-app-border bg-app-bg text-app-text-muted hover:text-app-text'
                  }`}
                >
                  <Globe size={18} />
                  Automático (Sistema)
                </button>
              </div>
            </div>

            {/* Paleta de Cores Primárias */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider block">
                Cor Primária Global do Sistema
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {PRIMARY_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setPrimaryColor(c.hex)}
                    className={`flex flex-col items-center p-3 rounded-2xl border text-center transition-all ${
                      primaryColor.toLowerCase() === c.hex.toLowerCase()
                        ? 'border-app-text shadow-md ring-2 ring-primary/30'
                        : 'border-app-border hover:border-app-text/40'
                    }`}
                  >
                    <span 
                      className="w-8 h-8 rounded-full shadow-inner mb-2 flex items-center justify-center text-white" 
                      style={{ backgroundColor: c.hex }}
                    >
                      {primaryColor.toLowerCase() === c.hex.toLowerCase() && <Check size={16} />}
                    </span>
                    <span className="text-[11px] font-bold text-app-text">{c.name}</span>
                    <span className="text-[10px] font-mono text-app-text-muted">{c.hex}</span>
                  </button>
                ))}
              </div>

              <div className="pt-2 flex items-center gap-3">
                <label className="text-xs font-medium text-app-text-muted">Personalizar cor hexadecimal:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-9 h-9 rounded-xl border border-app-border cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-app-border bg-app-bg text-xs font-mono w-28 uppercase"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyThemeNow}
                  className="px-4 py-2 bg-app-secondary hover:bg-app-border text-app-text font-bold text-xs rounded-xl transition-colors ml-auto"
                >
                  Aplicar Imediatamente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 4: Operações & Prazos */}
      {activeTab === 'operations' && (
        <div className="space-y-6">
          <div className="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-app-text">Parâmetros Operacionais & Prazos</h3>
              <p className="text-xs text-app-text-muted">
                Ajusta as regras gerais de tabelas, morosidade e fuso horário para todos os escritórios.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider block">
                  Itens por Página Padrão nas Tabelas
                </label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-2xl border border-app-border bg-app-bg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
                >
                  <option value={10}>10 itens por página</option>
                  <option value={25}>25 itens por página</option>
                  <option value={50}>50 itens por página</option>
                  <option value={100}>100 itens por página</option>
                </select>
                <p className="text-[11px] text-app-text-muted">
                  Paginação padrão para Processos, Contatos, Prazos e Tarefas.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider block">
                  Alerta de Morosidade Processual (Dias)
                </label>
                <div className="relative">
                  <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={diasMorosidade}
                    onChange={(e) => setDiasMorosidade(Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-app-border bg-app-bg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
                  />
                </div>
                <p className="text-[11px] text-app-text-muted">
                  Processos sem movimentação há mais tempo que este limite receberão alerta no Dashboard.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider block">
                  Fuso Horário Padrão do Sistema
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-app-border bg-app-bg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
                >
                  <option value="America/Sao_Paulo">Brasília / São Paulo (UTC-3)</option>
                  <option value="America/Cuiaba">Cuiabá / MT / MS (UTC-4)</option>
                  <option value="America/Manaus">Manaus / AM (UTC-4)</option>
                  <option value="America/Belem">Belém / PA (UTC-3)</option>
                  <option value="America/Fortaleza">Fortaleza / CE / Nordeste (UTC-3)</option>
                  <option value="America/Porto_Velho">Porto Velho / RO (UTC-4)</option>
                  <option value="America/Rio_Branco">Rio Branco / AC (UTC-5)</option>
                </select>
                <p className="text-[11px] text-app-text-muted">
                  Referência para cálculo de prazos, notificações e logs do sistema.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider block">
                  Módulo de Movimentos Processuais
                </label>
                <div className="flex items-center justify-between p-3.5 bg-app-bg border border-app-border rounded-2xl">
                  <div>
                    <span className="text-xs font-bold text-app-text block">Exibir Movimentos no Menu Lateral</span>
                    <span className="text-[11px] text-app-text-muted">Habilita a listagem geral de movimentações.</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showMovimentos}
                      onChange={(e) => setShowMovimentos(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-app-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 5: E-mails & Notificações Globais */}
      {activeTab === 'email' && (
        <div className="space-y-6">
          <div className="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-app-text">Notificações por E-mail & Servidor SMTP</h3>
              <p className="text-xs text-app-text-muted">
                Configure os disparos automatizados de prazos e relatórios para todos os membros do escritório.
              </p>
            </div>

            {/* Switches Principais de Disparo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-app-bg border border-app-border rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-app-text block">Notificações Globais</span>
                  <span className="text-[10px] text-app-text-muted">Ativar e-mails do sistema</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableEmailNotifications}
                    onChange={(e) => setEnableEmailNotifications(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-app-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="p-4 bg-app-bg border border-app-border rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-app-text block">Relatório Diário</span>
                  <span className="text-[10px] text-app-text-muted">Prazos e tarefas do dia</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailDailyReport}
                    onChange={(e) => setEmailDailyReport(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-app-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="p-4 bg-app-bg border border-app-border rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-app-text block">Relatório Semanal</span>
                  <span className="text-[10px] text-app-text-muted">Resumo de processos</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailWeeklyReport}
                    onChange={(e) => setEmailWeeklyReport(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-app-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>

            {/* Horário de Disparo */}
            <div className="space-y-1.5 max-w-xs">
              <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider block">
                Horário Padrão de Disparo Diário
              </label>
              <input
                type="time"
                value={emailDispatchTime}
                onChange={(e) => setEmailDispatchTime(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-app-border bg-app-bg text-sm text-app-text font-bold"
              />
            </div>

            {/* Configuração SMTP Opcional */}
            <div className="border-t border-app-border pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-app-text">Servidor SMTP Externo (Personalizado)</h4>
                  <p className="text-xs text-app-text-muted">Use seu próprio servidor de e-mail corporativo.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useExternalSmtp}
                    onChange={(e) => setUseExternalSmtp(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-app-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {useExternalSmtp && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-app-text-muted uppercase">Host SMTP</label>
                    <input
                      type="text"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="smtp.seudominio.adv.br"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-app-border bg-app-bg text-xs font-mono text-app-text"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-app-text-muted uppercase">Porta SMTP</label>
                    <input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(Number(e.target.value))}
                      placeholder="465 ou 587"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-app-border bg-app-bg text-xs font-mono text-app-text"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-app-text-muted uppercase">Usuário / E-mail</label>
                    <input
                      type="text"
                      value={emailUser}
                      onChange={(e) => setEmailUser(e.target.value)}
                      placeholder="notificacoes@seudominio.adv.br"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-app-border bg-app-bg text-xs text-app-text"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-bold text-app-text-muted uppercase">Senha de Aplicativo</label>
                    <div className="relative">
                      <input
                        type={showEmailPass ? 'text' : 'password'}
                        value={emailPass}
                        onChange={(e) => setEmailPass(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-app-border bg-app-bg text-xs font-mono text-app-text pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmailPass(!showEmailPass)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text p-1"
                      >
                        {showEmailPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={smtpSecure}
                        onChange={(e) => setSmtpSecure(e.target.checked)}
                        className="w-4 h-4 text-primary border-app-border rounded focus:ring-primary bg-app-bg"
                      />
                      <span className="text-xs font-bold text-app-text">SSL/TLS Seguro (Porta 465)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Teste de SMTP Global e Disparo Manual da Automação via Supabase */}
              <div className="border-t border-app-border pt-6 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="p-4 bg-app-bg border border-app-border rounded-2xl space-y-3">
                    <div>
                      <h5 className="text-xs font-bold text-app-text uppercase tracking-wider">Testar Envio SMTP Global</h5>
                      <p className="text-[11px] text-app-text-muted">Valida o servidor SMTP configurado acima (ou fallback do .env).</p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={testEmailTo}
                        onChange={(e) => setTestEmailTo(e.target.value)}
                        placeholder="destinatario@exemplo.com"
                        className="flex-1 px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs text-app-text"
                      />
                      <button
                        type="button"
                        disabled={isTestingSmtp}
                        onClick={async () => {
                          const target = testEmailTo.trim() || emailUser.trim() || currentUser?.email || '';
                          if (!target) {
                            setEmailActionFeedback({ type: 'error', message: 'Informe um e-mail destinatário para o teste.' });
                            return;
                          }
                          setIsTestingSmtp(true);
                          setEmailActionFeedback(null);
                          try {
                            await sendTestEmailExternal({
                              host: smtpHost.trim() || undefined,
                              port: Number(smtpPort) || 465,
                              secure: smtpSecure,
                              user: emailUser.trim() || undefined,
                              pass: emailPass.trim() || undefined,
                              to: target
                            });
                            setEmailActionFeedback({ type: 'success', message: `E-mail de teste enviado com sucesso para ${target}!` });
                          } catch (err: any) {
                            setEmailActionFeedback({ type: 'error', message: err?.message || 'Erro ao testar envio SMTP.' });
                          } finally {
                            setIsTestingSmtp(false);
                          }
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap"
                      >
                        {isTestingSmtp ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Testar SMTP
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-app-bg border border-app-border rounded-2xl space-y-3">
                    <div>
                      <h5 className="text-xs font-bold text-app-text uppercase tracking-wider">Rotina Automática via Supabase</h5>
                      <p className="text-[11px] text-app-text-muted">Dispara manualmente a checagem nos escritórios habilitados no Supabase.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isRunningAutomation !== null}
                        onClick={async () => {
                          setIsRunningAutomation('daily');
                          setEmailActionFeedback(null);
                          try {
                            const res = await triggerAutomatedEmails({ type: 'daily', force: true });
                            setEmailActionFeedback({
                              type: res.errors ? 'error' : 'success',
                              message: `Rotina Diária (${res.source?.toUpperCase()}): ${res.matchedOffices || 0} escritório(s) habilitado(s), ${res.sentCount || 0} e-mail(s) enviado(s)${res.errors ? `, ${res.errors} erro(s)` : ''}.`
                            });
                          } catch (err: any) {
                            setEmailActionFeedback({ type: 'error', message: err?.message || 'Falha ao executar rotina diária.' });
                          } finally {
                            setIsRunningAutomation(null);
                          }
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-app-surface border border-app-border text-app-text rounded-xl text-xs font-bold hover:border-primary hover:text-primary disabled:opacity-50"
                      >
                        {isRunningAutomation === 'daily' ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                        Executar Diário Agora
                      </button>
                      <button
                        type="button"
                        disabled={isRunningAutomation !== null}
                        onClick={async () => {
                          setIsRunningAutomation('weekly');
                          setEmailActionFeedback(null);
                          try {
                            const res = await triggerAutomatedEmails({ type: 'weekly', force: true });
                            setEmailActionFeedback({
                              type: res.errors ? 'error' : 'success',
                              message: `Rotina Semanal (${res.source?.toUpperCase()}): ${res.matchedOffices || 0} escritório(s) habilitado(s), ${res.sentCount || 0} e-mail(s) enviado(s)${res.errors ? `, ${res.errors} erro(s)` : ''}.`
                            });
                          } catch (err: any) {
                            setEmailActionFeedback({ type: 'error', message: err?.message || 'Falha ao executar rotina semanal.' });
                          } finally {
                            setIsRunningAutomation(null);
                          }
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-app-surface border border-app-border text-app-text rounded-xl text-xs font-bold hover:border-primary hover:text-primary disabled:opacity-50"
                      >
                        {isRunningAutomation === 'weekly' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Executar Semanal Agora
                      </button>
                    </div>
                  </div>
                </div>

                {emailActionFeedback && (
                  <div className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                    emailActionFeedback.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                      : 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300'
                  }`}>
                    {emailActionFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{emailActionFeedback.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!isProductionMode && activeTab === 'migration' && (
        <SupabaseMigrationTab />
      )}

      {/* Botão de Rodapé Flutuante para Salvar */}
      {activeTab !== 'migration' && (
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="flex items-center gap-2 px-8 py-3.5 bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-2xl shadow-xl shadow-primary/25 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {isSaving ? 'Salvando Alterações Globais...' : 'Salvar Todas as Configurações Globais'}
          </button>
        </div>
      )}
    </div>
  );
}
