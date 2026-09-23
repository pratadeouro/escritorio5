import React, { useState } from 'react';
import { useAppContext } from '../context';
import { 
  User, 
  Palette, 
  Sun, 
  Moon, 
  Building2, 
  Info, 
  ListOrdered, 
  Save,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Camera,
  Bell,
  Loader2,
  UserCircle,
  GripVertical,
  ArrowUp,
  ArrowDown,
  LayoutDashboard,
  Sparkles,
  Users,
  ClipboardList,
  Server,
  Calendar,
  ListTodo,
  DollarSign,
  FolderOpen,
  Copy,
  Tag,
  Scale,
  Activity,
  FileText,
  Landmark,
  Gavel,
  History,
  TrendingUp
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { View } from '../types';

interface SortableMenuItemProps {
  id: string;
  menu: { id: View; label: string; icon: React.ReactNode };
  index: number;
  total: number;
  onMove: (index: number, direction: 'up' | 'down') => void;
}

function SortableMenuItem({ id, menu, index, total, onMove }: SortableMenuItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`flex items-center justify-between p-3 bg-app-bg hover:bg-app-secondary/50 transition-colors group rounded-xl border border-app-border mb-2 ${isDragging ? 'shadow-lg border-primary/20 ring-1 ring-primary/20 bg-app-surface' : ''}`}
    >
      <div className="flex items-center flex-1">
        <div 
          {...attributes} 
          {...listeners}
          className="p-1.5 mr-2 text-app-text-muted hover:text-primary cursor-grab active:cursor-grabbing rounded transition-colors"
        >
          <GripVertical size={18} />
        </div>
        <div className="p-2 bg-app-surface rounded-lg mr-3 text-app-text-muted group-hover:text-primary transition-colors border border-app-border">
          {menu.icon}
        </div>
        <span className="text-sm font-medium text-app-text">{menu.label}</span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(index, 'up')}
          className="p-1.5 text-app-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-20"
          title="Mover para cima"
        >
          <ArrowUp size={16} />
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={() => onMove(index, 'down')}
          className="p-1.5 text-app-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-20"
          title="Mover para baixo"
        >
          <ArrowDown size={16} />
        </button>
      </div>
    </div>
  );
}

