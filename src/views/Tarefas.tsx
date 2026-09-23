import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context';
import { ListTodo, Plus, Search, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Link as LinkIcon, AlertCircle, List, LayoutGrid, Edit2, Eye, Trash2, Gavel, Users, Copy, Settings2, GripVertical, ChevronUp, ChevronDown, Building2, FileText } from 'lucide-react';
import Modal from '../components/Modal';
import Calendar from '../components/Calendar';
import ProcessoSelect from '../components/ProcessoSelect';
import TaskModal from '../components/TaskModal';
import Pagination from '../components/Pagination';
import { Tarefa } from '../types';
import { formatDate } from '../utils/date';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type ModalMode = 'create' | 'edit' | 'view';

function SortableHeader({ id, label, onSort, sortConfig }: { id: string; label: string; onSort: (key: string) => void; sortConfig: { key: string; direction: 'asc' | 'desc' } | null }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <th 
      ref={setNodeRef}
      style={style}
      className="p-2 sm:p-4 font-medium cursor-default group whitespace-nowrap bg-app-secondary"
    >
      <div className="flex items-center gap-2">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-app-text-muted hover:text-app-text transition-colors">
          <GripVertical size={14} />
        </div>
        <div 
          className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors"
          onClick={() => onSort(id)}
        >
          <span>{label}</span>
          {sortConfig?.key === id && (
            <span className="text-primary">
              {sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          )}
        </div>
      </div>
    </th>
  );
}

