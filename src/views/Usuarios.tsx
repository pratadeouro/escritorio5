import React, { useState } from 'react';
import { useAppContext } from '../context';
import { Users, Plus, Search, Edit2, Trash2, Mail, Phone, ShieldCheck, ChevronRight, Copy, Check, ListOrdered } from 'lucide-react';
import Modal from '../components/Modal';
import { Usuario, RolePermission, View } from '../types';

export default function Usuarios() {
  const { state, addUsuario, updateUsuario, deleteUsuario, hasPermission, getPermissions, currentUser, escritorioAtivoId, isAdmin, updateSettings } = useAppContext();
  const canWrite = hasPermission('usuarios', 'write');
  const canDelete = hasPermission('usuarios', 'delete');
  const [activeTab, setActiveTab] = useState<'usuarios' | 'permissions'>('usuarios');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    cargo: '',
    email: '',
    contato: '',
    cpf: '',
    senha: '',
    oab: '',
    permissao: '',
    escritoriosIds: [] as string[]
  });

  const filteredUsuarios = state.usuarios.filter(u => {
    // Se houver um escritório ativo selecionado, filtrar por ele (para todos, incluindo Admin)
    if (escritorioAtivoId && !u.escritoriosIds?.includes(escritorioAtivoId)) {
      return false;
    }

    // Admin vê todos
    if (isAdmin()) {
      return u.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
             u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
             u.cargo.toLowerCase().includes(searchTerm.toLowerCase());
    }

    // Não admin: ver apenas usuários associados aos seus escritórios
    const userOffices = currentUser?.escritoriosIds || [];
    const isAssociated = u.escritoriosIds?.some(id => userOffices.includes(id));
    
    if (!isAssociated) return false;

    return u.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
           u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
           u.cargo.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleOpenModal = (usuario?: Usuario) => {
    const availableOffices = state.escritorios.filter(esc => isAdmin() || (currentUser?.escritoriosIds || []).includes(esc.id));

    if (usuario) {
      setEditingUsuario(usuario);
      setFormData({
        nome: usuario.nome,
        cargo: usuario.cargo,
        email: usuario.email,
        contato: usuario.contato,
        cpf: usuario.cpf,
        senha: usuario.senha || '',
        oab: usuario.oab || '',
        permissao: usuario.permissao,
        escritoriosIds: usuario.escritoriosIds || []
      });
    } else {
      setEditingUsuario(null);
      setFormData({
        nome: '',
        cargo: '',
        email: '',
        contato: '',
        cpf: '',
        senha: '',
        oab: '',
        permissao: '',
        escritoriosIds: escritorioAtivoId ? [escritorioAtivoId] : (availableOffices[0] ? [availableOffices[0].id] : [])
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome) return;

    if (!formData.escritoriosIds || formData.escritoriosIds.length === 0) {
      alert('Por favor, selecione ao menos um escritório de atuação para o usuário.');
      return;
    }
    
    if (editingUsuario) {
      let finalEscritoriosIds = formData.escritoriosIds;
      
      // Se não for admin, preservar os IDs de escritórios que o usuário atual não tem acesso
      if (!isAdmin()) {
        const userOffices = currentUser?.escritoriosIds || [];
        const hiddenOffices = (editingUsuario.escritoriosIds || []).filter(id => !userOffices.includes(id));
        finalEscritoriosIds = [...new Set([...formData.escritoriosIds, ...hiddenOffices])];
      }

      updateUsuario({
        ...editingUsuario,
        ...formData,
        escritoriosIds: finalEscritoriosIds
      });
    } else {
      addUsuario({
        id: Math.random().toString(36).substr(2, 9),
        ...formData
      });
    }
    
    setIsModalOpen(false);
    setEditingUsuario(null);
    setFormData({
      nome: '',
      cargo: '',
      email: '',
      contato: '',
      cpf: '',
      senha: '',
      oab: '',
      permissao: '',
      escritoriosIds: []
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
      deleteUsuario(id);
    }
  };

  // Permissions Logic
  const normalizePermissions = (raw: any): RolePermission[] => {
    if (!raw) return [];
    try {
      let parsed: any[] = [];
      if (typeof raw === 'string') {
        if (raw === '[object Object]' || raw === 'undefined' || raw === 'null' || !raw.trim()) return [];
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
              const cleanMenus = menus.trim().startsWith('[') ? menus.trim() : `[${menus}]`;
              menus = JSON.parse(cleanMenus);
            } catch (e) {
              menus = menus.split(',').map((m: string) => m.trim().replace(/[\[\]"']/g, '')).filter(Boolean);
            }
          }
          
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
      console.error('Error normalizing permissions:', e);
      return [];
    }
  };

  const [structuredPermissions, setStructuredPermissions] = useState<RolePermission[]>(() => {
    const initial = normalizePermissions(state.settings.permissions);
    return initial;
  });
  
  const [selectedRoleIndex, setSelectedRoleIndex] = useState<number | null>(null);
  
  // Derived state for the currently selected role to avoid undefined crashes
  const currentRole = selectedRoleIndex !== null && structuredPermissions[selectedRoleIndex] 
    ? structuredPermissions[selectedRoleIndex] 
    : null;

  const [roleToDelete, setRoleToDelete] = useState<number | null>(null);
  const [localRoleName, setLocalRoleName] = useState<string>('');

  React.useEffect(() => {
    if (currentRole) {
      setLocalRoleName(currentRole.role);
    } else {
      setLocalRoleName('');
    }
  }, [selectedRoleIndex, currentRole?.role]);

  React.useEffect(() => {
    const normalized = normalizePermissions(state.settings.permissions);
    setStructuredPermissions(normalized);
    
    // Auto-select first role if none selected and we have roles
    if (selectedRoleIndex === null && normalized.length > 0) {
      setSelectedRoleIndex(0);
    } else if (selectedRoleIndex !== null && selectedRoleIndex >= normalized.length) {
      setSelectedRoleIndex(normalized.length > 0 ? normalized.length - 1 : null);
    }
  }, [state.settings.permissions]);

  const allMenus: { id: View; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'ia', label: 'Módulo Inteligência Artificial (IA)' },
    { id: 'contatos', label: 'Contatos / Clientes' },
    { id: 'processosAtivos', label: 'Processos Ativos' },
    { id: 'processosGeral', label: 'Processos (Geral)' },
    { id: 'movimentos', label: 'Movimentações Processuais' },
    { id: 'recursos', label: 'Gestão de Recursos' },
    { id: 'upj', label: 'Painel UPJ' },
    { id: 'eventos', label: 'Agenda de Eventos' },
    { id: 'tarefas', label: 'Gestão de Tarefas / Prazos' },
    { id: 'pendencias', label: 'Pendências e Morosidade' },
    { id: 'financeiro', label: 'Gestão Financeira' },
    { id: 'documentos', label: 'Gerador de Documentos' },
    { id: 'modelos', label: 'Modelos de Documentos' },
    { id: 'etiquetas', label: 'Gestão de Etiquetas' },
    { id: 'djen', label: 'Módulo DJEN' },
    { id: 'api_diario', label: 'Consulta - DJEN' },
    { id: 'leads', label: 'Prospecção de Leads' },
    { id: 'calendario', label: 'Calendário Judicial' },
    { id: 'usuarios', label: 'Gestão de Usuários' },
    { id: 'escritorios', label: 'Dados do Escritório' },
    { id: 'settings', label: 'Configurações Gerais' },
    { id: 'logs', label: 'Logs do Sistema' },
    { id: 'varas', label: 'Cadastro de Varas' },
    { id: 'forum', label: 'Cadastro de Fóruns' },
    { id: 'tribunais', label: 'Cadastro de Tribunais' },
    { id: 'julgadores', label: 'Cadastro de Julgadores' },
    { id: 'servidores', label: 'Cadastro de Servidores' },
  ];

  const allModules = [
    { id: 'processos', label: 'Processos' },
    { id: 'contatos', label: 'Contatos' },
    { id: 'financeiro', label: 'Financeiro' },
    { id: 'usuarios', label: 'Usuários' },
    { id: 'tarefas', label: 'Tarefas / Prazos' },
    { id: 'documentos', label: 'Gerador de Documentos' },
    { id: 'varas', label: 'Varas' },
    { id: 'tribunais', label: 'Tribunais' },
    { id: 'forums', label: 'Fóruns' },
    { id: 'escritorios', label: 'Escritórios' },
    { id: 'julgadores', label: 'Julgadores' },
    { id: 'servidores', label: 'Servidores' },
    { id: 'upj', label: 'UPJ' },
    { id: 'modelos', label: 'Modelos' },
    { id: 'recursos', label: 'Recursos' },
    { id: 'eventos', label: 'Eventos' },
    { id: 'djen', label: 'Módulo DJEN' },
    { id: 'api_diario', label: 'Consulta - DJEN' },
    { id: 'etiquetas', label: 'Etiquetas' },
    { id: 'calendario', label: 'Calendário' },
    { id: 'movimentos', label: 'Movimentações Processuais' },
  ];

  const moduleToMenuMapping: Record<string, View[]> = {
    processos: ['processosAtivos', 'processosGeral'],
    contatos: ['contatos'],
    financeiro: ['financeiro'],
    usuarios: ['usuarios'],
    tarefas: ['tarefas'],
    documentos: ['documentos'],
    varas: ['varas'],
    tribunais: ['tribunais'],
    forums: ['forum'],
    escritorios: ['escritorios'],
    julgadores: ['julgadores'],
    servidores: ['servidores'],
    upj: ['upj'],
    modelos: ['modelos'],
    recursos: ['recursos'],
    eventos: ['eventos'],
    djen: ['djen'],
    api_diario: ['api_diario'],
    etiquetas: ['etiquetas'],
    calendario: ['calendario'],
    movimentos: ['movimentos'],
  };

  const getVisibleModules = (role: RolePermission) => {
    return allModules.filter(mod => {
      const mappedMenus = moduleToMenuMapping[mod.id] || [];
      return mappedMenus.some(menuId => role.menus.includes(menuId));
    });
  };

  const handleAddRole = () => {
    const newRole: RolePermission = {
      role: 'Nova Categoria',
      menus: ['dashboard'],
      actions: allModules.reduce((acc, mod) => ({
        ...acc,
        [mod.id]: { read: false, write: false, delete: false }
      }), {})
    };
    const updated = [...structuredPermissions, newRole];
    setStructuredPermissions(updated);
    updateSettings({ ...state.settings, permissions: updated });
    setSelectedRoleIndex(updated.length - 1);
  };

  const handleDeleteRole = (index: number) => {
    setRoleToDelete(index);
  };

  const confirmDeleteRole = () => {
    if (roleToDelete !== null) {
      const updated = structuredPermissions.filter((_, i) => i !== roleToDelete);
      setStructuredPermissions(updated);
      updateSettings({ ...state.settings, permissions: updated });
      if (selectedRoleIndex === roleToDelete) setSelectedRoleIndex(null);
      setRoleToDelete(null);
    }
  };

  const handleUpdateRole = (index: number, updates: Partial<RolePermission>) => {
    const updated = [...structuredPermissions];
    const role = { ...updated[index], ...updates };
    
    // Sanitize actions based on current menus
    const sanitizedActions = { ...role.actions };
    allModules.forEach(mod => {
      const mappedMenus = moduleToMenuMapping[mod.id] || [];
      const isMenuVisible = mappedMenus.some(menuId => role.menus.includes(menuId));
      if (!isMenuVisible) {
        sanitizedActions[mod.id] = { read: false, write: false, delete: false };
      }
    });
    
    role.actions = sanitizedActions;
    updated[index] = role;
    setStructuredPermissions(updated);
    updateSettings({ ...state.settings, permissions: updated });
  };

  const selectAllMenus = (roleIndex: number) => {
    const role = structuredPermissions[roleIndex];
    const allIds = allMenus.map(m => m.id);
    
    // Check if everything is selected (except some strictly internal ones if any)
    const allSelected = allIds.every(id => role.menus.includes(id));
    
    const menus: View[] = allSelected ? ['dashboard' as View] : allIds;
    handleUpdateRole(roleIndex, { menus });
  };

  const selectAllActions = (roleIndex: number) => {
    const role = structuredPermissions[roleIndex];
    const actions = { ...role.actions };
    const visibleModules = getVisibleModules(role);
    
    if (visibleModules.length === 0) return;

    // Check if everything is currently enabled across all visible modules
    const allEnabled = visibleModules.every(mod => 
      actions[mod.id]?.read && actions[mod.id]?.write && actions[mod.id]?.delete
    );

    // Toggle states for visible modules
    visibleModules.forEach(mod => {
      actions[mod.id] = { 
        read: !allEnabled, 
        write: !allEnabled, 
        delete: !allEnabled 
      };
    });
    
    // For non-visible modules, ensure they are false
    allModules.forEach(mod => {
      if (!visibleModules.some(vm => vm.id === mod.id)) {
        actions[mod.id] = { read: false, write: false, delete: false };
      }
    });
    
    handleUpdateRole(roleIndex, { actions });
  };

  const selectAllEverything = (roleIndex: number) => {
    const role = structuredPermissions[roleIndex];
    
    // Check if EVERYTHING is selected
    const allMenuIds = allMenus.map(m => m.id);
    const isAllMenusSelected = allMenuIds.every(id => role.menus.includes(id));
    
    const isAllActionsEnabled = allModules.every(mod => 
      role.actions[mod.id]?.read && role.actions[mod.id]?.write && role.actions[mod.id]?.delete
    );

    const targetState = !(isAllMenusSelected && isAllActionsEnabled);

    // Update Menus
    const menus: View[] = targetState ? allMenuIds : ['dashboard' as View];
    
    // Update Actions
    const actions = { ...role.actions };
    allModules.forEach(mod => {
      actions[mod.id] = { 
        read: targetState, 
        write: targetState, 
        delete: targetState 
      };
    });

    handleUpdateRole(roleIndex, { menus, actions });
  };

  const toggleMenu = (roleIndex: number, menuId: View) => {
    const role = structuredPermissions[roleIndex];
    const menus = role.menus.includes(menuId)
      ? role.menus.filter(m => m !== menuId)
      : [...role.menus, menuId];
    handleUpdateRole(roleIndex, { menus });
  };

  const toggleAction = (roleIndex: number, moduleId: string, action: 'read' | 'write' | 'delete') => {
    const role = structuredPermissions[roleIndex];
    const actions = { ...role.actions };
    if (!actions[moduleId]) {
      actions[moduleId] = { read: false, write: false, delete: false };
    }
    actions[moduleId] = {
      ...actions[moduleId],
      [action]: !actions[moduleId][action]
    };
    handleUpdateRole(roleIndex, { actions });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-app-text flex items-center">
          <Users className="mr-3 text-primary" />
          Gestão de Usuários
        </h1>
        {activeTab === 'usuarios' && hasPermission('usuarios', 'write') && (
          <button 
            onClick={() => handleOpenModal()}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            Novo Usuário
          </button>
        )}
      </div>

      <div className="flex border-b border-app-border mb-6">
        <button
          onClick={() => setActiveTab('usuarios')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'usuarios'
              ? 'text-primary'
              : 'text-app-text-muted hover:text-app-text'
          }`}
        >
          <Users size={18} />
          Usuários
          {activeTab === 'usuarios' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        {isAdmin() && (
          <button
            onClick={() => setActiveTab('permissions')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'permissions'
                ? 'text-primary'
                : 'text-app-text-muted hover:text-app-text'
            }`}
          >
            <ShieldCheck size={18} />
            Permissões
            {activeTab === 'permissions' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        )}
      </div>

      {activeTab === 'usuarios' ? (
        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
          <div className="p-4 border-b border-app-border flex items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted" size={20} />
              <input 
                type="text" 
                placeholder="Buscar por nome, e-mail ou cargo..." 
                className="w-full pl-10 pr-4 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-app-surface text-app-text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-app-bg text-app-text-muted text-sm uppercase tracking-wider">
                  <th className="p-4 font-medium">Nome</th>
                  <th className="p-4 font-medium">Cargo</th>
                  <th className="p-4 font-medium">Escritório</th>
                  <th className="p-4 font-medium">OAB</th>
                  <th className="p-4 font-medium">Contato</th>
                  <th className="p-4 font-medium">Permissão</th>
                  <th className="p-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {filteredUsuarios.map((usuario, index) => (
                  <tr key={`${usuario.id}-${index}`} className="hover:bg-app-secondary/50 transition-colors group">
                    <td className="p-4">
                      <div className="font-medium text-app-text">{usuario.nome}</div>
                      {usuario.cpf && <div className="text-xs text-app-text-muted mt-1">CPF: {usuario.cpf}</div>}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-app-secondary text-app-text">
                        {usuario.cargo || 'Não definido'}
                      </span>
                    </td>
                    <td className="p-4 text-app-text-muted">
                      {usuario.escritoriosIds?.map((id, index) => {
                        const esc = state.escritorios.find(e => e.id === id);
                        return esc ? <span key={`${id}-${index}`}>{index > 0 ? ', ' : ''}{esc.nome}</span> : null;
                      }).filter(Boolean) || '-'}
                    </td>
                    <td className="p-4 text-app-text-muted">{usuario.oab || '-'}</td>
                    <td className="p-4 text-app-text-muted">
                      <div className="space-y-1">
                        {usuario.email && (
                          <div className="flex items-center text-sm">
                            <Mail size={14} className="mr-2 text-app-text-muted" />
                            {usuario.email}
                          </div>
                        )}
                        {usuario.contato && (
                          <div className="flex items-center text-sm">
                            <Phone size={14} className="mr-2 text-app-text-muted" />
                            {usuario.contato}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-app-text-muted">{usuario.permissao || '-'}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end space-x-2">
                        {hasPermission('usuarios', 'write') && (
                          <button 
                            onClick={() => handleOpenModal(usuario)}
                            disabled={!isAdmin() && (usuario.permissao === 'Admin' || usuario.email.toLowerCase() === 'pratadeouro@gmail.com')}
                            className={`text-app-text-muted hover:text-primary transition-colors p-2 rounded-full hover:bg-primary/10 disabled:opacity-30 disabled:cursor-not-allowed`}
                            title={!isAdmin() && (usuario.permissao === 'Admin' || usuario.email.toLowerCase() === 'pratadeouro@gmail.com') ? "Não é possível editar um administrador" : "Editar"}
                          >
                            <Edit2 size={18} />
                          </button>
                        )}
                        {hasPermission('usuarios', 'delete') && (
                          <button 
                            onClick={() => handleDelete(usuario.id)}
                            disabled={!isAdmin() && (usuario.permissao === 'Admin' || usuario.email.toLowerCase() === 'pratadeouro@gmail.com')}
                            className={`text-app-text-muted hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed`}
                            title={!isAdmin() && (usuario.permissao === 'Admin' || usuario.email.toLowerCase() === 'pratadeouro@gmail.com') ? "Não é possível excluir um administrador" : "Excluir"}
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsuarios.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-app-text-muted">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
            <div className="p-4 border-b border-app-border bg-app-secondary flex items-center justify-between">
              <div className="flex items-center">
                <ShieldCheck className="mr-2 text-primary" size={20} />
                <h2 className="font-semibold text-app-text">Categorias de Usuário e Permissões</h2>
              </div>
              <button
                type="button"
                onClick={handleAddRole}
                className="bg-primary hover:opacity-90 text-white px-3 py-1.5 rounded-lg flex items-center text-sm transition-all shadow-sm"
              >
                <Plus size={16} className="mr-1" />
                Nova Categoria
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 min-h-[400px]">
              {/* Sidebar: Categories */}
              <div className="border-r border-app-border bg-app-bg/30">
                <div className="p-2 space-y-1">
                  {structuredPermissions.map((role, idx) => (
                    <div
                      key={`${role.role}-${idx}`}
                      className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                        selectedRoleIndex === idx
                          ? 'bg-primary text-white shadow-md'
                          : 'text-app-text hover:bg-app-secondary'
                      }`}
                      onClick={() => setSelectedRoleIndex(idx)}
                    >
                      <div className="flex items-center overflow-hidden">
                        <ChevronRight size={16} className={`mr-2 transition-transform ${selectedRoleIndex === idx ? 'rotate-90' : ''}`} />
                        <span className="font-medium truncate">{role.role}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const roleToCopy = structuredPermissions[idx];
                            const newRole = { ...roleToCopy, role: `${roleToCopy.role} (Cópia)` };
                            const updated = [...structuredPermissions, newRole];
                            setStructuredPermissions(updated);
                            updateSettings({ ...state.settings, permissions: updated });
                            setSelectedRoleIndex(updated.length - 1);
                          }}
                          className={`p-1 rounded hover:bg-white/20 transition-all ${
                            selectedRoleIndex === idx ? 'text-white' : 'text-primary hover:bg-primary/10'
                          }`}
                          title="Duplicar"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRole(idx);
                          }}
                          className={`p-1 rounded hover:bg-red-500/20 transition-all ${
                            selectedRoleIndex === idx ? 'text-white hover:bg-white/20' : 'text-red-500'
                          }`}
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {structuredPermissions.length === 0 && (
                    <div className="p-8 text-center text-app-text-muted text-sm italic">
                      Nenhuma categoria definida.
                    </div>
                  )}
                </div>
              </div>

              {/* Main Content: Editor */}
              <div className="md:col-span-2 p-6 overflow-y-auto max-h-[600px]">
                {currentRole !== null ? (
                  <div className="space-y-8">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h2 className="text-lg font-bold text-app-text">Editar Permissões: {currentRole.role}</h2>
                        <p className="text-xs text-app-text-muted">Configure o que os usuários desta categoria podem ver e fazer.</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => selectAllEverything(selectedRoleIndex!)}
                          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-sm hover:opacity-90 transition-all flex items-center gap-2"
                        >
                          <ShieldCheck size={16} />
                          Selecionar Tudo (Menus + Ações)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRole(selectedRoleIndex!)}
                          className="px-4 py-2 text-red-500 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all text-sm font-medium"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-sm font-semibold text-app-text">Nome da Categoria</label>
                       <input
                         type="text"
                         className="w-full px-4 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                         value={localRoleName}
                         onChange={(e) => {
                           setLocalRoleName(e.target.value);
                           const updated = [...structuredPermissions];
                           updated[selectedRoleIndex!] = { ...updated[selectedRoleIndex!], role: e.target.value };
                           setStructuredPermissions(updated);
                         }}
                         onBlur={() => {
                           handleUpdateRole(selectedRoleIndex!, { role: localRoleName });
                         }}
                         placeholder="Ex: Advogado Sênior"
                       />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-app-text flex items-center">
                          <ListOrdered size={16} className="mr-2 text-primary" />
                          Menus Visíveis
                        </h3>
                        <button
                          type="button"
                          onClick={() => selectAllMenus(selectedRoleIndex!)}
                          className="text-[10px] font-bold text-primary uppercase hover:underline"
                        >
                          {allMenus.every(m => currentRole.menus.includes(m.id)) ? 'Desmarcar Todos' : 'Selecionar Todos'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {allMenus.map((menu, index) => (
                          <button
                            key={`${menu.id}-${index}`}
                            type="button"
                            onClick={() => toggleMenu(selectedRoleIndex!, menu.id)}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                              currentRole.menus.includes(menu.id)
                                ? 'bg-primary/10 border-primary text-primary shadow-sm'
                                : 'bg-app-bg border-app-border text-app-text-muted hover:border-app-text-muted'
                            }`}
                          >
                            <span className="truncate">{menu.label}</span>
                            {currentRole.menus.includes(menu.id) && <Check size={12} />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-app-text flex items-center">
                          <ShieldCheck size={16} className="mr-2 text-primary" />
                          Ações por Módulo
                        </h3>
                        <button
                          type="button"
                          onClick={() => selectAllActions(selectedRoleIndex!)}
                          className="text-[10px] font-bold text-primary uppercase hover:underline"
                        >
                          {(() => {
                            const visibleModules = allModules.filter(mod => {
                              const mappedMenus = moduleToMenuMapping[mod.id] || [];
                              return mappedMenus.some(menuId => currentRole.menus.includes(menuId));
                            });
                            const allEnabled = visibleModules.length > 0 && visibleModules.every(mod => {
                              const a = currentRole.actions[mod.id];
                              return a?.read && a?.write && a?.delete;
                            });
                            return allEnabled ? 'Remover Todas Ações' : 'Selecionar Todas Ações';
                          })()}
                        </button>
                      </div>
                      <div className="space-y-3">
                        {allModules
                          .filter(module => {
                            const mappedMenus = moduleToMenuMapping[module.id] || [];
                            return mappedMenus.some(menuId => currentRole.menus.includes(menuId));
                          })
                          .map((module, index) => (
                            <div key={`${module.id}-${index}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-app-bg/50 rounded-xl border border-app-border gap-3 animate-fadeIn">
                              <span className="text-sm font-medium text-app-text">{module.label}</span>
                              <div className="flex gap-2">
                                {(['read', 'write', 'delete'] as const).map((action) => (
                                  <button
                                    key={action}
                                    type="button"
                                    onClick={() => toggleAction(selectedRoleIndex!, module.id, action)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-bold border transition-all ${
                                      currentRole.actions[module.id]?.[action]
                                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm'
                                        : 'bg-app-surface border-app-border text-app-text-muted'
                                    }`}
                                  >
                                    {action === 'read' ? 'Ver' : action === 'write' ? 'Editar' : 'Excluir'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        {allModules.filter(module => {
                          const mappedMenus = moduleToMenuMapping[module.id] || [];
                          return mappedMenus.some(menuId => currentRole.menus.includes(menuId));
                        }).length === 0 && (
                          <div className="text-center py-4 bg-app-bg/20 rounded-xl border border-dashed border-app-border">
                            <p className="text-xs text-app-text-muted">Nenhum menu visível selecionado para configurar as ações.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-app-text-muted space-y-4">
                    <ShieldCheck size={48} className="opacity-20" />
                    <p>Selecione uma categoria para editar suas permissões.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Role Confirmation Modal */}
      <Modal
        isOpen={roleToDelete !== null}
        onClose={() => setRoleToDelete(null)}
        title="Excluir Categoria"
      >
        <div className="space-y-4">
          <p className="text-app-text">Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita.</p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setRoleToDelete(null)}
              className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-secondary/50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDeleteRole}
              className="px-4 py-2 text-white bg-red-500 rounded-lg hover:bg-red-500/90 transition-colors shadow-sm"
            >
              Excluir
            </button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingUsuario(null);
        }} 
        title={editingUsuario ? "Editar Usuário" : "Novo Usuário"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-app-text">Nome Completo *</label>
              <input 
                type="text" 
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                placeholder="Ex: João da Silva"
                value={formData.nome}
                onChange={e => setFormData({...formData, nome: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">E-mail</label>
              <input 
                type="email" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                placeholder="Ex: joao@email.com"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Telefone / Contato</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                placeholder="Ex: (11) 99999-9999"
                value={formData.contato}
                onChange={e => setFormData({...formData, contato: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Cargo</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                placeholder="Ex: Advogado"
                value={formData.cargo}
                onChange={e => setFormData({...formData, cargo: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Escritórios de Atuação *</label>
              <div className="max-h-32 overflow-y-auto border border-app-border rounded-lg p-2 space-y-2 bg-app-surface">
                {state.escritorios
                  .filter(esc => isAdmin() || (currentUser?.escritoriosIds || []).includes(esc.id))
                  .map((esc, index) => (
                  <label key={`${esc.id}-${index}`} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-app-border text-primary focus:ring-primary"
                      checked={formData.escritoriosIds.includes(esc.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, escritoriosIds: [...formData.escritoriosIds, esc.id] });
                        } else {
                          setFormData({ ...formData, escritoriosIds: formData.escritoriosIds.filter(id => id !== esc.id) });
                        }
                      }}
                    />
                    <span className="text-sm text-app-text">{esc.nome}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">CPF</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                placeholder="000.000.000-00"
                value={formData.cpf}
                onChange={e => setFormData({...formData, cpf: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">OAB</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                placeholder="Ex: 123456/SP"
                value={formData.oab}
                onChange={e => setFormData({...formData, oab: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Senha</label>
              <input 
                type="password" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                placeholder="Senha de acesso"
                value={formData.senha}
                onChange={e => setFormData({...formData, senha: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Permissão</label>
              <select 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                value={formData.permissao}
                onChange={e => setFormData({...formData, permissao: e.target.value})}
              >
                <option value="">Selecione uma permissão</option>
                {isAdmin() && <option value="Admin">Admin (Acesso Total)</option>}
                {getPermissions().map((p: RolePermission, idx: number) => (
                  <option key={`${p.role}-${idx}`} value={p.role}>
                    {p.role}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="pt-4 flex justify-end space-x-3 border-t border-app-border">
            <button 
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setEditingUsuario(null);
              }}
              className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-secondary/50 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
            >
              {editingUsuario ? "Atualizar Usuário" : "Salvar Usuário"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
