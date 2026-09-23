import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context';
import { Scale, Folder, Plus, Search, ChevronRight, Edit2, Trash2, Eye, X, History, DollarSign, GripVertical, UserPlus, ListTodo, Calendar, CalendarPlus, Link as LinkIcon, Settings2, ChevronLeft, Building2, Gavel, Users, Copy, Check, BarChart2, ChevronUp, ChevronDown, Tag, AlertCircle, FileText, Info } from 'lucide-react';
import Modal from '../components/Modal';
import TaskModal from '../components/TaskModal';
import VaraStatsModal from '../components/VaraStatsModal';
import { Processo, Vara } from '../types';
import { generateId } from '../services/googleSheets';
import { formatDate, calculateDeadline, getTribunalHolidays, formatDateTime } from '../utils/date';
import { CreateContatoModal, CreateVaraModal, CreateEventoModal } from '../components/CreateModals';
import Pagination from '../components/Pagination';
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

interface ProcessosProps {
  filterStatus?: 'Ativo' | 'Inativo';
  filterTag?: string;
  filterMorosidade?: boolean;
  hideTitle?: boolean;
  filterInstancia?: string;
  defaultInstancia?: string;
  customTitle?: string;
  containerClassName?: string;
}

type ModalMode = 'create' | 'edit' | 'view';