export default function Profile() {
  const { state, updateSettings, currentUser, applyTheme } = useAppContext();
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [formData, setFormData] = useState({
    theme: currentUser?.theme || state.settings.theme || 'light',
    itemsPerPage: currentUser?.itemsPerPage || state.settings.itemsPerPage || 10,
    enableEmailNotifications: currentUser?.enableNotifications ?? state.settings.enableEmailNotifications ?? false,
    fotoUrl: currentUser?.fotoUrl || '',
    nome: currentUser?.nome || '',
    contato: currentUser?.contato || '',
    oab: currentUser?.oab || '',
    cpf: currentUser?.cpf || '',
    menuOrder: currentUser?.menuOrder || state.settings.menuOrder || []
  });

  const allMenuItems: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'ia', label: 'Módulo IA', icon: <Sparkles size={18} /> },
    { id: 'contatos', label: 'Contatos', icon: <Users size={18} /> },
    { id: 'processosAtivos', label: 'Processos Ativos', icon: <ClipboardList size={18} /> },
    { id: 'pendencias', label: 'Pendências', icon: <Server size={18} /> },
    { id: 'eventos', label: 'Eventos', icon: <Calendar size={18} /> },
    { id: 'tarefas', label: 'Tarefas / Prazos', icon: <ListTodo size={18} /> },
    { id: 'financeiro', label: 'Financeiro', icon: <DollarSign size={18} /> },
    { id: 'documentos', label: 'Gerador de Documentos', icon: <FolderOpen size={18} /> },
    { id: 'modelos', label: 'Modelos', icon: <Copy size={18} /> },
    { id: 'djen', label: 'Módulo DJEN', icon: <Bell size={18} /> },
    { id: 'calendario', label: 'Calendário Judicial', icon: <Calendar size={18} /> },
    { id: 'movimentos', label: 'Movimentos', icon: <Activity size={18} /> },
    { id: 'recursos', label: 'Recursos', icon: <FileText size={18} /> },
    { id: 'processosGeral', label: 'Processos Geral', icon: <Scale size={18} /> },
    { id: 'etiquetas', label: 'Etiquetas', icon: <Tag size={18} /> },
    { id: 'usuarios', label: 'Usuários', icon: <Users size={18} /> },
    { id: 'escritorios', label: 'Escritórios', icon: <Building2 size={18} /> },
    { id: 'varas', label: 'Varas', icon: <Building2 size={18} /> },
    { id: 'forum', label: 'Fóruns', icon: <Landmark size={18} /> },
    { id: 'tribunais', label: 'Tribunais', icon: <Landmark size={18} /> },
    { id: 'upj', label: 'UPJ', icon: <Building2 size={18} /> },
    { id: 'julgadores', label: 'Julgadores', icon: <Gavel size={18} /> },
    { id: 'servidores', label: 'Servidores', icon: <Users size={18} /> },
    { id: 'api_diario', label: 'Consulta - DJEN', icon: <FileText size={18} /> },
    { id: 'leads', label: 'Leads', icon: <TrendingUp size={18} /> },
    { id: 'settings', label: 'Configurações', icon: <ListOrdered size={18} /> },
    { id: 'logs', label: 'Logs do Sistema', icon: <History size={18} /> },
  ];

  const currentMenuOrder = React.useMemo(() => {
    const order = formData.menuOrder.length > 0 
      ? [...formData.menuOrder] 
      : allMenuItems.map(m => m.id);
    
    // Ensure new items added to the system appear at the end
    allMenuItems.forEach(item => {
      if (!order.includes(item.id)) {
        order.push(item.id);
      }
    });
    
    return order;
  }, [formData.menuOrder]);

  const handleMoveMenu = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...currentMenuOrder];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex >= 0 && newIndex < newOrder.length) {
      const temp = newOrder[index];
      newOrder[index] = newOrder[newIndex];
      newOrder[newIndex] = temp;
      setFormData({ ...formData, menuOrder: newOrder });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = currentMenuOrder.indexOf(active.id as View);
      const newIndex = currentMenuOrder.indexOf(over.id as View);

      const newOrder = arrayMove(currentMenuOrder, oldIndex, newIndex);
      setFormData({ ...formData, menuOrder: newOrder });
    }
  };

  const handleThemePreview = (theme: 'light' | 'dark' | 'system') => {
    setFormData(prev => ({ ...prev, theme }));
    
    if (applyTheme) {
      // Find active office colors to maintain baseline
      const activeOfficeId = state.escritorios.find(e => e.id === state.settings.idEscritorio)?.id;
      const activeOffice = state.escritorios.find(e => e.id === activeOfficeId);
      
      applyTheme(
        theme,
        activeOffice?.primaryColor || '#4f46e5',
        activeOffice?.backgroundColor || '#ffffff',
        activeOffice?.secondaryColor || '#f8fafc'
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      // In our current architecture, updateSettings handles both global and personal state update
      // by identifying the current user and merging preferences.
      await updateSettings({
        ...state.settings,
        theme: formData.theme as any,
        itemsPerPage: formData.itemsPerPage,
        enableEmailNotifications: formData.enableEmailNotifications,
        menuOrder: formData.menuOrder
      });

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  const initials = formData.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-text flex items-center">
          <UserCircle className="mr-3 text-primary" />
          Minhas Preferências
        </h1>
        {isSaved && (
          <div className="flex items-center text-green-500 font-medium animate-in fade-in slide-in-from-right-2">
            <CheckCircle2 size={18} className="mr-2" />
            Salvo com sucesso!
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-app-surface rounded-2xl shadow-sm border border-app-border overflow-hidden">
            <div className="h-24 bg-gradient-to-br from-primary/20 to-primary/5" />
            <div className="px-6 pb-6 -mt-12 text-center">
              <div className="relative inline-block group">
                <div className="w-24 h-24 rounded-full bg-app-surface p-1 shadow-lg border border-app-border">
                  {formData.fotoUrl ? (
                    <img 
                      src={formData.fotoUrl} 
                      alt="Avatar" 
                      className="w-full h-full rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                      {initials}
                    </div>
                  )}
                </div>
                <button className="absolute bottom-0 right-0 p-2 bg-app-surface border border-app-border rounded-full shadow-md text-app-text-muted hover:text-primary transition-colors">
                  <Camera size={14} />
                </button>
              </div>
              <h2 className="mt-4 text-xl font-bold text-app-text leading-tight">{formData.nome || 'Usuário'}</h2>
              <p className="text-sm text-app-text-muted font-medium">{currentUser?.cargo || 'Colaborador'}</p>
              
              <div className="mt-6 flex flex-col gap-2">
                <div className="flex items-center text-sm text-app-text-muted bg-app-bg/50 px-3 py-2 rounded-lg border border-app-border">
                  <Mail size={14} className="mr-2" />
                  <span className="truncate">{currentUser?.email}</span>
                </div>
                {formData.oab && (
                  <div className="flex items-center text-sm text-app-text-muted bg-app-bg/50 px-3 py-2 rounded-lg border border-app-border">
                    <Building2 size={14} className="mr-2" />
                    <span>OAB: {formData.oab}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-app-surface rounded-2xl p-6 border border-app-border shadow-sm">
            <h3 className="text-sm font-bold text-app-text-muted uppercase tracking-wider mb-4">Informações da Conta</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs text-app-text-muted">CPF</p>
                <p className="text-sm font-medium text-app-text">{formData.cpf || 'Não informado'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-app-text-muted">Contato</p>
                <p className="text-sm font-medium text-app-text">{formData.contato || 'Não informado'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-app-text-muted">Nível de Acesso</p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  {currentUser?.permissao || 'Visualizador'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Preferences Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-app-surface rounded-2xl shadow-sm border border-app-border overflow-hidden">
              <div className="p-4 border-b border-app-border bg-app-secondary flex items-center">
                <Palette className="mr-2 text-primary" size={20} />
                <h2 className="font-semibold text-app-text">Minhas Preferências de Interface</h2>
              </div>
              
              <div className="p-6 space-y-8">
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/20 p-4 rounded-xl flex items-start gap-3">
                  <Info className="text-blue-600 shrink-0" size={20} />
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Estas configurações são exclusivas para sua conta e não afetam outros membros do escritório. 
                    Seu tema preferido sobrescreve o padrão do escritório.
                  </p>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-semibold text-app-text flex items-center gap-2">
                    <Palette size={16} className="text-primary" />
                    Tema do Sistema
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                      type="button"
                      onClick={() => handleThemePreview('light')}
                      className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                        formData.theme === 'light' 
                          ? 'border-primary bg-primary/5 text-primary shadow-sm' 
                          : 'border-app-border bg-app-bg text-app-text-muted hover:border-primary/50'
                      }`}
                    >
                      <Sun size={24} className="mb-2" />
                      <span className="font-medium">Modo Claro</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleThemePreview('dark')}
                      className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                        formData.theme === 'dark' 
                          ? 'border-primary bg-primary/5 text-primary shadow-sm' 
                          : 'border-app-border bg-app-bg text-app-text-muted hover:border-primary/50'
                      }`}
                    >
                      <Moon size={24} className="mb-2" />
                      <span className="font-medium">Modo Escuro</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleThemePreview('system')}
                      className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                        formData.theme === 'system' 
                          ? 'border-primary bg-primary/5 text-primary shadow-sm' 
                          : 'border-app-border bg-app-bg text-app-text-muted hover:border-primary/50'
                      }`}
                    >
                      <Building2 size={24} className="mb-2" />
                      <span className="font-medium">Escritório</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-app-text flex items-center gap-2">
                      <ListOrdered size={16} className="text-primary" />
                      Itens por Página
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      value={formData.itemsPerPage}
                      onChange={e => setFormData({ ...formData, itemsPerPage: parseInt(e.target.value) })}
                    >
                      {[10, 20, 50, 100].map(val => (
                        <option key={val} value={val}>{val} itens</option>
                      ))}
                    </select>
                    <p className="text-xs text-app-text-muted">Ajuste a densidade das tabelas de dados.</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-app-text flex items-center gap-2">
                        <Bell size={16} className="text-primary" />
                        Notificações no E-mail
                      </label>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, enableEmailNotifications: !formData.enableEmailNotifications })}
                        className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${
                          formData.enableEmailNotifications ? 'bg-primary' : 'bg-app-border'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            formData.enableEmailNotifications ? 'translate-x-5.5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-xs text-app-text-muted">Receba resumos e avisos importantes por e-mail.</p>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-app-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-semibold text-app-text flex items-center gap-2">
                        <ListOrdered size={16} className="text-primary" />
                        Personalizar Ordem do Menu
                      </label>
                      <p className="text-xs text-app-text-muted">Arraste os itens para organizar sua barra lateral.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, menuOrder: allMenuItems.map(m => m.id) }))}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Restaurar Padrão
                    </button>
                  </div>

                  <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={currentMenuOrder}
                        strategy={verticalListSortingStrategy}
                      >
                        {currentMenuOrder.map((viewId, index) => {
                          const menu = allMenuItems.find(m => m.id === viewId);
                          if (!menu) return null;
                          return (
                            <SortableMenuItem
                              key={viewId}
                              id={viewId}
                              menu={menu}
                              index={index}
                              total={currentMenuOrder.length}
                              onMove={handleMoveMenu}
                            />
                          );
                        })}
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>
              </div>

              {error && (
                <div className="px-6 py-3 bg-red-500/10 border-y border-red-500/20 text-red-500 text-sm flex items-center gap-2">
                  <AlertTriangle size={16} />
                  {error}
                </div>
              )}

              <div className="p-6 bg-app-secondary/50 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Salvar Preferências
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