export default function Tarefas({ filterStatus: initialFilterStatus }: { filterStatus?: string }) {
  const { state, deleteTarefa, escritorioAtivoId, isAdmin, currentUser, setSelectedProcessId, hasPermission } = useAppContext();
  const canWrite = hasPermission('tarefas', 'write');
  const canDelete = hasPermission('tarefas', 'delete');
  const [searchTerm, setSearchTerm] = useState('');
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const defaultCols = [
      'titulo', 'processo', 'vara', 'upj', 'dataInicio', 'dataLimite', 'prazoTipo', 'status', 'prioridade', 'atribuido'
    ];
    const saved = localStorage.getItem('advocacia_tarefas_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.length > 0 ? parsed : defaultCols;
      } catch (e) {
        return defaultCols;
      }
    }
    return defaultCols;
  });

  const toggleColumn = (colId: string) => {
    setColumnOrder(prev => {
      const newOrder = prev.includes(colId)
        ? prev.filter(id => id !== colId)
        : [...prev, colId];
      localStorage.setItem('advocacia_tarefas_columns', JSON.stringify(newOrder));
      return newOrder;
    });
  };

  const columnLabels: Record<string, string> = {
    idTarefa: 'ID Tarefa',
    titulo: 'Tarefa / Título',
    descricao: 'Descrição',
    processo: 'Processo',
    cliente: 'Cliente',
    vara: 'Vara',
    upj: 'UPJ / Secretaria',
    dataInicio: 'Data Início',
    dataLimite: 'Data Limite',
    prazoTipo: 'Tipo de Prazo',
    status: 'Status',
    prioridade: 'Prioridade',
    atribuido: 'Criado por',
    responsavel: 'Responsável',
    pagina: 'Página',
    link: 'Link',
    conclusao: 'Conclusão'
  };
  const [scopeFilter, setScopeFilter] = useState<'usuario' | 'todos'>('usuario');
  const [completionFilter, setCompletionFilter] = useState<'pendentes' | 'concluidos' | 'todos'>('pendentes');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [selectedTarefa, setSelectedTarefa] = useState<Tarefa | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [isVaraViewModalOpen, setIsVaraViewModalOpen] = useState(false);
  const [selectedVaraForView, setSelectedVaraForView] = useState<any>(null);
  const [isContatoViewModalOpen, setIsContatoViewModalOpen] = useState(false);
  const [selectedContatoForView, setSelectedContatoForView] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = state.settings.itemsPerPage || 20;
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem('advocacia_tarefas_columns', JSON.stringify(newOrder));
        return newOrder;
      });
    }
  };

  // Reseta para primeira página ao filtrar
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, scopeFilter, completionFilter]);

  const filteredTarefas = state.tarefas.filter(t => {
    const tEscId = (t.ID_ESCRITORIO || '').toString().trim().toUpperCase();
    const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
    
    // Se há um escritório ativo selecionado, a tarefa DEVE pertencer a ele
    if (activeEscId && tEscId !== activeEscId) return false;
    
    // Se não há um escritório selecionado, ou o usuário não tem acesso ao escritório da tarefa
    if (!isAdmin() && tEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(tEscId)) return false;

    const processoId = t.PROCESSO_ID || t.ID_PROC;
    const varaId = t.VARA_ID || t.ID_VARA;
    const processo = state.processos.find(p => p.id === processoId);
    const vara = state.varas.find(v => v.id === varaId);
    const searchLower = searchTerm.toLowerCase();
    
    const statusVal = t.STATUS || '';
    const titulo = t.TITULO || t.TAREFA || '';
    const matchesSearch = titulo.toLowerCase().includes(searchLower) || 
           statusVal.toLowerCase().includes(searchLower) ||
           (processo?.numero.toLowerCase().includes(searchLower)) ||
           (vara?.nome.toLowerCase().includes(searchLower));
    
    const isCompleted = statusVal.toLowerCase() === 'concluida' || statusVal.toLowerCase() === 'concluída';
    
    const matchesScope = scopeFilter === 'todos' || 
      (t.RESPONSAVEL_ID === currentUser?.id || t.ID_USER === currentUser?.id || t.ID_RESPONSAVEL === currentUser?.id);
      
    const matchesCompletion = completionFilter === 'todos' || 
      (completionFilter === 'pendentes' ? !isCompleted : isCompleted);
    
    return matchesSearch && matchesScope && matchesCompletion;
  });

  const sortedAndFilteredTarefas = useMemo(() => {
    let sortableItems = [...filteredTarefas];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any = '';
        let bValue: any = '';

        const getProcesso = (t: Tarefa) => state.processos.find(p => p.id === (t.PROCESSO_ID || t.ID_PROC));
        const getVara = (t: Tarefa) => state.varas.find(v => v.id === (t.VARA_ID || t.ID_VARA));

        switch (sortConfig.key) {
          case 'idTarefa':
            aValue = a.ID_TAREFA || a.id || '';
            bValue = b.ID_TAREFA || b.id || '';
            break;
          case 'titulo':
            aValue = a.TITULO || a.TAREFA || '';
            bValue = b.TITULO || b.TAREFA || '';
            break;
          case 'descricao':
            aValue = a.DESCRICAO || '';
            bValue = b.DESCRICAO || '';
            break;
          case 'processo':
            const pA = getProcesso(a);
            const pB = getProcesso(b);
            aValue = pA?.numero || a.PROC_NOME || '';
            bValue = pB?.numero || b.PROC_NOME || '';
            break;
          case 'cliente':
            const clA = getProcesso(a)?.clienteId;
            const clB = getProcesso(b)?.clienteId;
            aValue = state.contatos.find(c => c.id === clA)?.nome || '';
            bValue = state.contatos.find(c => c.id === clB)?.nome || '';
            break;
          case 'vara':
            const vA = getVara(a);
            const vB = getVara(b);
            aValue = vA?.nome || a.VARA_NOME || '';
            bValue = vB?.nome || b.VARA_NOME || '';
            break;
          case 'upj':
            aValue = a.UPJ_NOME || '';
            bValue = b.UPJ_NOME || '';
            break;
          case 'dataInicio':
            aValue = a.DATA_CRIACAO || a.PRAZO_IN || '';
            bValue = b.DATA_CRIACAO || b.PRAZO_IN || '';
            break;
          case 'dataLimite':
            aValue = a.DATA_LIMITE || a.PRAZO_FIM || '';
            bValue = b.DATA_LIMITE || b.PRAZO_FIM || '';
            break;
          case 'prazoTipo':
            aValue = a.prazo_tipo || 'Corridos';
            bValue = b.prazo_tipo || 'Corridos';
            break;
          case 'status':
            aValue = a.STATUS || '';
            bValue = b.STATUS || '';
            break;
          case 'prioridade':
            aValue = a.PRIORIDADE || '';
            bValue = b.PRIORIDADE || '';
            break;
          case 'atribuido':
            aValue = state.usuarios.find(u => u.id === a.ATRIBUIDO_ID)?.nome || a.ATRIBUIDO_ID || '';
            bValue = state.usuarios.find(u => u.id === b.ATRIBUIDO_ID)?.nome || b.ATRIBUIDO_ID || '';
            break;
          case 'responsavel':
            const respA = a.RESPONSAVEL_ID || a.ID_RESPONSAVEL;
            const respB = b.RESPONSAVEL_ID || b.ID_RESPONSAVEL;
            aValue = state.usuarios.find(u => u.id === respA)?.nome || respA || '';
            bValue = state.usuarios.find(u => u.id === respB)?.nome || respB || '';
            break;
          case 'pagina':
            aValue = a.PAGINA || '';
            bValue = b.PAGINA || '';
            break;
          case 'link':
            const procLinkA = getProcesso(a)?.link || a.LINK || '';
            const procLinkB = getProcesso(b)?.link || b.LINK || '';
            aValue = procLinkA;
            bValue = procLinkB;
            break;
          case 'conclusao':
            aValue = a.CONCLUSAO || '';
            bValue = b.CONCLUSAO || '';
            break;
          default:
            aValue = '';
            bValue = '';
        }

        if (typeof aValue === 'string') aValue = aValue.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (typeof bValue === 'string') bValue = bValue.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredTarefas, sortConfig, state.processos, state.varas, state.contatos, state.usuarios]);

  const totalPages = Math.ceil(sortedAndFilteredTarefas.length / itemsPerPage);
  const paginatedTarefas = sortedAndFilteredTarefas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleViewVara = (vara: any) => {
    setSelectedVaraForView(vara);
    setIsVaraViewModalOpen(true);
  };

  const handleViewContato = (contato: any) => {
    setSelectedContatoForView(contato);
    setIsContatoViewModalOpen(true);
  };

  const handleOpenModal = (mode: ModalMode, tarefa?: Tarefa) => {
    setModalMode(mode);
    setSelectedTarefa(tarefa || null);
    setIsModalOpen(true);
  };

  const handleDelete = (id_tarefa: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta tarefa?')) {
      deleteTarefa(id_tarefa);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgente': return 'bg-red-600 text-white shadow-sm font-bold';
      case 'alta': return 'bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 border border-red-500/20';
      case 'média': return 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20';
      case 'baixa': return 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20';
      default: return 'bg-app-bg text-app-text-muted border border-app-border';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'concluida':
      case 'concluída': return 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20';
      case 'pendente': return 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20';
      case 'em andamento': return 'bg-primary/10 text-primary dark:bg-primary/20 border border-primary/20';
      case 'aguardando terceiros': return 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-500/20';
      default: return 'bg-app-bg text-app-text-muted border border-app-border';
    }
  };

  const formatCNJ = (numero: string) => {
    const digits = numero.replace(/\D/g, '');
    if (digits.length === 20) {
      return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
    }
    return numero;
  };

  return (
    <>
      <div className="p-2 sm:p-4 md:p-6 w-full h-full flex flex-col space-y-3 sm:space-y-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold text-app-text flex items-center uppercase text-primary">
          <ListTodo className="mr-3 text-primary shrink-0" />
          <span className="truncate">Gestão de Tarefas / Prazos</span>
        </h1>
        {canWrite && (
          <button 
            onClick={() => handleOpenModal('create')}
            className="bg-primary hover:opacity-90 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
          >
            <Plus size={20} className="mr-2" />
            Nova Tarefa
          </button>
        )}
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-app-border flex flex-col xl:flex-row gap-4 items-stretch xl:items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 w-full xl:max-w-md">
            <button 
              id="btn-column-config"
              onClick={() => setIsColumnModalOpen(true)}
              className="p-2 border border-app-border rounded-lg text-app-text-muted hover:text-primary hover:border-primary transition-all bg-app-bg flex items-center justify-center shadow-sm shrink-0"
              title="Configurar Colunas"
            >
              <Settings2 size={20} />
            </button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted" size={20} />
              <input 
                type="text" 
                placeholder="Buscar por descrição, processo, vara ou status..." 
                className="w-full pl-10 pr-4 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            {/* Filtro de Atribuição */}
            <div className="flex bg-app-bg p-1 rounded-lg border border-app-border">
              <button
                type="button"
                onClick={() => setScopeFilter('usuario')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                  scopeFilter === 'usuario'
                    ? 'bg-app-surface text-primary shadow-sm border border-app-border/30'
                    : 'text-app-text-muted hover:text-app-text'
                }`}
              >
                👤 Minhas Tarefas
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('todos')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                  scopeFilter === 'todos'
                    ? 'bg-app-surface text-primary shadow-sm border border-app-border/30'
                    : 'text-app-text-muted hover:text-app-text'
                }`}
              >
                👥 Todas
              </button>
            </div>

            {/* Filtro de Conclusão */}
            <div className="flex bg-app-bg p-1 rounded-lg border border-app-border">
              <button
                type="button"
                onClick={() => setCompletionFilter('pendentes')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                  completionFilter === 'pendentes'
                    ? 'bg-app-surface text-primary shadow-sm border border-app-border/30'
                    : 'text-app-text-muted hover:text-app-text'
                }`}
              >
                ⏳ Pendentes
              </button>
              <button
                type="button"
                onClick={() => setCompletionFilter('concluidos')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                  completionFilter === 'concluidos'
                    ? 'bg-app-surface text-primary shadow-sm border border-app-border/30'
                    : 'text-app-text-muted hover:text-app-text'
                }`}
              >
                ✅ Concluídas
              </button>
              <button
                type="button"
                onClick={() => setCompletionFilter('todos')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                  completionFilter === 'todos'
                    ? 'bg-app-surface text-primary shadow-sm border border-app-border/30'
                    : 'text-app-text-muted hover:text-app-text'
                }`}
              >
                📋 Todas
              </button>
            </div>
          </div>

          <div className="flex bg-app-bg p-1 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-app-surface shadow-sm text-primary' : 'text-app-text-muted hover:text-app-text'}`}
              title="Visualização em Lista"
            >
              <List size={20} />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-md transition-all ${viewMode === 'calendar' ? 'bg-app-surface shadow-sm text-primary' : 'text-app-text-muted hover:text-app-text'}`}
              title="Visualização em Calendário"
            >
              <LayoutGrid size={20} />
            </button>
          </div>
        </div>

        {viewMode === 'list' ? (
          <>
            <div className="overflow-auto flex-1 scrollbar-thin scrollbar-thumb-app-border scrollbar-track-transparent">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <table className="w-full text-left border-collapse min-w-full">
                <thead className="sticky top-0 z-20 bg-app-surface shadow-sm">
                  <tr className="bg-app-secondary text-app-text-muted text-sm uppercase tracking-wider">
                    <SortableContext
                      items={columnOrder}
                      strategy={horizontalListSortingStrategy}
                    >
                      {columnOrder.map(colId => (
                        <SortableHeader 
                          key={colId}
                          id={colId} 
                          label={columnLabels[colId] || colId} 
                          onSort={requestSort} 
                          sortConfig={sortConfig} 
                        />
                      ))}
                    </SortableContext>
                    <th className="px-4 py-3 font-medium text-right sticky right-0 z-20 bg-app-secondary shadow-[-4px_0_8px_rgba(0,0,0,0.05)] hidden sm:table-cell">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                {paginatedTarefas.map((tarefa, index) => {
                  const processoId = tarefa.PROCESSO_ID || tarefa.ID_PROC;
                  const varaId = tarefa.VARA_ID || tarefa.ID_VARA;
                  const processo = state.processos.find(p => p.id === processoId);
                  const vara = state.varas.find(v => v.id === (processo?.varaId || varaId));
                  const upj = state.upj.find(u => u.id === vara?.secretaria);
                  const displayVara = vara?.nome || tarefa.VARA_NOME || tarefa['VARA.NOME'] || 'Vara não vinculada';
                  const displayUPJ = upj?.nome || (vara as any)?.UPJ || (vara as any)?.UPJ_NOME || tarefa.UPJ_NOME;
                  const procLink = processo?.link || tarefa.LINK;
                  const titulo = tarefa.TITULO || tarefa.TAREFA || '-';
                  const procNome = processo?.numero || tarefa.PROC_NOME || tarefa['PROC.NOME'] || '';
                  
                  return (
                    <tr 
                      key={`${tarefa.ID_TAREFA || index}-${index}`} 
                      className={`hover:bg-app-bg transition-colors group cursor-pointer`}
                      onClick={() => handleOpenModal('view', tarefa)}
                    >
                      {columnOrder.map(colId => {
                        switch (colId) {
                          case 'idTarefa':
                            return (
                              <td key={colId} className="p-2 sm:p-4 font-mono text-xs text-app-text-muted">
                                {tarefa.ID_TAREFA || tarefa.id || '-'}
                              </td>
                            );
                          case 'titulo':
                            return (
                              <td key={colId} className="p-2 sm:p-4">
                                <div className="font-medium text-app-text max-w-md truncate" title={titulo}>
                                  {titulo}
                                </div>
                              </td>
                            );
                          case 'descricao':
                            return (
                              <td key={colId} className="p-2 sm:p-4 text-sm text-app-text-muted max-w-xs truncate" title={tarefa.DESCRICAO}>
                                {tarefa.DESCRICAO || '-'}
                              </td>
                            );
                          case 'processo':
                            return (
                              <td key={colId} className="p-2 sm:p-4">
                                <div className="flex flex-col gap-0.5 mt-1">
                                  <div 
                                    className="text-[10px] sm:text-xs text-app-text-muted flex items-center hover:text-primary transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-center" onClick={(e) => {
                                      if (processo) {
                                        e.stopPropagation();
                                        setSelectedProcessId(processo.id);
                                        window.dispatchEvent(new CustomEvent('navigate', { detail: 'processosAtivos' }));
                                      }
                                    }}>
                                      <AlertCircle size={10} className="mr-1 sm:size-3" />
                                      <span className="truncate font-mono">{formatCNJ(procNome) || 'Não vinculado'}</span>
                                    </div>
                                    {procNome && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(procNome);
                                        }}
                                        className="ml-1.5 p-0.5 hover:bg-primary/10 rounded transition-colors text-app-text-muted hover:text-primary"
                                        title="Copiar número"
                                      >
                                        <Copy size={10} className="sm:size-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </td>
                            );
                          case 'cliente':
                            const cliente = processo?.clienteId ? state.contatos.find(c => c.id === processo.clienteId) : null;
                            return (
                              <td key={colId} className="p-2 sm:p-4 text-xs font-bold text-primary max-w-xs truncate uppercase tracking-tight">
                                {cliente ? (
                                  <div 
                                    className="hover:underline cursor-pointer flex items-center"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewContato(cliente);
                                    }}
                                  >
                                    <Users size={10} className="mr-1 sm:size-3 text-app-text-muted" />
                                    <span className="truncate">{cliente.nome}</span>
                                  </div>
                                ) : (
                                  <span className="text-app-text-muted font-normal">-</span>
                                )}
                              </td>
                            );
                          case 'vara':
                            return (
                              <td key={colId} className="p-2 sm:p-4 text-sm font-medium text-app-text">
                                {vara ? (
                                  <div 
                                    className="hover:text-primary hover:underline cursor-pointer transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewVara(vara);
                                    }}
                                  >
                                    {displayVara}
                                  </div>
                                ) : (
                                  <span>{displayVara}</span>
                                )}
                              </td>
                            );
                          case 'upj':
                            return (
                              <td key={colId} className="p-2 sm:p-4 text-xs text-app-text-muted">
                                {displayUPJ || '-'}
                              </td>
                            );
                          case 'dataInicio':
                            return (
                              <td key={colId} className="p-2 sm:p-4 text-sm text-app-text-muted">
                                {(tarefa.DATA_CRIACAO || tarefa.PRAZO_IN) ? formatDate(tarefa.DATA_CRIACAO || tarefa.PRAZO_IN) : '-'}
                              </td>
                            );
                          case 'dataLimite':
                            return (
                              <td key={colId} className="p-2 sm:p-4 text-sm font-medium text-app-text">
                                {(tarefa.DATA_LIMITE || tarefa.PRAZO_FIM) ? formatDate(tarefa.DATA_LIMITE || tarefa.PRAZO_FIM) : '-'}
                              </td>
                            );
                          case 'prazoTipo':
                            return (
                              <td key={colId} className="p-2 sm:p-4 text-sm font-medium text-app-text uppercase tracking-wider">
                                {tarefa.prazo_tipo || 'Corridos'}
                              </td>
                            );
                          case 'status':
                            return (
                              <td key={colId} className="p-2 sm:p-4">
                                <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold leading-none ${getStatusColor(tarefa.STATUS)}`}>
                                  {(tarefa.STATUS || 'Pendente').toUpperCase()}
                                </span>
                              </td>
                            );
                          case 'prioridade':
                            return (
                              <td key={colId} className="p-2 sm:p-4">
                                <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold leading-none ${getPriorityColor(tarefa.PRIORIDADE)}`}>
                                  {(tarefa.PRIORIDADE || 'Normal').toUpperCase()}
                                </span>
                              </td>
                            );
                          case 'atribuido':
                            const criador = state.usuarios.find(u => u.id === tarefa.ATRIBUIDO_ID);
                            return (
                              <td key={colId} className="p-2 sm:p-4 text-sm text-app-text-muted">
                                {criador?.nome || tarefa.ATRIBUIDO_ID || '-'}
                              </td>
                            );
                          case 'responsavel':
                            const respId = tarefa.RESPONSAVEL_ID || tarefa.ID_RESPONSAVEL;
                            const respUser = state.usuarios.find(u => u.id === respId);
                            return (
                              <td key={colId} className="p-2 sm:p-4 text-sm text-app-text-muted">
                                {respUser?.nome || respId || '-'}
                              </td>
                            );
                          case 'pagina':
                            return (
                              <td key={colId} className="p-2 sm:p-4 text-sm text-app-text-muted">
                                {tarefa.PAGINA || '-'}
                              </td>
                            );
                          case 'link':
                            return (
                              <td key={colId} className="p-2 sm:p-4">
                                {procLink ? (
                                  <a 
                                    href={procLink} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary hover:text-primary/80 transition-colors p-1 inline-block"
                                    onClick={(e) => e.stopPropagation()}
                                    title="Acessar Link"
                                  >
                                    <LinkIcon size={16} />
                                  </a>
                                ) : '-'}
                              </td>
                            );
                          case 'conclusao':
                            return (
                              <td key={colId} className="p-2 sm:p-4 text-sm text-app-text-muted">
                                {tarefa.CONCLUSAO ? formatDate(tarefa.CONCLUSAO) : '-'}
                              </td>
                            );
                          default:
                            return <td key={colId} className="p-2 sm:p-4">-</td>;
                        }
                      })}
                      <td className="px-4 py-3 text-right sticky right-0 z-10 bg-app-surface group-hover:bg-app-bg transition-colors shadow-[-4px_0_8px_rgba(0,0,0,0.05)] hidden sm:table-cell">
                        <div className="flex justify-end space-x-2">
                          {procLink && (
                            <a 
                              href={procLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80 transition-colors p-2 rounded-full hover:bg-primary/10"
                              onClick={(e) => e.stopPropagation()}
                              title="Acessar Processo"
                            >
                              <LinkIcon size={18} />
                            </a>
                          )}
                          {(canWrite || (currentUser?.id && (tarefa.ID_USER === currentUser.id || tarefa.RESPONSAVEL_ID === currentUser.id))) && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleOpenModal('edit', tarefa); }}
                              className="text-app-text-muted hover:text-primary transition-colors p-2 rounded-full hover:bg-app-bg"
                              title="Editar"
                            >
                              <Edit2 size={18} />
                            </button>
                          )}
                          {(canDelete || (currentUser?.id && tarefa.ID_USER === currentUser.id)) && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDelete(tarefa.ID_TAREFA); }}
                              className="text-app-text-muted hover:text-red-600 transition-colors p-2 rounded-full hover:bg-app-bg"
                              title="Excluir"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paginatedTarefas.length === 0 && (
                  <tr>
                    <td colSpan={columnOrder.length + 1} className="p-8 text-center text-app-text-muted">
                      Nenhuma tarefa encontrada.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
          </DndContext>
        </div>

        {/* Paginação */}
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={sortedAndFilteredTarefas.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          label="tarefas"
        />
      </>
    ) : (
      <div className="p-4 overflow-auto flex-1 scrollbar-thin scrollbar-thumb-app-border scrollbar-track-transparent">
            <Calendar 
              events={filteredTarefas.map(t => {
                const prazo_in = t.DATA_CRIACAO || t.PRAZO_IN;
                const prazo_fim = t.DATA_LIMITE || t.PRAZO_FIM;
                const titulo = t.TITULO || t.TAREFA || '';
                return {
                  id: t.ID_TAREFA,
                  startDate: prazo_in,
                  endDate: prazo_fim,
                  title: titulo,
                  color: t.PRIORIDADE === 'Alta' ? 'bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 border-red-500/20 dark:border-red-500/30' :
                         t.PRIORIDADE === 'Média' ? 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/30' :
                         'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30'
                };
              })}
              onEventClick={(id) => {
                const tarefa = state.tarefas.find(t => t.ID_TAREFA === id);
                if (tarefa) handleOpenModal('view', tarefa);
              }}
            />
          </div>
        )}
      </div>
    </div>

      <TaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        mode={modalMode} 
        tarefa={selectedTarefa}
      />

      <Modal 
        isOpen={isVaraViewModalOpen} 
        onClose={() => setIsVaraViewModalOpen(false)} 
        title="Visualizar Vara"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-app-text-muted uppercase">Nome da Vara</label>
              <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text font-bold">
                {selectedVaraForView?.nome || '-'}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text-muted uppercase">Tribunal</label>
              <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text flex items-center gap-2 font-medium">
                <Building2 size={15} className="text-app-text-muted shrink-0" />
                <span>
                  {(() => {
                    const v = selectedVaraForView;
                    if (!v) return '-';
                    if (v.idTj) {
                      const t = state.tribunais.find(tr => tr.id === v.idTj || tr.id.toLowerCase() === v.idTj?.toLowerCase());
                      if (t) return t.sigla ? `${t.sigla} - ${t.nome}` : t.nome;
                    }
                    if (v.forum) {
                      const forumObj = state.forums.find(f => f.id === v.forum || f.nome === v.forum);
                      if (forumObj && forumObj.tribunalId) {
                        const t = state.tribunais.find(tr => tr.id === forumObj.tribunalId || tr.id.toLowerCase() === forumObj.tribunalId?.toLowerCase());
                        if (t) return t.sigla ? `${t.sigla} - ${t.nome}` : t.nome;
                      }
                      const tDirect = state.tribunais.find(tr => tr.id === v.forum || tr.id.toLowerCase() === v.forum?.toLowerCase());
                      if (tDirect) return tDirect.sigla ? `${tDirect.sigla} - ${tDirect.nome}` : tDirect.nome;
                    }
                    return '-';
                  })()}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text-muted uppercase">Fórum</label>
              <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text">
                {state.forums.find(f => f.id === selectedVaraForView?.forum)?.nome || state.tribunais.find(f => f.id === selectedVaraForView?.forum)?.nome || selectedVaraForView?.forum || '-'}
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-app-text-muted uppercase">Quantidade de Processos</label>
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 text-primary font-bold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-primary shrink-0" />
                  <span>
                    {(() => {
                      if (!selectedVaraForView?.id) return '0 processos';
                      const count = state.processos.filter(p => (p.varaId || p.tribunal) === selectedVaraForView.id).length;
                      return `${count} processo${count === 1 ? '' : 's'}`;
                    })()}
                  </span>
                </div>
                <span className="text-xs px-2.5 py-1 bg-primary/10 rounded-full font-semibold">
                  Cadastrados na Vara
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text-muted uppercase">Localização</label>
              <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text">
                {selectedVaraForView?.localizacao || '-'}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text-muted uppercase"> Telefone / WhatsApp</label>
              <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text">
                {selectedVaraForView?.telefone || '-'}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text-muted uppercase">E-mail</label>
              <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-primary font-medium">
                {selectedVaraForView?.email || '-'}
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-app-text-muted uppercase">Balcão Virtual</label>
              <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-primary font-medium truncate">
                {selectedVaraForView?.balcaoVirtual ? (
                  <a href={selectedVaraForView.balcaoVirtual} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {selectedVaraForView.balcaoVirtual}
                  </a>
                ) : '-'}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text-muted uppercase">Juiz Titular</label>
              <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text flex items-center gap-2">
                <Gavel size={14} className="text-app-text-muted" />
                {state.julgadores.find(j => j.id === selectedVaraForView?.juiz)?.nome || selectedVaraForView?.juiz || '-'}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text-muted uppercase">Juiz Acumulando</label>
              <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text flex items-center gap-2">
                <Gavel size={14} className="text-app-text-muted" />
                {state.julgadores.find(j => j.id === selectedVaraForView?.juiz_2)?.nome || selectedVaraForView?.juiz_2 || '-'}
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-app-text-muted uppercase">Secretaria (UPJ)</label>
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 text-primary font-bold">
                {state.upj.find(u => u.id === selectedVaraForView?.secretaria)?.nome || '-'}
              </div>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-app-text-muted uppercase">Servidores Associados</label>
              <div className="border border-app-border rounded-lg p-3 bg-app-secondary/10 min-h-[60px] flex flex-wrap gap-2">
                {selectedVaraForView?.id_servidores && selectedVaraForView.id_servidores.length > 0 ? (
                  selectedVaraForView.id_servidores.map((sid: string) => {
                    const s = state.servidores.find(srv => srv.id === sid);
                    if (!s) return null;
                    return (
                      <div key={sid} className="px-3 py-1 bg-app-surface border border-app-border rounded-lg flex flex-col">
                        <span className="text-xs font-bold text-app-text">{s.nome}</span>
                        {s.cargo && <span className="text-[10px] text-app-text-muted">{s.cargo}</span>}
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center w-full py-4 text-app-text-muted text-xs italic">
                    <Users size={20} className="mb-1 opacity-20" />
                    Nenhum servidor associado.
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="pt-4 flex justify-end">
            <button 
              onClick={() => setIsVaraViewModalOpen(false)}
              className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:opacity-90 transition-all shadow-md active:scale-95"
            >
              Fechar
            </button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isContatoViewModalOpen} 
        onClose={() => setIsContatoViewModalOpen(false)} 
        title="Visualizar Cliente"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-app-text-muted uppercase">Nome Completo</label>
              <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text font-bold">
                {selectedContatoForView?.nome}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text-muted uppercase">Tipo</label>
              <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text">
                {selectedContatoForView?.tipo || '-'}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text-muted uppercase">CPF / CNPJ</label>
              <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text">
                {selectedContatoForView?.cpfCnpj || '-'}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text-muted uppercase">Telefone</label>
              <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text font-medium">
                {selectedContatoForView?.telefone || '-'}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text-muted uppercase">E-mail</label>
              <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-primary font-medium">
                {selectedContatoForView?.email || '-'}
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-app-text-muted uppercase">Endereço</label>
              <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text">
                {selectedContatoForView?.endereco || '-'}
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-app-text-muted uppercase">Observações</label>
              <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text min-h-[60px]">
                {selectedContatoForView?.observacoes || '-'}
              </div>
            </div>
          </div>
          <div className="pt-4 flex justify-end">
            <button 
              onClick={() => setIsContatoViewModalOpen(false)}
              className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:opacity-90 transition-all shadow-md active:scale-95"
            >
              Fechar
            </button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isColumnModalOpen} 
        onClose={() => setIsColumnModalOpen(false)} 
        title="Configurar Visualização de Colunas"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-app-text-muted">
            Selecione as colunas que deseja exibir na tabela de tarefas.
          </p>
          <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {Object.entries(columnLabels).map(([id, label]) => (
              <label 
                key={id} 
                className="flex items-center p-3 rounded-lg border border-app-border bg-app-secondary/30 hover:bg-app-secondary transition-colors cursor-pointer group"
              >
                <div className="relative flex items-center">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded border-app-border text-primary focus:ring-primary bg-app-surface transition-all cursor-pointer"
                    checked={columnOrder.includes(id)}
                    onChange={() => toggleColumn(id)}
                  />
                </div>
                <span className="ml-3 text-sm font-medium text-app-text group-hover:text-primary transition-colors">
                  {label}
                </span>
              </label>
            ))}
          </div>
          <div className="pt-4 border-t border-app-border flex justify-end">
            <button 
              onClick={() => setIsColumnModalOpen(false)}
              className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:opacity-90 transition-all shadow-md active:scale-95"
            >
              Concluído
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