const ProcessTitleHeader = ({ 
  numero, 
  titulo, 
  prefix,
  currentIndex,
  totalItems,
  onPrev,
  onNext,
  hasPrev,
  hasNext
}: { 
  numero?: string; 
  titulo?: string; 
  prefix?: string;
  currentIndex?: number;
  totalItems?: number;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}) => {
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedNum, setCopiedNum] = useState(false);
  const [copiedTitle, setCopiedTitle] = useState(false);

  const handleCopyAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const parts = [numero, titulo].filter(Boolean);
      const textToCopy = parts.join(' - ').trim();
      await navigator.clipboard.writeText(textToCopy);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const handleCopyNum = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!numero) return;
    try {
      await navigator.clipboard.writeText(numero);
      setCopiedNum(true);
      setTimeout(() => setCopiedNum(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar número:', err);
    }
  };

  const handleCopyTitle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!titulo) return;
    try {
      await navigator.clipboard.writeText(titulo);
      setCopiedTitle(true);
      setTimeout(() => setCopiedTitle(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar título:', err);
    }
  };

  const showNav = onPrev && onNext && totalItems !== undefined && totalItems > 0 && currentIndex !== undefined && currentIndex >= 0;

  return (
    <div className="flex flex-col gap-2 w-full min-w-0 max-w-full text-app-text select-text">
      <div className="flex items-start justify-between gap-3 w-full min-w-0 max-w-full">
        <div className="flex flex-col gap-1 min-w-0 flex-1 break-words">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {prefix && (
              <span className="text-primary font-bold text-xs sm:text-sm uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded border border-primary/20 shrink-0">
                {prefix}
              </span>
            )}
            {numero ? (
              <div className="inline-flex items-center gap-1 bg-app-bg px-2 py-0.5 rounded border border-app-border shrink-0 max-w-full">
                <span className="text-app-text font-bold text-xs sm:text-sm md:text-base font-mono tracking-tight break-all select-all">
                  {numero}
                </span>
                <button
                  onClick={handleCopyNum}
                  type="button"
                  className="p-1 rounded text-app-text-muted hover:text-primary hover:bg-app-surface transition-colors shrink-0"
                  title="Copiar apenas o número do processo"
                >
                  {copiedNum ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </button>
              </div>
            ) : null}
          </div>
          <div className="flex items-start gap-2 text-sm sm:text-base md:text-lg font-medium text-app-text break-words whitespace-normal leading-snug">
            <span className="flex-1 min-w-0">{titulo || 'Sem Título'}</span>
            {titulo ? (
              <button
                onClick={handleCopyTitle}
                type="button"
                className="p-1 rounded text-app-text-muted hover:text-primary hover:bg-app-bg transition-colors shrink-0 mt-0.5"
                title="Copiar apenas o título"
              >
                {copiedTitle ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          <button
            onClick={handleCopyAll}
            type="button"
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-app-text bg-app-bg hover:bg-primary hover:text-white border border-app-border hover:border-primary transition-all shrink-0 flex items-center gap-1.5 shadow-sm"
            title="Copiar número e título do processo"
          >
            {copiedAll ? (
              <>
                <Check size={14} className="text-emerald-500" />
                <span className="hidden sm:inline text-emerald-500">Copiado!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span className="hidden sm:inline">Copiar Tudo</span>
              </>
            )}
          </button>
        </div>
      </div>

      {showNav && (
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-app-border/40 text-xs text-app-text-muted select-none">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-app-text">Processo {currentIndex + 1}</span> de {totalItems}
            <span className="hidden sm:inline-block text-[11px] opacity-75 ml-2">(Use as setas ← e → do teclado para navegar)</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onPrev}
              disabled={!hasPrev}
              className="px-2 py-1 rounded bg-app-bg hover:bg-app-surface disabled:opacity-30 disabled:cursor-not-allowed border border-app-border flex items-center gap-1 text-app-text hover:text-primary transition-all font-medium"
              title="Processo Anterior (Seta Esquerda)"
            >
              <ChevronLeft size={14} />
              <span className="hidden sm:inline">Anterior</span>
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!hasNext}
              className="px-2 py-1 rounded bg-app-bg hover:bg-app-surface disabled:opacity-30 disabled:cursor-not-allowed border border-app-border flex items-center gap-1 text-app-text hover:text-primary transition-all font-medium"
              title="Próximo Processo (Seta Direita)"
            >
              <span className="hidden sm:inline">Próximo</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

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

  const isHiddenOnMobile = ['idProc', 'tipo', 'valorCausa', 'instancia', 'classe', 'assunto', 'distribuicao', 'resultado', 'ultimoMov', 'link', 'tags', 'pasta'].includes(id);
  const isHiddenOnXs = ['escritorio', 'status', 'varaForum'].includes(id);
  
  const responsiveClass = isHiddenOnMobile 
    ? 'hidden md:table-cell' 
    : isHiddenOnXs 
      ? 'hidden sm:table-cell' 
      : '';

  return (
    <th 
      ref={setNodeRef}
      style={style}
      className={`px-4 py-3 font-medium cursor-default group whitespace-nowrap bg-app-secondary ${responsiveClass}`}
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

export default function Processos({ 
  filterStatus, 
  filterTag, 
  filterMorosidade, 
  hideTitle,
  filterInstancia,
  defaultInstancia,
  customTitle,
  containerClassName
}: ProcessosProps) {
  const { 
    state, 
    addProcesso, 
    updateProcesso, 
    deleteProcesso, 
    addContato, 
    updateContato,
    addMovimento, 
    setSelectedProcessId, 
    hasPermission, 
    escritorioAtivoId, 
    isAdmin, 
    currentUser,
    addEnvolvimento,
    updateEnvolvimento,
    deleteEnvolvimento,
    updateMovimento,
    deleteMovimento,
    addTarefa,
    updateTarefa,
    deleteTarefa,
    addEvento,
    updateEvento,
    deleteEvento,
    addTransacao,
    updateTransacao,
    deleteTransacao
  } = useAppContext();
  const isGlobalAdmin = isAdmin() && (escritorioAtivoId === "" || !escritorioAtivoId);
  const [searchTerm, setSearchTerm] = useState('');
  const [internalStatusFilter, setInternalStatusFilter] = useState<'Todos' | 'Ativo' | 'Inativo'>('Todos');
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const tagDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setIsTagDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [selectedProcesso, setSelectedProcesso] = useState<Processo | null>(null);
  const [selectedContactToAdd, setSelectedContactToAdd] = useState('');
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [selectedTipoEnvolvimento, setSelectedTipoEnvolvimento] = useState('');
  const [editingEnvolvidoContactId, setEditingEnvolvidoContactId] = useState<string | null>(null);
  const [editingTipoEnvolvimento, setEditingTipoEnvolvimento] = useState<string>('');
  const [showContactResults, setShowContactResults] = useState(false);
  const [isMovimentosModalOpen, setIsMovimentosModalOpen] = useState(false);
  const [isTarefasModalOpen, setIsTarefasModalOpen] = useState(false);
  const [isNewContactModalOpen, setIsNewContactModalOpen] = useState(false);
  const [isAddMovimentoModalOpen, setIsAddMovimentoModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskModalMode, setTaskModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedTarefaForModal, setSelectedTarefaForModal] = useState<any>(null);
  const [isNewVaraModalOpen, setIsNewVaraModalOpen] = useState(false);
  const [isNewEventoModalOpen, setIsNewEventoModalOpen] = useState(false);
  const [initialEventoData, setInitialEventoData] = useState<any>(null);
  const [isVaraViewModalOpen, setIsVaraViewModalOpen] = useState(false);
  const [selectedVaraForView, setSelectedVaraForView] = useState<any>(null);
  const [isContatoViewModalOpen, setIsContatoViewModalOpen] = useState(false);
  const [selectedContatoForView, setSelectedContatoForView] = useState<any>(null);
  const [isEditingContato, setIsEditingContato] = useState(false);
  const [editContatoFormData, setEditContatoFormData] = useState<any>(null);
  const [varaSearch, setVaraSearch] = useState('');
  const [showVaraResults, setShowVaraResults] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientResults, setShowClientResults] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [isFinanceiroModalOpen, setIsFinanceiroModalOpen] = useState(false);
  const [financeiroFormData, setFinanceiroFormData] = useState({
    id: '',
    tipo: 'Receita' as 'Receita' | 'Despesa',
    valor: 0,
    data: new Date().toISOString().split('T')[0],
    descricao: '',
    status: 'Pendente' as 'Pago' | 'Pendente',
    observacoes: '',
    usuarioId: '',
    escritorioId: '',
    processoId: '',
    clienteId: '',
    contatoId: '',
    mode: 'create' as 'create' | 'edit'
  });
  const [movimentoFormData, setMovimentoFormData] = useState({
    id: '',
    data: new Date().toISOString().split('T')[0],
    descricao: '',
    pagina: '',
    usuarioId: '',
    escritorioId: '',
    mode: 'create' as 'create' | 'edit'
  });
  const [novoContato, setNovoContato] = useState({
    nome: '',
    tipo: 'Cliente' as const,
    email: '',
    telefone: '',
    cpfCnpj: '',
    escritorioId: escritorioAtivoId || ''
  });
  const [isVaraStatsModalOpen, setIsVaraStatsModalOpen] = useState(false);
  const [varaForStats, setVaraForStats] = useState<Vara | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleShowVaraStats = () => {
    const varaId = formData.varaId || selectedProcesso?.varaId || selectedProcesso?.tribunal;
    const vara = state.varas.find(v => v.id === varaId);
    if (vara) {
      setVaraForStats(vara);
      setIsVaraStatsModalOpen(true);
    }
  };
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, internalStatusFilter, filterTag, filterMorosidade, escritorioAtivoId]);

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const defaultCols = [
      'idProc', 'tipo', 'titulo', 'numero', 'instancia', 'cliente', 'escritorio', 'varaForum', 'classe', 'assunto', 'valorCausa', 'distribuicao', 'resultado', 'status', 'ultimoMov', 'link', 'tags', 'pasta'
    ];
    const saved = localStorage.getItem('advocacia_processos_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Filtra colunas indesejadas (mantendo ultimoMov se o usuário quiser agora)
        const filtered = parsed.filter((col: string) => 
          !['movimentacao', 'MOVIMENTACAO', 'MOVIMENTAÇÃO', 'Movimentação'].includes(col)
        );
        return filtered.length > 0 ? filtered : defaultCols;
      } catch (e) {
        return defaultCols;
      }
    }
    return defaultCols;
  });

  // Limpeza extra para garantir que colunas antigas sejam removidas do localStorage
  // E que a nova coluna 'ultimoMov' seja adicionada para usuários existentes
  useEffect(() => {
    const saved = localStorage.getItem('advocacia_processos_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        let filtered = parsed.filter((col: string) => 
          !['movimentacao', 'MOVIMENTACAO', 'MOVIMENTAÇÃO', 'Movimentação'].includes(col)
        );
        
        const columnAddedKey = 'advocacia_ultimo_mov_added_v2';
        const alreadyAdded = localStorage.getItem(columnAddedKey);

        if (!filtered.includes('ultimoMov') && !alreadyAdded) {
          // Tenta inserir após o status ou no final
          const statusIdx = filtered.indexOf('status');
          if (statusIdx !== -1) {
            filtered.splice(statusIdx + 1, 0, 'ultimoMov');
          } else {
            filtered.push('ultimoMov');
          }
          localStorage.setItem(columnAddedKey, 'true');
        }

        if (filtered.length !== parsed.length || (filtered.includes('ultimoMov') && !parsed.includes('ultimoMov'))) {
          localStorage.setItem('advocacia_processos_columns', JSON.stringify(filtered));
          setColumnOrder(filtered);
        }
      } catch (e) {}
    }
  }, []);

  const columnLabels: Record<string, string> = {
    idProc: 'ID PROC',
    tipo: 'TIPO',
    titulo: 'Título',
    numero: 'Número',
    instancia: 'Instância',
    cliente: 'ID Cliente',
    escritorio: 'Escritório',
    varaForum: 'Vara / Fórum',
    classe: 'Classe',
    assunto: 'Assunto',
    valorCausa: 'Valor da Causa',
    distribuicao: 'Distribuição',
    resultado: 'Resultado',
    status: 'Ativo',
    ultimoMov: 'Último Mov',
    link: 'Link',
    tags: 'Tags',
    pasta: 'Pasta',
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
        localStorage.setItem('advocacia_processos_columns', JSON.stringify(newOrder));
        return newOrder;
      });
    }
  };

  const itemsPerPage = state.settings.itemsPerPage || 10;

  const [formData, setFormData] = useState({
    numero: '',
    clienteId: '',
    parteContraria: '',
    tribunal: '',
    status: 'Ativo' as 'Ativo' | 'Inativo',
    dataDistribuicao: new Date().toISOString().split('T')[0],
    idProc: '',
    tipo: '',
    titulo: '',
    instancia: '',
    varaId: '',
    classe: '',
    assunto: '',
    valorCausa: 0,
    resultado: '',
    ativo: '',
    link: '',
    tags: '',
    pasta: '',
    escritorioId: '',
    envolvidosIds: [] as string[]
  });

  const [formError, setFormError] = useState<string | null>(null);

  const getUltimoMovDate = (processo: any) => {
    const movimentosProc = state.movimentos.filter(m => 
      String(m.processoId) === String(processo.id) || 
      String(m.processoId) === String(processo.idProc) || 
      String(m.processoId) === String(processo.numero)
    );
    
    if (movimentosProc.length === 0) return '-';
    
    const ultimaMov = movimentosProc.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];
    return formatDate(ultimaMov.data) || '-';
  };

  const filteredProcessos = state.processos.filter(p => {
    const pEscId = (p.escritorioId || '').toString().trim().toUpperCase();
    const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
    const isGlobal = pEscId === 'X';
    
    // Admin in "Todos os Escritórios" (empty activeEscId) sees everything
    // If an active office is selected, show only processes for that office or global ones
    // Allow processes with no office ID to be seen by admins
    if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
    
    // For non-admins, they must have the office ID in their list or it must be global
    if (!isAdmin() && !isGlobal) {
      const userOffices = (currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase());
      if (pEscId && !userOffices.includes(pEscId)) return false;
    }

    const vara = state.varas.find(v => v.id === p.tribunal);
    const forum = state.tribunais.find(f => f.id === vara?.forum);
    
    const searchLower = searchTerm.toLowerCase().trim();
    
    // Initial status filter (combines prop filter if fixed, or internal dropdown filter)
    let matchesStatus = true;
    if (filterStatus) {
      matchesStatus = p.status === filterStatus;
    } else if (internalStatusFilter !== 'Todos') {
      matchesStatus = (p.status || 'Ativo') === internalStatusFilter;
    }

    // Filter by tag if requested
    if (filterTag) {
      const pTags = (p.tags || '').split(',').map(t => t.trim()).filter(Boolean);
      const hasTag = state.etiquetas.some(e => {
        const tagName = e.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const targetTag = filterTag.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return pTags.includes(String(e.id)) && tagName.includes(targetTag);
      });
      if (!hasTag) return false;
    }

    // Filter by selected tag dropdown if any is selected (supports multiple selection OR logic)
    if (selectedTagFilters.length > 0) {
      const pTags = (p.tags || '').split(',').map(t => t.trim()).filter(Boolean);
      const hasSelectedTag = selectedTagFilters.some(tagId => pTags.includes(String(tagId)));
      if (!hasSelectedTag) {
        return false;
      }
    }

    // Filter by morosidade if requested
    if (filterMorosidade) {
      const diasMorosidade = state.settings.diasMorosidade || 30;
      const hoje = new Date();
      const movimentosProc = state.movimentos.filter(m => 
        String(m.processoId) === String(p.id) || 
        String(m.processoId) === String(p.idProc) || 
        String(m.processoId) === String(p.numero)
      );
      
      let diffDays = 0;
      if (movimentosProc.length === 0) {
        if (!p.dataDistribuicao) return false;
        const distDate = new Date(p.dataDistribuicao);
        diffDays = Math.ceil(Math.abs(hoje.getTime() - distDate.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        const ultimaMov = movimentosProc.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];
        const ultimaMovDate = new Date(ultimaMov.data);
        diffDays = Math.ceil(Math.abs(hoje.getTime() - ultimaMovDate.getTime()) / (1000 * 60 * 60 * 24));
      }
      
      if (diffDays <= diasMorosidade) return false;
    }

    if (filterInstancia) {
      const pInst = (p.instancia || '').toLowerCase().trim();
      const targetInst = filterInstancia.toLowerCase().trim();
      if (pInst !== targetInst) return false;
    }

    if (!searchLower) return matchesStatus;

    const normalizeStr = (str: string) => 
      (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const sNorm = normalizeStr(searchTerm);

    // Get involved parties (envolvidos) names and client name
    const client = state.contatos.find(c => c.id === p.clienteId);
    const clientName = client ? client.nome : '';
    const clientApelido = client ? client.apelido : '';

    const envolvidosNomes = (p.envolvidosIds || []).map(id => {
      const c = state.contatos.find(cont => String(cont.id) === String(id));
      return c ? `${c.nome} ${c.apelido || ''}` : '';
    }).filter(Boolean).join(' ');

    const matchesSearch = 
      normalizeStr(p.numero).includes(sNorm) || 
      normalizeStr(p.idProc).includes(sNorm) ||
      normalizeStr(p.titulo).includes(sNorm) ||
      normalizeStr(p.parteContraria).includes(sNorm) ||
      normalizeStr(p.tipo).includes(sNorm) ||
      normalizeStr(p.assunto).includes(sNorm) ||
      normalizeStr(p.classe).includes(sNorm) ||
      normalizeStr(vara?.nome).includes(sNorm) ||
      normalizeStr(forum?.nome).includes(sNorm) ||
      normalizeStr(clientName).includes(sNorm) ||
      normalizeStr(clientApelido).includes(sNorm) ||
      normalizeStr(envolvidosNomes).includes(sNorm);
    
    return matchesSearch && matchesStatus;
  });

  const sortedAndFilteredProcessos = useMemo(() => {
    let sortableItems = [...filteredProcessos];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any = '';
        let bValue: any = '';

        if (sortConfig.key === 'cliente') {
          aValue = state.contatos.find(c => c.id === a.clienteId)?.nome || '';
          bValue = state.contatos.find(c => c.id === b.clienteId)?.nome || '';
        } else if (sortConfig.key === 'escritorio') {
          aValue = state.escritorios.find(e => e.id === a.escritorioId)?.nome || '';
          bValue = state.escritorios.find(e => e.id === b.escritorioId)?.nome || '';
        } else if (sortConfig.key === 'ultimoMov') {
          const getUltimaData = (p: Processo) => {
            const movs = state.movimentos.filter(m => 
              String(m.processoId) === String(p.id) || 
              String(m.processoId) === String(p.idProc) || 
              String(m.processoId) === String(p.numero)
            );
            if (movs.length === 0) return 0;
            return Math.max(...movs.map(m => new Date(m.data).getTime()));
          };
          aValue = getUltimaData(a);
          bValue = getUltimaData(b);
        } else if (sortConfig.key === 'varaForum') {
          const vA = state.varas.find(v => v.id === (a.varaId || a.tribunal));
          const vB = state.varas.find(v => v.id === (b.varaId || b.tribunal));
          aValue = vA?.nome || '';
          bValue = vB?.nome || '';
        } else {
          const map: Record<string, keyof Processo> = {
            idProc: 'idProc',
            titulo: 'titulo',
            numero: 'numero',
            instancia: 'instancia',
            tipo: 'tipo',
            classe: 'classe',
            assunto: 'assunto',
            valorCausa: 'valorCausa',
            distribuicao: 'dataDistribuicao',
            resultado: 'resultado',
            status: 'status',
            pasta: 'pasta'
          };
          const key = map[sortConfig.key] || sortConfig.key;
          aValue = a[key as keyof Processo] || '';
          bValue = b[key as keyof Processo] || '';
        }

        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredProcessos, sortConfig, state.contatos, state.escritorios, state.movimentos, state.varas]);

  const totalPages = Math.ceil(sortedAndFilteredProcessos.length / itemsPerPage);
  const paginatedProcessos = sortedAndFilteredProcessos.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const formatCNJ = (numero: string) => {
    if (!numero) return '';
    const clean = numero.replace(/\D/g, '');
    if (clean.length !== 20) return numero;
    return `${clean.substring(0, 7)}-${clean.substring(7, 9)}.${clean.substring(9, 13)}.${clean.substring(13, 14)}.${clean.substring(14, 16)}.${clean.substring(16, 20)}`;
  };

  const processMovimentos = state.movimentos
    .filter(m => {
      if (!selectedProcesso) return false;
      const mProcId = String(m.processoId || '').trim();
      if (!mProcId) return false;
      return (
        (selectedProcesso.idProc && mProcId === String(selectedProcesso.idProc).trim()) || 
        (selectedProcesso.id && mProcId === String(selectedProcesso.id).trim()) ||
        (selectedProcesso.numero && mProcId === String(selectedProcesso.numero).trim())
      );
    })
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  const last5Movimentos = processMovimentos.slice(0, 5);

  const processTarefas = state.tarefas
    .filter(t => {
      const procRef = String(selectedProcesso?.idProc || selectedProcesso?.id || selectedProcesso?.numero);
      const taskProcId = String(t.PROCESSO_ID || t.ID_PROC);
      return taskProcId === procRef;
    })
    .sort((a, b) => {
      const dateA = a.DATA_LIMITE || a.PRAZO_FIM || '';
      const dateB = b.DATA_LIMITE || b.PRAZO_FIM || '';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

  const last5Tarefas = processTarefas.slice(0, 5);

  const processEventos = state.eventos
    .filter(e => {
      if (!selectedProcesso) return false;
      const procId = String(selectedProcesso.id).trim();
      const procIdProc = String(selectedProcesso.idProc || '').trim();
      const procNum = String(selectedProcesso.numero || '').trim();
      const eventProcId = String(e.processoId || '').trim();
      return eventProcId === procId || eventProcId === procIdProc || eventProcId === procNum;
    })
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  const last5Eventos = processEventos.slice(0, 5);

  const getGoogleCalendarUrl = (evento: any) => {
    const title = `${evento.tipo ? `[${evento.tipo}] ` : ''}${evento.titulo}`;
    
    const descriptionParts = [];
    if (selectedProcesso) {
      descriptionParts.push(`Processo: ${selectedProcesso.numero ? selectedProcesso.numero : ''} - ${selectedProcesso.titulo || selectedProcesso.parteContraria || ''}`);
    }
    if (evento.link) {
      descriptionParts.push(`Link do Evento: ${evento.link}`);
    }
    if (evento.observacoes) {
      descriptionParts.push(`Observações:\n${evento.observacoes}`);
    }
    const details = descriptionParts.join('\n\n');
    
    let dates = '';
    const dateStr = evento.data;
    if (dateStr) {
      if (dateStr.includes('T')) {
        const cleanStart = dateStr.replace(/[-:]/g, '') + '00';
        const startDate = new Date(dateStr);
        if (!isNaN(startDate.getTime())) {
          const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
          const endYear = endDate.getFullYear();
          const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
          const endDay = String(endDate.getDate()).padStart(2, '0');
          const endHours = String(endDate.getHours()).padStart(2, '0');
          const endMinutes = String(endDate.getMinutes()).padStart(2, '0');
          const cleanEnd = `${endYear}${endMonth}${endDay}T${endHours}${endMinutes}00`;
          dates = `${cleanStart}/${cleanEnd}`;
        } else {
          dates = `${cleanStart}/${cleanStart}`;
        }
      } else {
        const cleanStart = dateStr.replace(/-/g, '');
        const startDate = new Date(dateStr + 'T00:00:00');
        if (!isNaN(startDate.getTime())) {
          const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
          const endYear = endDate.getFullYear();
          const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
          const endDay = String(endDate.getDate()).padStart(2, '0');
          const cleanEnd = `${endYear}${endMonth}${endDay}`;
          dates = `${cleanStart}/${cleanEnd}`;
        } else {
          dates = `${cleanStart}/${cleanStart}`;
        }
      }
    }
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dates}&details=${encodeURIComponent(details)}`;
  };

  const filteredContacts = useMemo(() => {
    if (contactSearchTerm.length < 3) return [];
    const searchNorm = contactSearchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return state.contatos.filter(c => 
      !formData.envolvidosIds.includes(c.id) &&
      ((c.nome || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(searchNorm) || 
       (c.cpfCnpj || '').includes(contactSearchTerm))
    ).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [state.contatos, contactSearchTerm, formData.envolvidosIds]);

  const filteredClientsForPrimary = useMemo(() => {
    if (clientSearch.length < 3) return [];
    const searchNorm = clientSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return state.contatos.filter(c => 
      c.tipo === 'Cliente' && 
      (c.escritorioId === formData.escritorioId || c.escritorioId === 'X' || c.escritorioId === 'x' || !c.escritorioId) &&
      ((c.nome || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(searchNorm) || 
       (c.cpfCnpj || '').includes(clientSearch))
    ).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [state.contatos, clientSearch, formData.escritorioId]);

  const processFinanceiro = state.financeiro
    .filter(f => {
      if (!selectedProcesso) return false;
      const fProcId = String(f.processoId || '').trim();
      if (!fProcId) return false;
      return (
        (selectedProcesso.idProc && fProcId === String(selectedProcesso.idProc).trim()) || 
        (selectedProcesso.id && fProcId === String(selectedProcesso.id).trim()) ||
        (selectedProcesso.numero && fProcId === String(selectedProcesso.numero).trim())
      );
    })
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  const availableEtiquetas = useMemo(() => {
    return state.etiquetas.filter(e => 
      e.escritorioId === escritorioAtivoId || 
      e.escritorioId?.toUpperCase() === 'X'
    ).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [state.etiquetas, escritorioAtivoId]);

  const tagsArray = useMemo(() => (formData.tags || '').split(',').map(t => t.trim()).filter(Boolean), [formData.tags]);
  
  const unselectedTags = useMemo(() => 
    availableEtiquetas.filter(tag => !tagsArray.includes(String(tag.id))),
    [availableEtiquetas, tagsArray]
  );

  const toggleColumn = (colId: string) => {
    setColumnOrder(prev => {
      let newOrder;
      if (prev.includes(colId)) {
        newOrder = prev.filter(id => id !== colId);
      } else {
        newOrder = [...prev, colId];
      }
      localStorage.setItem('advocacia_processos_columns', JSON.stringify(newOrder));
      return newOrder;
    });
  };

  const handleOpenAddMovimento = () => {
    setMovimentoFormData({
      id: '',
      data: new Date().toISOString().split('T')[0],
      descricao: '',
      pagina: '',
      usuarioId: currentUser?.id || '',
      escritorioId: '',
      mode: 'create'
    });
    setIsAddMovimentoModalOpen(true);
  };

  const handleEditMovimento = (mov: any) => {
    setMovimentoFormData({
      id: mov.id,
      data: mov.data,
      descricao: mov.descricao,
      pagina: mov.pagina || '',
      usuarioId: mov.usuarioId || '',
      escritorioId: mov.escritorioId || '',
      mode: 'edit'
    });
    setIsAddMovimentoModalOpen(true);
  };

  const handleSubmitMovimento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProcesso) return;

    const procRef = formData.idProc || selectedProcesso.idProc || selectedProcesso.id || selectedProcesso.numero;

    if (movimentoFormData.mode === 'edit') {
      updateMovimento({
        id: movimentoFormData.id,
        processoId: procRef,
        data: movimentoFormData.data,
        descricao: movimentoFormData.descricao,
        pagina: movimentoFormData.pagina,
        usuarioId: movimentoFormData.usuarioId,
        escritorioId: movimentoFormData.escritorioId || selectedProcesso?.escritorioId || escritorioAtivoId || ''
      });
    } else {
      const newMovimento = {
        id: `mov_${Date.now()}`,
        processoId: procRef,
        data: movimentoFormData.data,
        descricao: movimentoFormData.descricao,
        pagina: movimentoFormData.pagina,
        usuarioId: movimentoFormData.usuarioId,
        escritorioId: selectedProcesso?.escritorioId || escritorioAtivoId || ''
      };
      addMovimento(newMovimento);
    }
    setIsAddMovimentoModalOpen(false);
  };

  const handleOpenAddTarefa = () => {
    setSelectedTarefaForModal(null);
    setTaskModalMode('create');
    setIsTaskModalOpen(true);
  };

  const handleEditTarefa = (tarefa: any) => {
    setSelectedTarefaForModal(tarefa);
    setTaskModalMode('edit');
    setIsTaskModalOpen(true);
  };

  const handleViewTarefa = (tarefa: any) => {
    setSelectedTarefaForModal(tarefa);
    setTaskModalMode('view');
    setIsTaskModalOpen(true);
  };

  const handleViewVara = (vara: any) => {
    setSelectedVaraForView(vara);
    setIsVaraViewModalOpen(true);
  };

  const handleViewContato = (contato: any) => {
    setSelectedContatoForView(contato);
    setIsContatoViewModalOpen(true);
    setIsEditingContato(false);
    setEditContatoFormData(contato ? { ...contato } : null);
  };

  const handleSaveEditedContato = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editContatoFormData || !editContatoFormData.nome) return;
    updateContato(editContatoFormData);
    setSelectedContatoForView(editContatoFormData);
    setIsEditingContato(false);
  };

  const handleOpenAddFinanceiro = () => {
    const procRef = selectedProcesso ? String(selectedProcesso.idProc || selectedProcesso.id || selectedProcesso.numero || '').trim() : '';
    setFinanceiroFormData({
      id: '',
      tipo: 'Receita',
      valor: 0,
      data: new Date().toISOString().split('T')[0],
      descricao: '',
      status: 'Pendente',
      observacoes: '',
      usuarioId: currentUser?.id || '',
      escritorioId: selectedProcesso?.escritorioId || escritorioAtivoId || 'x',
      processoId: procRef,
      clienteId: selectedProcesso?.clienteId || '',
      contatoId: selectedProcesso?.clienteId || '',
      mode: 'create'
    });
    setIsFinanceiroModalOpen(true);
  };

  const handleEditFinanceiro = (trans: any) => {
    const procRef = selectedProcesso ? String(selectedProcesso.idProc || selectedProcesso.id || selectedProcesso.numero || '').trim() : (trans.processoId || '');
    const cid = trans.contatoId || trans.clienteId || selectedProcesso?.clienteId || '';
    setFinanceiroFormData({
      id: trans.id,
      tipo: trans.tipo || 'Receita',
      valor: trans.valor || 0,
      data: trans.data || new Date().toISOString().split('T')[0],
      descricao: trans.descricao || '',
      status: trans.status || 'Pendente',
      observacoes: trans.observacoes || '',
      usuarioId: trans.usuarioId || currentUser?.id || '',
      escritorioId: trans.escritorioId || selectedProcesso?.escritorioId || escritorioAtivoId || 'x',
      processoId: procRef,
      clienteId: cid,
      contatoId: cid,
      mode: 'edit'
    });
    setIsFinanceiroModalOpen(true);
  };

  const handleSubmitFinanceiro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProcesso) return;

    const procRef = String(selectedProcesso.idProc || selectedProcesso.id || selectedProcesso.numero || '').trim();
    const cid = financeiroFormData.contatoId || financeiroFormData.clienteId || selectedProcesso.clienteId || '';

    const dataToSave = {
      id: financeiroFormData.mode === 'edit' ? financeiroFormData.id : `fin_${Date.now()}`,
      tipo: financeiroFormData.tipo,
      valor: Number(financeiroFormData.valor),
      data: financeiroFormData.data,
      descricao: financeiroFormData.descricao || financeiroFormData.observacoes || 'Lançamento',
      status: financeiroFormData.status,
      observacoes: financeiroFormData.observacoes,
      processoId: procRef,
      clienteId: cid,
      contatoId: cid,
      escritorioId: financeiroFormData.escritorioId || selectedProcesso.escritorioId || escritorioAtivoId || 'x',
      usuarioId: financeiroFormData.usuarioId || currentUser?.id || 'system'
    };

    if (financeiroFormData.mode === 'edit') {
      updateTransacao(dataToSave);
    } else {
      addTransacao(dataToSave);
    }

    setIsFinanceiroModalOpen(false);
  };

  const handleDeleteFinanceiro = (id: string) => {
    const canDelete = isAdmin() || hasPermission('financeiro', 'delete');
    if (!canDelete) {
      alert('Você não tem permissão para excluir registros financeiros.');
      return;
    }
    if (window.confirm('Tem certeza que deseja excluir esta transação financeira?')) {
      deleteTransacao(id);
    }
  };

  const handleOpenModal = (mode: ModalMode, processo?: Processo) => {
    setModalMode(mode);
    setFormError(null);
    setVaraSearch('');
    setShowVaraResults(false);
    setClientSearch('');
    setShowClientResults(false);
    if (processo) {
      setSelectedProcesso(processo);
      // Use varaId if exists, otherwise fallback to tribunal (which currently holds the ID)
      const effectiveVaraId = processo.varaId || processo.tribunal || '';
      
      setFormData({
        numero: processo.numero || '',
        clienteId: processo.clienteId || '',
        parteContraria: processo.parteContraria || '',
        tribunal: effectiveVaraId,
        status: processo.status || 'Ativo',
        dataDistribuicao: processo.dataDistribuicao || new Date().toISOString().split('T')[0],
        idProc: processo.idProc || '',
        tipo: processo.tipo || '',
        titulo: processo.titulo || '',
        instancia: processo.instancia || '',
        varaId: effectiveVaraId,
        classe: processo.classe || '',
        assunto: processo.assunto || '',
        valorCausa: processo.valorCausa || 0,
        resultado: processo.resultado || '',
        ativo: processo.ativo || '',
        link: processo.link || '',
        tags: processo.tags || '',
        pasta: processo.pasta || '',
        escritorioId: processo.escritorioId || '',
        envolvidosIds: (processo.envolvidosIds && processo.envolvidosIds.length > 0)
          ? processo.envolvidosIds
          : state.envolvidos
              .filter(e => {
                const eProcId = String(e.processoId || '').trim();
                if (!eProcId) return false;
                const pId = String(processo.id || '').trim();
                const pNum = String(processo.numero || '').trim();
                return (pId && eProcId === pId) || (pNum && eProcId === pNum);
              })
              .map(e => e.contatoId)
      });
    } else {
      setSelectedProcesso(null);
      // Default office to the first one the user belongs to, or the active one
      const defaultOfficeId = escritorioAtivoId || (currentUser?.escritoriosIds && currentUser.escritoriosIds.length > 0 ? currentUser.escritoriosIds[0] : '');
      const newProcessId = generateId('processo');
      
      setFormData({
        numero: '',
        clienteId: '',
        parteContraria: '',
        tribunal: '',
        status: 'Ativo',
        dataDistribuicao: new Date().toISOString().split('T')[0],
        idProc: newProcessId,
        tipo: '',
        titulo: '',
        instancia: defaultInstancia || '',
        varaId: '',
        classe: '',
        assunto: '',
        valorCausa: 0,
        resultado: '',
        ativo: '',
        link: '',
        tags: '',
        pasta: '',
        escritorioId: defaultOfficeId,
        envolvidosIds: []
      });
    }
    setIsModalOpen(true);
  };

  React.useEffect(() => {
    if (state.selectedProcessId) {
      const processo = state.processos.find(p => p.id === state.selectedProcessId);
      if (processo) {
        handleOpenModal('view', processo);
        setSelectedProcessId(undefined);
      }
    }
  }, [state.selectedProcessId, state.processos]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    // Validar Título
    if (!formData.titulo || !formData.titulo.trim()) {
      setFormError('O campo "Título" é obrigatório.');
      setTimeout(() => {
        const elem = document.getElementById('titulo_input');
        if (elem) {
          elem.focus();
          elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      return;
    }

    // Validar Escritório se for Admin ou se usuário tiver mais de um escritório
    const showEscritorioField = isAdmin() || (currentUser?.escritoriosIds && currentUser.escritoriosIds.length > 1);
    const finalOfficeId = formData.escritorioId || escritorioAtivoId || '';
    if (showEscritorioField && !finalOfficeId) {
      setFormError('O campo "Escritório" é obrigatório. Por favor, selecione um escritório.');
      setTimeout(() => {
        const elem = document.getElementById('escritorioId_select');
        if (elem) {
          elem.focus();
          elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      return;
    }
    
    if (modalMode === 'create') {
      addProcesso({
        id: formData.idProc,
        ...formData,
        escritorioId: finalOfficeId
      });
    } else if (modalMode === 'edit' && selectedProcesso) {
      updateProcesso({
        ...selectedProcesso,
        ...formData,
        escritorioId: finalOfficeId
      });
    }
    
    setIsModalOpen(false);
  };

  const handleSaveContato = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoContato.nome) return;
    
    const newContactId = Math.random().toString(36).substr(2, 9);
    addContato({
      id: newContactId,
      ...novoContato,
      escritorioId: novoContato.escritorioId || escritorioAtivoId || ''
    } as any);
    
    // Set the newly created contact as the selected client
    setFormData(prev => ({ ...prev, clienteId: newContactId }));
    
    setIsNewContactModalOpen(false);
    setNovoContato({
      nome: '',
      tipo: 'Cliente',
      email: '',
      telefone: '',
      cpfCnpj: '',
      escritorioId: escritorioAtivoId || ''
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este processo?')) {
      deleteProcesso(id);
    }
  };

  const currentProcessIndex = useMemo(() => {
    if (!selectedProcesso || sortedAndFilteredProcessos.length === 0) return -1;
    return sortedAndFilteredProcessos.findIndex(p => p.id === selectedProcesso.id);
  }, [selectedProcesso, sortedAndFilteredProcessos]);

  const hasPrevProcesso = currentProcessIndex > 0;
  const hasNextProcesso = currentProcessIndex >= 0 && currentProcessIndex < sortedAndFilteredProcessos.length - 1;

  const handleNavigateProcesso = (direction: 'prev' | 'next') => {
    if (currentProcessIndex === -1) return;
    const targetIndex = direction === 'prev' ? currentProcessIndex - 1 : currentProcessIndex + 1;
    if (targetIndex >= 0 && targetIndex < sortedAndFilteredProcessos.length) {
      const targetProc = sortedAndFilteredProcessos[targetIndex];
      handleOpenModal(modalMode === 'create' ? 'view' : modalMode, targetProc);
    }
  };

  // Keyboard navigation with arrow keys (Left / Right) when viewing or editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isModalOpen || currentProcessIndex === -1) return;
      
      // Ignore if user is actively typing in an input, textarea, or select
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isInputActive = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';
      if (isInputActive) return;

      if (e.key === 'ArrowLeft' && hasPrevProcesso) {
        e.preventDefault();
        handleNavigateProcesso('prev');
      } else if (e.key === 'ArrowRight' && hasNextProcesso) {
        e.preventDefault();
        handleNavigateProcesso('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, currentProcessIndex, hasPrevProcesso, hasNextProcesso, sortedAndFilteredProcessos, modalMode]);

  const getModalTitle = () => {
    switch (modalMode) {
      case 'create': return 'Novo Processo';
      case 'edit': return (
        <ProcessTitleHeader 
          prefix="Editar Processo" 
          numero={formData.numero} 
          titulo={formData.titulo} 
          currentIndex={currentProcessIndex}
          totalItems={sortedAndFilteredProcessos.length}
          onPrev={() => handleNavigateProcesso('prev')}
          onNext={() => handleNavigateProcesso('next')}
          hasPrev={hasPrevProcesso}
          hasNext={hasNextProcesso}
        />
      );
      case 'view': return (
        <ProcessTitleHeader 
          numero={formData.numero} 
          titulo={formData.titulo} 
          currentIndex={currentProcessIndex}
          totalItems={sortedAndFilteredProcessos.length}
          onPrev={() => handleNavigateProcesso('prev')}
          onNext={() => handleNavigateProcesso('next')}
          hasPrev={hasPrevProcesso}
          hasNext={hasNextProcesso}
        />
      );
      default: return '';
    }
  };

  return (
    <div className={containerClassName || "p-2 sm:p-4 md:p-6 w-full h-full flex flex-col space-y-3 sm:space-y-6 overflow-hidden"}>
      {!hideTitle && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
          <h1 className="text-xl sm:text-2xl font-bold text-app-text flex items-center uppercase">
            <Scale className="mr-3 text-primary shrink-0" />
            <span className="truncate">
              {customTitle || (filterTag === 'pendencia' ? 'PENDÊNCIA' : (filterStatus === 'Ativo' ? 'Processos Ativos' : 'Processos'))}
            </span>
          </h1>
          {hasPermission('processos', 'write') && (
            <button 
              onClick={() => handleOpenModal('create')}
              className="bg-primary hover:opacity-90 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm"
            >
              <Plus size={20} className="mr-2" />
              Novo Processo
            </button>
          )}
        </div>
      )}

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="p-3 sm:p-4 border-b border-app-border flex flex-col lg:flex-row gap-3 lg:items-center justify-between flex-shrink-0">
          <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center space-x-3 shrink-0">
              <button 
                id="btn-column-config"
                onClick={() => setIsColumnModalOpen(true)}
                className="p-2 border border-app-border rounded-lg text-app-text-muted hover:text-primary hover:border-primary transition-all bg-app-secondary flex items-center justify-center shadow-sm shrink-0"
                title="Configurar Colunas"
              >
                <Settings2 size={20} />
              </button>
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted" size={20} />
                <input 
                  type="text" 
                  placeholder="Buscar por número, parte, vara ou fórum..." 
                  className="w-full pl-10 pr-10 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-app-secondary text-app-text placeholder-app-text-muted"
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
                {searchTerm && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setCurrentPage(1);
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-app-text-muted hover:text-app-text transition-colors"
                    title="Limpar busca"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>

            {selectedTagFilters.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 py-1 min-w-0">
                {selectedTagFilters.map(tagId => {
                  const tag = state.etiquetas.find(t => String(t.id) === String(tagId));
                  if (!tag) return null;
                  return (
                    <span 
                      key={tag.id}
                      className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded text-[10px] font-extrabold border uppercase tracking-wider transition-colors shadow-sm select-none shrink-0"
                      style={{ 
                        backgroundColor: tag.cor ? `${tag.cor}15` : 'rgba(var(--app-secondary), 0.3)', 
                        color: tag.cor || 'var(--app-text)',
                        borderColor: tag.cor ? `${tag.cor}30` : 'var(--app-border)'
                      }}
                    >
                      <span className="truncate max-w-[120px]">{tag.nome}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTagFilters(prev => prev.filter(id => id !== String(tag.id)));
                          setCurrentPage(1);
                        }}
                        className="hover:bg-black/10 rounded p-0.5 transition-colors"
                        title="Remover filtro"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  );
                })}
                <span className="text-xs text-app-text-muted font-semibold whitespace-nowrap ml-1 bg-app-secondary px-2 py-1 rounded-md border border-app-border">
                  {filteredProcessos.length} {filteredProcessos.length === 1 ? 'registro encontrado' : 'registros encontrados'}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {!filterStatus && (
              <div className="flex items-center space-x-2 bg-app-secondary px-3 py-2 rounded-lg border border-app-border">
                <span className="text-xs font-semibold text-app-text-muted">Status:</span>
                <select 
                  className="bg-transparent text-app-text text-sm font-medium focus:outline-none cursor-pointer"
                  value={internalStatusFilter}
                  onChange={(e) => {
                    setInternalStatusFilter(e.target.value as 'Todos' | 'Ativo' | 'Inativo');
                    setCurrentPage(1);
                  }}
                >
                  <option value="Todos" className="bg-app-surface text-app-text">Todos os Status</option>
                  <option value="Ativo" className="bg-app-surface text-app-text">Ativos</option>
                  <option value="Inativo" className="bg-app-surface text-app-text">Inativos</option>
                </select>
              </div>
            )}

            <div className="relative w-full sm:w-64 shrink-0" ref={tagDropdownRef}>
              <button
                type="button"
                onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                className="relative w-full flex items-center justify-between pl-9 pr-10 py-2 border border-app-border rounded-lg bg-app-secondary text-app-text text-sm font-medium shadow-sm hover:border-primary/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-left"
              >
                <span className="truncate flex items-center gap-1.5">
                  <Tag size={16} className="text-app-text-muted absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                  {selectedTagFilters.length === 0 ? (
                    "Todas as etiquetas"
                  ) : selectedTagFilters.length === 1 ? (
                    state.etiquetas.find(t => String(t.id) === String(selectedTagFilters[0]))?.nome || "1 etiqueta"
                  ) : (
                    `${selectedTagFilters.length} etiquetas`
                  )}
                </span>
                <ChevronDown size={16} className={`text-app-text-muted transition-transform duration-200 shrink-0 ${isTagDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {selectedTagFilters.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTagFilters([]);
                    setCurrentPage(1);
                  }}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-red-500 transition-colors p-1 rounded-md z-10"
                  title="Limpar seleção"
                >
                  <X size={14} />
                </button>
              )}

              {isTagDropdownOpen && (
                <div className="absolute right-0 mt-1 w-full sm:w-72 bg-app-surface border border-app-border rounded-xl shadow-lg z-50 py-1.5 max-h-64 overflow-y-auto">
                  <div className="px-3 py-1.5 border-b border-app-border flex items-center justify-between text-xs font-semibold text-app-text-muted">
                    <span>Filtrar por etiqueta</span>
                    {selectedTagFilters.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTagFilters([]);
                          setCurrentPage(1);
                        }}
                        className="text-primary hover:underline"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    {availableEtiquetas.length === 0 ? (
                      <div className="text-xs text-app-text-muted text-center py-4">
                        Nenhuma etiqueta disponível.
                      </div>
                    ) : (
                      availableEtiquetas.map(tag => {
                        const isSelected = selectedTagFilters.includes(String(tag.id));
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => {
                              const tagStr = String(tag.id);
                              setSelectedTagFilters(prev => {
                                const newSelection = prev.includes(tagStr)
                                  ? prev.filter(id => id !== tagStr)
                                  : [...prev, tagStr];
                                return newSelection;
                              });
                              setCurrentPage(1);
                            }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-app-secondary rounded-lg transition-colors text-left"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // Controlled by button click
                              className="rounded border-app-border text-primary focus:ring-primary h-4 w-4 pointer-events-none shrink-0"
                            />
                            <span 
                              className="px-1.5 py-0.5 rounded text-[10px] font-extrabold border uppercase tracking-wider truncate"
                              style={{ 
                                backgroundColor: tag.cor ? `${tag.cor}15` : 'rgba(var(--app-secondary), 0.3)', 
                                color: tag.cor || 'var(--app-text)',
                                borderColor: tag.cor ? `${tag.cor}30` : 'var(--app-border)'
                              }}
                            >
                              {tag.nome}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

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
                    {columnOrder.map((colId: string) => (
                      <React.Fragment key={colId}>
                        <SortableHeader 
                          id={colId} 
                          label={columnLabels[colId] || colId} 
                          onSort={requestSort} 
                          sortConfig={sortConfig} 
                        />
                      </React.Fragment>
                    ))}
                  </SortableContext>
                  <th className="px-4 py-3 font-medium text-right sticky right-0 z-20 bg-app-secondary shadow-[-4px_0_8px_rgba(0,0,0,0.05)] hidden sm:table-cell">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {paginatedProcessos.map((processo, index) => {
                  const cliente = state.contatos.find(c => c.id === processo.clienteId);
                  const escritorio = state.escritorios.find(e => e.id === processo.escritorioId);
                  
                  const varaId = processo.varaId || processo.tribunal;
                  const vara = state.varas.find(v => v.id === varaId);
                  const forum = vara ? state.forums.find(f => f.id === vara.forum) : null;
                  const tribunal = forum ? state.tribunais.find(t => t.id.toUpperCase() === forum.tribunalId?.toUpperCase()) : null;

                  return (
                    <tr 
                      key={`${processo.id}-${index}`} 
                      className={`hover:bg-app-secondary transition-colors group cursor-pointer lg:cursor-default`}
                      onClick={() => {
                        if (window.innerWidth < 1024) {
                          handleOpenModal('view', processo);
                        }
                      }}
                    >
                      {columnOrder.map(colId => {
                        const cellClass = `px-4 py-3 text-sm text-app-text-muted ${
                          ['idProc', 'tipo', 'valorCausa', 'instancia', 'classe', 'assunto', 'distribuicao', 'resultado', 'ultimoMov', 'link', 'tags', 'pasta'].includes(colId) 
                            ? 'hidden md:table-cell' 
                            : ''
                        }`;
                        switch (colId) {
                          case 'idProc':
                            return <td key={colId} className={cellClass}>{processo.idProc || '-'}</td>;
                          case 'titulo':
                            return <td key={colId} className="px-4 py-3 text-sm text-app-text-muted whitespace-nowrap">{processo.titulo || '-'}</td>;
                          case 'tipo':
                            return <td key={colId} className={cellClass}>{processo.tipo || '-'}</td>;
                          case 'valorCausa':
                            return (
                              <td key={colId} className={cellClass}>
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(processo.valorCausa || 0)}
                              </td>
                            );
                          case 'instancia':
                            return <td key={colId} className={cellClass}>{processo.instancia || '-'}</td>;
                          case 'classe':
                            return <td key={colId} className={cellClass}><div className="line-clamp-2">{processo.classe || '-'}</div></td>;
                          case 'assunto':
                            return <td key={colId} className={cellClass}><div className="line-clamp-2">{processo.assunto || '-'}</div></td>;
                          case 'distribuicao':
                            return <td key={colId} className={cellClass}>{formatDate(processo.dataDistribuicao) || '-'}</td>;
                          case 'resultado':
                            return <td key={colId} className={cellClass}>{processo.resultado || '-'}</td>;
                          case 'ultimoMov':
                            return <td key={colId} className={cellClass}>{getUltimoMovDate(processo)}</td>;
                          case 'link':
                            return (
                              <td key={colId} className={cellClass}>
                                {processo.link ? (
                                  <a href={processo.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Link</a>
                                ) : '-'}
                              </td>
                            );
                          case 'tags':
                            const currentTags = (processo.tags || '').split(',').map(tagId => tagId.trim()).filter(Boolean);
                            return (
                              <td key={colId} className={cellClass}>
                                <div className="flex flex-wrap gap-1">
                                  {currentTags.map(tagId => {
                                    const tag = state.etiquetas.find(t => String(t.id) === String(tagId));
                                    if (!tag) return null;
                                    return (
                                      <span 
                                        key={tag.id} 
                                        className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold border"
                                        style={{ 
                                          backgroundColor: tag.cor ? `${tag.cor}15` : 'rgba(var(--app-secondary), 0.3)', 
                                          color: tag.cor || 'var(--app-text)',
                                          borderColor: tag.cor ? `${tag.cor}30` : 'var(--app-border)'
                                        }}
                                      >
                                        {tag.nome.toUpperCase()}
                                      </span>
                                    );
                                  })}
                                  {currentTags.length === 0 && <span className="text-app-text-muted text-xs">-</span>}
                                </div>
                              </td>
                            );
                          case 'pasta':
                            return (
                              <td key={colId} className={cellClass}>
                                {processo.pasta ? (
                                  (processo.pasta.startsWith('http') || processo.pasta.includes('://')) ? (
                                    <a href={processo.pasta} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">link</a>
                                  ) : processo.pasta
                                ) : '-'}
                              </td>
                            );
                          case 'numero':
                            return (
                              <td 
                                key={colId} 
                                className="px-4 py-3 font-mono text-sm text-primary whitespace-nowrap cursor-pointer hover:underline font-bold"
                              >
                                <div className="flex items-center gap-2">
                                  <span onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenModal('view', processo);
                                  }}>
                                    {formatCNJ(processo.numero)}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(processo.numero);
                                      // Feedback opcional? Simples por enquanto
                                    }}
                                    className="p-1 hover:bg-primary/10 rounded transition-colors text-app-text-muted hover:text-primary"
                                    title="Copiar número"
                                  >
                                    <Copy size={14} />
                                  </button>
                                </div>
                              </td>
                            );
                          case 'cliente':
                            return (
                              <td key={colId} className="px-4 py-3 text-app-text whitespace-nowrap">
                                <span 
                                  className="hover:text-primary hover:underline cursor-pointer transition-colors"
                                  onClick={(e) => {
                                    if (cliente) {
                                      e.stopPropagation();
                                      handleViewContato(cliente);
                                    }
                                  }}
                                >
                                  {cliente?.nome || '-'}
                                </span>
                              </td>
                            );
                          case 'escritorio':
                            return <td key={colId} className="px-4 py-3 text-app-text whitespace-nowrap hidden sm:table-cell">{escritorio?.nome || '-'}</td>;
                          case 'varaForum':
                            return (
                              <td key={colId} className="px-4 py-3 text-app-text hidden sm:table-cell">
                                {vara ? (
                                  <div className="flex flex-col gap-1 min-w-[150px]">
                                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                                      <span 
                                        className="font-bold text-xs truncate text-primary hover:underline cursor-pointer" 
                                        title={vara.nome}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleViewVara(vara);
                                        }}
                                      >
                                        {vara.nome}
                                      </span>
                                      {tribunal && (
                                        <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded uppercase tracking-wider shrink-0" title={tribunal.nome}>
                                          {tribunal.id}
                                        </span>
                                      )}
                                    </div>
                                    {forum && (
                                      <span className="text-[10px] text-app-text-muted truncate opacity-70" title={forum.nome}>
                                        {forum.nome}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs font-medium text-app-text-muted truncate block max-w-[200px]">{processo.tribunal || '-'}</span>
                                )}
                              </td>
                            );
                          case 'status':
                            return (
                              <td key={colId} className="px-4 py-3 hidden sm:table-cell">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  processo.status === 'Ativo' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-app-bg text-app-text-muted border border-app-border'
                                }`}>
                                  {processo.status}
                                </span>
                              </td>
                            );
                          default:
                            return null;
                        }
                      })}
                      <td className="px-4 py-3 text-right sticky right-0 z-10 bg-app-surface group-hover:bg-app-secondary transition-colors shadow-[-4px_0_8px_rgba(0,0,0,0.05)] hidden sm:table-cell">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenModal('view', processo); }}
                            className="text-app-text-muted hover:text-primary transition-colors p-2 rounded-full hover:bg-primary/10"
                            title="Visualizar"
                          >
                            <Eye size={18} />
                          </button>
                          {processo.status === 'Ativo' && processo.link && (
                            <button
                              onClick={(e) => { e.stopPropagation(); window.open(processo.link, '_blank'); }}
                              className="text-app-text-muted hover:text-primary transition-colors p-2 rounded-full hover:bg-primary/10"
                              title="Visualizar processo"
                            >
                              <Scale size={18} />
                            </button>
                          )}
                          {processo.status === 'Ativo' && processo.pasta && (
                            <button
                              onClick={(e) => { e.stopPropagation(); window.open(processo.pasta, '_blank'); }}
                              className="text-app-text-muted hover:text-primary transition-colors p-2 rounded-full hover:bg-primary/10"
                              title="Abrir pasta do processo"
                            >
                              <Folder size={18} />
                            </button>
                          )}
                          {hasPermission('processos', 'write') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenModal('edit', processo); }}
                              className="text-app-text-muted hover:text-primary transition-colors p-2 rounded-full hover:bg-primary/10"
                              title="Editar"
                            >
                              <Edit2 size={18} />
                            </button>
                          )}
                          {hasPermission('processos', 'delete') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(processo.id); }}
                              className="text-app-text-muted hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-500/10"
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
                {filteredProcessos.length === 0 && (
                  <tr>
                    <td colSpan={columnOrder.length + 1} className="p-8 text-center text-app-text-muted">
                      Nenhum processo encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </DndContext>
        </div>

        {/* Pagination Controls */}
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredProcessos.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          label="processos"
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={getModalTitle()} maxWidth="max-w-5xl">
        <form onSubmit={handleSave} className="flex flex-col max-h-[75vh]">
          <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Informações Básicas */}
            <div className="md:col-span-3">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider border-b border-primary/10 pb-2 mb-4">
                Informações Básicas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-app-text-muted uppercase">Tribunal</label>
                  <div className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text text-sm flex items-center gap-2 min-h-[38px]">
                    <Building2 size={16} className="text-primary shrink-0" />
                    <span className="font-medium truncate">
                      {(() => {
                        const varaId = formData.varaId || selectedProcesso?.varaId || selectedProcesso?.tribunal;
                        const vObj = state.varas.find(v => v.id === varaId || v.nome.toLowerCase() === (varaSearch || '').toLowerCase());
                        if (vObj) {
                          if (vObj.idTj) {
                            const t = state.tribunais.find(tr => tr.id === vObj.idTj || tr.id.toLowerCase() === vObj.idTj?.toLowerCase() || tr.sigla === vObj.idTj);
                            if (t) return t.sigla ? `${t.sigla} - ${t.nome}` : t.nome;
                          }
                          if (vObj.forum) {
                            const fObj = state.forums.find(f => f.id === vObj.forum || f.nome === vObj.forum);
                            if (fObj && fObj.tribunalId) {
                              const t = state.tribunais.find(tr => tr.id === fObj.tribunalId || tr.id.toLowerCase() === fObj.tribunalId?.toLowerCase());
                              if (t) return t.sigla ? `${t.sigla} - ${t.nome}` : t.nome;
                            }
                            const tDirect = state.tribunais.find(tr => tr.id === vObj.forum || tr.id.toLowerCase() === vObj.forum?.toLowerCase());
                            if (tDirect) return tDirect.sigla ? `${tDirect.sigla} - ${tDirect.nome}` : tDirect.nome;
                          }
                          return 'Não vinculado na Vara';
                        }
                        if (formData.tribunal) {
                          const tDirect = state.tribunais.find(tr => tr.id === formData.tribunal || tr.id.toLowerCase() === formData.tribunal.toLowerCase() || tr.sigla === formData.tribunal);
                          if (tDirect) return tDirect.sigla ? `${tDirect.sigla} - ${tDirect.nome}` : tDirect.nome;
                          return formData.tribunal;
                        }
                        return 'Vara não selecionada';
                      })()}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-app-text-muted uppercase">Número do Processo</label>
                    {formData.numero && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(formData.numero);
                          alert('Número do processo copiado!');
                        }}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                        title="Copiar número"
                      >
                        <Copy size={11} />
                        <span>Copiar</span>
                      </button>
                    )}
                  </div>
                  <input 
                    type="text" 
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-app-bg disabled:text-app-text-muted text-sm font-mono bg-app-surface text-app-text"
                    placeholder="Ex: 0000000-00.0000.0.00.0000"
                    value={formData.numero}
                    onChange={e => setFormData({...formData, numero: e.target.value})}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-app-text-muted uppercase">Título *</label>
                    {formData.titulo && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(formData.titulo);
                          alert('Título copiado!');
                        }}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                        title="Copiar título"
                      >
                        <Copy size={11} />
                        <span>Copiar</span>
                      </button>
                    )}
                  </div>
                  <input 
                    id="titulo_input"
                    type="text" 
                    required
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-app-bg disabled:text-app-text-muted text-sm bg-app-surface text-app-text"
                    value={formData.titulo}
                    onChange={e => setFormData({...formData, titulo: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-app-text-muted uppercase">Status</label>
                  <select 
                    disabled={modalMode === 'view'}
                    className={`w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-app-bg text-sm font-medium bg-app-surface ${
                      formData.status === 'Ativo' ? 'text-emerald-600 dark:text-emerald-400' : 'text-app-text-muted'
                    }`}
                    value={formData.status}
                    onChange={e => {
                      const newStatus = e.target.value as any;
                      setFormData({...formData, status: newStatus, ativo: newStatus});
                    }}
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
                {modalMode === 'view' && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-app-text-muted uppercase">Último Movimento</label>
                    <div className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text-muted text-sm font-medium flex items-center min-h-[38px]">
                      {selectedProcesso ? getUltimoMovDate(selectedProcesso) : '-'}
                    </div>
                  </div>
                )}
                {(isAdmin() || (currentUser?.escritoriosIds && currentUser.escritoriosIds.length > 1)) && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-app-text-muted uppercase">Escritório</label>
                    <select 
                      id="escritorioId_select"
                      disabled={modalMode === 'view'}
                      className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-app-bg disabled:text-app-text-muted text-sm bg-app-surface text-app-text"
                      value={formData.escritorioId}
                      onChange={e => setFormData({...formData, escritorioId: e.target.value})}
                    >
                      <option value="">Selecione um Escritório</option>
                      {isGlobalAdmin && <option value="x">GLOBAL (Todos os Escritórios)</option>}
                      {state.escritorios
                        .filter(e => isAdmin() || (currentUser?.escritoriosIds || []).includes(e.id))
                        .map(e => (
                          <option key={e.id} value={e.id}>{e.nome}</option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Detalhes Jurídicos */}
            <div className="md:col-span-3">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider border-b border-primary/10 pb-2 mb-4">
                Detalhes Jurídicos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-app-text-muted uppercase">Cliente</label>
                    {modalMode !== 'view' && (
                      <button
                        type="button"
                        onClick={() => setIsNewContactModalOpen(true)}
                        className="text-[10px] text-primary hover:underline flex items-center gap-1"
                      >
                        <UserPlus size={10} />
                        Cadastrar Novo
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    {modalMode === 'view' ? (
                      <button
                        type="button"
                        onClick={() => {
                          const clienteObj = state.contatos.find(c => String(c.id) === String(formData.clienteId)) ||
                                             state.contatos.find(c => c.nome.toLowerCase() === String(formData.clienteId || clientSearch).toLowerCase());
                          if (clienteObj) {
                            handleViewContato(clienteObj);
                          }
                        }}
                        disabled={!formData.clienteId && !clientSearch}
                        className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-sm text-left font-medium text-primary hover:border-primary/50 hover:bg-primary/5 transition-all group cursor-pointer disabled:cursor-not-allowed disabled:text-app-text-muted disabled:hover:bg-app-bg disabled:hover:border-app-border"
                        title="Clique para visualizar os detalhes do contato"
                      >
                        <span className="truncate group-hover:underline block">
                          {(() => {
                            const clienteObj = state.contatos.find(c => String(c.id) === String(formData.clienteId)) ||
                                               state.contatos.find(c => c.nome.toLowerCase() === String(formData.clienteId || clientSearch).toLowerCase());
                            return clienteObj ? clienteObj.nome : (formData.clienteId || clientSearch || 'Nenhum cliente associado');
                          })()}
                        </span>
                      </button>
                    ) : (
                      <input 
                        id="clienteId_input"
                        type="text" 
                        disabled={(modalMode as any) === 'view'}
                        className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-app-bg disabled:text-app-text-muted text-sm bg-app-surface text-app-text"
                        placeholder="Digite pelo menos 3 letras..."
                        value={formData.clienteId ? (state.contatos.find(c => c.id === formData.clienteId)?.nome || clientSearch) : clientSearch}
                        onChange={e => {
                          setClientSearch(e.target.value);
                          setShowClientResults(true);
                          if (formData.clienteId) {
                            setFormData({...formData, clienteId: ''});
                          }
                        }}
                        onFocus={() => setShowClientResults(true)}
                      />
                    )}
                    {showClientResults && clientSearch.length >= 3 && modalMode !== 'view' && (
                      <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setShowClientResults(false)} />
                        <div className="absolute top-full left-0 right-0 z-[70] mt-1 bg-app-surface border border-app-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                          {filteredClientsForPrimary.length > 0 ? (
                            filteredClientsForPrimary.map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setFormData({...formData, clienteId: c.id});
                                  setClientSearch(c.nome);
                                  setShowClientResults(false);
                                }}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-primary/10 text-app-text border-b border-app-border last:border-0 flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-medium">{c.nome}</div>
                                  <div className="text-[10px] text-app-text-muted">{c.cpfCnpj}</div>
                                </div>
                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase font-bold">Selecionar</span>
                              </button>
                            ))
                          ) : (
                            <div className="p-4 text-center text-sm text-app-text-muted italic">
                              Nenhum cliente encontrado.
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setIsNewContactModalOpen(true);
                              setShowClientResults(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-primary font-bold hover:bg-primary/5 flex items-center border-t border-app-border bg-app-surface sticky bottom-0"
                          >
                            <Plus size={16} className="mr-2" />
                            CADASTRAR NOVO CLIENTE
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-app-text-muted uppercase">TIPO</label>
                  <select 
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-app-bg disabled:text-app-text-muted text-sm bg-app-surface text-app-text"
                    value={formData.tipo}
                    onChange={e => setFormData({...formData, tipo: e.target.value})}
                  >
                    <option value="">Selecione o tipo</option>
                    <option value="Judicial">Judicial</option>
                    <option value="Administrativo">Administrativo</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-app-text-muted uppercase">Instância</label>
                  <select 
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-app-bg disabled:text-app-text-muted text-sm bg-app-surface text-app-text"
                    value={formData.instancia}
                    onChange={e => setFormData({...formData, instancia: e.target.value})}
                  >
                    <option value="">Selecione a instância</option>
                    <option value="1 grau">1 grau</option>
                    <option value="2 grau">2 grau</option>
                    <option value="Instancia Superior">Instancia Superior</option>
                  </select>
                </div>
                <div className="space-y-1 relative">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-app-text-muted uppercase">Vara</label>
                    {modalMode === 'view' && (formData.varaId || selectedProcesso?.varaId || selectedProcesso?.tribunal) && (
                      <button
                        type="button"
                        onClick={handleShowVaraStats}
                        className="text-[10px] text-primary hover:underline flex items-center gap-1 font-bold"
                      >
                        <BarChart2 size={12} />
                        Estatísticas da Vara
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    {modalMode === 'view' ? (
                      <button
                        type="button"
                        onClick={() => {
                          const varaId = formData.varaId || selectedProcesso?.varaId || selectedProcesso?.tribunal;
                          const varaObj = state.varas.find(v => String(v.id) === String(varaId)) ||
                                           state.varas.find(v => v.nome.toLowerCase() === String(varaSearch).toLowerCase());
                          if (varaObj) {
                            handleViewVara(varaObj);
                          }
                        }}
                        disabled={!formData.varaId && !selectedProcesso?.varaId && !selectedProcesso?.tribunal && !varaSearch}
                        className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-sm text-left font-medium text-primary hover:border-primary/50 hover:bg-primary/5 transition-all group cursor-pointer disabled:cursor-not-allowed disabled:text-app-text-muted disabled:hover:bg-app-bg disabled:hover:border-app-border"
                        title="Clique para visualizar os detalhes da vara"
                      >
                        <span className="truncate group-hover:underline block">
                          {(() => {
                            const varaId = formData.varaId || selectedProcesso?.varaId || selectedProcesso?.tribunal;
                            const varaObj = state.varas.find(v => String(v.id) === String(varaId)) ||
                                             state.varas.find(v => v.nome.toLowerCase() === String(varaSearch).toLowerCase());
                            return varaObj ? varaObj.nome : (varaSearch || 'Nenhuma vara associada');
                          })()}
                        </span>
                      </button>
                    ) : (
                      <input 
                        type="text" 
                        disabled={(modalMode as any) === 'view'}
                        className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-app-bg disabled:text-app-text-muted text-sm bg-app-surface text-app-text"
                        placeholder="Digite pelo menos 2 letras..."
                        value={formData.varaId ? (state.varas.find(v => v.id === formData.varaId)?.nome || varaSearch) : varaSearch}
                        onChange={e => {
                          setVaraSearch(e.target.value);
                          setShowVaraResults(true);
                          if (formData.varaId) {
                            setFormData({...formData, varaId: '', tribunal: ''});
                          }
                        }}
                        onFocus={() => setShowVaraResults(true)}
                      />
                    )}
                    {showVaraResults && varaSearch.length >= 2 && modalMode !== 'view' && (
                      <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setShowVaraResults(false)} />
                        <div className="absolute top-full left-0 right-0 z-[70] mt-1 bg-app-surface border border-app-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                          <button
                            type="button"
                            onClick={() => {
                              setIsNewVaraModalOpen(true);
                              setShowVaraResults(false);
                            }}
                            className="w-full text-left px-3 py-2 text-primary font-bold hover:bg-app-secondary border-b border-app-border text-sm"
                          >
                            ++ CADASTRAR NOVO ++
                          </button>
                          {state.varas
                            .filter(v => {
                              const normName = (v.nome || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                              const normSearch = (varaSearch || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                              return normName.includes(normSearch);
                            })
                            .map(v => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => {
                                  const foundTj = v.idTj || (state.forums.find(f => f.id === v.forum)?.tribunalId) || v.id;
                                  setFormData({...formData, varaId: v.id, tribunal: foundTj});
                                  setVaraSearch(v.nome);
                                  setShowVaraResults(false);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-app-secondary text-sm text-app-text"
                              >
                                {v.nome}
                              </button>
                            ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-app-text-muted uppercase">Secretaria (UPJ)</label>
                  <div className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text-muted text-sm italic min-h-[38px] flex items-center">
                    {(() => {
                      const vara = state.varas.find(v => v.id === formData.varaId);
                      const upj = state.upj.find(u => u.id === vara?.secretaria);
                      return upj?.nome || (vara as any)?.UPJ || (vara as any)?.UPJ_NOME || 'Vinculada à vara selecionada';
                    })()}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-app-text-muted uppercase">Classe</label>
                  <input 
                    type="text" 
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-app-bg disabled:text-app-text-muted text-sm bg-app-surface text-app-text"
                    value={formData.classe}
                    onChange={e => setFormData({...formData, classe: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-app-text-muted uppercase">Assunto</label>
                  <input 
                    type="text" 
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-app-bg disabled:text-app-text-muted text-sm bg-app-surface text-app-text"
                    value={formData.assunto}
                    onChange={e => setFormData({...formData, assunto: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Financeiro e Datas */}
            <div className="md:col-span-3">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider border-b border-primary/10 pb-2 mb-4">
                Financeiro e Datas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-app-text-muted uppercase">Valor da Causa</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-app-text-muted text-sm">R$</span>
                    <input 
                      type="number" 
                      disabled={modalMode === 'view'}
                      className="w-full pl-9 pr-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-app-bg disabled:text-app-text-muted text-sm bg-app-surface text-app-text"
                      value={formData.valorCausa}
                      onChange={e => setFormData({...formData, valorCausa: Number(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-app-text-muted uppercase">Data de Distribuição</label>
                  <input 
                    type="date" 
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-app-bg disabled:text-app-text-muted text-sm bg-app-surface text-app-text"
                    value={formData.dataDistribuicao}
                    onChange={e => setFormData({...formData, dataDistribuicao: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-app-text-muted uppercase">Resultado</label>
                  <input 
                    type="text" 
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-app-bg disabled:text-app-text-muted text-sm bg-app-surface text-app-text"
                    value={formData.resultado}
                    onChange={e => setFormData({...formData, resultado: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Acompanhamento */}
            <div className="md:col-span-3">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider border-b border-primary/10 pb-2 mb-4">
                Acompanhamento
              </h3>

              {modalMode === 'view' ? (
                <div className="space-y-4">
                  {/* Row of clickable icons for saved links */}
                  {(formData.link || formData.pasta) && (
                    <div className="flex flex-wrap gap-3 items-center">
                      {formData.link && (
                        <a
                          href={formData.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 border border-app-border rounded-xl text-primary hover:bg-app-secondary hover:border-primary/30 transition-all flex items-center justify-center shadow-sm"
                          title={`Acessar Link: ${formData.link}`}
                        >
                          <LinkIcon size={20} />
                        </a>
                      )}
                      {formData.pasta && (
                        (formData.pasta.startsWith('http') || formData.pasta.includes('://')) ? (
                          <a
                            href={formData.pasta}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 border border-app-border rounded-xl text-amber-500 hover:bg-app-secondary hover:border-amber-500/30 transition-all flex items-center justify-center shadow-sm"
                            title={`Abrir Pasta: ${formData.pasta}`}
                          >
                            <Folder size={20} />
                          </a>
                        ) : (
                          <div 
                            className="px-3 py-2 border border-app-border rounded-xl text-app-text bg-app-secondary/30 text-sm font-semibold flex items-center gap-2 shadow-sm"
                            title={`Pasta Física: ${formData.pasta}`}
                          >
                            <Folder size={18} className="text-amber-500" />
                            <span>{formData.pasta}</span>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* Marcadores / Etiquetas */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-app-text-muted uppercase mb-1 block">Marcadores / Etiquetas</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-app-surface border border-app-border rounded-xl min-h-[52px] relative items-center">
                      {tagsArray.map(tagId => {
                        const tag = availableEtiquetas.find(t => String(t.id) === String(tagId));
                        if (!tag) return null;
                        return (
                          <div 
                            key={tag.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm"
                            style={{ 
                              backgroundColor: tag.cor || 'var(--primary)', 
                              color: '#fff',
                            }}
                          >
                            {tag.nome.toUpperCase()}
                          </div>
                        );
                      })}
                      {tagsArray.length === 0 && (
                        <span className="text-sm text-app-text-muted italic px-2">Nenhum marcador associado.</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Link e Pasta na mesma linha */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-app-text-muted uppercase">Link</label>
                      <input 
                        type="url" 
                        className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text text-sm"
                        value={formData.link}
                        onChange={e => setFormData({...formData, link: e.target.value})}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-app-text-muted uppercase">Pasta</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text text-sm"
                        value={formData.pasta}
                        onChange={e => setFormData({...formData, pasta: e.target.value})}
                        placeholder="Número ou nome da pasta..."
                      />
                    </div>
                  </div>

                  {/* Marcadores / Etiquetas */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-app-text-muted uppercase mb-1 block">Marcadores / Etiquetas</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-app-surface border border-app-border rounded-xl min-h-[52px] relative items-center">
                      {/* Tags Selecionadas */}
                      {tagsArray.map(tagId => {
                        const tag = availableEtiquetas.find(t => String(t.id) === String(tagId));
                        if (!tag) return null;
                        return (
                          <div 
                            key={tag.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm animate-in fade-in zoom-in duration-200"
                            style={{ 
                              backgroundColor: tag.cor || 'var(--primary)', 
                              color: '#fff',
                            }}
                          >
                            {tag.nome.toUpperCase()}
                            <button 
                              type="button" 
                              onClick={() => {
                                const newTags = tagsArray.filter(id => id !== tagId);
                                setFormData({ ...formData, tags: newTags.join(',') });
                              }}
                              className="hover:bg-black/10 rounded-full p-0.5 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}

                      {/* Botão Adicionar */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowTagSelector(!showTagSelector)}
                          className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center hover:opacity-90 transition-all shadow-md active:scale-95"
                          title="Adicionar Marcador"
                        >
                          <Plus size={20} />
                        </button>
                        
                        {showTagSelector && (
                          <>
                            <div 
                              className="fixed inset-0 z-[60]" 
                              onClick={() => setShowTagSelector(false)}
                            />
                            <div className="absolute top-10 left-0 z-[70] w-56 bg-app-surface border border-app-border rounded-xl shadow-2xl p-2 max-h-60 overflow-y-auto animate-in slide-in-from-top-2 duration-200">
                              <div className="text-[10px] font-extrabold text-app-text-muted uppercase px-2 py-1 border-b border-app-border mb-2 mb-1 bg-app-secondary/50 rounded-t-lg">
                                Selecionar Marcador
                              </div>
                              <div className="space-y-1">
                                {unselectedTags.map(tag => (
                                  <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() => {
                                      const newTags = [...tagsArray, String(tag.id)];
                                      setFormData({ ...formData, tags: newTags.join(',') });
                                      setShowTagSelector(false);
                                    }}
                                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-app-secondary transition-colors text-xs font-bold flex items-center gap-2 group"
                                  >
                                    <div 
                                      className="w-3 h-3 rounded-full border border-black/10 shadow-sm transition-transform group-hover:scale-110" 
                                      style={{ backgroundColor: tag.cor || 'var(--primary)' }} 
                                    />
                                    <span className="text-app-text">{tag.nome}</span>
                                  </button>
                                ))}
                                {unselectedTags.length === 0 && (
                                  <div className="px-2 py-4 text-center text-[11px] text-app-text-muted italic">
                                    Todas as etiquetas já foram utilizadas.
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 border-t border-app-border pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-app-text flex items-center">
                <DollarSign className="mr-2 text-primary" size={20} />
                Financeiro Relacionado
              </h3>
              {(isAdmin() || hasPermission('financeiro', 'write')) && (
                <button
                  type="button"
                  onClick={handleOpenAddFinanceiro}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/95 hover:shadow-md transition-all active:scale-95 shadow-sm"
                >
                  <Plus size={14} />
                  Adicionar Lançamento
                </button>
              )}
            </div>
            
            <div className="bg-app-secondary/30 rounded-xl border border-app-border overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-app-secondary text-app-text-muted text-xs uppercase tracking-wider">
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium">Tipo</th>
                    <th className="p-3 font-medium">Valor</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Observações</th>
                    <th className="p-3 font-medium">Usuário</th>
                    <th className="p-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {processFinanceiro.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-app-text-muted text-sm">
                        Nenhum registro financeiro encontrado.
                      </td>
                    </tr>
                  ) : (
                    processFinanceiro.map((trans, idx) => {
                      const usuario = state.usuarios.find(u => u.id === trans.usuarioId);
                      const canEditTrans = isAdmin() || hasPermission('financeiro', 'write') || (currentUser?.id && trans.usuarioId === currentUser.id);
                      const canDeleteTrans = isAdmin() || hasPermission('financeiro', 'delete') || (currentUser?.id && trans.usuarioId === currentUser.id);

                      return (
                        <tr key={trans.id || idx} className="text-sm hover:bg-app-bg/50 transition-colors">
                          <td className="p-3 text-app-text-muted whitespace-nowrap">
                            {formatDate(trans.data)}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              trans.tipo === 'Receita' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            }`}>
                              {trans.tipo}
                            </span>
                          </td>
                          <td className={`p-3 font-medium ${trans.tipo === 'Receita' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(trans.valor)}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              trans.status === 'Pago' 
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' 
                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                            }`}>
                              {trans.status || 'Pendente'}
                            </span>
                          </td>
                          <td className="p-3 text-app-text-muted max-w-xs truncate" title={trans.observacoes || trans.descricao}>
                            {trans.observacoes || trans.descricao || '-'}
                          </td>
                          <td className="p-3 text-app-text-muted text-xs">
                            {usuario?.nome || trans.usuarioId || '-'}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-2">
                              {canEditTrans && (
                                <button
                                  type="button"
                                  onClick={() => handleEditFinanceiro(trans)}
                                  className="p-1 hover:bg-app-bg rounded text-primary transition-colors"
                                  title="Editar Lançamento"
                                >
                                  <Edit2 size={16} />
                                </button>
                              )}
                              {canDeleteTrans && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteFinanceiro(trans.id)}
                                  className="p-1 hover:bg-app-bg rounded text-red-500 transition-colors"
                                  title="Excluir Lançamento"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 border-t border-app-border pt-6">
            <h3 className="text-lg font-semibold text-app-text mb-4 flex items-center">
              <Scale className="mr-2 text-primary" size={20} />
              Partes Envolvidas
            </h3>
            
            {modalMode !== 'view' && (
              <div className="flex flex-col md:flex-row gap-3 mb-6 relative">
                <div className="flex-1 relative">
                  <label className="text-[10px] font-bold text-app-text-muted uppercase mb-1 block">Buscar Contato (mín. 3 letras)</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted" size={16} />
                    <input 
                      type="text"
                      placeholder="Nome, CPF ou CNPJ..."
                      className="w-full pl-9 pr-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text text-sm"
                      value={contactSearchTerm}
                      onChange={(e) => {
                        setContactSearchTerm(e.target.value);
                        setShowContactResults(true);
                      }}
                      onFocus={() => setShowContactResults(true)}
                    />
                  </div>
                  
                  {showContactResults && contactSearchTerm.length >= 3 && (
                    <>
                      <div className="fixed inset-0 z-[55]" onClick={() => setShowContactResults(false)} />
                      <div className="absolute top-full left-0 right-0 z-[60] mt-1 bg-app-surface border border-app-border rounded-xl shadow-2xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                        {filteredContacts.length > 0 ? (
                          <div className="p-1">
                            {filteredContacts.map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setSelectedContactToAdd(c.id);
                                  setContactSearchTerm(c.nome);
                                  setShowContactResults(false);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg hover:bg-primary/10 transition-colors flex flex-col ${selectedContactToAdd === c.id ? 'bg-primary/5 border border-primary/20' : ''}`}
                              >
                                <span className="text-sm font-bold text-app-text">{c.nome}</span>
                                <span className="text-[10px] text-app-text-muted">{c.cpfCnpj} • {c.tipo}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-sm text-app-text-muted italic">
                            Nenhum contato encontrado.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="w-full md:w-64">
                  <label className="text-[10px] font-bold text-app-text-muted uppercase mb-1 block">Tipo de Envolvimento</label>
                  <select 
                    className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text text-sm"
                    value={selectedTipoEnvolvimento}
                    onChange={e => setSelectedTipoEnvolvimento(e.target.value)}
                  >
                    <option value="">Selecione o tipo...</option>
                    {state.tipoEnvolvimentos
                      .sort((a, b) => {
                        const isDefaultA = a.id === 'apelante' || a.id === 'apelado';
                        const isDefaultB = b.id === 'apelante' || b.id === 'apelado';
                        if (isDefaultA && !isDefaultB) return 1;
                        if (!isDefaultA && isDefaultB) return -1;
                        return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
                      })
                      .map(t => (
                        <option key={t.id} value={t.nome}>{t.nome}</option>
                      ))
                    }
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedContactToAdd && selectedTipoEnvolvimento) {
                        // Create involvement record
                        const envId = `env_${Date.now()}`;
                        const procId = selectedProcesso?.idProc || selectedProcesso?.id || selectedProcesso?.numero || '';
                        
                        addEnvolvimento({
                          id: envId,
                          contatoId: selectedContactToAdd,
                          processoId: procId,
                          tipoEnvolvimento: selectedTipoEnvolvimento,
                          escritorioId: escritorioAtivoId || 'x'
                        });
                        
                        setFormData({
                          ...formData,
                          envolvidosIds: [...formData.envolvidosIds, selectedContactToAdd]
                        });
                        
                        setSelectedContactToAdd('');
                        setContactSearchTerm('');
                        setSelectedTipoEnvolvimento('');
                      }
                    }}
                    disabled={!selectedContactToAdd || !selectedTipoEnvolvimento}
                    className="w-full md:w-auto px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed h-[42px] self-end"
                  >
                    <Plus size={18} className="mr-1" /> Adicionar Parte
                  </button>
                </div>
              </div>
            )}

            <div className="bg-app-secondary/30 rounded-xl border border-app-border overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-app-secondary text-app-text-muted text-xs uppercase tracking-wider">
                    <th className="p-3 font-medium">Nome</th>
                    <th className="p-3 font-medium">Tipo de Envolvimento</th>
                    {modalMode !== 'view' && <th className="p-3 font-medium text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {formData.envolvidosIds.length === 0 ? (
                    <tr>
                      <td colSpan={modalMode !== 'view' ? 3 : 2} className="p-4 text-center text-app-text-muted text-sm">
                        Nenhuma parte envolvida adicionada.
                      </td>
                    </tr>
                  ) : (
                    formData.envolvidosIds.map((id, index) => {
                      // Try to find contact by ID (string comparison)
                      let contato = state.contatos.find(c => String(c.id) === String(id));
                      
                      // Fallback: Try to find by name if id looks like a name or if ID match failed
                      if (!contato) {
                        contato = state.contatos.find(c => c.nome.toLowerCase() === String(id).toLowerCase());
                      }

                      const envolvimento = state.envolvidos.find(e => {
                        const eProcId = String(e.processoId || '').trim();
                        if (!eProcId) return false;
                        const pId = String(selectedProcesso?.id || '').trim();
                        const pNum = String(selectedProcesso?.numero || '').trim();
                        return ((pId && eProcId === pId) || (pNum && eProcId === pNum)) && 
                          String(e.contatoId) === String(id);
                      });
                      
                      if (!contato) {
                        // If contact not found in state, we might still want to show the ID or a placeholder
                        return (
                          <tr key={`${id}-${index}`} className="text-sm">
                            <td className="p-3 text-app-text-muted italic">Contato não encontrado ({id})</td>
                            <td className="p-3 text-app-text-muted italic">
                              {editingEnvolvidoContactId === String(id) ? (
                                <select 
                                  className="px-2 py-1 border border-app-border rounded-lg bg-app-surface text-app-text text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                                  value={editingTipoEnvolvimento}
                                  onChange={e => setEditingTipoEnvolvimento(e.target.value)}
                                >
                                  <option value="">Selecione...</option>
                                  {state.tipoEnvolvimentos
                                    .sort((a, b) => {
                                      const isDefaultA = a.id === 'apelante' || a.id === 'apelado';
                                      const isDefaultB = b.id === 'apelante' || b.id === 'apelado';
                                      if (isDefaultA && !isDefaultB) return 1;
                                      if (!isDefaultA && isDefaultB) return -1;
                                      return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
                                    })
                                    .map(t => (
                                      <option key={t.id} value={t.nome}>{t.nome}</option>
                                    ))
                                  }
                                </select>
                              ) : (
                                envolvimento?.tipoEnvolvimento || '-'
                              )}
                            </td>
                            {modalMode !== 'view' && (
                              <td className="p-3 text-right">
                                {editingEnvolvidoContactId === String(id) ? (
                                  <div className="inline-flex items-center space-x-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (envolvimento) {
                                          updateEnvolvimento({
                                            ...envolvimento,
                                            tipoEnvolvimento: editingTipoEnvolvimento
                                          });
                                        } else {
                                          const envId = `env_${Date.now()}`;
                                          const procId = selectedProcesso?.idProc || selectedProcesso?.id || selectedProcesso?.numero || '';
                                          addEnvolvimento({
                                            id: envId,
                                            contatoId: String(id),
                                            processoId: procId,
                                            tipoEnvolvimento: editingTipoEnvolvimento,
                                            escritorioId: escritorioAtivoId || 'x'
                                          });
                                        }
                                        setEditingEnvolvidoContactId(null);
                                      }}
                                      className="text-emerald-500 hover:text-emerald-700 transition-colors p-1"
                                      title="Salvar alterações"
                                    >
                                      <Check size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingEnvolvidoContactId(null);
                                      }}
                                      className="text-app-text-muted hover:text-app-text transition-colors p-1"
                                      title="Cancelar"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center space-x-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingEnvolvidoContactId(String(id));
                                        setEditingTipoEnvolvimento(envolvimento?.tipoEnvolvimento || '');
                                      }}
                                      className="text-primary hover:text-primary-dark transition-colors p-1"
                                      title="Editar envolvimento"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFormData({
                                          ...formData,
                                          envolvidosIds: formData.envolvidosIds.filter(eid => eid !== id)
                                        });
                                        if (envolvimento) {
                                          deleteEnvolvimento(envolvimento.id);
                                        }
                                      }}
                                      className="text-red-500 hover:text-red-700 transition-colors p-1"
                                      title="Remover envolvimento"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      }

                      return (
                        <tr key={`${id}-${index}`} className="text-sm">
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => handleViewContato(contato)}
                              className="text-app-text font-medium hover:text-primary hover:underline text-left transition-colors focus:outline-none"
                              title="Visualizar detalhes do contato"
                            >
                              {contato.nome}
                            </button>
                          </td>
                          <td className="p-3 text-primary font-medium">
                            {editingEnvolvidoContactId === String(id) ? (
                              <select 
                                className="px-2 py-1 border border-app-border rounded-lg bg-app-surface text-app-text text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                                value={editingTipoEnvolvimento}
                                onChange={e => setEditingTipoEnvolvimento(e.target.value)}
                              >
                                <option value="">Selecione...</option>
                                {state.tipoEnvolvimentos
                                  .sort((a, b) => {
                                    const isDefaultA = a.id === 'apelante' || a.id === 'apelado';
                                    const isDefaultB = b.id === 'apelante' || b.id === 'apelado';
                                    if (isDefaultA && !isDefaultB) return 1;
                                    if (!isDefaultA && isDefaultB) return -1;
                                    return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
                                  })
                                  .map(t => (
                                    <option key={t.id} value={t.nome}>{t.nome}</option>
                                  ))
                                }
                              </select>
                            ) : (
                              envolvimento?.tipoEnvolvimento || '-'
                            )}
                          </td>
                          {modalMode !== 'view' && (
                            <td className="p-3 text-right">
                              {editingEnvolvidoContactId === String(id) ? (
                                <div className="inline-flex items-center space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (envolvimento) {
                                        updateEnvolvimento({
                                          ...envolvimento,
                                          tipoEnvolvimento: editingTipoEnvolvimento
                                        });
                                      } else {
                                        const envId = `env_${Date.now()}`;
                                        const procId = selectedProcesso?.idProc || selectedProcesso?.id || selectedProcesso?.numero || '';
                                        addEnvolvimento({
                                          id: envId,
                                          contatoId: String(id),
                                          processoId: procId,
                                          tipoEnvolvimento: editingTipoEnvolvimento,
                                          escritorioId: escritorioAtivoId || 'x'
                                        });
                                      }
                                      setEditingEnvolvidoContactId(null);
                                    }}
                                    className="text-emerald-500 hover:text-emerald-700 transition-colors p-1"
                                    title="Salvar alterações"
                                  >
                                    <Check size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingEnvolvidoContactId(null);
                                    }}
                                    className="text-app-text-muted hover:text-app-text transition-colors p-1"
                                    title="Cancelar"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingEnvolvidoContactId(String(id));
                                      setEditingTipoEnvolvimento(envolvimento?.tipoEnvolvimento || '');
                                    }}
                                    className="text-primary hover:text-primary-dark transition-colors p-1"
                                    title="Editar envolvimento"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormData({
                                        ...formData,
                                        envolvidosIds: formData.envolvidosIds.filter(eid => eid !== id)
                                      });
                                      if (envolvimento) {
                                        deleteEnvolvimento(envolvimento.id);
                                      }
                                    }}
                                    className="text-red-500 hover:text-red-700 transition-colors p-1"
                                    title="Remover envolvimento"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {state.settings.showMovimentos !== false && (
            <div className="mt-8 border-t border-app-border pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-app-text flex items-center">
                  <History className="mr-2 text-primary" size={20} />
                  Movimentações
                </h3>
                <div className="flex items-center space-x-3">
                  {processMovimentos.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setIsMovimentosModalOpen(true)}
                      className="text-sm text-primary hover:text-primary/80 font-medium"
                    >
                      Visualizar todas
                    </button>
                  )}
                  {modalMode !== 'view' && hasPermission('movimentos', 'write') && (
                    <button
                      type="button"
                      onClick={handleOpenAddMovimento}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/95 hover:shadow-md transition-all active:scale-95 shadow-sm"
                    >
                      <Plus size={14} />
                      Adicionar Movimento
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-app-secondary/30 rounded-xl border border-app-border overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-app-secondary text-app-text-muted text-xs uppercase tracking-wider">
                      <th className="p-3 font-medium">Data</th>
                      <th className="p-3 font-medium">Movimentação</th>
                      <th className="p-3 font-medium">Página</th>
                      <th className="p-3 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border">
                    {last5Movimentos.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-app-text-muted text-sm">
                          Nenhuma movimentação encontrada.
                        </td>
                      </tr>
                    ) : (
                      last5Movimentos.map((mov, idx) => (
                        <tr key={mov.id || idx} className="text-sm">
                          <td className="p-3 text-app-text-muted whitespace-nowrap">
                            {formatDate(mov.data)}
                          </td>
                          <td className="p-3 text-app-text">{mov.descricao}</td>
                          <td className="p-3 text-app-text-muted">{mov.pagina || '-'}</td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-2">
                              {modalMode === 'edit' && (hasPermission('movimentos', 'write') || (currentUser?.id && mov.usuarioId === currentUser.id)) && (
                                <button
                                  type="button"
                                  onClick={() => handleEditMovimento(mov)}
                                  className="p-1 hover:bg-app-bg rounded text-primary transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 size={16} />
                                </button>
                              )}
                              {modalMode === 'edit' && (hasPermission('movimentos', 'delete') || (currentUser?.id && mov.usuarioId === currentUser.id)) && (
                                <button
                                  type="button"
                                  onClick={() => deleteMovimento(mov.id)}
                                  className="p-1 hover:bg-app-bg rounded text-red-500 transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-8 border-t border-app-border pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-app-text flex items-center">
                <ListTodo className="mr-2 text-primary" size={20} />
                Tarefas Associadas
              </h3>
              <div className="flex items-center space-x-3">
                {processTarefas.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setIsTarefasModalOpen(true)}
                    className="text-sm text-primary hover:text-primary/80 font-medium"
                  >
                    Visualizar todas
                  </button>
                )}
                {modalMode !== 'view' && hasPermission('tarefas', 'write') && (
                  <button
                    type="button"
                    onClick={handleOpenAddTarefa}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/95 hover:shadow-md transition-all active:scale-95 shadow-sm"
                  >
                    <Plus size={14} />
                    Adicionar Tarefa
                  </button>
                )}
              </div>
            </div>

            <div className="bg-app-secondary/30 rounded-xl border border-app-border overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-app-secondary text-app-text-muted text-xs uppercase tracking-wider">
                    <th className="p-3 font-medium">Prazo Final</th>
                    <th className="p-3 font-medium">Tarefa</th>
                    <th className="p-3 font-medium">Responsável</th>
                    <th className="p-3 font-medium text-center">Status</th>
                    <th className="p-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {last5Tarefas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-app-text-muted text-sm">
                        Nenhuma tarefa associada encontrada.
                      </td>
                    </tr>
                  ) : (
                    last5Tarefas.map((tarefa, idx) => {
                      const responsavel = state.usuarios.find(u => u.id === (tarefa.RESPONSAVEL_ID || tarefa.ID_USER));
                      return (
                        <tr key={tarefa.ID_TAREFA || idx} className="text-sm hover:bg-app-bg/50 transition-colors">
                          <td className="p-3 text-app-text-muted whitespace-nowrap">
                            {formatDate(tarefa.PRAZO_FIM || tarefa.DATA_LIMITE)}
                          </td>
                          <td className="p-3 text-app-text font-medium">{tarefa.TAREFA || tarefa.TITULO}</td>
                          <td className="p-3 text-app-text-muted">{responsavel?.nome || tarefa.RESPONSAVEL_ID || tarefa.ID_USER || '-'}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              tarefa.STATUS.toLowerCase().includes('concl') || tarefa.STATUS.toLowerCase().includes('pago') 
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                                : tarefa.STATUS.toLowerCase().includes('andamento')
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                : tarefa.STATUS.toLowerCase().includes('terceiro')
                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                            }`}>
                              {tarefa.STATUS}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                          <div className="flex justify-end gap-2">
                            {(tarefa.LINK || selectedProcesso?.link) && (
                              <a
                                href={tarefa.LINK || selectedProcesso?.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 hover:bg-app-bg rounded text-primary transition-colors"
                                title="Acessar"
                              >
                                <LinkIcon size={14} />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleViewTarefa(tarefa)}
                              className="p-1 hover:bg-app-secondary rounded text-app-text-muted transition-colors"
                              title="Visualizar"
                            >
                              <Eye size={14} />
                            </button>
                            {modalMode === 'edit' && (isAdmin() || hasPermission('tarefas', 'write') || (currentUser?.id && (tarefa.ID_USER === currentUser.id || tarefa.RESPONSAVEL_ID === currentUser.id))) && (
                              <button
                                type="button"
                                onClick={() => handleEditTarefa(tarefa)}
                                className="p-1 hover:bg-app-secondary rounded text-primary transition-colors"
                                title="Editar"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                            {modalMode === 'edit' && (isAdmin() || hasPermission('tarefas', 'delete') || (currentUser?.id && (tarefa.ID_USER === currentUser.id || tarefa.RESPONSAVEL_ID === currentUser.id))) && (
                              <button
                                type="button"
                                onClick={() => deleteTarefa(tarefa.ID_TAREFA)}
                                className="p-1 hover:bg-app-secondary rounded text-red-500 transition-colors"
                                title="Excluir"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>
          </div>

            {/* Eventos Associados Section */}
          <div className="mt-8 border-t border-app-border pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-app-text flex items-center">
                <Calendar className="mr-2 text-primary" size={20} />
                Eventos Associados
              </h3>
              <div className="flex items-center space-x-3">
                {modalMode !== 'view' && hasPermission('eventos', 'write') && (
                  <button
                    type="button"
                    onClick={() => {
                      setInitialEventoData({
                        processoId: selectedProcesso?.id,
                        titulo: `Prazo: ${selectedProcesso?.numero || ''}`,
                        data: new Date().toISOString().split('T')[0],
                        tipo: 'Prazo',
                        observacoes: `PROCESSO: ${selectedProcesso?.numero || ''}`
                      });
                      setIsNewEventoModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/95 hover:shadow-md transition-all active:scale-95 shadow-sm"
                  >
                    <Plus size={14} />
                    Adicionar Evento
                  </button>
                )}
              </div>
            </div>

            <div className="bg-app-secondary/30 rounded-xl border border-app-border overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-app-secondary text-app-text-muted text-xs uppercase tracking-wider">
                    <th className="p-3 font-medium">Prazo / Data</th>
                    <th className="p-3 font-medium">Evento</th>
                    <th className="p-3 font-medium text-center">Tipo</th>
                    <th className="p-3 font-medium text-center">Link</th>
                    <th className="p-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {last5Eventos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-app-text-muted text-sm">
                        Nenhum evento associado encontrado.
                      </td>
                    </tr>
                  ) : (
                    last5Eventos.map((evento, idx) => (
                      <tr key={evento.id || idx} className="text-sm hover:bg-app-bg/50 transition-colors">
                        <td className="p-3 text-app-text-muted whitespace-nowrap">
                          {formatDateTime(evento.data)}
                        </td>
                        <td className="p-3 text-app-text font-medium">{evento.titulo}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            evento.tipo === 'Prazo' 
                              ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' 
                              : evento.tipo === 'Audiência'
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                              : evento.tipo === 'Reunião'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                              : 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400'
                          }`}>
                            {evento.tipo}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {evento.link ? (
                            <a
                              href={evento.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-primary hover:underline font-medium gap-1 text-xs"
                              title="Acessar Link do Evento"
                            >
                              <LinkIcon size={14} className="text-primary" />
                              <span>Acessar</span>
                            </a>
                          ) : (
                            <span className="text-app-text-muted text-xs">-</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-2">
                            <a
                              href={getGoogleCalendarUrl(evento)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 hover:bg-app-secondary rounded text-emerald-600 dark:text-emerald-400 transition-colors"
                              title="Adicionar ao Google Agenda"
                            >
                              <CalendarPlus size={14} />
                            </a>
                            {modalMode === 'edit' && (isAdmin() || hasPermission('eventos', 'write') || (currentUser?.id && evento.usuarioId === currentUser.id)) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setInitialEventoData(evento);
                                  setIsNewEventoModalOpen(true);
                                }}
                                className="p-1 hover:bg-app-secondary rounded text-primary transition-colors"
                                title="Editar"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                            {modalMode === 'edit' && (isAdmin() || hasPermission('eventos', 'delete') || (currentUser?.id && evento.usuarioId === currentUser.id)) && (
                              <button
                                type="button"
                                onClick={() => deleteEvento(evento.id)}
                                className="p-1 hover:bg-app-secondary rounded text-red-500 transition-colors"
                                title="Excluir"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {formError && (
            <div id="form-error-banner" className="p-4 mt-6 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl flex items-start gap-3 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
              <AlertCircle className="shrink-0 mt-0.5" size={18} />
              <div className="flex-1">
                <h4 className="font-bold">Não foi possível salvar o processo</h4>
                <p className="mt-1 text-xs opacity-90">{formError}</p>
              </div>
            </div>
          )}

          </div>

          {/* Standardized bottom bar layout */}
          <div className="pt-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 border-t border-app-border mt-4">
            {/* Left aligned utility buttons & Navigation */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {selectedProcesso?.link && (
                <a 
                  href={selectedProcesso.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center text-sm font-medium shadow-sm"
                >
                  <LinkIcon size={16} className="mr-1.5" />
                  Acessar Processo
                </a>
              )}

              {modalMode !== 'create' && currentProcessIndex !== -1 && (
                <div className="inline-flex items-center gap-1 bg-app-bg p-1 rounded-lg border border-app-border text-xs">
                  <button
                    type="button"
                    onClick={() => handleNavigateProcesso('prev')}
                    disabled={!hasPrevProcesso}
                    className="px-2.5 py-1.5 rounded-md hover:bg-app-surface disabled:opacity-30 disabled:cursor-not-allowed text-app-text hover:text-primary transition-all font-medium flex items-center gap-1"
                    title="Processo Anterior"
                  >
                    <ChevronLeft size={14} />
                    <span>Anterior</span>
                  </button>
                  <span className="px-2 text-app-text-muted font-medium select-none">
                    {currentProcessIndex + 1} / {sortedAndFilteredProcessos.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleNavigateProcesso('next')}
                    disabled={!hasNextProcesso}
                    className="px-2.5 py-1.5 rounded-md hover:bg-app-surface disabled:opacity-30 disabled:cursor-not-allowed text-app-text hover:text-primary transition-all font-medium flex items-center gap-1"
                    title="Próximo Processo"
                  >
                    <span>Próximo</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Right aligned dismiss / submit buttons */}
            <div className="flex items-center justify-end space-x-3">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-bg transition-colors text-sm font-medium"
              >
                {modalMode === 'view' ? 'Fechar' : 'Cancelar'}
              </button>
              {modalMode !== 'view' && (
                <button 
                  type="submit"
                  className="px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors text-sm font-semibold"
                >
                  {modalMode === 'create' ? 'Salvar Processo' : 'Atualizar Processo'}
                </button>
              )}
              {modalMode === 'view' && (
                <button 
                  type="button"
                  onClick={() => setModalMode('edit')}
                  className="px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors text-sm font-semibold"
                >
                  Editar
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={isMovimentosModalOpen} 
        onClose={() => setIsMovimentosModalOpen(false)} 
        title={`Todas as Movimentações - ${formatCNJ(selectedProcesso?.numero || '')}`}
      >
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-app-bg shadow-sm">
              <tr className="bg-app-secondary text-app-text-muted text-xs uppercase tracking-wider">
                <th className="p-4 font-medium">Data</th>
                <th className="p-4 font-medium">Movimentação</th>
                <th className="p-4 font-medium">Página</th>
                <th className="p-4 font-medium">Usuário</th>
                <th className="p-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {processMovimentos.map((mov, idx) => {
                const usuario = state.usuarios.find(u => u.id === mov.usuarioId);
                return (
                  <tr key={mov.id || idx} className="hover:bg-app-bg transition-colors">
                    <td className="p-4 text-sm text-app-text-muted whitespace-nowrap">
                      {formatDate(mov.data)}
                    </td>
                    <td className="p-4 text-sm text-app-text">{mov.descricao}</td>
                    <td className="p-4 text-sm text-app-text-muted">{mov.pagina || '-'}</td>
                    <td className="p-4 text-sm text-app-text-muted">{usuario?.nome || mov.usuarioId || '-'}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        {modalMode === 'edit' && (hasPermission('movimentos', 'write') || (currentUser?.id && mov.usuarioId === currentUser.id)) && (
                          <button
                            type="button"
                            onClick={() => handleEditMovimento(mov)}
                            className="p-1 hover:bg-app-secondary rounded text-primary transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        {modalMode === 'edit' && (hasPermission('movimentos', 'delete') || (currentUser?.id && mov.usuarioId === currentUser.id)) && (
                          <button
                            type="button"
                            onClick={() => deleteMovimento(mov.id)}
                            className="p-1 hover:bg-app-secondary rounded text-red-500 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setIsMovimentosModalOpen(false)}
            className="px-4 py-2 bg-app-secondary text-app-text rounded-lg hover:bg-app-bg transition-colors"
          >
            Fechar
          </button>
        </div>
      </Modal>

      <Modal 
        isOpen={isTarefasModalOpen} 
        onClose={() => setIsTarefasModalOpen(false)} 
        title={`Todas as Tarefas - ${formatCNJ(selectedProcesso?.numero || '')}`}
        maxWidth="max-w-4xl"
      >
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-app-bg shadow-sm z-10">
              <tr className="bg-app-secondary text-app-text-muted text-xs uppercase tracking-wider">
                <th className="p-4 font-medium">Prazo Final</th>
                <th className="p-4 font-medium">Tarefa</th>
                <th className="p-4 font-medium">Responsável</th>
                <th className="p-4 font-medium text-center">Status</th>
                <th className="p-4 font-medium">Prioridade</th>
                <th className="p-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {processTarefas.map((tarefa, idx) => {
                const responsavel = state.usuarios.find(u => u.id === (tarefa.RESPONSAVEL_ID || tarefa.ID_USER));
                return (
                  <tr key={tarefa.ID_TAREFA || idx} className="hover:bg-app-bg transition-colors">
                    <td className="p-4 text-sm text-app-text-muted whitespace-nowrap">
                      {formatDate(tarefa.PRAZO_FIM || tarefa.DATA_LIMITE)}
                    </td>
                    <td className="p-4 text-sm text-app-text font-medium">{tarefa.TAREFA || tarefa.TITULO}</td>
                    <td className="p-4 text-sm text-app-text-muted">{responsavel?.nome || tarefa.RESPONSAVEL_ID || tarefa.ID_USER || '-'}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        tarefa.STATUS.toLowerCase().includes('concl') || tarefa.STATUS.toLowerCase().includes('pago') 
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                          : tarefa.STATUS.toLowerCase().includes('andamento')
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : tarefa.STATUS.toLowerCase().includes('terceiro')
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      }`}>
                        {tarefa.STATUS}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`text-[10px] font-bold uppercase ${
                        tarefa.PRIORIDADE.toLowerCase().includes('urgente') ? 'text-red-700 bg-red-100 px-1 rounded' :
                        tarefa.PRIORIDADE.toLowerCase().includes('alt') ? 'text-red-500' : 
                        tarefa.PRIORIDADE.toLowerCase().includes('méd') || tarefa.PRIORIDADE.toLowerCase().includes('med') ? 'text-amber-500' : 
                        tarefa.PRIORIDADE.toLowerCase().includes('baix') ? 'text-emerald-500' :
                        'text-app-text-muted'
                      }`}>
                        {tarefa.PRIORIDADE}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        {(tarefa.LINK || selectedProcesso?.link) && (
                          <a
                            href={tarefa.LINK || selectedProcesso?.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:bg-app-secondary rounded text-primary transition-colors"
                            title="Acessar"
                          >
                            <LinkIcon size={16} />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleViewTarefa(tarefa)}
                          className="p-1 hover:bg-app-secondary rounded text-app-text-muted transition-colors"
                          title="Visualizar"
                        >
                          <Eye size={16} />
                        </button>
                        {modalMode === 'edit' && (isAdmin() || hasPermission('tarefas', 'write') || (currentUser?.id && (tarefa.ID_USER === currentUser.id || tarefa.RESPONSAVEL_ID === currentUser.id))) && (
                          <button
                            type="button"
                            onClick={() => handleEditTarefa(tarefa)}
                            className="p-1 hover:bg-app-secondary rounded text-primary transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        {modalMode === 'edit' && (isAdmin() || hasPermission('tarefas', 'delete') || (currentUser?.id && (tarefa.ID_USER === currentUser.id || tarefa.RESPONSAVEL_ID === currentUser.id))) && (
                          <button
                            type="button"
                            onClick={() => deleteTarefa(tarefa.ID_TAREFA)}
                            className="p-1 hover:bg-app-secondary rounded text-red-500 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          {selectedProcesso?.link && (
            <a 
              href={selectedProcesso.link}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center shadow-sm"
            >
              <LinkIcon size={18} className="mr-2" />
              Acessar Processo
            </a>
          )}
          <button
            onClick={() => setIsTarefasModalOpen(false)}
            className="px-4 py-2 bg-app-secondary text-app-text rounded-lg hover:bg-app-bg transition-colors"
          >
            Fechar
          </button>
        </div>
      </Modal>

      <Modal isOpen={isNewContactModalOpen} onClose={() => setIsNewContactModalOpen(false)} title="Novo Contato">
        <form onSubmit={handleSaveContato} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Nome *</label>
              <input 
                type="text" 
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoContato.nome}
                onChange={e => setNovoContato({...novoContato, nome: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Tipo *</label>
              <select 
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoContato.tipo}
                onChange={e => setNovoContato({...novoContato, tipo: e.target.value as any})}
              >
                <option value="Cliente">Cliente</option>
                <option value="Contato">Contato</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Email</label>
              <input 
                type="email" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoContato.email}
                onChange={e => setNovoContato({...novoContato, email: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Telefone</label>
              <input 
                type="tel" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoContato.telefone}
                onChange={e => setNovoContato({...novoContato, telefone: e.target.value})}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-app-text">CPF/CNPJ</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoContato.cpfCnpj}
                onChange={e => setNovoContato({...novoContato, cpfCnpj: e.target.value})}
              />
            </div>
            {isGlobalAdmin && (
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-app-text">Escritório Responsável *</label>
                <select 
                  required
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={novoContato.escritorioId}
                  onChange={e => setNovoContato({...novoContato, escritorioId: e.target.value})}
                >
                  <option value="">Selecione um escritório</option>
                  <option value="x">GLOBAL (Todos os Escritórios)</option>
                  {state.escritorios.map(esc => (
                    <option key={esc.id} value={esc.id}>{esc.nome}</option>
                  ))}
                </select>
              </div>
            )}
            {!isGlobalAdmin && isAdmin() && (
              <div className="md:col-span-2 flex items-center space-x-2 py-2">
                <input 
                  type="checkbox"
                  id="process-new-contact-global"
                  className="w-4 h-4 text-primary border-app-border rounded focus:ring-primary bg-app-secondary"
                  checked={novoContato.escritorioId === 'x'}
                  onChange={e => setNovoContato({...novoContato, escritorioId: e.target.checked ? 'x' : (escritorioAtivoId || '')})}
                />
                <label htmlFor="process-new-contact-global" className="text-sm font-medium text-app-text cursor-pointer">
                  Contato Global (Visível em todos os escritórios)
                </label>
              </div>
            )}
          </div>
          <div className="pt-4 flex justify-end space-x-3 border-t border-app-border">
            <button 
              type="button"
              onClick={() => setIsNewContactModalOpen(false)}
              className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-bg transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-4 py-2 text-white bg-primary rounded-lg hover:opacity-90 transition-colors shadow-sm"
            >
              Salvar Contato
            </button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={isFinanceiroModalOpen} 
        onClose={() => setIsFinanceiroModalOpen(false)} 
        title={financeiroFormData.mode === 'edit' ? 'Editar Lançamento Financeiro' : 'Novo Lançamento Financeiro'}
      >
        <form onSubmit={handleSubmitFinanceiro} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-app-text-muted uppercase mb-1">Tipo *</label>
              <select
                className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={financeiroFormData.tipo}
                onChange={(e) => setFinanceiroFormData({ ...financeiroFormData, tipo: e.target.value as 'Receita' | 'Despesa' })}
              >
                <option value="Receita">Receita</option>
                <option value="Despesa">Despesa</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-app-text-muted uppercase mb-1">Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={financeiroFormData.valor}
                onChange={(e) => setFinanceiroFormData({ ...financeiroFormData, valor: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-app-text-muted uppercase mb-1">Data *</label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={financeiroFormData.data}
                onChange={(e) => setFinanceiroFormData({ ...financeiroFormData, data: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-app-text-muted uppercase mb-1">Status</label>
              <select
                className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={financeiroFormData.status}
                onChange={(e) => setFinanceiroFormData({ ...financeiroFormData, status: e.target.value as 'Pago' | 'Pendente' })}
              >
                <option value="Pendente">Pendente</option>
                <option value="Pago">Pago</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text-muted uppercase mb-1">Contato (Opcional)</label>
            <select
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={financeiroFormData.contatoId || financeiroFormData.clienteId || ''}
              onChange={(e) => setFinanceiroFormData({ ...financeiroFormData, contatoId: e.target.value, clienteId: e.target.value })}
            >
              <option value="">Nenhum contato selecionado</option>
              {state.contatos.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome} {c.cpfCnpj ? `(${c.cpfCnpj})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text-muted uppercase mb-1">Descrição</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ex: Honorários, custas processuais..."
              value={financeiroFormData.descricao}
              onChange={(e) => setFinanceiroFormData({ ...financeiroFormData, descricao: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text-muted uppercase mb-1">Observações</label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Detalhes adicionais..."
              value={financeiroFormData.observacoes}
              onChange={(e) => setFinanceiroFormData({ ...financeiroFormData, observacoes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-app-border">
            <button
              type="button"
              onClick={() => setIsFinanceiroModalOpen(false)}
              className="px-4 py-2 border border-app-border text-app-text hover:bg-app-bg rounded-lg text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white hover:bg-primary/90 rounded-lg text-sm font-bold transition-colors shadow-sm"
            >
              {financeiroFormData.mode === 'edit' ? 'Salvar Alterações' : 'Adicionar Lançamento'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={isAddMovimentoModalOpen} 
        onClose={() => setIsAddMovimentoModalOpen(false)} 
        title={movimentoFormData.mode === 'edit' ? 'Editar Movimentação' : 'Adicionar Movimentação'}
      >
        <form onSubmit={handleSubmitMovimento} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Data *</label>
              <input 
                type="date" 
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={movimentoFormData.data}
                onChange={e => setMovimentoFormData({...movimentoFormData, data: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Página</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={movimentoFormData.pagina}
                onChange={e => setMovimentoFormData({...movimentoFormData, pagina: e.target.value})}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-app-text">Descrição *</label>
              <textarea 
                required
                rows={3}
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={movimentoFormData.descricao}
                onChange={e => setMovimentoFormData({...movimentoFormData, descricao: e.target.value})}
                placeholder="Descreva a movimentação processual..."
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-app-text">Responsável *</label>
              <select 
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={movimentoFormData.usuarioId}
                onChange={e => setMovimentoFormData({...movimentoFormData, usuarioId: e.target.value})}
              >
                <option value="">Selecione o responsável...</option>
                {state.usuarios
                  .filter(u => !escritorioAtivoId || (u.escritoriosIds || []).includes(escritorioAtivoId))
                  .sort((a, b) => a.nome.localeCompare(b.nome))
                  .map(u => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))
                }
              </select>
            </div>
          </div>
          <div className="pt-4 flex justify-end space-x-3 border-t border-app-border">
            <button 
              type="button"
              onClick={() => setIsAddMovimentoModalOpen(false)}
              className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-bg transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-4 py-2 text-white bg-primary rounded-lg hover:opacity-90 transition-colors shadow-sm"
            >
              {movimentoFormData.mode === 'edit' ? 'Atualizar Movimentação' : 'Adicionar Movimentação'}
            </button>
          </div>
        </form>
      </Modal>

      <TaskModal 
        isOpen={isTaskModalOpen} 
        onClose={() => {
          setIsTaskModalOpen(false);
          setSelectedTarefaForModal(null);
        }} 
        mode={taskModalMode}
        tarefa={selectedTarefaForModal}
        initialData={selectedProcesso ? {
          PROCESSO_ID: selectedProcesso.id,
          ID_PROC: selectedProcesso.id,
          PROC_NOME: selectedProcesso.numero,
          'PROC.NOME': selectedProcesso.numero,
          VARA_ID: selectedProcesso.varaId || selectedProcesso.tribunal || '',
          ID_VARA: selectedProcesso.varaId || selectedProcesso.tribunal || '',
          ID_ESCRITORIO: selectedProcesso.escritorioId || escritorioAtivoId || ''
        } : undefined}
      />
      {isNewContactModalOpen && (
        <CreateContatoModal 
          isOpen={isNewContactModalOpen} 
          onClose={() => setIsNewContactModalOpen(false)} 
        />
      )}
      {isNewVaraModalOpen && (
        <CreateVaraModal 
          isOpen={isNewVaraModalOpen} 
          onClose={() => setIsNewVaraModalOpen(false)} 
        />
      )}
      {isNewEventoModalOpen && (
        <CreateEventoModal
          isOpen={isNewEventoModalOpen}
          onClose={() => setIsNewEventoModalOpen(false)}
          initialData={initialEventoData}
        />
      )}

      <Modal 
        isOpen={isColumnModalOpen} 
        onClose={() => setIsColumnModalOpen(false)} 
        title="Configurar Visualização de Colunas"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-app-text-muted">
            Selecione as colunas que deseja exibir na tabela de processos. Você também pode arrastar as colunas na tabela para reordená-las.
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
              <label className="text-sm font-medium text-app-text-muted uppercase">Telefone / WhatsApp</label>
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
        title={isEditingContato ? "Editar Detalhes do Contato" : "Detalhes do Contato"}
      >
        {isEditingContato ? (
          <form onSubmit={handleSaveEditedContato} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-1">
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-app-text-muted">Nome Completo *</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={editContatoFormData?.nome || ''}
                  onChange={e => setEditContatoFormData({ ...editContatoFormData, nome: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text-muted">Tipo *</label>
                <select 
                  required
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={editContatoFormData?.tipo || 'Cliente'}
                  onChange={e => setEditContatoFormData({ ...editContatoFormData, tipo: e.target.value as any })}
                >
                  <option value="Cliente">Cliente</option>
                  <option value="Contato">Contato</option>
                  <option value="Lead">Lead</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text-muted">Apelido / Nome Fantasia</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={editContatoFormData?.apelido || ''}
                  onChange={e => setEditContatoFormData({ ...editContatoFormData, apelido: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text-muted">Status</label>
                <select 
                  required
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={editContatoFormData?.status || 'Ativo'}
                  onChange={e => setEditContatoFormData({ ...editContatoFormData, status: e.target.value })}
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text-muted">Estado Civil</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={editContatoFormData?.statusCivil || ''}
                  onChange={e => setEditContatoFormData({ ...editContatoFormData, statusCivil: e.target.value })}
                  placeholder="Ex: Solteiro, Casado..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text-muted">Profissão</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={editContatoFormData?.profissao || ''}
                  onChange={e => setEditContatoFormData({ ...editContatoFormData, profissao: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text-muted">CPF / CNPJ</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={editContatoFormData?.cpfCnpj || ''}
                  onChange={e => setEditContatoFormData({ ...editContatoFormData, cpfCnpj: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text-muted">RG</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={editContatoFormData?.rg || ''}
                  onChange={e => setEditContatoFormData({ ...editContatoFormData, rg: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text-muted">Telefone</label>
                <input 
                  type="tel" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={editContatoFormData?.telefone || ''}
                  onChange={e => setEditContatoFormData({ ...editContatoFormData, telefone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text-muted">E-mail</label>
                <input 
                  type="email" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={editContatoFormData?.email || ''}
                  onChange={e => setEditContatoFormData({ ...editContatoFormData, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text-muted">CEP</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={editContatoFormData?.cep || ''}
                  onChange={e => setEditContatoFormData({ ...editContatoFormData, cep: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text-muted">Município</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={editContatoFormData?.municipio || ''}
                  onChange={e => setEditContatoFormData({ ...editContatoFormData, municipio: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text-muted">Estado</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={editContatoFormData?.estado || ''}
                  onChange={e => setEditContatoFormData({ ...editContatoFormData, estado: e.target.value })}
                  placeholder="Ex: AM, SP..."
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-app-text-muted">Endereço</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={editContatoFormData?.endereco || ''}
                  onChange={e => setEditContatoFormData({ ...editContatoFormData, endereco: e.target.value })}
                />
              </div>
              {isGlobalAdmin && (
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium text-app-text">Escritório Responsável *</label>
                  <select 
                    required
                    className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                    value={editContatoFormData?.escritorioId || ''}
                    onChange={e => setEditContatoFormData({ ...editContatoFormData, escritorioId: e.target.value })}
                  >
                    <option value="">Selecione um escritório</option>
                    <option value="x">GLOBAL (Todos os Escritórios)</option>
                    {state.escritorios.map(esc => (
                      <option key={esc.id} value={esc.id}>{esc.nome}</option>
                    ))}
                  </select>
                </div>
              )}
              {!isGlobalAdmin && isAdmin() && (
                <div className="md:col-span-2 flex items-center space-x-2 py-2">
                  <input 
                    type="checkbox"
                    id="edit-global-contact-processos"
                    className="w-4 h-4 text-primary border-app-border rounded focus:ring-primary bg-app-secondary"
                    checked={editContatoFormData?.escritorioId === 'x'}
                    onChange={e => setEditContatoFormData({ ...editContatoFormData, escritorioId: e.target.checked ? 'x' : (escritorioAtivoId || '') })}
                  />
                  <label htmlFor="edit-global-contact-processos" className="text-sm font-medium text-app-text cursor-pointer">
                    Contato Global (Visível em todos os escritórios)
                  </label>
                </div>
              )}
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-app-text-muted">Dados de Pagamento (Pix, Conta Bancária, etc.)</label>
                <textarea 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text min-h-[60px]"
                  value={editContatoFormData?.dadosPagamento || ''}
                  onChange={e => setEditContatoFormData({ ...editContatoFormData, dadosPagamento: e.target.value })}
                  placeholder="Ex: Chave PIX: pix@email.com, Banco: Nubank, Conta: ..."
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-app-text-muted">Observações</label>
                <textarea 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text min-h-[80px]"
                  value={editContatoFormData?.observacoes || ''}
                  onChange={e => setEditContatoFormData({ ...editContatoFormData, observacoes: e.target.value })}
                />
              </div>
            </div>
            <div className="pt-4 flex justify-end space-x-3 border-t border-app-border">
              <button 
                type="button"
                onClick={() => setIsEditingContato(false)}
                className="px-5 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-bg transition-colors font-bold"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="px-5 py-2 bg-primary text-white font-bold rounded-lg hover:opacity-90 transition-all shadow-md active:scale-95"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-1">
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-app-text-muted uppercase">Nome Completo</label>
                <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text font-bold text-base">
                  {selectedContatoForView?.nome || '-'}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-app-text-muted uppercase">Apelido / Nome Fantasia</label>
                <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text font-medium">
                  {selectedContatoForView?.apelido || '-'}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-app-text-muted uppercase">ID (Código)</label>
                <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text font-mono text-sm">
                  {selectedContatoForView?.id || '-'}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-app-text-muted uppercase">Tipo</label>
                <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text font-medium">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    selectedContatoForView?.tipo === 'Cliente' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                    selectedContatoForView?.tipo === 'Contato' ? 'bg-primary/10 text-primary' :
                    selectedContatoForView?.tipo === 'Lead' ? 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400' :
                    'bg-app-bg text-app-text-muted border border-app-border'
                  }`}>
                    {selectedContatoForView?.tipo || '-'}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-app-text-muted uppercase">Status</label>
                <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text font-medium">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    selectedContatoForView?.status === 'Inativo' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {selectedContatoForView?.status || 'Ativo'}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-app-text-muted uppercase">Estado Civil</label>
                <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text">
                  {selectedContatoForView?.statusCivil || '-'}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-app-text-muted uppercase">Profissão</label>
                <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text">
                  {selectedContatoForView?.profissao || '-'}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-app-text-muted uppercase">CPF / CNPJ</label>
                <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text">
                  {selectedContatoForView?.cpfCnpj || '-'}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-app-text-muted uppercase">RG</label>
                <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text">
                  {selectedContatoForView?.rg || '-'}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-app-text-muted uppercase">Telefone</label>
                <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text font-medium">
                  {selectedContatoForView?.telefone || '-'}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-app-text-muted uppercase">E-mail</label>
                <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-primary font-medium">
                  {selectedContatoForView?.email || '-'}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-app-text-muted uppercase">CEP</label>
                <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text">
                  {selectedContatoForView?.cep || '-'}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-app-text-muted uppercase">Município</label>
                <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text">
                  {selectedContatoForView?.municipio || '-'}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-app-text-muted uppercase">Estado</label>
                <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text">
                  {selectedContatoForView?.estado || '-'}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-app-text-muted uppercase">Data de Cadastro</label>
                <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text">
                  {selectedContatoForView?.dataCadastro || '-'}
                </div>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-app-text-muted uppercase">Endereço</label>
                <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text">
                  {selectedContatoForView?.endereco || '-'}
                </div>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-app-text-muted uppercase">Dados de Pagamento</label>
                <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text min-h-[50px] whitespace-pre-wrap">
                  {selectedContatoForView?.dadosPagamento || '-'}
                </div>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-app-text-muted uppercase">Observações</label>
                <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border text-app-text min-h-[60px] whitespace-pre-wrap">
                  {selectedContatoForView?.observacoes || '-'}
                </div>
              </div>
            </div>
            <div className="pt-4 flex justify-between border-t border-app-border">
              <div>
                {hasPermission('contatos', 'write') && (
                  <button 
                    onClick={() => {
                      setEditContatoFormData({ ...selectedContatoForView });
                      setIsEditingContato(true);
                    }}
                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                  >
                    <Edit2 size={16} /> Editar
                  </button>
                )}
              </div>
              <button 
                onClick={() => setIsContatoViewModalOpen(false)}
                className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:opacity-90 transition-all shadow-md active:scale-95"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {varaForStats && (
        <VaraStatsModal
          isOpen={isVaraStatsModalOpen}
          onClose={() => setIsVaraStatsModalOpen(false)}
          vara={varaForStats}
        />
      )}
    </div>
  );
}
