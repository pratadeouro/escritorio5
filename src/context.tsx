import React, { createContext, useContext, useState, ReactNode, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppState, Contato, Processo, Evento, Movimento, Transacao, Documento, Vara, Julgador, Escritorio, Usuario, Tarefa, Tribunal, View, RolePermission, Modelo, Etiqueta, TipoEnvolvimento, Envolvido, Calendario, UPJ, Recurso, Servidor, Forum, Lead, LeadStatus, DEFAULT_LEAD_STATUSES, LogRegistro } from './types';
import { importFromGoogleSheets, generateId } from './services/googleSheets';
import { saveAllDataToScript, saveLogToScript, upsertItemToScript, deleteItemFromScript, saveTableToScript } from './services/googleAppsScript';
import { 
  getActiveDataSource, 
  setActiveDataSource, 
  isSupabaseConfigured, 
  fetchAllDataFromSupabase,
  upsertProcessoSupabase,
  deleteProcessoSupabase,
  upsertContatoSupabase,
  deleteContatoSupabase,
  upsertTarefaSupabase,
  deleteTarefaSupabase,
  upsertEventoSupabase,
  deleteEventoSupabase,
  upsertFinanceiroSupabase,
  deleteFinanceiroSupabase,
  upsertMovimentoSupabase,
  deleteMovimentoSupabase,
  upsertItemGenericSupabase,
  deleteItemGenericSupabase,
  saveLogSupabase
} from './services/supabaseService';
import { 
  signInHybrid, 
  signOutSupabase, 
  getSupabaseSession, 
  resetSupabasePassword 
} from './services/supabaseAuth';

const safeAlert = (message: string) => {
  console.warn('[System Message]', message);
  try {
    alert(message);
  } catch (e) {
    console.error("alert blocked by environment", e);
  }
};

const safeConfirm = (message: string): boolean => {
  try {
    return window.confirm(message);
  } catch (e) {
    console.warn("confirm blocked by environment, defaulting to true", e);
    return true;
  }
};

const initialState: AppState = {
  contatos: [],
  processos: [],
  eventos: [],
  movimentos: [],
  financeiro: [],
  documentos: [],
  varas: [],
  tarefas: [],
  escritorios: [],
  usuarios: [],
  pendencias: [],
  modelos: [],
  julgadores: [],
  recursos: [],
  upj: [],
  envolvidos: [],
  tribunais: [],
  servidores: [],
  etiquetas: [],
  calendario: [],
  tipoEnvolvimentos: [
    { id: 'apelante', nome: 'Apelante' },
    { id: 'apelado', nome: 'Apelado' }
  ],
  leads: [],
  leadsStatus: DEFAULT_LEAD_STATUSES,
  forums: [],
  logs: [],
  settings: {
    spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID || '1GuBKYPr_ea0A7Gh5mGQxxevQZs8qXZg4mSx93u5TCsg',
    scriptUrl: import.meta.env.VITE_SCRIPT_URL || '',
    timezone: 'America/Sao_Paulo',
    itemsPerPage: 10,
    permissions: '[]',
    enableEmailNotifications: false,
    emailWeeklyReport: false,
    emailNewNotifications: false,
    diasMorosidade: 30,
  },
  allSettings: [],
  syncStatus: 'idle',
  lastSyncTime: localStorage.getItem('advocacia_last_sync') || null,
  syncLogs: JSON.parse(localStorage.getItem('advocacia_sync_logs') || '[]'),
  hasLoaded: false,
  hasFullLoaded: false,
  viewParams: undefined,
};

