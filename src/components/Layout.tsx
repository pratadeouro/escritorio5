import React, { useState, useEffect } from 'react';
import { View } from '../types';
import { 
  LayoutDashboard, 
  Scale, 
  Users, 
  Calendar, 
  DollarSign, 
  FileText, 
  Menu, 
  X,
  Bell,
  UserCircle,
  Loader2,
  Building2,
  ClipboardList,
  Network,
  ListTodo,
  Server,
  Copy,
  FormInput,
  Gavel,
  Activity,
  FolderOpen,
  Landmark,
  Sparkles,
  Tag,
  Settings,
  LogOut,
  ChevronDown,
  ChevronLeft,
  TrendingUp,
  User,
  ExternalLink,
  History
} from 'lucide-react';
import Modal from './Modal';
import SyncIndicator from './SyncIndicator';
import VersionUpdateNotice from './VersionUpdateNotice';
import { CURRENT_APP_VERSION } from '../services/versionService';
import { useAppContext } from '../context';
import { motion, AnimatePresence } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  currentView: View;
  onNavigate: (view: View) => void;
}

export default function Layout({ children, currentView, onNavigate }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('desktop_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [locaisOpen, setLocaisOpen] = useState(false);
  const [publicacoesHoje, setPublicacoesHoje] = useState<number>(0);
  const { state, isImporting, canViewMenu, isAdmin, logout, currentUser, escritorioAtivoId, setEscritorioAtivoId, activeOfficeName, setViewParams } = useAppContext();
  const activeOffice = state.escritorios.find(e => e.id === escritorioAtivoId);
  const officeName = activeOfficeName;

  // Get user's offices
  const userOffices = isAdmin() ? state.escritorios.map(e => e.id) : (currentUser?.escritoriosIds || []);
  const hasMultipleOffices = isAdmin() ? state.escritorios.length > 1 : userOffices.length > 1;

  useEffect(() => {
    const fetchPublicacoesHoje = async () => {
      if (!currentUser && !escritorioAtivoId) return;

      const activeOffice = state.escritorios.find(e => e.id === escritorioAtivoId);
      const responsavel = activeOffice?.responsavel || currentUser?.nome || '';
      
      if (!responsavel) return;

      const today = new Date().toISOString().split('T')[0];
      const url = `https://comunicaapi.pje.jus.br/api/v1/comunicacao?pagina=1&itensPorPagina=1&dataDisponibilizacaoInicio=${today}&dataDisponibilizacaoFim=${today}&nomeAdvogado=${encodeURIComponent(responsavel)}`;

      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setPublicacoesHoje(data.count || 0);
        }
      } catch (e) {
        console.error('Erro ao buscar publicações do dia no Layout:', e);
      }
    };

    fetchPublicacoesHoje();
    // Refresh every 5 minutes
    const interval = setInterval(fetchPublicacoesHoje, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [escritorioAtivoId, state.escritorios, currentUser]);

  useEffect(() => {
    if (officeName) {
      document.title = officeName;
    }
  }, [officeName]);

  const activeProcessosCount = state.processos.filter(p => {
    const pEscId = (p.escritorioId || '').toString().trim().toUpperCase();
    const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
    const isGlobal = pEscId === 'X';
    
    if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
    if (!isAdmin() && !isGlobal && pEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(pEscId)) return false;
    return p.status === 'Ativo';
  }).length;

  const pendenciasCount = state.processos.filter(p => {
    const pEscId = (p.escritorioId || '').toString().trim().toUpperCase();
    const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
    const isGlobal = pEscId === 'X';
    
    if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
    if (!isAdmin() && !isGlobal && pEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(pEscId)) return false;
    if (p.status !== 'Ativo') return false;
    const pTags = (p.tags || '').split(',').map(t => t.trim()).filter(Boolean);
    return state.etiquetas.some(e => {
      const tagName = e.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return pTags.includes(String(e.id)) && tagName.includes('pendencia');
    });
  }).length;

  const allItems: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard' as View, label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'ia' as View, label: 'Módulo IA', icon: <Sparkles size={20} className="text-primary" /> },
    { id: 'contatos' as View, label: 'Contatos', icon: <Users size={20} /> },
    { id: 'processosAtivos' as View, label: `Processos Ativos (${activeProcessosCount})`, icon: <ClipboardList size={20} /> },
    { id: 'djen' as View, label: 'Módulo DJEN', icon: <Bell size={20} /> },
    { id: 'calendario' as View, label: 'Calendário Judicial', icon: <Calendar size={20} className="text-secondary" /> },
    { id: 'eventos' as View, label: 'Eventos', icon: <Calendar size={20} /> },
    { id: 'financeiro' as View, label: 'Financeiro', icon: <DollarSign size={20} /> },
    { id: 'usuarios' as View, label: 'Usuários', icon: <Users size={20} /> },
    { id: 'tarefas' as View, label: 'Tarefas / Prazos', icon: <ListTodo size={20} /> },
    { id: 'pendencias' as View, label: `PENDÊNCIA (${pendenciasCount})`, icon: <Server size={20} /> },
    { id: 'documentos' as View, label: 'Gerador de Documentos', icon: <FolderOpen size={20} /> },
    { id: 'etiquetas' as View, label: 'Etiquetas', icon: <Tag size={20} /> },
    { id: 'api_diario' as View, label: 'Consulta - DJEN', icon: <FileText size={20} /> },
    { id: 'leads' as View, label: 'Leads', icon: <TrendingUp size={20} /> },
    { id: 'escritorios' as View, label: 'Escritórios', icon: <Building2 size={20} /> },
    { id: 'modelos' as View, label: 'Modelos', icon: <Copy size={20} /> },
    { id: 'movimentos' as View, label: 'Movimentos', icon: <Activity size={20} /> },
    { id: 'recursos' as View, label: 'Recursos', icon: <FileText size={20} /> },
    { id: 'processosGeral' as View, label: 'Processos Geral', icon: <Scale size={20} /> },
    { id: 'settings' as View, label: 'Configurações', icon: <Settings size={20} /> },
    { id: 'logs' as View, label: 'Logs do Sistema', icon: <History size={20} /> },
    { id: 'varas' as View, label: 'Varas', icon: <Building2 size={20} /> },
    { id: 'forum' as View, label: 'Fóruns', icon: <Landmark size={20} /> },
    { id: 'tribunais' as View, label: 'Tribunais', icon: <Landmark size={20} /> },
    { id: 'upj' as View, label: 'UPJ', icon: <Building2 size={20} /> },
    { id: 'julgadores' as View, label: 'Julgadores', icon: <Gavel size={20} /> },
    { id: 'servidores' as View, label: 'Servidores', icon: <Users size={20} /> },
  ].filter(item => item.id !== 'movimentos' || state.settings.showMovimentos !== false);

  const userMenuOrder = currentUser?.menuOrder || state.settings.menuOrder || [];

  const getSortedItems = (items: typeof allItems) => {
    if (!userMenuOrder || userMenuOrder.length === 0) return items;
    return [...items].sort((a, b) => {
      const idxA = userMenuOrder.indexOf(a.id);
      const idxB = userMenuOrder.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return 0;
    });
  };

  const locaisIds: View[] = ['varas', 'forum', 'tribunais', 'upj', 'julgadores', 'servidores'];
  
  const navItems = getSortedItems(allItems.filter(item => !locaisIds.includes(item.id)));
  const locaisItems = getSortedItems(allItems.filter(item => locaisIds.includes(item.id)));

  const lawyerName = currentUser?.nome || activeOffice?.responsavel || 'Walber Mendonça';
  const initials = lawyerName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const isFullHeightView = ['processosAtivos', 'processosGeral', 'pendencias', 'ia', 'tarefas'].includes(currentView);

  return (
    <div className="h-screen h-[100dvh] bg-app-bg flex transition-colors duration-300 overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        bg-app-surface border-r border-app-border
        transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
        ${desktopSidebarCollapsed 
          ? 'lg:w-0 lg:opacity-0 lg:border-r-0 lg:pointer-events-none lg:overflow-hidden' 
          : 'lg:w-64 lg:opacity-100 lg:overflow-visible'
        }
        flex flex-col shadow-sm h-full
        pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)]
      `}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-app-border flex-shrink-0">
          <div className="flex items-center space-x-2 text-primary overflow-hidden">
            <Scale size={28} strokeWidth={2.5} className="shrink-0" />
            <span className="text-xl font-bold tracking-tight text-app-text truncate">{officeName}</span>
          </div>
          <button 
            className="lg:hidden text-app-text-muted hover:text-app-text"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={24} />
          </button>

          {/* Desktop collapse button */}
          <button 
            className="hidden lg:flex text-app-text-muted hover:text-primary p-1.5 hover:bg-app-secondary rounded-lg transition-colors ml-2 shrink-0"
            onClick={() => {
              setDesktopSidebarCollapsed(true);
              localStorage.setItem('desktop_sidebar_collapsed', 'true');
            }}
            title="Recolher Menu"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-app-border scrollbar-track-transparent">
          <nav className="px-3 space-y-1">
            {navItems.filter(item => canViewMenu(item.id)).map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all
                  ${currentView === item.id 
                    ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]' 
                    : 'text-app-text-muted hover:bg-app-secondary hover:text-app-text'
                  }
                `}
              >
                <span className={`mr-3 ${currentView === item.id ? 'text-white' : 'text-app-text-muted'}`}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}

            {/* Submenu Locais */}
            {locaisItems.filter(item => canViewMenu(item.id)).length > 0 && (
              <div className="space-y-1">
                <button
                  onClick={() => setLocaisOpen(!locaisOpen)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl transition-all
                    text-app-text-muted hover:bg-app-secondary hover:text-app-text
                  `}
                >
                  <div className="flex items-center">
                    <span className="mr-3 text-app-text-muted">
                      <Landmark size={20} />
                    </span>
                    Locais
                  </div>
                  <ChevronDown 
                    size={16} 
                    className={`transition-transform duration-200 ${locaisOpen ? 'rotate-180' : ''}`} 
                  />
                </button>
                
                <AnimatePresence>
                  {locaisOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden pl-4 space-y-1"
                    >
                      {locaisItems.filter(item => canViewMenu(item.id)).map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            onNavigate(item.id);
                            setSidebarOpen(false);
                            setLocaisOpen(false);
                          }}
                          className={`
                            w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all
                            ${currentView === item.id 
                              ? 'bg-primary/10 text-primary' 
                              : 'text-app-text-muted hover:bg-app-secondary/50 hover:text-app-text'
                            }
                          `}
                        >
                          <span className={`mr-3 ${currentView === item.id ? 'text-primary' : 'text-app-text-muted'}`}>
                            {item.icon}
                          </span>
                          {item.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </nav>
        </div>

        <div className="p-4 border-t border-app-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => onNavigate('profile')}
              className="flex items-center space-x-3 overflow-hidden hover:bg-app-secondary p-1 rounded-lg transition-colors flex-1 mr-2"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center text-primary font-bold">
                {initials}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-app-text truncate">{lawyerName}</p>
                {currentUser?.email && (
                  <p className="text-[10px] text-app-text-muted/70 truncate">{currentUser.email}</p>
                )}
              </div>
            </button>
            <button 
              onClick={logout}
              className="p-2 text-app-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
          {!desktopSidebarCollapsed && (
            <div className="mt-3 pt-2 border-t border-app-border/40 text-center">
              <p className="text-[10px] text-app-text-muted font-medium">
                &copy; {new Date().getFullYear()} {activeOfficeName || 'LexGestão'}
              </p>
              <p className="text-[10px] text-app-text-muted/70 font-mono mt-0.5">
                Versão {CURRENT_APP_VERSION}
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Loading Overlay */}
        {isImporting && (
          <div className="absolute inset-0 bg-app-bg/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-lg font-medium text-app-text">Importando dados...</p>
            <p className="text-sm text-app-text-muted mt-2">Isso pode levar alguns instantes.</p>
          </div>
        )}

        {/* Header */}
        <header className="bg-app-surface border-b border-app-border shadow-sm flex-shrink-0 pt-[env(safe-area-inset-top,0px)]">
          <div className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            {/* Mobile Menu trigger OR Desktop Expand trigger */}
            <button
              className={`
                text-app-text-muted hover:text-app-text p-1.5 hover:bg-app-secondary rounded-lg transition-colors mr-3
                ${desktopSidebarCollapsed ? 'flex' : 'lg:hidden'}
              `}
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setSidebarOpen(true);
                } else {
                  setDesktopSidebarCollapsed(false);
                  localStorage.setItem('desktop_sidebar_collapsed', 'false');
                }
              }}
              title={desktopSidebarCollapsed ? "Expandir Menu" : "Menu"}
            >
              <Menu size={22} />
            </button>
            
            <div className="hidden sm:flex items-center">
              <h1 className="text-xl font-bold text-app-text tracking-tight">
                {activeOfficeName}
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {hasMultipleOffices && (
              <div className="flex items-center mr-2">
                <Building2 size={16} className="text-app-text-muted mr-2" />
                <select
                  value={escritorioAtivoId || ''}
                  onChange={(e) => setEscritorioAtivoId(e.target.value)}
                  className="bg-app-surface border border-app-border text-app-text text-sm rounded-lg focus:ring-primary focus:border-primary block p-2"
                >
                  {isAdmin() && <option value="">Todos os Escritórios</option>}
                  {userOffices.map(id => {
                    const esc = state.escritorios.find(e => e.id === id);
                    return (
                      <option key={id} value={id}>
                        {esc ? esc.nome : `Escritório ${id}`}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            <SyncIndicator />
            <button 
              onClick={() => {
                setViewParams({ tab: 'nome' });
                onNavigate('api_diario');
              }}
              className="text-app-text-muted hover:text-app-text relative p-2 rounded-full hover:bg-app-secondary transition-colors"
              title={publicacoesHoje > 0 ? `${publicacoesHoje} Novas Publicações Hoje` : 'Sem novas publicações hoje'}
            >
              <Bell size={20} className={publicacoesHoje > 0 ? 'text-red-500' : ''} />
              {publicacoesHoje > 0 && (
                <span className="absolute top-1.5 right-1.5 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-app-surface animate-bounce" />
              )}
            </button>
            <div className="relative">
              <button 
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className={`flex items-center space-x-2 p-1.5 rounded-lg transition-all ${isProfileDropdownOpen ? 'bg-primary/10 text-primary' : 'text-app-text-muted hover:text-app-text hover:bg-app-secondary'}`}
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs border border-primary/20">
                  {initials}
                </div>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isProfileDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsProfileDropdownOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-2 w-72 bg-app-surface border border-app-border rounded-xl shadow-xl z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-app-border bg-app-bg/50">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg border border-primary/20">
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-app-text truncate">{currentUser?.nome || 'Usuário'}</p>
                            <p className="text-xs text-app-text-muted truncate">{currentUser?.email || 'Sem email'}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-2">
                        <div className="px-3 py-2">
                          <p className="text-[10px] font-bold text-app-text-muted uppercase tracking-wider mb-1">Escritório Atual</p>
                          <div className="flex items-center text-sm text-app-text">
                            <Building2 size={14} className="mr-2 text-primary" />
                            <span className="truncate font-medium">
                              {escritorioAtivoId 
                                ? (state.escritorios.find(e => e.id === escritorioAtivoId)?.nome || 'Escritório não encontrado')
                                : (isAdmin() ? 'Todos os Escritórios' : 'Nenhum escritório selecionado')
                              }
                            </span>
                          </div>
                        </div>

                        <div className="h-px bg-app-border my-1" />

                        <button
                          onClick={() => {
                            onNavigate('profile');
                            setIsProfileDropdownOpen(false);
                          }}
                          className="w-full flex items-center space-x-3 px-3 py-2.5 text-sm text-app-text hover:bg-app-secondary rounded-lg transition-colors group"
                        >
                          <div className="p-1.5 rounded-md bg-app-bg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <UserCircle size={16} />
                          </div>
                          <span className="flex-1 text-left">Preferências</span>
                          <ExternalLink size={14} className="text-app-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>

                        <button
                          onClick={() => {
                            logout();
                            setIsProfileDropdownOpen(false);
                          }}
                          className="w-full flex items-center space-x-3 px-3 py-2.5 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors group"
                        >
                          <div className="p-1.5 rounded-md bg-red-500/10 transition-colors">
                            <LogOut size={16} />
                          </div>
                          <span className="flex-1 text-left">Sair do Sistema</span>
                        </button>

                        <div className="pt-2 mt-1 border-t border-app-border/60 text-center">
                          <p className="text-[10px] text-app-text-muted">
                            &copy; {new Date().getFullYear()} {activeOfficeName || 'LexGestão'}
                          </p>
                          <p className="text-[9px] text-app-text-muted/70 font-mono mt-0.5">
                            Versão {CURRENT_APP_VERSION}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

        {/* Banner de Aviso de Versão Desatualizada */}
        <VersionUpdateNotice />

        {/* Page content */}
        <div className={`
          flex-1 flex flex-col min-h-0 
          ${isFullHeightView ? 'overflow-hidden' : 'overflow-y-auto'} 
          pb-[env(safe-area-inset-bottom,12px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] 
          scrollbar-thin scrollbar-thumb-app-border scrollbar-track-transparent
        `}>
          {children}
        </div>
      </main>
    </div>
  );
}