interface AppContextType {
  state: AppState;
  addContato: (contato: Contato) => void;
  addContatos: (contatos: Contato[]) => void;
  updateContato: (contato: Contato) => void;
  deleteContato: (id: string) => void;
  addProcesso: (processo: Processo) => void;
  addProcessos: (processos: Processo[]) => void;
  addEvento: (evento: Evento) => void;
  updateEvento: (evento: Evento) => void;
  deleteEvento: (id: string) => void;
  addMovimento: (movimento: Movimento) => void;
  updateMovimento: (movimento: Movimento) => void;
  deleteMovimento: (id: string) => void;
  addTransacao: (transacao: Transacao) => void;
  updateTransacao: (transacao: Transacao) => void;
  deleteTransacao: (id: string) => void;
  addDocumento: (documento: Documento) => void;
  updateDocumento: (documento: Documento) => void;
  deleteDocumento: (id: string) => void;
  addRecurso: (recurso: Recurso) => void;
  updateRecurso: (recurso: Recurso) => void;
  deleteRecurso: (id: string) => void;
  addVara: (vara: Vara) => void;
  updateVara: (vara: Vara) => void;
  deleteVara: (id: string) => void;
  addJulgador: (julgador: Julgador) => void;
  updateJulgador: (julgador: Julgador) => void;
  deleteJulgador: (id: string) => void;
  addServidor: (servidor: any) => void;
  updateServidor: (id: string, servidor: any) => void;
  deleteServidor: (id: string) => void;
  addPendencia: (pendencia: any) => void;
  updatePendencia: (id: string, pendencia: any) => void;
  deletePendencia: (id: string) => void;
  addEscritorio: (escritorio: Escritorio, updatedUsers?: Usuario[]) => void;
  updateEscritorio: (escritorio: Escritorio, updatedUsers?: Usuario[]) => void;
  deleteEscritorio: (id: string) => void;
  addTribunal: (tribunal: Tribunal) => void;
  updateTribunal: (tribunal: Tribunal) => void;
  deleteTribunal: (id: string) => void;
  addForum: (forum: any) => void;
  updateForum: (forum: any) => void;
  deleteForum: (id: string) => void;
  addUPJ: (upj: UPJ) => void;
  updateUPJ: (upj: UPJ) => void;
  deleteUPJ: (id: string) => void;
  addUsuario: (usuario: Usuario) => void;
  updateUsuario: (usuario: Usuario) => void;
  deleteUsuario: (id: string) => void;
  addModelo: (modelo: Modelo) => void;
  updateModelo: (modelo: Modelo) => void;
  deleteModelo: (id: string) => void;
  addTarefa: (tarefa: Tarefa) => void;
  updateTarefa: (tarefa: Tarefa) => void;
  deleteTarefa: (id: string) => void;
  updateProcesso: (processo: Processo) => void;
  deleteProcesso: (id: string) => void;
  addLead: (lead: Lead) => void;
  updateLead: (lead: Lead) => void;
  deleteLead: (id: string) => void;
  addLeadStatus: (status: LeadStatus) => void;
  updateLeadStatusItem: (status: LeadStatus) => void;
  deleteLeadStatus: (id: string) => void;
  updateSettings: (settings: AppState['settings']) => void;
  setSelectedProcessId: (id: string | undefined) => void;
  forceSave: () => Promise<void>;
  forceLoad: () => Promise<void>;
  login: (email: string, senha: string) => Promise<boolean>;
  loginWithGoogleEmail: (email: string) => Promise<boolean>;
  logout: () => void;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  isImporting: boolean;
  lastSyncTime: string | null;
  syncLogs: Array<{timestamp: string, action: string, status: 'success' | 'error', details?: string}>;
  currentUser: Usuario | null;
  hasPermission: (action: string, type: 'read' | 'write' | 'delete') => boolean;
  canViewMenu: (view: View) => boolean;
  getPermissions: () => RolePermission[];
  escritorioAtivoId: string | null;
  setEscritorioAtivoId: (id: string) => void;
  activeOfficeName: string;
  isAdmin: () => boolean;
  isLoggingOut: boolean;
  addEtiqueta: (etiqueta: Etiqueta) => void;
  updateEtiqueta: (etiqueta: Etiqueta) => void;
  deleteEtiqueta: (id: string) => void;
  addCalendario: (item: Calendario) => void;
  updateCalendario: (item: Calendario) => void;
  deleteCalendario: (id: string) => void;
  addTipoEnvolvimento: (tipo: TipoEnvolvimento) => void;
  addEnvolvimento: (envolvido: Envolvido) => void;
  updateEnvolvimento: (envolvido: Envolvido) => void;
  deleteEnvolvimento: (id: string) => void;
  applyTheme: (theme: 'light' | 'dark' | 'system', primary: string, bg: string, secondary: string, officeName?: string) => void;
  setViewParams: (params: any) => void;
  dataSource: 'supabase' | 'sheets';
  setDataSource: (source: 'supabase' | 'sheets') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('advocacia_settings');
    const savedAll = localStorage.getItem('advocacia_all_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const parsedAll = savedAll ? JSON.parse(savedAll) : [];
        return { 
          ...initialState, 
          allSettings: parsedAll,
          settings: { 
            ...initialState.settings, 
            ...parsed,
            // Forçar variáveis de ambiente se existirem, ignorando o localStorage para estes campos
            spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID || parsed.spreadsheetId || initialState.settings.spreadsheetId,
            scriptUrl: import.meta.env.VITE_SCRIPT_URL || parsed.scriptUrl || initialState.settings.scriptUrl
          } 
        };
      } catch (e) {
        return initialState;
      }
    }
    return initialState;
  });
  const stateRef = useRef(state);
  const initialUserCountRef = useRef<number | null>(null);
  const initialProcessCountRef = useRef<number | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const [isImporting, setIsImporting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isSyncingRef = useRef(false);
  const isFirstRender = useRef(true);
  const skipNextSave = useRef(false);
  const lastSavedStateRef = useRef<string>('');

  const [authenticatedUserEmail, setAuthenticatedUserEmail] = useState<string | null>(() => {
    return localStorage.getItem('advocacia_user_email');
  });

  const [dataSource, setDataSourceState] = useState<'supabase' | 'sheets'>(getActiveDataSource);

  const setDataSource = useCallback((source: 'supabase' | 'sheets') => {
    setActiveDataSource(source);
    setDataSourceState(source);
  }, []);

  const [escritorioAtivoId, setEscritorioAtivoIdState] = useState<string | null>(() => {
    const stored = localStorage.getItem('advocacia_escritorio_ativo');
    return stored ? stored.toUpperCase() : null;
  });

  const setEscritorioAtivoId = useCallback((id: string | null) => {
    const normalizedId = id ? id.toUpperCase() : null;
    setEscritorioAtivoIdState(normalizedId);
    if (normalizedId) {
      localStorage.setItem('advocacia_escritorio_ativo', normalizedId);
    } else {
      localStorage.removeItem('advocacia_escritorio_ativo');
    }
  }, []);

  // Restaura sessão ativa do Supabase Auth se existir
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    getSupabaseSession().then(session => {
      if (session?.user?.email && !authenticatedUserEmail) {
        console.log('[Supabase Auth] Restaurando sessão ativa detectada:', session.user.email);
        setAuthenticatedUserEmail(session.user.email);
        localStorage.setItem('advocacia_user_email', session.user.email);
      }
    }).catch(err => {
      console.warn('Aviso ao verificar sessão do Supabase:', err);
    });
  }, [authenticatedUserEmail]);

  // Helper to apply theme to DOM
  const applyTheme = useCallback((theme: 'light' | 'dark' | 'system', primary: string, bg: string, secondary: string, officeName?: string) => {
    const root = document.documentElement;
    let actualTheme: 'light' | 'dark' = theme === 'system' 
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    
    const isDark = actualTheme === 'dark';

    // Save to cache for fast initial loading next time
    const cacheData: any = {
      theme,
      primaryColor: primary,
      backgroundColor: bg,
      secondaryColor: secondary
    };

    if (officeName) {
      cacheData.officeName = officeName;
    } else {
      // Preserve existing officeName if not provided
      try {
        const existing = localStorage.getItem('advocacia_theme_cache');
        if (existing) {
          const parsed = JSON.parse(existing);
          if (parsed.officeName) cacheData.officeName = parsed.officeName;
        }
      } catch (e) {}
    }

    localStorage.setItem('advocacia_theme_cache', JSON.stringify(cacheData));

    if (isDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
      root.style.setProperty('--bg-color', '#020617');
      root.style.setProperty('--surface-color', '#0f172a');
      root.style.setProperty('--border-color', '#1e293b');
      root.style.setProperty('--text-color', '#f8fafc');
      root.style.setProperty('--text-muted-color', '#94a3b8');
      root.style.setProperty('--secondary-color', '#1e293b');
      root.style.setProperty('--primary-color', primary === '#4f46e5' ? '#6366f1' : primary);
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      root.style.setProperty('--bg-color', bg);
      root.style.setProperty('--surface-color', '#ffffff');
      root.style.setProperty('--border-color', '#f1f5f9');
      root.style.setProperty('--text-color', '#0f172a');
      root.style.setProperty('--text-muted-color', '#64748b');
      root.style.setProperty('--secondary-color', secondary);
      root.style.setProperty('--primary-color', primary);
    }
  }, []);

  const normalizeString = (str: any) => 
    (String(str || '')).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, '').trim();

  // Identifica o usuário atual pelo e-mail
  const currentUser = useMemo(() => {
    if (!authenticatedUserEmail) return null;
    
    // Procura na lista carregada (case-insensitive e trim)
    const normalizedAuthEmail = authenticatedUserEmail.trim().toLowerCase();
    const user = state.usuarios.find(u => (u.email || '').trim().toLowerCase() === normalizedAuthEmail);
    
    if (user) return user;
    
    // Fallback para o administrador principal se não estiver na lista mas estiver autenticado
    if (normalizedAuthEmail === 'pratadeouro@gmail.com') {
      return {
        id: 'admin-fallback',
        nome: 'Administrador',
        email: normalizedAuthEmail,
        senha: '12345',
        permissao: 'Admin',
        cargo: 'Administrador',
        contato: '',
        cpf: '',
        escritoriosIds: state.escritorios.length > 0 ? [state.escritorios[0].id] : []
      };
    }
    
    return null;
  }, [state.usuarios, authenticatedUserEmail, state.escritorios]);

  const isAdmin = useCallback((): boolean => {
    if (!currentUser) return false;
    const email = currentUser.email.toLowerCase();
    return normalizeString(currentUser.permissao) === 'admin' || 
           email === 'pratadeouro@gmail.com';
  }, [currentUser]);

  const activeOfficeName = useMemo(() => {
    if (escritorioAtivoId === "" || escritorioAtivoId === null) {
      if (isAdmin()) return "Todos os Escritórios";
    }
    const activeOffice = state.escritorios.find(e => e.id === escritorioAtivoId);
    if (activeOffice) return activeOffice.nome;
    
    // Fallback to cached name if state hasn't loaded yet
    const cached = localStorage.getItem('advocacia_theme_cache');
    if (cached) {
      try {
        const { officeName } = JSON.parse(cached);
        if (officeName) return officeName;
      } catch (e) {}
    }
    
    if (state.escritorios.length > 0) return state.escritorios[0].nome;
    return 'LexGestão';
  }, [state.escritorios, escritorioAtivoId, isAdmin]);

  const login = useCallback(async (email: string, senha: string): Promise<boolean> => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedSenha = senha.trim();

    // 1. Procura o usuário na lista carregada
    let user = state.usuarios.find(u => {
      const matchEmail = (u.email || '').trim().toLowerCase() === normalizedEmail;
      const matchSenha = (u.senha !== undefined && u.senha !== null) 
        ? u.senha.toString().trim() === normalizedSenha
        : false;
      return matchEmail && matchSenha;
    });

    // Fallback para o administrador principal se a lista estiver vazia ou não contiver o usuário
    if (!user && normalizedEmail === 'pratadeouro@gmail.com' && normalizedSenha === '12345') {
      user = {
        id: 'admin-fallback',
        nome: 'Administrador',
        email: normalizedEmail,
        senha: normalizedSenha,
        permissao: 'Admin',
        cargo: 'Administrador',
        contato: '',
        cpf: '',
        escritoriosIds: state.escritorios.length > 0 ? [state.escritorios[0].id] : []
      };
    }

    const userByEmail = user || state.usuarios.find(u => (u.email || '').trim().toLowerCase() === normalizedEmail);

    // 2. Executa a Autenticação Híbrida Supabase (Opção 3)
    let authSuccess = false;
    if (isSupabaseConfigured()) {
      try {
        const hybridRes = await signInHybrid(normalizedEmail, normalizedSenha, userByEmail);
        if (hybridRes.success) {
          authSuccess = true;
          if (!user && userByEmail) {
            user = userByEmail;
          }
        } else {
          console.warn('[Login Híbrido] Supabase Auth:', hybridRes.error);
        }
      } catch (authErr) {
        console.warn('[Login Híbrido] Exceção ao autenticar com Supabase:', authErr);
      }
    }

    // 3. Se autenticou com sucesso no Supabase OU confere credenciais locais (fallback)
    if (authSuccess || user) {
      const effectiveUser = user || userByEmail;
      if (!effectiveUser) return false;

      setAuthenticatedUserEmail(effectiveUser.email);
      localStorage.setItem('advocacia_user_email', effectiveUser.email);
      
      // Limpa backup antigo pesado para liberar espaço (3MB cache issue)
      localStorage.removeItem('advocacia_data_backup');
      
      // Trigger full load after login
      handleImport(true);
      
      if (effectiveUser.escritoriosIds && effectiveUser.escritoriosIds.length > 0) {
        setEscritorioAtivoId(effectiveUser.escritoriosIds[0]);
      }
      
      // Log de login
      if (state.settings.scriptUrl) {
        saveLogToScript(state.settings.scriptUrl, {
          usuario: effectiveUser.email,
          acao: 'LOGIN',
          idEscritorio: effectiveUser.escritoriosIds && effectiveUser.escritoriosIds.length > 0 ? effectiveUser.escritoriosIds[0] : '',
          detalhes: `Usuário ${effectiveUser.nome} logou no sistema (Autenticação Híbrida).`
        });
      }
      
      return true;
    }

    return false;
  }, [state.usuarios, state.escritorios, setEscritorioAtivoId]);

  const loginWithGoogleEmail = useCallback(async (googleEmail: string): Promise<boolean> => {
    const normalizedEmail = googleEmail.trim().toLowerCase();
    if (!normalizedEmail) return false;

    // Procura o usuário cadastrado pelo e-mail
    let user = state.usuarios.find(u => (u.email || '').trim().toLowerCase() === normalizedEmail);

    // Fallback de admin principal se for o e-mail cadastrado de administração
    if (!user && (normalizedEmail === 'pratadeouro@gmail.com' || state.usuarios.length === 0)) {
      user = {
        id: 'admin-fallback',
        nome: normalizedEmail.split('@')[0] || 'Administrador',
        email: normalizedEmail,
        senha: '',
        permissao: 'Admin',
        cargo: 'Administrador',
        contato: '',
        cpf: '',
        escritoriosIds: state.escritorios.length > 0 ? [state.escritorios[0].id] : []
      };
    }

    if (user) {
      setAuthenticatedUserEmail(user.email);
      localStorage.setItem('advocacia_user_email', user.email);
      localStorage.removeItem('advocacia_data_backup');
      handleImport(true);

      if (user.escritoriosIds && user.escritoriosIds.length > 0) {
        setEscritorioAtivoId(user.escritoriosIds[0]);
      }

      if (state.settings.scriptUrl) {
        saveLogToScript(state.settings.scriptUrl, {
          usuario: user.email,
          acao: 'LOGIN_GMAIL',
          idEscritorio: user.escritoriosIds && user.escritoriosIds.length > 0 ? user.escritoriosIds[0] : '',
          detalhes: `Usuário ${user.nome} autenticou via Gmail/Google.`
        });
      }

      return true;
    }

    return false;
  }, [state.usuarios, state.escritorios, state.settings.scriptUrl, setEscritorioAtivoId]);

  const logout = useCallback(async () => {
    // Verificar se há sincronização pendente ou em curso
    const currentStateString = JSON.stringify({
      c: stateRef.current.contatos, p: stateRef.current.processos, e: stateRef.current.eventos, m: stateRef.current.movimentos,
      f: stateRef.current.financeiro, t: stateRef.current.tarefas, esc: stateRef.current.escritorios, u: stateRef.current.usuarios
    });

    const isDirty = currentStateString !== lastSavedStateRef.current && stateRef.current.hasLoaded && !!currentUser;

    if (isSyncingRef.current) {
      if (!window.confirm('Aguarde! Uma sincronização está em andamento. Se você sair agora, os dados podem não ser salvos corretamente na nuvem. Deseja sair mesmo assim?')) {
        return;
      }
    } else if (isDirty) {
      if (!window.confirm('Você tem alterações que ainda não foram enviadas para a nuvem. Deseja sair sem sincronizar? (Recomendamos salvar no Centro de Sincronia antes de sair)')) {
        return;
      }
    }

    setIsLoggingOut(true);
    
    // Pegar o estado atual de forma segura via ref para evitar race conditions
    const currentState = { ...stateRef.current };
    const currentUsuarios = currentState.usuarios;
    const currentProcessos = currentState.processos;
    const userEmail = currentUsuarios.find(u => u.email === authenticatedUserEmail)?.email || authenticatedUserEmail || 'Desconhecido';
    const currentEscritorioId = escritorioAtivoId || '';

    // Log de logout
    if (currentState.settings.scriptUrl) {
      try {
        await saveLogToScript(currentState.settings.scriptUrl, {
          usuario: userEmail,
          acao: 'LOGOUT',
          idEscritorio: currentEscritorioId,
          detalhes: `Usuário efetuou logout.`
        });
      } catch (e) {
        console.error("Erro ao logar logout:", e);
      }
    }

    // Limpar informações de autenticação
    try {
      await signOutSupabase();
    } catch (e) {
      console.warn('Aviso ao deslogar do Supabase:', e);
    }

    setAuthenticatedUserEmail(null);
    localStorage.removeItem('advocacia_user_email');
    setEscritorioAtivoIdState(null);
    localStorage.removeItem('advocacia_escritorio_ativo');

    // Resetar o estado para o inicial (mantendo configurações)
    setState(prevState => ({
      ...initialState,
      settings: prevState.settings,
      syncStatus: 'idle',
      hasLoaded: false
    }));

    setIsLoggingOut(false);
  }, [authenticatedUserEmail, escritorioAtivoId]);

  // Helper for centralized logging of actions with record details and error handling
  const saveAndLog = useCallback(async (newState: AppState, acao: string, detalhes: string, record?: any) => {
    if (!newState.settings.scriptUrl || !newState.hasLoaded) return;

    // Mask sensitive fields for logging
    const sanitize = (val: any) => {
      if (!val || typeof val !== 'object') return val;
      const sanitized = { ...val };
      ['senha', 'password', 'token', 'key'].forEach(k => {
        if (k in sanitized) sanitized[k] = '***';
      });
      return sanitized;
    };

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formattedDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const logId = "L_" + Math.floor(Math.random() * 10000000);
    const recordDetails = record ? ` | Registro: ${JSON.stringify(sanitize(record))}` : '';
    const fullDetails = `${detalhes}${recordDetails}`;

    const newLog: LogRegistro = {
      id: logId,
      data: formattedDate,
      usuario: authenticatedUserEmail || 'Desconhecido',
      acao: acao,
      idEscritorio: escritorioAtivoId || '',
      detalhes: fullDetails
    };

    // Update local state immediately so user sees the log on screen
    setState(prevState => ({
      ...prevState,
      logs: [newLog, ...(prevState.logs || [])]
    }));

    const newStateWithLog = {
      ...newState,
      logs: [newLog, ...(newState.logs || [])]
    };

    try {
      // 1. Salvamento atômico direto no Supabase (se configurado)
      if (isSupabaseConfigured() && record) {
        try {
          if (acao === 'ADD_PROCESSO' || acao === 'UPDATE_PROCESSO') {
            await upsertProcessoSupabase(record);
          } else if (acao === 'DELETE_PROCESSO') {
            await deleteProcessoSupabase(record?.id || record);
          } else if (acao === 'ADD_CONTATO' || acao === 'UPDATE_CONTATO') {
            await upsertContatoSupabase(record);
          } else if (acao === 'DELETE_CONTATO') {
            await deleteContatoSupabase(record?.id || record);
          } else if (acao === 'ADD_TAREFA' || acao === 'UPDATE_TAREFA') {
            await upsertTarefaSupabase(record);
          } else if (acao === 'DELETE_TAREFA') {
            await deleteTarefaSupabase(record?.ID_TAREFA || record?.id || record);
          } else if (acao === 'ADD_EVENTO' || acao === 'UPDATE_EVENTO') {
            await upsertEventoSupabase(record);
          } else if (acao === 'DELETE_EVENTO') {
            await deleteEventoSupabase(record?.id || record);
          } else if (acao === 'ADD_MOVIMENTO' || acao === 'UPDATE_MOVIMENTO') {
            await upsertMovimentoSupabase(record);
          } else if (acao === 'DELETE_MOVIMENTO') {
            await deleteMovimentoSupabase(record?.id || record);
          } else if (acao === 'ADD_TRANSACAO' || acao === 'UPDATE_TRANSACAO') {
            await upsertFinanceiroSupabase(record);
          } else if (acao === 'DELETE_TRANSACAO') {
            await deleteFinanceiroSupabase(record?.id || record);
          } else if (acao === 'ADD_DOCUMENTO' || acao === 'UPDATE_DOCUMENTO') {
            await upsertItemGenericSupabase('documentos', {
              id: record.id,
              titulo: record.titulo,
              tipo: record.tipo || null,
              processo_id: record.processoId || null,
              data_criacao: record.dataCriacao ? new Date(record.dataCriacao).toISOString() : new Date().toISOString(),
              conteudo: record.conteudo || null,
              escritorio_id: record.escritorioId || null,
              url: record.url || null,
              data_upload: record.dataUpload ? new Date(record.dataUpload).toISOString() : null,
            });
          } else if (acao === 'DELETE_DOCUMENTO') {
            await deleteItemGenericSupabase('documentos', record?.id || record);
          } else if (acao === 'ADD_ETIQUETA' || acao === 'UPDATE_ETIQUETA') {
            await upsertItemGenericSupabase('etiquetas', {
              id: record.id,
              nome: record.nome,
              cor: record.cor || null,
              escritorio_id: record.escritorioId || null,
            });
          } else if (acao === 'DELETE_ETIQUETA') {
            await deleteItemGenericSupabase('etiquetas', record?.id || record);
          } else if (acao === 'ADD_LEAD' || acao === 'UPDATE_LEAD') {
            await upsertItemGenericSupabase('leads', {
              id: record.id,
              numero: record.numero || null,
              classe: record.classe || null,
              tribunal: record.tribunal || null,
              orgao: record.orgao || null,
              partes: record.partes || null,
              advogados: record.advogados || null,
              status: record.status || 'Novo',
              escritorio_id: record.escritorioId || null,
              resumo: record.resumo || null,
              prioridade: record.prioridade || 'Média',
            });
          } else if (acao === 'DELETE_LEAD') {
            await deleteItemGenericSupabase('leads', record?.id || record);
          }
          await saveLogSupabase(newLog);
        } catch (sbErr) {
          console.warn('[Supabase] Falha ao salvar atomicamente no Supabase:', sbErr);
        }
      }

      const scriptUrl = newStateWithLog.settings.scriptUrl;

      // 2. Executa salvamento atômico direto na planilha para dual-write / redundância
      if (scriptUrl && record) {
        try {
          if (acao === 'ADD_ETIQUETA' || acao === 'UPDATE_ETIQUETA') {
            await upsertItemToScript(scriptUrl, 'Etiquetas', {
              ID: record.id,
              NOME: record.nome,
              COR: record.cor || '',
              ID_ESCRITORIO: record.escritorioId
            }, 'ID');
          } else if (acao === 'DELETE_ETIQUETA') {
            await deleteItemFromScript(scriptUrl, 'Etiquetas', record.id || record, 'ID');
          } else if (acao === 'ADD_ENVOLVIMENTO' || acao === 'UPDATE_ENVOLVIMENTO') {
            await upsertItemToScript(scriptUrl, 'Envolvidos', {
              ID_CADASTRO: record.id,
              ID_CONTATO: record.contatoId,
              ID_PROC: record.processoId,
              ID_RECURSO: record.recursoId || '',
              TIPO_ENVOLVIMENTO: record.tipoEnvolvimento,
              ID_ESCRITORIO: record.escritorioId
            }, 'ID_CADASTRO');
          } else if (acao === 'DELETE_ENVOLVIMENTO') {
            await deleteItemFromScript(scriptUrl, 'Envolvidos', record?.id || record, 'ID_CADASTRO');
          } else if (acao === 'ADD_LEAD' || acao === 'UPDATE_LEAD') {
            await upsertItemToScript(scriptUrl, 'Leads', {
              ID: record.id,
              NUMERO: record.numero || '',
              CLASSE: record.classe || '',
              TRIBUNAL: record.tribunal || '',
              ORGAO: record.orgao || '',
              PARTES: record.partes || '',
              ADVOGADOS: record.advogados || '',
              DISPONIBILIZACAO: record.disponibilizacao || '',
              PUBLICACAO: record.publicacao || '',
              DATA_CADASTRO: record.dataCadastro || '',
              STATUS: record.status || 'Novo',
              ID_ESCRITORIO: record.escritorioId || '',
              RESUMO: record.resumo || '',
              PRIORIDADE: record.prioridade || 'Média'
            }, 'ID');
          } else if (acao === 'DELETE_LEAD') {
            await deleteItemFromScript(scriptUrl, 'Leads', record?.id || record, 'ID');
          } else if (acao === 'ADD_LEAD_STATUS' || acao === 'UPDATE_LEAD_STATUS') {
            await upsertItemToScript(scriptUrl, 'leads_status', {
              ID: record.id,
              NOME: record.nome,
              COR: record.cor || '#3B82F6',
              ID_ESCRITORIO: record.escritorioId || record.idEscritorio || 'x'
            }, 'ID');
          } else if (acao === 'DELETE_LEAD_STATUS') {
            await deleteItemFromScript(scriptUrl, 'leads_status', record?.id || record, 'ID');
          } else if (acao === 'ADD_MODELO' || acao === 'UPDATE_MODELO') {
            await upsertItemToScript(scriptUrl, 'Modelos', {
              ID: record.id,
              ID_MODELO: record.id,
              NOME_MODELO: record.nome,
              NOME: record.nome,
              TITULO: record.nome,
              FASE_MODELO: record.fase || '',
              FASE: record.fase || '',
              MATERIA: record.materia || '',
              LINK: record.link || '',
              URL: record.link || '',
              ID_ESCRITORIO: record.escritorioId || ''
            }, 'ID');
          } else if (acao === 'DELETE_MODELO') {
            await deleteItemFromScript(scriptUrl, 'Modelos', record?.id || record, 'ID');
          } else if (acao === 'ADD_DOCUMENTO' || acao === 'UPDATE_DOCUMENTO') {
            await upsertItemToScript(scriptUrl, 'Documentos', {
              ID: record.id,
              ID_DOC: record.id,
              ID_DOCUMENTO: record.id,
              TITULO: record.titulo,
              MODELO: record.titulo,
              NOME: record.titulo,
              TIPO: record.tipo || '',
              CONTEUDO: record.conteudo || '',
              ARQUIVO: record.conteudo || '',
              TEXTO: record.conteudo || '',
              ID_ESCRITORIO: record.escritorioId || '',
              PROCESSO_ID: record.processoId || '',
              ID_PROC: record.processoId || '',
              DATA_CRIACAO: record.dataCriacao || '',
              DATA_UPLOAD: record.dataUpload || record.dataCriacao || '',
              URL: record.url || ''
            }, 'ID');
          } else if (acao === 'DELETE_DOCUMENTO') {
            await deleteItemFromScript(scriptUrl, 'Documentos', record?.id || record, 'ID');
          }
        } catch (atomicErr) {
          console.warn('Salvamento atômico direto com aviso:', atomicErr);
        }
      }

      // Salva estado geral apenas se tiver certeza de que todos os dados foram carregados (hasFullLoaded)
      if (newStateWithLog.hasFullLoaded !== false && scriptUrl) {
        await saveAllDataToScript(newStateWithLog, scriptUrl);
      }
      
      if (scriptUrl) {
        await saveLogToScript(scriptUrl, {
          usuario: authenticatedUserEmail || 'Desconhecido',
          acao: acao,
          idEscritorio: escritorioAtivoId || '',
          detalhes: fullDetails
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Erro na ação ${acao}:`, error);
      
      if (newStateWithLog.settings.scriptUrl) {
        try {
          await saveLogToScript(newStateWithLog.settings.scriptUrl, {
            usuario: authenticatedUserEmail || 'Desconhecido',
            acao: `ERRO_${acao}`,
            idEscritorio: escritorioAtivoId || '',
            detalhes: `FALHA na ação ${acao} (${detalhes}): ${errorMsg}`
          });
        } catch (logErr) {
          console.error("Falha ao registrar log de erro:", logErr);
        }
      }
    }
  }, [authenticatedUserEmail, escritorioAtivoId]);


  const parsePermissions = useCallback((raw: any): RolePermission[] => {
    if (!raw) return [];
    try {
      let parsed: any[];
      
      if (typeof raw === 'string') {
        if (raw === '[object Object]' || raw === 'undefined' || raw === 'null') return [];
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          // Check if it's a comma separated list (legacy format)
          if (raw.includes(',')) {
            return [{
              role: 'Usuário',
              menus: raw.split(',').map((s: string) => s.trim() as View),
              actions: {}
            }];
          }
          return [];
        }
      } else {
        parsed = raw;
      }

      if (!Array.isArray(parsed)) return [];
      
      // Apenas considera legado se for uma lista de menus separada por vírgulas (formato antigo da planilha) em vez de JSON
      const isLegacy = typeof raw === 'string' && !raw.trim().startsWith('[') && raw.includes(',');

      // Helper function to safely extract values by keys with any case, space, or accents
      const getNormalizedValue = (obj: any, keys: string[]): any => {
        if (!obj || typeof obj !== 'object') return undefined;
        const normMap = new Map<string, string>();
        const normalize = (str: string) => {
          return str
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // remove accents
            .replace(/[^a-z0-9]/g, "");     // remove spaces and non-alphanumeric
        };
        for (const rawKey of Object.keys(obj)) {
          normMap.set(normalize(rawKey), rawKey);
        }
        for (const searchKey of keys) {
          const actualKey = normMap.get(normalize(searchKey));
          if (actualKey !== undefined && obj[actualKey] !== undefined && obj[actualKey] !== null) {
            return obj[actualKey];
          }
        }
        return undefined;
      };

      return parsed
        .filter((r: any) => r && typeof r === 'object')
        .map((r: any) => {
          const roleNameVal = getNormalizedValue(r, [
            'role', 'categoria', 'nivel', 'funcao', 'nome', 'permissao', 'cargo', 'role_name', 'categoria_nome', 'roles'
          ]);
          const roleName = (roleNameVal || 'Nova Categoria').toString().trim();
          
          const menusVal = getNormalizedValue(r, [
            'menus', 'menusvisiveis', 'permissoes', 'telas', 'telasvisiveis', 'menus_visiveis', 'permissoes_menus'
          ]);
          let menus = menusVal || [];
          
          const actionsVal = getNormalizedValue(r, [
            'actions', 'acoes', 'permissoesdeacoes', 'acoespermitidas', 'permissoes_acoes', 'acoes_permitidas'
          ]);
          let actions = actionsVal || {};

          // Normalizar Menus
          if (typeof menus === 'string') {
            try {
              // Limpar possíveis escapes extras se vier de CSV
              const cleanMenus = menus.trim().startsWith('[') ? menus.trim() : `[${menus}]`;
              menus = JSON.parse(cleanMenus);
            } catch (e) {
              // Tentar separar por vírgula se não for JSON válido
              menus = menus.split(',').map((m: string) => m.trim().replace(/[\[\]"']/g, '')).filter(Boolean);
            }
          }
          
          // Garantir que menus seja um array e que tenha pelo menos o dashboard se for uma categoria válida
          if (!Array.isArray(menus)) {
            menus = ['dashboard'];
          } else if (menus.length === 0) {
            menus = ['dashboard'];
          }

          if (isLegacy && menus.includes('api_diario') && !menus.includes('leads')) {
            menus.push('leads');
          }

          // Normalizar Ações
          if (typeof actions === 'string') {
            try {
              actions = JSON.parse(actions.trim());
            } catch (e) {
              actions = {};
            }
          }
          if (typeof actions !== 'object' || actions === null) actions = {};

          return {
            role: roleName,
            menus: menus as View[],
            actions: actions as RolePermission['actions']
          };
        })
        .filter(r => !!r.role);
    } catch (e) {
      console.error('Erro ao processar permissões:', e);
      return [];
    }
  }, []);

  const getPermissions = useCallback((): RolePermission[] => {
    const current = parsePermissions(state.settings.permissions);
    
    // Agrupar e mesclar permissões de roles com o mesmo nome (case-insensitive)
    const mergedRolesMap = new Map<string, RolePermission>();
    
    for (const p of current) {
      if (!p.role) continue;
      const key = normalizeString(p.role);
      const existing = mergedRolesMap.get(key);
      
      if (!existing) {
        // Clona para evitar mutações diretas
        mergedRolesMap.set(key, {
          role: p.role,
          menus: [...p.menus],
          actions: JSON.parse(JSON.stringify(p.actions || {}))
        });
      } else {
        // União dos menus permitidos
        const newMenus = [...new Set([...existing.menus, ...p.menus])];
        existing.menus = newMenus;
        
        // União das ações permitidas (logical OR)
        const allModulesList = [...new Set([...Object.keys(existing.actions || {}), ...Object.keys(p.actions || {})])];
        for (const mod of allModulesList) {
          const act1 = existing.actions[mod] || { read: false, write: false, delete: false };
          const act2 = p.actions[mod] || { read: false, write: false, delete: false };
          existing.actions[mod] = {
            read: act1.read || act2.read,
            write: act1.write || act2.write,
            delete: act1.delete || act2.delete
          };
        }
      }
    }
    
    return Array.from(mergedRolesMap.values());
  }, [state.settings.permissions, parsePermissions, normalizeString]);

  const hasPermission = useCallback((action: string, type: 'read' | 'write' | 'delete'): boolean => {
    if (!currentUser) return false;
    
    // Admin ou usuário específico sempre tem permissão total
    if (isAdmin()) return true;

    const permissions = getPermissions();
    const userRoleNormalized = normalizeString(currentUser.permissao || '');
    
    const rolePerm = permissions.find(p => p.role && normalizeString(p.role) === userRoleNormalized);
    
    if (!rolePerm) return false;
    
    const moduleActions = rolePerm.actions[action];
    if (!moduleActions) return false;
    
    return moduleActions[type];
  }, [currentUser, isAdmin, getPermissions, normalizeString]);

  const canViewMenu = useCallback((view: View): boolean => {
    if (!currentUser) return false;
    
    const permissions = getPermissions();
    const userRoleNormalized = normalizeString(currentUser.permissao || '');
    
    const rolePerm = permissions.find(p => p.role && normalizeString(p.role) === userRoleNormalized);
    
    if (rolePerm) {
      // Admins sempre devem poder ver as configurações para evitar lockout
      if (isAdmin() && view === 'settings') return true;
      return rolePerm.menus.includes(view);
    }

    // Admin ou usuário específico vê todos os menus se não houver papel correspondente cadastrado
    if (isAdmin()) return true;
    
    return false;
  }, [currentUser, isAdmin, getPermissions, normalizeString]);

  // Auto-select office if none is active but user has offices
  useEffect(() => {
    if (!authenticatedUserEmail || !state.hasLoaded) return;

    // Se não houver escritório selecionado (null)
    if (escritorioAtivoId === null) {
      if (!isAdmin()) {
        // Usuário comum PRECISA de um escritório
        if (currentUser?.escritoriosIds && currentUser.escritoriosIds.length > 0) {
          setEscritorioAtivoId(currentUser.escritoriosIds[0]);
        } else if (state.escritorios.length > 0) {
          // Fallback para o primeiro escritório global (se houver)
          setEscritorioAtivoId(state.escritorios[0].id);
        }
      }
      // Admins podem permanecer em null (Todos os Escritórios)
    } else {
      // Verifica se o escritório ainda existe ou se o usuário ainda tem acesso
      const officeExists = state.escritorios.some(e => e.id === escritorioAtivoId);
      const hasAccess = isAdmin() || (currentUser?.escritoriosIds || []).includes(escritorioAtivoId);
      
      if (!officeExists || !hasAccess) {
        if (isAdmin()) {
          // Se admin perdeu acesso (ex: office deletado), vai para "Todos"
          setEscritorioAtivoIdState(null);
          localStorage.removeItem('advocacia_escritorio_ativo');
        } else if (currentUser?.escritoriosIds && currentUser.escritoriosIds.length > 0) {
          setEscritorioAtivoId(currentUser.escritoriosIds[0]);
        } else if (state.escritorios.length > 0) {
          setEscritorioAtivoId(state.escritorios[0].id);
        } else {
          setEscritorioAtivoIdState(null);
          localStorage.removeItem('advocacia_escritorio_ativo');
        }
      }
    }
  }, [state.hasLoaded, authenticatedUserEmail, currentUser, escritorioAtivoId, state.escritorios, isAdmin, setEscritorioAtivoId]);

  useEffect(() => {
    const activeOffice = state.escritorios.find(e => e.id === escritorioAtivoId);
    
    // Fallback settings if no office is active or office has no theme settings
    // User theme preference takes absolute priority over office baseline
    const theme = state.settings.theme || activeOffice?.theme || 'light';
    const primaryColor = activeOffice?.primaryColor || '#4f46e5';
    const backgroundColor = activeOffice?.backgroundColor || '#ffffff';
    const secondaryColor = activeOffice?.secondaryColor || '#f8fafc';

    applyTheme(theme, primaryColor, backgroundColor, secondaryColor, activeOffice?.nome);
  }, [escritorioAtivoId, state.escritorios, applyTheme]);

  // Switch settings when active office changes
  useEffect(() => {
    if (!state.hasLoaded || !escritorioAtivoId) return;

    const officeSettings = state.allSettings.find(s => s.idEscritorio === escritorioAtivoId);
    if (officeSettings) {
      // User specific overrides
      const personalSettings = {
        theme: currentUser?.theme,
        itemsPerPage: currentUser?.itemsPerPage,
        menuOrder: currentUser?.menuOrder,
        enableNotifications: currentUser?.enableNotifications
      };

      const mergedSettings = {
        ...officeSettings,
        ...(personalSettings.theme ? { theme: personalSettings.theme } : {}),
        ...(personalSettings.itemsPerPage ? { itemsPerPage: personalSettings.itemsPerPage } : {}),
        ...(personalSettings.menuOrder ? { menuOrder: personalSettings.menuOrder } : {}),
        // enableNotifications might be boolean, so check for undefined
        ...(personalSettings.enableNotifications !== undefined ? { enableEmailNotifications: personalSettings.enableNotifications } : {})
      };

      // Compare to avoid infinite updates
      const hasChanged = 
        mergedSettings.itemsPerPage !== state.settings.itemsPerPage ||
        mergedSettings.timezone !== state.settings.timezone ||
        mergedSettings.permissions !== state.settings.permissions ||
        mergedSettings.emailUser !== state.settings.emailUser ||
        mergedSettings.emailPass !== state.settings.emailPass ||
        mergedSettings.useExternalSmtp !== state.settings.useExternalSmtp ||
        mergedSettings.smtpHost !== state.settings.smtpHost ||
        mergedSettings.smtpPort !== state.settings.smtpPort ||
        mergedSettings.smtpSecure !== state.settings.smtpSecure ||
        mergedSettings.enableEmailNotifications !== state.settings.enableEmailNotifications ||
        mergedSettings.emailWeeklyReport !== state.settings.emailWeeklyReport ||
        mergedSettings.emailNewNotifications !== state.settings.emailNewNotifications ||
        mergedSettings.diasMorosidade !== state.settings.diasMorosidade ||
        mergedSettings.theme !== state.settings.theme ||
        JSON.stringify(mergedSettings.menuOrder) !== JSON.stringify(state.settings.menuOrder);

      if (hasChanged) {
        setState(s => ({
          ...s,
          settings: { ...s.settings, ...mergedSettings }
        }));
      }
    }
  }, [
    escritorioAtivoId, 
    state.hasLoaded, 
    state.allSettings, 
    currentUser,
    state.settings.itemsPerPage, 
    state.settings.timezone, 
    state.settings.permissions, 
    state.settings.emailUser, 
    state.settings.emailPass, 
    state.settings.useExternalSmtp, 
    state.settings.smtpHost,
    state.settings.smtpPort,
    state.settings.smtpSecure,
    state.settings.enableEmailNotifications,
    state.settings.emailWeeklyReport,
    state.settings.emailNewNotifications,
    state.settings.diasMorosidade,
    state.settings.menuOrder,
    state.settings.theme
  ]);

  // Apply theme from cache on initial mount before state loads
  useEffect(() => {
    const cached = localStorage.getItem('advocacia_theme_cache');
    if (cached) {
      try {
        const { theme, primaryColor, backgroundColor, secondaryColor } = JSON.parse(cached);
        const root = document.documentElement;
        if (theme === 'dark') {
          root.classList.add('dark');
          root.style.colorScheme = 'dark';
          root.style.setProperty('--bg-color', '#020617');
          root.style.setProperty('--surface-color', '#0f172a');
          root.style.setProperty('--border-color', '#1e293b');
          root.style.setProperty('--text-color', '#f8fafc');
          root.style.setProperty('--text-muted-color', '#94a3b8');
          root.style.setProperty('--secondary-color', '#1e293b');
          const finalPrimary = primaryColor === '#4f46e5' ? '#6366f1' : primaryColor;
          root.style.setProperty('--primary-color', finalPrimary);
        } else {
          root.classList.remove('dark');
          root.style.colorScheme = 'light';
          root.style.setProperty('--bg-color', backgroundColor);
          root.style.setProperty('--surface-color', '#ffffff');
          root.style.setProperty('--border-color', '#f1f5f9');
          root.style.setProperty('--text-color', '#0f172a');
          root.style.setProperty('--text-muted-color', '#64748b');
          root.style.setProperty('--secondary-color', secondaryColor);
          root.style.setProperty('--primary-color', primaryColor);
        }
      } catch (e) {
        console.warn('Failed to apply theme from cache');
      }
    }
  }, []);

  // Automatic save to Google Sheets when data changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (isImporting) {
      skipNextSave.current = true;
      return;
    }

    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    // CRITICAL: Only save if data has loaded AND a user is logged in
    // This prevents wiping the spreadsheet if the initial import failed or if on login screen
    // We also check if we have users, to avoid saving an empty state by mistake
    const currentUsersCount = state.usuarios.length;
    const initialUsersCount = initialUserCountRef.current || 0;
    const initialProcessesCount = initialProcessCountRef.current || 0;
    
    // Integrity checks to prevent data wipe during load failures
    let currentPermissionsCount = 0;
    try {
      currentPermissionsCount = (Array.isArray(state.settings.permissions) 
        ? state.settings.permissions.length 
        : (typeof state.settings.permissions === 'string' ? (JSON.parse(state.settings.permissions || '[]').length || 0) : 0));
    } catch (e) {
      // If it exists but is not parsable, assume it's not empty for integrity purposes
      if (state.settings.permissions) currentPermissionsCount = 1;
    }
    
    const isIntegrityCompromised = state.hasLoaded && (
      currentUsersCount === 0 || 
      (initialUsersCount > 5 && currentUsersCount < (initialUsersCount / 2)) ||
      (state.processos.length === 0 && (state.lastSyncTime !== null && initialProcessesCount > 5)) || 
      (currentPermissionsCount === 0 && state.lastSyncTime !== null && state.usuarios.length > 5)
    );

    if (!state.settings.scriptUrl || !state.hasLoaded || state.hasFullLoaded === false || !currentUser || isIntegrityCompromised || document.visibilityState === 'hidden') {
      if (document.visibilityState === 'hidden') {
        // Ignora auto-save com aba suspensa/tela de celular bloqueada
        return;
      }
      if (isIntegrityCompromised) {
        let reason = "";
        if (currentUsersCount === 0) reason = "Inconsistência na lista de usuários detectada (Lista de usuários vazia)";
        else if (initialUsersCount > 1 && currentUsersCount < (initialUsersCount / 2)) reason = "Inconsistência na lista de usuários detectada (Queda drástica no número de usuários)";
        else if (state.processos.length === 0) reason = "Queda drástica na lista de processos (Lista esvaziou)";
        else if (state.tarefas.length === 0) reason = "Lista de tarefas vazia";
        else if (currentPermissionsCount === 0) reason = "Lista de permissões vazia";

        console.error(`Auto-save bloqueado: ${reason}.`);
      }
      return;
    }

    const timer = setTimeout(async () => {
      // PREVENT CONCURRENT SAVES (Sync Queue)
      if (isSyncingRef.current) {
        console.log('Sincronização em andamento. Aguardando próxima rodada...');
        return;
      }

      const currentStateString = JSON.stringify({
        c: state.contatos, p: state.processos, e: state.eventos, m: state.movimentos,
        f: state.financeiro, t: state.tarefas, esc: state.escritorios, u: state.usuarios,
        cal: state.calendario, et: state.etiquetas, pen: state.pendencias, mod: state.modelos,
        doc: state.documentos,
        rec: state.recursos, upj: state.upj, tri: state.tribunais, ser: state.servidores,
        env: state.envolvidos, jul: state.julgadores,
        conf: state.settings, allConf: state.allSettings
      });

      // Avoid saving if nothing meaningful changed
      if (currentStateString === lastSavedStateRef.current) {
        return;
      }

      if (!state.settings.scriptUrl) {
        console.warn('URL do Script não configurada. O salvamento automático foi ignorado.');
        return;
      }

      isSyncingRef.current = true;
      setState(s => ({ ...s, syncStatus: 'saving' }));
      
      try {
        // AppSheet-like safety: retry mechanism
        let attempts = 0;
        const maxAttempts = 2;
        let success = false;

        while (attempts < maxAttempts && !success) {
          try {
            await saveAllDataToScript(state, state.settings.scriptUrl);
            success = true;
          } catch (e) {
            attempts++;
            if (attempts < maxAttempts) {
              console.warn(`Tentativa de salvamento ${attempts} falhou. Retentando em 3s...`);
              await new Promise(r => setTimeout(r, 3000));
            } else {
              throw e;
            }
          }
        }
        
        lastSavedStateRef.current = currentStateString;

        // Log de salvamento automático
        if (state.settings.scriptUrl && currentUser) {
          saveLogToScript(state.settings.scriptUrl, {
            usuario: currentUser.email,
            acao: 'AUTO_SAVE',
            idEscritorio: escritorioAtivoId || '',
            detalhes: 'Sincronização automática de dados realizada com sucesso.'
          });
        }
        
        console.log('Dados salvos automaticamente na planilha');
        const now = new Date().toISOString();
        setState(s => ({ 
          ...s, 
          syncStatus: 'idle',
          lastSyncTime: now,
          syncLogs: [{
            timestamp: now,
            action: 'Sincronização Automática',
            status: 'success' as const,
            details: 'Sincronização concluída com sucesso.'
          }, ...s.syncLogs].slice(0, 20)
        }));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('Erro ao salvar dados automaticamente:', error);
        
        const now = new Date().toISOString();
        setState(s => ({ 
          ...s, 
          syncStatus: 'error',
          syncLogs: [{
            timestamp: now,
            action: 'Erro Sincronia',
            status: 'error' as const,
            details: errorMsg
          }, ...s.syncLogs].slice(0, 20)
        }));
        
        // Registrar erro no log se possível
        try {
          if (state.settings.scriptUrl && currentUser) {
            await saveLogToScript(state.settings.scriptUrl, {
              usuario: currentUser.email,
              acao: 'ERRO_AUTO_SAVE',
              idEscritorio: escritorioAtivoId || '',
              detalhes: `Falha na sincronização automática: ${errorMsg}`
            });
          }
        } catch (e) {}

        // Reset error status after 5 seconds
        setTimeout(() => setState(s => ({ ...s, syncStatus: 'idle' })), 5000);
      } finally {
        isSyncingRef.current = false;
      }
    }, 3000); // Debounce de 3 segundos (mais seguro para evitar spam no GAS)

    return () => clearTimeout(timer);
  }, [
    state.contatos,
    state.processos,
    state.eventos,
    state.movimentos,
    state.financeiro,
    state.documentos,
    state.varas,
    state.tarefas,
    state.servidores,
    state.etiquetas,
    state.tipoEnvolvimentos,
    state.escritorios,
    state.usuarios,
    state.calendario,
    state.pendencias,
    state.modelos,
    state.julgadores,
    state.recursos,
    state.upj,
    state.envolvidos,
    state.tribunais,
    state.leads,
    state.leadsStatus,
    state.settings.itemsPerPage,
    state.settings.timezone,
    state.settings.scriptUrl,
    state.settings.permissions,
    isImporting,
    currentUser // Added currentUser to dependencies
  ]);

  // --- PERSISTENCE ---
  useEffect(() => {
    localStorage.setItem('advocacia_settings', JSON.stringify(state.settings));
    localStorage.setItem('advocacia_all_settings', JSON.stringify(state.allSettings));
  }, [state.settings, state.allSettings]);

  useEffect(() => {
    localStorage.setItem('advocacia_last_sync', state.lastSyncTime || '');
    localStorage.setItem('advocacia_sync_logs', JSON.stringify(state.syncLogs));
  }, [state.lastSyncTime, state.syncLogs]);

  // --- LOCAL BACKUP PERSISTENCE ---
  // Periodically saves current state to localStorage as a safety net
  // OPTIMIZED: Removed heavy data (processos, movimentos, financeiro) to avoid 3MB limit
  useEffect(() => {
    if (!state.hasLoaded || isImporting || isLoggingOut) return;

    const backupTimer = setTimeout(() => {
      try {
        // We only backup essential structural data, not the heavy lists that cause 3MB cache
        const { 
          syncStatus, 
          hasLoaded, 
          settings, 
          processos, 
          movimentos, 
          financeiro, 
          tarefas,
          contatos,
          eventos,
          pendencias,
          documentos,
          ...dataToBackup 
        } = state;
        
        // Save core structural data (usuarios, escritorios, etc.)
        localStorage.setItem('advocacia_core_backup', JSON.stringify({
          usuarios: state.usuarios,
          escritorios: state.escritorios,
          allSettings: state.allSettings
        }));
        
        localStorage.setItem('advocacia_backup_timestamp', Date.now().toString());
      } catch (e) {
        console.error("Erro ao criar backup local:", e);
      }
    }, 2000); 

    return () => clearTimeout(backupTimer);
  }, [state.usuarios, state.escritorios, state.allSettings, state.hasLoaded, isImporting, isLoggingOut]);

  const handleImport = useCallback(async (isFullLoad: boolean = false) => {
    // Se já carregou tudo e pediram core, ignora
    if (stateRef.current.hasLoaded && !isFullLoad && stateRef.current.usuarios.length > 0) return;
    
    setIsImporting(true);
    setState(s => ({ ...s, syncStatus: 'loading' }));
    try {
      // Phase 1: Only core if not logged in
      const shouldLoadFull = isFullLoad || !!authenticatedUserEmail;
      let importedData: Partial<AppState>;

      if (getActiveDataSource() === 'supabase' && isSupabaseConfigured()) {
        try {
          importedData = await fetchAllDataFromSupabase(!shouldLoadFull);
        } catch (sbErr) {
          console.warn('[Supabase] Falha ao carregar do Supabase, tentando Sheets...', sbErr);
          importedData = await importFromGoogleSheets(stateRef.current.settings.spreadsheetId, !shouldLoadFull);
        }
      } else {
        importedData = await importFromGoogleSheets(stateRef.current.settings.spreadsheetId, !shouldLoadFull);
      }
      
      const now = new Date().toISOString();
      setState(prevState => {
        const newState = {
          ...prevState,
          syncStatus: 'idle' as const,
          lastSyncTime: now,
          syncLogs: [{
            timestamp: now,
            action: shouldLoadFull ? 'Carga Completa' : 'Carga Essencial',
            status: 'success' as const,
            details: shouldLoadFull ? 'Todos os dados carregados.' : 'Dados de acesso carregados.'
          }, ...prevState.syncLogs].slice(0, 20),
          contatos: importedData.contatos !== undefined ? importedData.contatos : prevState.contatos,
          processos: importedData.processos !== undefined ? importedData.processos : prevState.processos,
          eventos: importedData.eventos !== undefined ? importedData.eventos : prevState.eventos,
          movimentos: importedData.movimentos !== undefined ? importedData.movimentos : prevState.movimentos,
          financeiro: importedData.financeiro !== undefined ? importedData.financeiro : prevState.financeiro,
          documentos: importedData.documentos !== undefined ? importedData.documentos : prevState.documentos,
          varas: importedData.varas !== undefined ? importedData.varas : prevState.varas,
          tarefas: importedData.tarefas !== undefined ? importedData.tarefas : prevState.tarefas,
          escritorios: (importedData.escritorios !== undefined && (importedData.escritorios.length > 0 || !prevState.hasLoaded)) ? importedData.escritorios : prevState.escritorios,
          usuarios: (importedData.usuarios !== undefined && (importedData.usuarios.length > 0 || !prevState.hasLoaded)) ? importedData.usuarios : prevState.usuarios,
          pendencias: importedData.pendencias !== undefined ? importedData.pendencias : prevState.pendencias,
          modelos: importedData.modelos !== undefined ? importedData.modelos : prevState.modelos,
          julgadores: importedData.julgadores !== undefined ? importedData.julgadores : prevState.julgadores,
          recursos: importedData.recursos !== undefined ? importedData.recursos : prevState.recursos,
          upj: importedData.upj !== undefined ? importedData.upj : prevState.upj,
          envolvidos: importedData.envolvidos !== undefined ? importedData.envolvidos : prevState.envolvidos,
          tribunais: importedData.tribunais !== undefined ? importedData.tribunais : prevState.tribunais,
          forums: importedData.forums !== undefined ? importedData.forums : prevState.forums,
          servidores: importedData.servidores !== undefined ? importedData.servidores : prevState.servidores,
          etiquetas: importedData.etiquetas !== undefined ? importedData.etiquetas : prevState.etiquetas,
          calendario: importedData.calendario !== undefined ? importedData.calendario : prevState.calendario,
          leads: importedData.leads !== undefined ? importedData.leads : prevState.leads,
          leadsStatus: (() => {
            const loaded = importedData.leadsStatus !== undefined ? importedData.leadsStatus : (importedData as any).leads_status !== undefined ? (importedData as any).leads_status : prevState.leadsStatus;
            const combined: LeadStatus[] = [];
            const seenIds = new Set<string>();
            const seenNomes = new Set<string>();

            (loaded || []).forEach((s: any) => {
              const idNorm = String(s.id || '').trim().toLowerCase();
              const nomeNorm = String(s.nome || '').trim().toLowerCase();
              if (idNorm && nomeNorm && !seenIds.has(idNorm) && !seenNomes.has(nomeNorm)) {
                combined.push({
                  id: s.id || idNorm,
                  nome: s.nome || nomeNorm,
                  cor: s.cor || '#3B82F6',
                  escritorioId: s.escritorioId || s.idEscritorio || 'x',
                  idEscritorio: s.escritorioId || s.idEscritorio || 'x'
                });
                seenIds.add(idNorm);
                seenNomes.add(nomeNorm);
              }
            });

            DEFAULT_LEAD_STATUSES.forEach(d => {
              const idNorm = d.id.toLowerCase();
              const nomeNorm = d.nome.toLowerCase();
              if (!seenIds.has(idNorm) && !seenNomes.has(nomeNorm)) {
                combined.push(d);
                seenIds.add(idNorm);
                seenNomes.add(nomeNorm);
              }
            });

            return combined.length > 0 ? combined : DEFAULT_LEAD_STATUSES;
          })(),
          logs: importedData.logs !== undefined ? importedData.logs : prevState.logs,
          tipoEnvolvimentos: (() => {
            const defaults = [
              { id: 'apelante', nome: 'Apelante' },
              { id: 'apelado', nome: 'Apelado' }
            ];
            const loaded = importedData.tipoEnvolvimentos !== undefined ? importedData.tipoEnvolvimentos : prevState.tipoEnvolvimentos;
            const combined: any[] = [];
            const seenIds = new Set<string>();
            const seenNomes = new Set<string>();
            
            (loaded || []).forEach((t: any) => {
              const idNorm = String(t.id || '').trim().toLowerCase();
              const nomeNorm = String(t.nome || '').trim().toLowerCase();
              if (idNorm && nomeNorm && !seenIds.has(idNorm) && !seenNomes.has(nomeNorm)) {
                combined.push(t);
                seenIds.add(idNorm);
                seenNomes.add(nomeNorm);
              }
            });
            
            defaults.forEach(d => {
              const idNorm = d.id.toLowerCase();
              const nomeNorm = d.nome.toLowerCase();
              if (!seenIds.has(idNorm) && !seenNomes.has(nomeNorm)) {
                combined.push(d);
                seenIds.add(idNorm);
                seenNomes.add(nomeNorm);
              }
            });
            return combined;
          })(),
          allSettings: (importedData.allSettings !== undefined && (importedData.allSettings.length > 0 || !prevState.hasLoaded)) ? importedData.allSettings : prevState.allSettings,
          settings: (() => {
            const allSettings = importedData.allSettings !== undefined ? importedData.allSettings : prevState.allSettings;
            if (prevState.hasLoaded && allSettings.length === 0 && importedData.allSettings !== undefined) {
              return prevState.settings;
            }
            const eid = localStorage.getItem('advocacia_escritorio_ativo') || escritorioAtivoId;
            const officeSettings = allSettings.find((s: any) => s.idEscritorio === eid);
            return { 
              ...prevState.settings, 
              ...(officeSettings || importedData.settings || {}) 
            };
          })(),
          hasLoaded: true,
          hasFullLoaded: shouldLoadFull && importedData.processos !== undefined
        };

        return newState;
      });

      if (importedData.usuarios) {
        initialUserCountRef.current = importedData.usuarios.length;
      }
      if (importedData.processos) {
        initialProcessCountRef.current = importedData.processos.length;
      }
      
      // Se carregamos apenas core mas estamos logados, dispara o full load
      if (!shouldLoadFull && !!authenticatedUserEmail && !isFullLoad) {
        // Use await to keep isImporting = true until full load finishes
        await handleImport(true);
      }
    } catch (error) {
      console.error('Failed to import data:', error);
      setState(s => ({ ...s, syncStatus: 'error' }));
      setTimeout(() => setState(s => ({ ...s, syncStatus: 'idle' })), 5000);
    } finally {
      setIsImporting(false);
    }
  }, [authenticatedUserEmail, escritorioAtivoId]);

  useEffect(() => {
    const onImportEvent = () => handleImport(true);
    window.addEventListener('import-google-sheets', onImportEvent);
    
    // Auto-import on mount 
    if (state.settings.spreadsheetId && !state.hasLoaded) {
      handleImport(!!authenticatedUserEmail);
    }

    // MOBILE / DESKTOP SMART RECONNECT & VISIBILITY LISTENER
    // Quando o usuário no celular desbloqueia a tela ou retorna ao app após segundo plano,
    // atualiza silenciosamente os dados se esteve inativo por mais de 3 minutos.
    let lastActiveTime = Date.now();
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const minutesInactive = (now - lastActiveTime) / (1000 * 60);
        lastActiveTime = now;
        
        // Se ficou inativo por mais de 3 minutos e está autenticado, sincroniza silenciosamente
        if (minutesInactive >= 3 && !!authenticatedUserEmail && !isImporting) {
          console.log(`[Mobile/Tab Sync] Retornando de ${Math.round(minutesInactive)} min inativo. Atualizando dados remotos...`);
          handleImport(true);
        }
      } else {
        lastActiveTime = Date.now();
      }
    };

    const handleOnline = () => {
      console.log('[Mobile Sync] Conexão restabelecida. Sincronizando dados...');
      if (!!authenticatedUserEmail && !isImporting) {
        handleImport(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('import-google-sheets', onImportEvent);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [authenticatedUserEmail, handleImport, isImporting, state.hasLoaded, state.settings.spreadsheetId]);

  const addContato = useCallback((contato: Contato) => {
    setState(s => {
      const newState = { ...s, contatos: [...s.contatos, contato] };
      saveAndLog(newState, 'ADD_CONTATO', `Novo contato adicionado: ${contato.nome}`, contato);
      return newState;
    });
  }, [saveAndLog]);

  const addContatos = useCallback((novosContatos: Contato[]) => {
    if (novosContatos.length === 0) return;
    setState(s => {
      const newState = { ...s, contatos: [...s.contatos, ...novosContatos] };
      saveAndLog(newState, 'ADD_CONTATOS', `${novosContatos.length} novos contatos importados do Google Forms`, novosContatos);
      return newState;
    });
  }, [saveAndLog]);

  const updateContato = useCallback((contato: Contato) => {
    setState(s => {
      const newState = {
        ...s,
        contatos: s.contatos.map(c => c.id === contato.id ? contato : c)
      };
      saveAndLog(newState, 'UPDATE_CONTATO', `Contato atualizado: ${contato.nome}`, contato);
      return newState;
    });
  }, [saveAndLog]);

  const deleteContato = useCallback((id: string) => {
    setState(s => {
      const contatoToDelete = s.contatos.find(c => c.id === id);
      const newState = {
        ...s,
        contatos: s.contatos.filter(c => c.id !== id)
      };
      saveAndLog(newState, 'DELETE_CONTATO', `Contato excluído: ${contatoToDelete?.nome || id}`, contatoToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const addProcesso = useCallback((processo: Processo) => {
    setState(s => {
      const generatedId = generateId('processo');
      const newProcesso = { 
        ...processo, 
        id: (processo.id || generatedId).toString().trim().toUpperCase(),
        idProc: (processo.idProc || processo.id || generatedId).toString().trim().toUpperCase(),
        escritorioId: (processo.escritorioId || '').toString().trim().toUpperCase()
      };
      const newState = { ...s, processos: [...s.processos, newProcesso] };
      saveAndLog(newState, 'ADD_PROCESSO', `Novo processo adicionado: ${newProcesso.numero || newProcesso.id}`, newProcesso);
      return newState;
    });
  }, [saveAndLog]);

  const addProcessos = useCallback((novosProcessos: Processo[]) => {
    if (novosProcessos.length === 0) return;
    setState(s => {
      const processed = novosProcessos.map(processo => {
        const generatedId = generateId('processo');
        return {
          ...processo,
          id: (processo.id || generatedId).toString().trim().toUpperCase(),
          idProc: (processo.idProc || processo.id || generatedId).toString().trim().toUpperCase(),
          escritorioId: (processo.escritorioId || s.settings.idEscritorio || '').toString().trim().toUpperCase()
        };
      });
      const newState = { ...s, processos: [...s.processos, ...processed] };
      saveAndLog(newState, 'ADD_PROCESSOS', `${novosProcessos.length} processos importados com sucesso`, processed);
      return newState;
    });
  }, [saveAndLog]);

  const addLead = useCallback((lead: Lead) => {
    setState(s => {
      const generatedId = generateId();
      const newLead = {
        ...lead,
        id: (lead.id || generatedId).toString().trim().toUpperCase(),
        escritorioId: (lead.escritorioId || s.settings.idEscritorio || '').toString().trim().toUpperCase()
      };
      const newState = { ...s, leads: [...(s.leads || []), newLead] };
      saveAndLog(newState, 'ADD_LEAD', `Novo lead adicionado: ${newLead.numero || newLead.id}`, newLead);
      return newState;
    });
  }, [saveAndLog]);

  const updateLead = useCallback((lead: Lead) => {
    setState(s => {
      const newState = {
        ...s,
        leads: (s.leads || []).map(l => l.id === lead.id ? lead : l)
      };
      saveAndLog(newState, 'UPDATE_LEAD', `Lead atualizado: ${lead.numero || lead.id}`, lead);
      return newState;
    });
  }, [saveAndLog]);

  const deleteLead = useCallback((id: string) => {
    setState(s => {
      const itemToDelete = (s.leads || []).find(l => l.id === id);
      const newState = {
        ...s,
        leads: (s.leads || []).filter(l => l.id !== id)
      };
      saveAndLog(newState, 'DELETE_LEAD', `Lead excluído: ${itemToDelete ? itemToDelete.numero || itemToDelete.id : id}`, itemToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const addLeadStatus = useCallback((status: LeadStatus) => {
    setState(s => {
      const generatedId = generateId();
      const newStatus: LeadStatus = {
        ...status,
        id: (status.id || generatedId).toString().trim().toLowerCase(),
        escritorioId: status.escritorioId || status.idEscritorio || 'x',
        idEscritorio: status.escritorioId || status.idEscritorio || 'x'
      };
      const newState = { ...s, leadsStatus: [...(s.leadsStatus || []), newStatus] };
      saveAndLog(newState, 'ADD_LEAD_STATUS', `Novo status de lead adicionado: ${newStatus.nome}`, newStatus);
      return newState;
    });
  }, [saveAndLog]);

  const updateLeadStatusItem = useCallback((status: LeadStatus) => {
    setState(s => {
      const newState = {
        ...s,
        leadsStatus: (s.leadsStatus || []).map(st => st.id === status.id ? status : st)
      };
      saveAndLog(newState, 'UPDATE_LEAD_STATUS', `Status de lead atualizado: ${status.nome}`, status);
      return newState;
    });
  }, [saveAndLog]);

  const deleteLeadStatus = useCallback((id: string) => {
    setState(s => {
      const itemToDelete = (s.leadsStatus || []).find(st => st.id === id);
      const newState = {
        ...s,
        leadsStatus: (s.leadsStatus || []).filter(st => st.id !== id)
      };
      saveAndLog(newState, 'DELETE_LEAD_STATUS', `Status de lead excluído: ${itemToDelete ? itemToDelete.nome : id}`, itemToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const addEvento = useCallback((evento: Evento) => {
    setState(s => {
      const newEvento = { ...evento, id: evento.id || generateId() };
      const newState = { ...s, eventos: [...s.eventos, newEvento] };
      saveAndLog(newState, 'ADD_EVENTO', `Novo evento adicionado: ${newEvento.titulo}`, newEvento);
      return newState;
    });
  }, [saveAndLog]);

  const updateEvento = useCallback((evento: Evento) => {
    setState(s => {
      const newState = {
        ...s,
        eventos: s.eventos.map(e => e.id === evento.id ? evento : e)
      };
      saveAndLog(newState, 'UPDATE_EVENTO', `Evento atualizado: ${evento.titulo}`, evento);
      return newState;
    });
  }, [saveAndLog]);

  const deleteEvento = useCallback((id: string) => {
    setState(s => {
      const itemToDelete = s.eventos.find(e => e.id === id);
      const newState = {
        ...s,
        eventos: s.eventos.filter(e => e.id !== id)
      };
      saveAndLog(newState, 'DELETE_EVENTO', `Evento excluído: ${itemToDelete?.titulo || id}`, itemToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const addMovimento = useCallback((movimento: Movimento) => {
    setState(s => {
      const newMovimento = { 
        ...movimento, 
        id: movimento.id || generateId(),
        processoId: (movimento.processoId || '').toString().trim().toUpperCase(),
        escritorioId: (movimento.escritorioId || '').toString().trim().toUpperCase()
      };
      const newState = { ...s, movimentos: [...s.movimentos, newMovimento] };
      saveAndLog(newState, 'ADD_MOVIMENTO', `Novo movimento adicionado para proc: ${newMovimento.processoId}`, newMovimento);
      return newState;
    });
  }, [saveAndLog]);

  const updateMovimento = useCallback((movimento: Movimento) => {
    setState(s => {
      const normalizedMovimento = {
        ...movimento,
        processoId: (movimento.processoId || '').toString().trim().toUpperCase(),
        escritorioId: (movimento.escritorioId || '').toString().trim().toUpperCase()
      };
      const newState = {
        ...s,
        movimentos: s.movimentos.map(m => m.id === normalizedMovimento.id ? normalizedMovimento : m)
      };
      saveAndLog(newState, 'UPDATE_MOVIMENTO', `Movimento atualizado: ${normalizedMovimento.id}`, normalizedMovimento);
      return newState;
    });
  }, [saveAndLog]);

  const deleteMovimento = useCallback((id: string) => {
    setState(s => {
      const itemToDelete = s.movimentos.find(m => m.id === id);
      const newState = {
        ...s,
        movimentos: s.movimentos.filter(m => m.id !== id)
      };
      saveAndLog(newState, 'DELETE_MOVIMENTO', `Movimento excluído: ${id}`, itemToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const addTransacao = useCallback((transacao: Transacao) => {
    setState(s => {
      const newTransacao = { ...transacao, id: transacao.id || generateId('financeiro') };
      const newState = { ...s, financeiro: [...s.financeiro, newTransacao] };
      saveAndLog(newState, 'ADD_TRANSACAO', `Nova transação adicionada: ${newTransacao.descricao}`, newTransacao);
      return newState;
    });
  }, [saveAndLog]);

  const updateTransacao = useCallback((transacao: Transacao) => {
    setState(s => {
      const newState = {
        ...s,
        financeiro: s.financeiro.map(t => t.id === transacao.id ? transacao : t)
      };
      saveAndLog(newState, 'UPDATE_TRANSACAO', `Transação atualizada: ${transacao.descricao}`, transacao);
      return newState;
    });
  }, [saveAndLog]);

  const deleteTransacao = useCallback((id: string) => {
    setState(s => {
      const itemToDelete = s.financeiro.find(t => t.id === id);
      const newState = {
        ...s,
        financeiro: s.financeiro.filter(t => t.id !== id)
      };
      saveAndLog(newState, 'DELETE_TRANSACAO', `Transação excluída: ${itemToDelete?.descricao || id}`, itemToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const addDocumento = useCallback((documento: Documento) => {
    setState(s => {
      const newDocumento = { ...documento, id: documento.id || generateId() };
      const newState = { ...s, documentos: [...s.documentos, newDocumento] };
      saveAndLog(newState, 'ADD_DOCUMENTO', `Novo documento adicionado: ${newDocumento.titulo}`, newDocumento);
      return newState;
    });
  }, [saveAndLog]);

  const updateDocumento = useCallback((documento: Documento) => {
    setState(s => {
      const newState = {
        ...s,
        documentos: s.documentos.map(d => d.id === documento.id ? documento : d)
      };
      saveAndLog(newState, 'UPDATE_DOCUMENTO', `Documento atualizado: ${documento.titulo}`, documento);
      return newState;
    });
  }, [saveAndLog]);

  const deleteDocumento = useCallback((id: string) => {
    setState(s => {
      const itemToDelete = s.documentos.find(d => d.id === id);
      const newState = {
        ...s,
        documentos: s.documentos.filter(d => d.id !== id)
      };
      saveAndLog(newState, 'DELETE_DOCUMENTO', `Documento excluído: ${itemToDelete?.titulo || id}`, itemToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const addRecurso = useCallback((recurso: Recurso) => {
    setState(s => {
      const newRecurso = { ...recurso, id: recurso.id || generateId() };
      const newState = { ...s, recursos: [...s.recursos, newRecurso] };
      saveAndLog(newState, 'ADD_RECURSO', `Novo recurso adicionado`, newRecurso);
      return newState;
    });
  }, [saveAndLog]);

  const updateRecurso = useCallback((recurso: Recurso) => {
    setState(s => {
      const newState = {
        ...s,
        recursos: s.recursos.map(r => r.id === recurso.id ? recurso : r)
      };
      saveAndLog(newState, 'UPDATE_RECURSO', `Recurso atualizado`, recurso);
      return newState;
    });
  }, [saveAndLog]);

  const deleteRecurso = useCallback((id: string) => {
    setState(s => {
      const itemToDelete = s.recursos.find(r => r.id === id);
      const newState = {
        ...s,
        recursos: s.recursos.filter(r => r.id !== id)
      };
      saveAndLog(newState, 'DELETE_RECURSO', `Recurso excluído`, itemToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const addVara = useCallback((vara: Vara) => {
    setState(s => {
      const newVara = { ...vara, id: vara.id || generateId() };
      const newState = { ...s, varas: [...s.varas, newVara] };
      saveAndLog(newState, 'ADD_VARA', `Nova vara adicionada: ${newVara.nome}`, newVara);
      return newState;
    });
  }, [saveAndLog]);

  const updateVara = useCallback((vara: Vara) => {
    setState(s => {
      const newState = {
        ...s,
        varas: s.varas.map(v => v.id === vara.id ? vara : v)
      };
      saveAndLog(newState, 'UPDATE_VARA', `Vara atualizada: ${vara.nome}`, vara);
      return newState;
    });
  }, [saveAndLog]);

  const deleteVara = useCallback((id: string) => {
    setState(s => {
      const itemToDelete = s.varas.find(v => v.id === id);
      const newState = {
        ...s,
        varas: s.varas.filter(v => v.id !== id)
      };
      saveAndLog(newState, 'DELETE_VARA', `Vara excluída: ${itemToDelete?.nome || id}`, itemToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const addJulgador = useCallback((julgador: Julgador) => {
    setState(s => {
      const newJulgador = { ...julgador, id: julgador.id || generateId() };
      const newState = { ...s, julgadores: [...s.julgadores, newJulgador] };
      saveAndLog(newState, 'ADD_JULGADOR', `Novo julgador adicionado: ${newJulgador.nome}`, newJulgador);
      return newState;
    });
  }, [saveAndLog]);

  const updateJulgador = useCallback((julgador: Julgador) => {
    setState(s => {
      const newState = {
        ...s,
        julgadores: s.julgadores.map(j => j.id === julgador.id ? julgador : j)
      };
      saveAndLog(newState, 'UPDATE_JULGADOR', `Julgador atualizado: ${julgador.nome}`, julgador);
      return newState;
    });
  }, [saveAndLog]);

  const deleteJulgador = useCallback((id: string) => {
    setState(s => {
      const itemToDelete = s.julgadores.find(j => j.id === id);
      const newState = {
        ...s,
        julgadores: s.julgadores.filter(j => j.id !== id)
      };
      saveAndLog(newState, 'DELETE_JULGADOR', `Julgador excluído: ${itemToDelete?.nome || id}`, itemToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const addServidor = useCallback((servidor: any) => {
    setState(s => {
      const newServidor = { ...servidor, id: servidor.id || generateId() };
      const newState = { ...s, servidores: [...s.servidores, newServidor] };
      saveAndLog(newState, 'ADD_SERVIDOR', `Novo servidor adicionado: ${newServidor.nome}`, newServidor);
      return newState;
    });
  }, [saveAndLog]);

  const updateServidor = useCallback((id: string, servidor: any) => {
    setState(s => {
      const newState = {
        ...s,
        servidores: s.servidores.map(sv => sv.id === id ? servidor : sv)
      };
      saveAndLog(newState, 'UPDATE_SERVIDOR', `Servidor atualizado: ${servidor.nome}`, servidor);
      return newState;
    });
  }, [saveAndLog]);

  const deleteServidor = useCallback((id: string) => {
    setState(s => {
      const itemToDelete = s.servidores.find(sv => sv.id === id);
      const newState = {
        ...s,
        servidores: s.servidores.filter(sv => sv.id !== id)
      };
      saveAndLog(newState, 'DELETE_SERVIDOR', `Servidor excluído: ${itemToDelete?.nome || id}`, itemToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const addPendencia = useCallback((pendencia: any) => {
    setState(s => {
      const newPendencia = { ...pendencia, id: pendencia.id || generateId() };
      const newState = { ...s, pendencias: [...s.pendencias, newPendencia] };
      saveAndLog(newState, 'ADD_PENDENCIA', `Nova pendência adicionada`, newPendencia);
      return newState;
    });
  }, [saveAndLog]);

  const updatePendencia = useCallback((id: string, pendencia: any) => {
    setState(s => {
      const newState = {
        ...s,
        pendencias: s.pendencias.map(p => (p.id === id || p.ID === id) ? pendencia : p)
      };
      saveAndLog(newState, 'UPDATE_PENDENCIA', `Pendência atualizada`, pendencia);
      return newState;
    });
  }, [saveAndLog]);

  const deletePendencia = useCallback((id: string) => {
    setState(s => {
      const itemToDelete = s.pendencias.find(p => p.id === id || p.ID === id);
      const newState = {
        ...s,
        pendencias: s.pendencias.filter(p => p.id !== id && p.ID !== id)
      };
      saveAndLog(newState, 'DELETE_PENDENCIA', `Pendência excluída`, itemToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const addEscritorio = useCallback((escritorio: Escritorio, updatedUsers?: Usuario[]) => {
    setState(s => {
      const newEscritorio = { 
        ...escritorio, 
        id: (escritorio.id || generateId()).toString().trim().toUpperCase() 
      };
      
      let updatedUsuarios = s.usuarios;
      if (updatedUsers && updatedUsers.length > 0) {
        const normalizedUsers = updatedUsers.map(usuario => ({
          ...usuario,
          id: (usuario.id || '').toString().trim().toUpperCase(),
          escritoriosIds: (usuario.escritoriosIds || []).map(id => id.toString().trim().toUpperCase())
        }));
        const normalizedUsersMap = new Map(normalizedUsers.map(u => [u.id, u]));
        updatedUsuarios = s.usuarios.map(u => {
          const normId = (u.id || '').toString().trim().toUpperCase();
          return normalizedUsersMap.has(normId) ? normalizedUsersMap.get(normId)! : u;
        });
      }

      const newState = { 
        ...s, 
        escritorios: [...s.escritorios, newEscritorio],
        usuarios: updatedUsuarios
      };
      saveAndLog(newState, 'ADD_ESCRITORIO', `Novo escritório adicionado: ${newEscritorio.nome}`, newEscritorio);
      return newState;
    });
  }, [saveAndLog]);
  
  const updateEscritorio = useCallback((escritorio: Escritorio, updatedUsers?: Usuario[]) => {
    setState(s => {
      let updatedUsuarios = s.usuarios;
      if (updatedUsers && updatedUsers.length > 0) {
        const normalizedUsers = updatedUsers.map(usuario => ({
          ...usuario,
          id: (usuario.id || '').toString().trim().toUpperCase(),
          escritoriosIds: (usuario.escritoriosIds || []).map(id => id.toString().trim().toUpperCase())
        }));
        const normalizedUsersMap = new Map(normalizedUsers.map(u => [u.id, u]));
        updatedUsuarios = s.usuarios.map(u => {
          const normId = (u.id || '').toString().trim().toUpperCase();
          return normalizedUsersMap.has(normId) ? normalizedUsersMap.get(normId)! : u;
        });
      }

      const newState = {
        ...s,
        escritorios: s.escritorios.map(e => e.id === escritorio.id ? escritorio : e),
        usuarios: updatedUsuarios
      };
      
      // Se for o escritório ativo, atualizar também as settings locais
      if (escritorio.id === escritorioAtivoId) {
        const updatedLocalSettings = {
          ...s.settings,
          timezone: escritorio.timezone,
          itemsPerPage: escritorio.itemsPerPage,
          emailUser: escritorio.emailUser,
          emailPass: escritorio.emailPass,
          useExternalSmtp: escritorio.useExternalSmtp,
          smtpHost: escritorio.smtpHost,
          smtpPort: escritorio.smtpPort,
          smtpSecure: escritorio.smtpSecure,
          enableEmailNotifications: escritorio.enableEmailNotifications,
          emailWeeklyReport: escritorio.emailWeeklyReport,
          emailDailyReport: escritorio.emailDailyReport,
          emailNewNotifications: escritorio.emailNewNotifications,
          templateWeeklyReport: escritorio.templateWeeklyReport,
          templateDailyReport: escritorio.templateDailyReport,
          templateNewNotifications: escritorio.templateNewNotifications,
          emailDispatchTime: escritorio.emailDispatchTime,
          showMovimentos: escritorio.showMovimentos,
          diasMorosidade: escritorio.diasMorosidade,
          menuOrder: escritorio.menuOrder,
        };
        newState.settings = updatedLocalSettings;
        
        // Também atualizar o allSettings correspondente para manter consistência
        newState.allSettings = s.allSettings.map(as => 
          as.idEscritorio === escritorio.id ? { ...updatedLocalSettings, idEscritorio: escritorio.id } : as
        );
      }
      
      saveAndLog(newState, 'UPDATE_ESCRITORIO', `Escritório atualizado: ${escritorio.nome}`, escritorio);
      return newState;
    });
  }, [saveAndLog, escritorioAtivoId]);

  const deleteEscritorio = useCallback((id: string) => {
    setState(s => {
      const itemToDelete = s.escritorios.find(e => e.id === id);
      const newState = {
        ...s,
        escritorios: s.escritorios.filter(e => e.id !== id)
      };
      saveAndLog(newState, 'DELETE_ESCRITORIO', `Escritório excluído: ${itemToDelete?.nome || id}`, itemToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const addTribunal = useCallback((tribunal: Tribunal) => {
    setState(s => {
      const newTribunal = { ...tribunal, id: tribunal.id || generateId() };
      const newState = { ...s, tribunais: [...s.tribunais, newTribunal] };
      saveAndLog(newState, 'ADD_TRIBUNAL', `Novo tribunal adicionado: ${newTribunal.nome}`, newTribunal);
      return newState;
    });
  }, [saveAndLog]);
  
  const updateTribunal = useCallback((tribunal: Tribunal) => {
    setState(s => {
      const newState = {
        ...s,
        tribunais: s.tribunais.map(t => t.id === tribunal.id ? tribunal : t)
      };
      saveAndLog(newState, 'UPDATE_TRIBUNAL', `Tribunal atualizado: ${tribunal.nome}`, tribunal);
      return newState;
    });
  }, [saveAndLog]);

  const deleteTribunal = useCallback((id: string) => {
    setState(s => {
      const itemToDelete = s.tribunais.find(t => t.id === id);
      const newState = {
        ...s,
        tribunais: s.tribunais.filter(t => t.id !== id)
      };
      saveAndLog(newState, 'DELETE_TRIBUNAL', `Tribunal excluído: ${itemToDelete?.nome || id}`, itemToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const addForum = useCallback((forum: any) => {
    setState(s => {
      const newForum = { ...forum, id: forum.id || generateId() };
      const newState = { ...s, forums: [...s.forums, newForum] };
      saveAndLog(newState, 'ADD_FORUM', `Novo fórum adicionado: ${newForum.nome}`, newForum);
      return newState;
    });
  }, [saveAndLog]);

  const updateForum = useCallback((forum: any) => {
    setState(s => {
      const newState = {
        ...s,
        forums: s.forums.map(f => f.id === forum.id ? forum : f)
      };
      saveAndLog(newState, 'UPDATE_FORUM', `Fórum atualizado: ${forum.nome}`, forum);
      return newState;
    });
  }, [saveAndLog]);

  const deleteForum = useCallback((id: string) => {
    setState(s => {
      const itemToDelete = s.forums.find(f => f.id === id);
      const newState = {
        ...s,
        forums: s.forums.filter(f => f.id !== id)
      };
      saveAndLog(newState, 'DELETE_FORUM', `Fórum excluído: ${itemToDelete?.nome || id}`, itemToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const addUPJ = useCallback((upj: UPJ) => {
    setState(s => {
      const newUPJ = { ...upj, id: upj.id || generateId() };
      const newState = { ...s, upj: [...s.upj, newUPJ] };
      saveAndLog(newState, 'ADD_UPJ', `Nova UPJ adicionada: ${newUPJ.nome}`, newUPJ);
      return newState;
    });
  }, [saveAndLog]);

  const updateUPJ = useCallback((upj: UPJ) => {
    setState(s => {
      const newState = {
        ...s,
        upj: s.upj.map(u => u.id === upj.id ? upj : u)
      };
      saveAndLog(newState, 'UPDATE_UPJ', `UPJ atualizada: ${upj.nome}`, upj);
      return newState;
    });
  }, [saveAndLog]);

  const deleteUPJ = useCallback((id: string) => {
    setState(s => {
      const itemToDelete = s.upj.find(u => u.id === id);
      const newState = {
        ...s,
        upj: s.upj.filter(u => u.id !== id)
      };
      saveAndLog(newState, 'DELETE_UPJ', `UPJ excluída: ${itemToDelete?.nome || id}`, itemToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const addUsuario = useCallback((usuario: Usuario) => {
    setState(s => {
      const newUsuario = { 
        ...usuario, 
        id: (usuario.id || generateId('usuario')).toString().trim().toUpperCase(),
        escritoriosIds: (usuario.escritoriosIds || []).map(id => id.toString().trim().toUpperCase())
      };
      const newState = { ...s, usuarios: [...s.usuarios, newUsuario] };
      saveAndLog(newState, 'ADD_USUARIO', `Novo usuário adicionado: ${newUsuario.nome}`, newUsuario);
      return newState;
    });
  }, [saveAndLog]);
  
  const updateUsuario = useCallback((usuario: Usuario) => {
    setState(s => {
      const normalizedUsuario = {
        ...usuario,
        id: (usuario.id || '').toString().trim().toUpperCase(),
        escritoriosIds: (usuario.escritoriosIds || []).map(id => id.toString().trim().toUpperCase())
      };
      const newState = {
        ...s,
        usuarios: s.usuarios.map(u => u.id === normalizedUsuario.id ? normalizedUsuario : u)
      };
      saveAndLog(newState, 'UPDATE_USUARIO', `Usuário atualizado: ${normalizedUsuario.nome}`, normalizedUsuario);
      return newState;
    });
  }, [saveAndLog]);

  const deleteUsuario = useCallback((id: string) => {
    setState(s => {
      const itemToDelete = s.usuarios.find(u => u.id === id);
      const newState = {
        ...s,
        usuarios: s.usuarios.filter(u => u.id !== id)
      };
      saveAndLog(newState, 'DELETE_USUARIO', `Usuário excluído: ${itemToDelete?.nome || id}`, itemToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const addModelo = useCallback((modelo: Modelo) => {
    setState(s => {
      const newId = (modelo.id || generateId()).toUpperCase();
      const newModelo = { ...modelo, id: newId };
      const newState = { ...s, modelos: [...s.modelos, newModelo] };
      saveAndLog(newState, 'ADD_MODELO', `Novo modelo adicionado: ${newModelo.nome}`, newModelo);
      return newState;
    });
  }, [saveAndLog]);

  const updateModelo = useCallback((modelo: Modelo) => {
    setState(s => {
      const newState = {
        ...s,
        modelos: s.modelos.map(m => m.id === modelo.id ? modelo : m)
      };
      saveAndLog(newState, 'UPDATE_MODELO', `Modelo atualizado: ${modelo.nome}`, modelo);
      return newState;
    });
  }, [saveAndLog]);

  const deleteModelo = useCallback((id: string) => {
    setState(s => {
      const itemToDelete = s.modelos.find(m => m.id === id);
      const newState = {
        ...s,
        modelos: s.modelos.filter(m => m.id !== id)
      };
      saveAndLog(newState, 'DELETE_MODELO', `Modelo excluído: ${itemToDelete?.nome || id}`, itemToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const addTarefa = useCallback((tarefa: Tarefa) => {
    setState(s => {
      const generatedId = generateId('tarefa');
      const taskId = (tarefa.ID_TAREFA || generatedId).toString().trim().toUpperCase();
      
      const newTarefa: Tarefa = { 
        ...tarefa, 
        ID_TAREFA: taskId,
        id: taskId, // Backward compatibility
        TITULO: tarefa.TITULO || tarefa.TAREFA || '',
        DATA_CRIACAO: tarefa.DATA_CRIACAO || tarefa.PRAZO_IN || new Date().toISOString().split('T')[0],
        DATA_LIMITE: tarefa.DATA_LIMITE || tarefa.PRAZO_FIM || '',
        PROCESSO_ID: (tarefa.PROCESSO_ID || tarefa.ID_PROC || '').toString().trim().toUpperCase(),
        RESPONSAVEL_ID: (tarefa.RESPONSAVEL_ID || tarefa.ID_USER || '').toString().trim().toUpperCase()
      };
      
      const newState = { ...s, tarefas: [...s.tarefas, newTarefa] };
      saveAndLog(newState, 'ADD_TAREFA', `Nova tarefa adicionada: ${newTarefa.TITULO || newTarefa.TAREFA}`, newTarefa);
      return newState;
    });
  }, [saveAndLog]);

  const updateTarefa = useCallback((tarefa: Tarefa) => {
    setState(s => {
      const normalizedTarefa: Tarefa = {
        ...tarefa,
        TITULO: tarefa.TITULO || tarefa.TAREFA || '',
        DATA_CRIACAO: tarefa.DATA_CRIACAO || tarefa.PRAZO_IN || '',
        DATA_LIMITE: tarefa.DATA_LIMITE || tarefa.PRAZO_FIM || '',
        PROCESSO_ID: (tarefa.PROCESSO_ID || tarefa.ID_PROC || '').toString().trim().toUpperCase(),
        RESPONSAVEL_ID: (tarefa.RESPONSAVEL_ID || tarefa.ID_USER || '').toString().trim().toUpperCase()
      };
      
      const newState = {
        ...s,
        tarefas: s.tarefas.map(t => t.ID_TAREFA === normalizedTarefa.ID_TAREFA ? normalizedTarefa : t)
      };
      saveAndLog(newState, 'UPDATE_TAREFA', `Tarefa atualizada: ${normalizedTarefa.TITULO || normalizedTarefa.TAREFA}`, normalizedTarefa);
      return newState;
    });
  }, [saveAndLog]);

  const deleteTarefa = useCallback((id: string) => {
    setState(s => {
      const itemToDelete = s.tarefas.find(t => t.ID_TAREFA === id || t.id === id);
      const newState = {
        ...s,
        tarefas: s.tarefas.filter(t => t.ID_TAREFA !== id && t.id !== id)
      };
      saveAndLog(newState, 'DELETE_TAREFA', `Tarefa excluída: ${itemToDelete?.TITULO || itemToDelete?.TAREFA || id}`, itemToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const updateProcesso = useCallback((processo: Processo) => {
    setState(s => {
      const normalizedProcesso = {
        ...processo,
        id: (processo.id || '').toString().trim().toUpperCase(),
        idProc: (processo.idProc || '').toString().trim().toUpperCase(),
        escritorioId: (processo.escritorioId || '').toString().trim().toUpperCase()
      };
      const newState = {
        ...s,
        processos: s.processos.map(p => p.id === normalizedProcesso.id ? normalizedProcesso : p)
      };
      saveAndLog(newState, 'UPDATE_PROCESSO', `Processo atualizado: ${normalizedProcesso.numero || normalizedProcesso.id}`, normalizedProcesso);
      return newState;
    });
  }, [saveAndLog]);

  const deleteProcesso = useCallback((id: string) => {
    setState(s => {
      const itemToDelete = s.processos.find(p => p.id === id);
      const newState = {
        ...s,
        processos: s.processos.filter(p => p.id !== id)
      };
      saveAndLog(newState, 'DELETE_PROCESSO', `Processo excluído: ${itemToDelete?.numero || id}`, itemToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const addEtiqueta = useCallback((etiqueta: Etiqueta) => {
    setState(s => {
      const newState = { ...s, etiquetas: [...s.etiquetas, etiqueta] };
      saveAndLog(newState, 'ADD_ETIQUETA', `Nova etiqueta adicionada: ${etiqueta.nome}`, etiqueta);
      return newState;
    });
  }, [saveAndLog]);

  const updateEtiqueta = useCallback((etiqueta: Etiqueta) => {
    setState(s => {
      const newState = {
        ...s,
        etiquetas: s.etiquetas.map(e => e.id === etiqueta.id ? etiqueta : e)
      };
      saveAndLog(newState, 'UPDATE_ETIQUETA', `Etiqueta atualizada: ${etiqueta.nome}`, etiqueta);
      return newState;
    });
  }, [saveAndLog]);

  const deleteEtiqueta = useCallback((id: string) => {
    setState(s => {
      const itemToDelete = s.etiquetas.find(e => e.id === id);
      const newState = {
        ...s,
        etiquetas: s.etiquetas.filter(e => e.id !== id)
      };
      saveAndLog(newState, 'DELETE_ETIQUETA', `Etiqueta excluída: ${itemToDelete?.nome || id}`, itemToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const addCalendario = useCallback((item: Calendario) => setState(s => {
    const newItem = { ...item, id: item.id || generateId() };
    const newState = { ...s, calendario: [...s.calendario, newItem] };
    saveAndLog(newState, 'ADD_CALENDARIO', `Novo item no calendário: ${newItem.descricao}`, newItem);
    return newState;
  }), [saveAndLog]);

  const updateCalendario = useCallback((item: Calendario) => setState(s => {
    const newState = {
      ...s,
      calendario: s.calendario.map(c => c.id === item.id ? item : c)
    };
    saveAndLog(newState, 'UPDATE_CALENDARIO', `Item do calendário atualizado: ${item.descricao}`, item);
    return newState;
  }), [saveAndLog]);

  const deleteCalendario = useCallback((id: string) => setState(s => {
    const itemToDelete = s.calendario.find(c => c.id === id);
    const newState = {
      ...s,
      calendario: s.calendario.filter(c => c.id !== id)
    };
    saveAndLog(newState, 'DELETE_CALENDARIO', `Item do calendário excluído: ${itemToDelete?.descricao || id}`, itemToDelete);
    return newState;
  }), [saveAndLog]);

  const addTipoEnvolvimento = useCallback((tipo: TipoEnvolvimento) => {
    setState(s => {
      const newState = { ...s, tipoEnvolvimentos: [...s.tipoEnvolvimentos, tipo] };
      saveAndLog(newState, 'ADD_TIPO_ENVOLVIMENTO', `Novo tipo de envolvimento: ${tipo.nome}`, tipo);
      return newState;
    });
  }, [saveAndLog]);

  const addEnvolvimento = useCallback((envolvido: Envolvido) => {
    setState(s => {
      const newState = { ...s, envolvidos: [...s.envolvidos, envolvido] };
      saveAndLog(newState, 'ADD_ENVOLVIMENTO', `Novo envolvimento adicionado`, envolvido);
      return newState;
    });
  }, [saveAndLog]);

  const updateEnvolvimento = useCallback((envolvido: Envolvido) => {
    setState(s => {
      const newState = {
        ...s,
        envolvidos: s.envolvidos.map(e => e.id === envolvido.id ? envolvido : e)
      };
      saveAndLog(newState, 'UPDATE_ENVOLVIMENTO', `Envolvimento atualizado`, envolvido);
      return newState;
    });
  }, [saveAndLog]);

  const deleteEnvolvimento = useCallback((id: string) => {
    setState(s => {
      const itemToDelete = s.envolvidos.find(e => e.id === id);
      const newState = {
        ...s,
        envolvidos: s.envolvidos.filter(e => e.id !== id)
      };
      saveAndLog(newState, 'DELETE_ENVOLVIMENTO', `Envolvimento excluído`, itemToDelete);
      return newState;
    });
  }, [saveAndLog]);

  const setViewParams = useCallback((params: any) => {
    setState(s => ({ ...s, viewParams: params }));
  }, []);

  const updateSettings = useCallback((settings: AppState['settings']) => {
    setState(s => {
      const eid = s.settings.idEscritorio || escritorioAtivoId || '';
      const updatedSettings = { ...settings, idEscritorio: eid };
      
      const isPermissionsChanged = JSON.stringify(settings.permissions) !== JSON.stringify(s.settings.permissions);
      
      let newAllSettings = [...s.allSettings];
      const index = newAllSettings.findIndex(as => as.idEscritorio === eid);
      
      if (index !== -1) {
        newAllSettings[index] = updatedSettings;
      } else {
        newAllSettings.push(updatedSettings);
      }

      if (isPermissionsChanged) {
        newAllSettings = newAllSettings.map(as => ({
          ...as,
          permissions: settings.permissions
        }));
      }

      // Identify if we need to update personal user settings
      let newUsuarios = [...s.usuarios];
      if (currentUser) {
        const userIndex = newUsuarios.findIndex(u => u.id === currentUser.id);
        if (userIndex !== -1) {
          newUsuarios[userIndex] = {
            ...newUsuarios[userIndex],
            theme: settings.theme,
            itemsPerPage: settings.itemsPerPage,
            menuOrder: settings.menuOrder,
            enableNotifications: settings.enableEmailNotifications
          };
        }
      }

      // Sync settings back to the Escritorio object to ensure it's saved in the Escritorios sheet
      let newEscritorios = [...s.escritorios];
      const escritorioIndex = newEscritorios.findIndex(e => e.id === eid);
      if (escritorioIndex !== -1) {
        newEscritorios[escritorioIndex] = {
          ...newEscritorios[escritorioIndex],
          timezone: settings.timezone,
          itemsPerPage: settings.itemsPerPage,
          emailUser: settings.emailUser,
          emailPass: settings.emailPass,
          useExternalSmtp: settings.useExternalSmtp,
          smtpHost: settings.smtpHost,
          smtpPort: settings.smtpPort,
          smtpSecure: settings.smtpSecure,
          enableEmailNotifications: settings.enableEmailNotifications,
          emailWeeklyReport: settings.emailWeeklyReport,
          emailDailyReport: settings.emailDailyReport,
          emailNewNotifications: settings.emailNewNotifications,
          templateWeeklyReport: settings.templateWeeklyReport,
          templateDailyReport: settings.templateDailyReport,
          templateNewNotifications: settings.templateNewNotifications,
          emailDispatchTime: settings.emailDispatchTime,
          showMovimentos: settings.showMovimentos,
          diasMorosidade: settings.diasMorosidade,
          menuOrder: settings.menuOrder,
          // Convert system theme to light for office baseline if needed
          theme: (settings.theme === 'system' || !settings.theme) ? 'light' : settings.theme as 'light' | 'dark'
        };
      }
      
      const newState = { 
        ...s, 
        settings: updatedSettings,
        allSettings: newAllSettings,
        usuarios: newUsuarios,
        escritorios: newEscritorios
      };
      saveAndLog(newState, 'UPDATE_SETTINGS', 'Configurações atualizadas (Globais + Pessoais)', updatedSettings);
      return newState;
    });
  }, [escritorioAtivoId, currentUser, saveAndLog]);
  const setSelectedProcessId = useCallback((id: string | undefined) => setState(s => ({ ...s, selectedProcessId: id })), []);
  
  const forceLoad = useCallback(async () => {
    const isSupabaseActive = getActiveDataSource() === 'supabase' && isSupabaseConfigured();

    if (!isSupabaseActive && !state.settings.spreadsheetId) {
      setState(s => ({ ...s, syncStatus: 'error' }));
      safeAlert('Por favor, configure o ID da Planilha nas Configurações.');
      setTimeout(() => setState(s => ({ ...s, syncStatus: 'idle' })), 3000);
      return;
    }

    setIsImporting(true);
    setState(s => ({ ...s, syncStatus: 'loading' }));
    try {
      let data: Partial<AppState>;
      if (isSupabaseActive) {
        data = await fetchAllDataFromSupabase(false);
      } else {
        data = await importFromGoogleSheets(state.settings.spreadsheetId);
      }
      const now = new Date().toISOString();
      setState(s => {
        const allSettings = data.allSettings || s.allSettings;
        const eid = escritorioAtivoId || '';
        const officeSettings = allSettings.find((as: any) => as.idEscritorio === eid);

        return {
          ...s,
          ...data,
          allSettings,
          settings: { ...s.settings, ...(officeSettings || data.settings || {}) },
          syncStatus: 'idle',
          lastSyncTime: now,
          syncLogs: [{
            timestamp: now,
            action: isSupabaseActive ? 'Carga Supabase' : 'Carga Forçada',
            status: 'success' as const,
            details: isSupabaseActive ? 'Dados recarregados diretamente do banco Supabase.' : 'Recarregamento total concluído.'
          }, ...s.syncLogs].slice(0, 20),
          hasLoaded: true
        };
      });
      console.log(`Dados carregados com sucesso (${isSupabaseActive ? 'Supabase' : 'Planilha'})`);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      const now = new Date().toISOString();
      setState(s => ({ 
        ...s, 
        syncStatus: 'error',
        syncLogs: [{
          timestamp: now,
          action: isSupabaseActive ? 'Erro Carga Supabase' : 'Erro Carga Forçada',
          status: 'error' as const,
          details: error instanceof Error ? error.message : String(error)
        }, ...s.syncLogs].slice(0, 20)
      }));
      setTimeout(() => setState(s => ({ ...s, syncStatus: 'idle' })), 3000);
    } finally {
      setIsImporting(false);
    }
  }, [state.settings.spreadsheetId, escritorioAtivoId]);

  const forceSave = useCallback(async () => {
    if (isSyncingRef.current) {
      console.log('Sincronização manual impedida: Já existe um salvamento em curso.');
      return;
    }

    const scriptUrl = stateRef.current.settings.scriptUrl;
    if (!scriptUrl) {
      setState(s => ({ ...s, syncStatus: 'error' }));
      safeAlert('Por favor, configure a URL do Script nas Configurações antes de salvar.');
      setTimeout(() => setState(s => ({ ...s, syncStatus: 'idle' })), 3000);
      return;
    }

    if (!currentUser) {
      setState(s => ({ ...s, syncStatus: 'error' }));
      safeAlert('Você precisa estar logado para salvar dados.');
      setTimeout(() => setState(s => ({ ...s, syncStatus: 'idle' })), 3000);
      return;
    }

    if (!stateRef.current.hasLoaded) {
      if (!safeConfirm('Atenção: Os dados ainda não foram totalmente carregados da planilha. Salvar agora pode apagar dados existentes no Google Sheets. Deseja continuar mesmo assim?')) {
        return;
      }
    }

    const currentUsersCount = stateRef.current.usuarios.length;
    const initialUsersCount = initialUserCountRef.current || 0;
    const isIntegrityCompromised = stateRef.current.hasLoaded && (
      currentUsersCount === 0 || 
      (initialUsersCount > 1 && currentUsersCount < (initialUsersCount / 2))
    );

    if (isIntegrityCompromised) {
      if (!safeConfirm(`AVISO CRÍTICO: Detectamos que o número de usuários caiu drasticamente (de ${initialUsersCount} para ${currentUsersCount}). Isso geralmente indica uma falha no carregamento. Salvar agora pode causar PERDA PERMANENTE de usuários na planilha. Deseja prosseguir com o salvamento mesmo assim?`)) {
        return;
      }
    }
    
    isSyncingRef.current = true;
    setState(s => ({ ...s, syncStatus: 'saving' }));
    try {
      await saveAllDataToScript(stateRef.current, scriptUrl);
      
      lastSavedStateRef.current = JSON.stringify({
        c: stateRef.current.contatos, p: stateRef.current.processos, e: stateRef.current.eventos, m: stateRef.current.movimentos,
        f: stateRef.current.financeiro, t: stateRef.current.tarefas, esc: stateRef.current.escritorios, u: stateRef.current.usuarios
      });

      // Log de salvamento manual
      if (scriptUrl && currentUser) {
        saveLogToScript(scriptUrl, {
          usuario: currentUser.email,
          acao: 'MANUAL_SAVE',
          idEscritorio: escritorioAtivoId || '',
          detalhes: 'Sincronização manual de dados realizada pelo usuário com sucesso.'
        });
      }
      
      console.log('Dados salvos manualmente na planilha');
      const now = new Date().toISOString();
      setState(s => ({ 
        ...s, 
        syncStatus: 'idle',
        lastSyncTime: now,
        syncLogs: [{
          timestamp: now,
          action: 'Sincronização Manual',
          status: 'success' as const,
          details: 'Sincronização manual concluída com sucesso.'
        }, ...s.syncLogs].slice(0, 20)
      }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Erro ao salvar dados manualmente:', error);
      
      const now = new Date().toISOString();
      setState(s => ({ 
        ...s, 
        syncStatus: 'error',
        syncLogs: [{
          timestamp: now,
          action: 'Erro Sincronia Manual',
          status: 'error' as const,
          details: errorMsg
        }, ...s.syncLogs].slice(0, 20)
      }));
      
      // Registrar erro no log
      if (scriptUrl && currentUser) {
        try {
          await saveLogToScript(scriptUrl, {
            usuario: currentUser.email,
            acao: 'ERRO_MANUAL_SAVE',
            idEscritorio: escritorioAtivoId || '',
            detalhes: `Falha na sincronização manual: ${errorMsg}`
          });
        } catch (e) {}
      }
      
      setState(s => ({ ...s, syncStatus: 'error' }));
      setTimeout(() => setState(s => ({ ...s, syncStatus: 'idle' })), 3000);
    } finally {
      isSyncingRef.current = false;
    }
  }, [state.settings.scriptUrl, currentUser, escritorioAtivoId]);

  const resetPassword = useCallback(async (email: string) => {
    return resetSupabasePassword(email);
  }, []);

  const contextValue = React.useMemo(() => ({ 
    state, 
    addContato, 
    addContatos,
    updateContato,
    deleteContato,
    addProcesso, 
    addProcessos,
    updateProcesso,
    deleteProcesso,
    addLead,
    updateLead,
    deleteLead,
    addLeadStatus,
    updateLeadStatusItem,
    deleteLeadStatus,
    addEvento, 
    updateEvento,
    deleteEvento,
    addMovimento, 
    updateMovimento,
    deleteMovimento,
    addTransacao, 
    updateTransacao,
    deleteTransacao,
    addDocumento,
    updateDocumento,
    deleteDocumento,
    addRecurso,
    updateRecurso,
    deleteRecurso,
    addVara, 
    updateVara,
    deleteVara,
    addJulgador,
    updateJulgador,
    deleteJulgador,
    addServidor,
    updateServidor,
    deleteServidor,
    addPendencia,
    updatePendencia,
    deletePendencia,
    addEscritorio,
    updateEscritorio,
    deleteEscritorio,
    addTribunal,
    updateTribunal,
    deleteTribunal,
    addForum,
    updateForum,
    deleteForum,
    addUPJ,
    updateUPJ,
    deleteUPJ,
    addUsuario, 
    updateUsuario,
    deleteUsuario,
    addModelo,
    updateModelo,
    deleteModelo,
    addTarefa, 
    updateTarefa,
    deleteTarefa,
    updateSettings,
    setSelectedProcessId,
    forceSave,
    forceLoad,
    login,
    loginWithGoogleEmail,
    logout,
    resetPassword,
    isAdmin,
    isImporting,
    currentUser,
    hasPermission,
    canViewMenu,
    getPermissions,
    escritorioAtivoId,
    setEscritorioAtivoId,
    activeOfficeName,
    isLoggingOut,
    addEtiqueta,
    updateEtiqueta,
    deleteEtiqueta,
    addCalendario,
    updateCalendario,
    deleteCalendario,
    addTipoEnvolvimento,
    addEnvolvimento,
    updateEnvolvimento,
    deleteEnvolvimento,
    applyTheme,
    setViewParams,
    dataSource,
    setDataSource,
    lastSyncTime: state.lastSyncTime,
    syncLogs: state.syncLogs,
  }), [
    state, 
    addContato, 
    addContatos,
    updateContato,
    deleteContato,
    addProcesso, 
    addProcessos,
    updateProcesso,
    deleteProcesso,
    addEvento, 
    updateEvento,
    deleteEvento,
    addMovimento, 
    updateMovimento,
    deleteMovimento,
    addTransacao, 
    updateTransacao,
    deleteTransacao,
    addDocumento,
    updateDocumento,
    deleteDocumento,
    addRecurso,
    updateRecurso,
    deleteRecurso,
    addVara, 
    updateVara,
    deleteVara,
    addJulgador,
    updateJulgador,
    deleteJulgador,
    addServidor,
    updateServidor,
    deleteServidor,
    addPendencia,
    updatePendencia,
    deletePendencia,
    addEscritorio,
    updateEscritorio,
    deleteEscritorio,
    addTribunal,
    updateTribunal,
    deleteTribunal,
    addForum,
    updateForum,
    deleteForum,
    addUPJ,
    updateUPJ,
    deleteUPJ,
    addUsuario, 
    updateUsuario,
    deleteUsuario,
    addModelo,
    updateModelo,
    deleteModelo,
    addTarefa, 
    updateTarefa,
    deleteTarefa,
    updateSettings,
    setSelectedProcessId,
    forceSave,
    forceLoad,
    login,
    loginWithGoogleEmail,
    logout,
    isAdmin,
    isImporting,
    currentUser,
    hasPermission,
    canViewMenu,
    getPermissions,
    escritorioAtivoId,
    setEscritorioAtivoId,
    activeOfficeName,
    isLoggingOut,
    addEtiqueta,
    updateEtiqueta,
    deleteEtiqueta,
    addCalendario,
    updateCalendario,
    deleteCalendario,
    addTipoEnvolvimento,
    addEnvolvimento,
    updateEnvolvimento,
    deleteEnvolvimento,
    applyTheme,
    setViewParams,
    dataSource,
    setDataSource,
    resetPassword,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
