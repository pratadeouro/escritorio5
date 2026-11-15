import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context';
import {
  Building2,
  Plus,
  Search,
  Trash2,
  Gavel,
  Activity,
  FileText,
  Info,
  Edit2,
  Eye,
  Settings2,
  X,
} from 'lucide-react';
import Modal from '../components/Modal';
import VaraStatsModal from '../components/VaraStatsModal';
import Pagination from '../components/Pagination';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import {
  SortableTableHeader,
  ColumnConfigModal,
  ConfirmDeleteModal,
  useTableColumns,
  matchesOfficeFilter,
  normalizeSearchStr,
  SortConfig,
} from '../components/CadastrosTableHelper';

const VARA_COLUMN_LABELS: Record<string, string> = {
  id: 'ID (ID_VARA)',
  nome: 'Nome da Vara',
  idTj: 'Tribunal (ID_TJ)',
  forum: 'Fórum',
  secretaria: 'Secretaria (UPJ)',
  processos: 'Processos',
  contato: 'Contato',
  localizacao: 'Localização',
  juiz: 'Juiz',
  servidores: 'Servidores',
};

const VARA_DEFAULT_COLUMNS = [
  'nome',
  'forum',
  'secretaria',
  'processos',
  'contato',
  'juiz',
  'servidores',
];

export default function Varas() {
  const { state, addVara, updateVara, deleteVara, escritorioAtivoId, isAdmin, currentUser, hasPermission } =
    useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingVaraId, setEditingVaraId] = useState<string | null>(null);
  const [deletingVaraId, setDeletingVaraId] = useState<string | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'dados' | 'processos'>('dados');
  const [processSearchTerm, setProcessSearchTerm] = useState('');

  const canRead = hasPermission('varas', 'read');
  const canWrite = hasPermission('varas', 'write');
  const canDelete = hasPermission('varas', 'delete');

  const {
    columnOrder,
    toggleColumn,
    resetColumns,
    isColumnModalOpen,
    setIsColumnModalOpen,
    sensors,
    handleDragEnd,
  } = useTableColumns('varas_columns_v1', VARA_DEFAULT_COLUMNS, Object.keys(VARA_COLUMN_LABELS));

  const [sortConfig, setSortConfig] = useState<SortConfig | null>({
    key: 'nome',
    direction: 'asc',
  });

  const handleSort = (key: string) => {
    setSortConfig((prev) =>
      prev && prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, escritorioAtivoId]);

  const [novaVara, setNovaVara] = useState({
    id: '',
    nome: '',
    forum: '',
    localizacao: '',
    telefone: '',
    email: '',
    balcaoVirtual: '',
    juiz: '',
    juiz_2: '',
    id_servidores: [] as string[],
    idTj: '',
  });

  const adminUser = isAdmin();

  const countProcessosForVara = (varaId: string) =>
    state.processos.filter((p) => {
      const pVaraId = p.varaId || p.tribunal;
      if (pVaraId !== varaId) return false;
      return matchesOfficeFilter(
        p.escritorioId,
        escritorioAtivoId,
        adminUser,
        currentUser?.escritoriosIds
      );
    }).length;

  const filteredVaras = useMemo(() => {
    const sNorm = normalizeSearchStr(searchTerm);
    return state.varas.filter((v) => {
      if (!matchesOfficeFilter(v.escritorioId, escritorioAtivoId, adminUser, currentUser?.escritoriosIds)) {
        return false;
      }
      if (!sNorm) return true;

      const forum = state.forums.find((f) => f.id === v.forum);
      const juiz = state.julgadores.find((j) => j.id === v.juiz);
      const juiz2 = state.julgadores.find((j) => j.id === v.juiz_2);
      const sec = state.upj.find((u) => u.id === v.secretaria);

      return (
        normalizeSearchStr(v.id).includes(sNorm) ||
        normalizeSearchStr(v.nome).includes(sNorm) ||
        normalizeSearchStr(v.idTj).includes(sNorm) ||
        normalizeSearchStr(v.forum).includes(sNorm) ||
        normalizeSearchStr(forum?.nome).includes(sNorm) ||
        normalizeSearchStr(sec?.nome).includes(sNorm) ||
        normalizeSearchStr(juiz?.nome || v.juiz).includes(sNorm) ||
        normalizeSearchStr(juiz2?.nome || v.juiz_2).includes(sNorm) ||
        normalizeSearchStr(v.localizacao).includes(sNorm) ||
        normalizeSearchStr(v.email).includes(sNorm) ||
        normalizeSearchStr(v.telefone).includes(sNorm)
      );
    });
  }, [state.varas, state.forums, state.julgadores, state.upj, searchTerm, escritorioAtivoId, adminUser, currentUser]);

  const [forumSearch, setForumSearch] = useState('');
  const [showForumResults, setShowForumResults] = useState(false);

  useEffect(() => {
    if (novaVara.forum) {
      const forum = state.forums.find((f) => f.id === novaVara.forum);
      setForumSearch(forum ? forum.nome : novaVara.forum);
    } else {
      setForumSearch('');
    }
  }, [novaVara.forum, state.forums]);

  const sortedVaras = useMemo(() => {
    if (!sortConfig) return filteredVaras;

    return [...filteredVaras].sort((a, b) => {
      let aValue: any = '';
      let bValue: any = '';

      switch (sortConfig.key) {
        case 'id':
          aValue = a.id || '';
          bValue = b.id || '';
          break;
        case 'nome':
          aValue = a.nome || '';
          bValue = b.nome || '';
          break;
        case 'idTj':
          aValue = a.idTj || '';
          bValue = b.idTj || '';
          break;
        case 'forum': {
          const forumA = state.forums.find((f) => f.id === a.forum);
          const forumB = state.forums.find((f) => f.id === b.forum);
          aValue = forumA?.nome || a.forum || '';
          bValue = forumB?.nome || b.forum || '';
          break;
        }
        case 'secretaria': {
          const secA = state.upj.find((u) => u.id === a.secretaria);
          const secB = state.upj.find((u) => u.id === b.secretaria);
          aValue = secA?.nome || '';
          bValue = secB?.nome || '';
          break;
        }
        case 'processos':
          aValue = countProcessosForVara(a.id);
          bValue = countProcessosForVara(b.id);
          break;
        case 'contato':
          aValue = `${a.email || ''} ${a.telefone || ''}`.trim();
          bValue = `${b.email || ''} ${b.telefone || ''}`.trim();
          break;
        case 'localizacao':
          aValue = a.localizacao || '';
          bValue = b.localizacao || '';
          break;
        case 'juiz': {
          const jA = state.julgadores.find((j) => j.id === a.juiz);
          const jB = state.julgadores.find((j) => j.id === b.juiz);
          aValue = jA?.nome || a.juiz || '';
          bValue = jB?.nome || b.juiz || '';
          break;
        }
        case 'servidores':
          aValue = (a.id_servidores || []).length;
          bValue = (b.id_servidores || []).length;
          break;
        default:
          aValue = (a as any)[sortConfig.key] || '';
          bValue = (b as any)[sortConfig.key] || '';
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const strA = normalizeSearchStr(aValue);
      const strB = normalizeSearchStr(bValue);

      if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredVaras, sortConfig, state.forums, state.upj, state.processos, state.julgadores, escritorioAtivoId, currentUser]);

  const itemsPerPage = state.settings.itemsPerPage || 10;
  const totalPages = Math.ceil(sortedVaras.length / itemsPerPage);

  const paginatedVaras = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedVaras.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedVaras, currentPage, itemsPerPage]);

  const [selectedVaraForStats, setSelectedVaraForStats] = useState<any>(null);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

  const handleShowStats = (vara: any) => {
    setSelectedVaraForStats(vara);
    setIsStatsModalOpen(true);
  };

  const handleEdit = (vara: any) => {
    setModalMode('edit');
    setEditingVaraId(vara.id);
    setActiveModalTab('dados');
    setProcessSearchTerm('');
    setNovaVara({
      id: vara.id || '',
      nome: vara.nome || '',
      forum: vara.forum || '',
      localizacao: vara.localizacao || '',
      telefone: vara.telefone || '',
      email: vara.email || '',
      balcaoVirtual: vara.balcaoVirtual || '',
      juiz: vara.juiz || '',
      juiz_2: vara.juiz_2 || '',
      id_servidores: vara.id_servidores || [],
      idTj: vara.idTj || '',
    });
    setIsModalOpen(true);
  };

  const handleView = (vara: any) => {
    setModalMode('view');
    setEditingVaraId(vara.id);
    setActiveModalTab('dados');
    setProcessSearchTerm('');
    setNovaVara({
      id: vara.id || '',
      nome: vara.nome || '',
      forum: vara.forum || '',
      localizacao: vara.localizacao || '',
      telefone: vara.telefone || '',
      email: vara.email || '',
      balcaoVirtual: vara.balcaoVirtual || '',
      juiz: vara.juiz || '',
      juiz_2: vara.juiz_2 || '',
      id_servidores: vara.id_servidores || [],
      idTj: vara.idTj || '',
    });
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setModalMode('create');
    setEditingVaraId(null);
    setActiveModalTab('dados');
    setProcessSearchTerm('');
    setNovaVara({
      id: '',
      nome: '',
      forum: '',
      localizacao: '',
      telefone: '',
      email: '',
      balcaoVirtual: '',
      juiz: '',
      juiz_2: '',
      id_servidores: [],
      idTj: '',
    });
    setIsModalOpen(true);
  };

  const modalVaraId = editingVaraId || novaVara.id;
  const modalVaraProcessos = useMemo(() => {
    if (!modalVaraId) return [];
    return state.processos.filter((p) => {
      const pVaraId = p.varaId || p.tribunal;
      if (pVaraId !== modalVaraId) return false;
      return matchesOfficeFilter(
        p.escritorioId,
        escritorioAtivoId,
        adminUser,
        currentUser?.escritoriosIds
      );
    });
  }, [state.processos, modalVaraId, escritorioAtivoId, adminUser, currentUser]);

  const filteredModalVaraProcessos = useMemo(() => {
    if (!processSearchTerm.trim()) return modalVaraProcessos;
    const term = normalizeSearchStr(processSearchTerm);
    return modalVaraProcessos.filter((p) => {
      const cliente = state.contatos.find((c) => c.id === p.clienteId)?.nome || '';
      return (
        normalizeSearchStr(p.numero || p.id).includes(term) ||
        normalizeSearchStr(p.titulo).includes(term) ||
        normalizeSearchStr(p.parteContraria).includes(term) ||
        normalizeSearchStr(p.classe || p.tipo).includes(term) ||
        normalizeSearchStr(cliente).includes(term)
      );
    });
  }, [modalVaraProcessos, processSearchTerm, state.contatos]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaVara.nome || !novaVara.id) return;

    if (editingVaraId) {
      updateVara({
        ...novaVara,
        id: editingVaraId,
      } as any);
    } else {
      addVara({
        ...novaVara,
        escritorioId: escritorioAtivoId || '',
      } as any);
    }

    setIsModalOpen(false);
    setEditingVaraId(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingVaraId || !canDelete) return;
    deleteVara(deletingVaraId);
    if (editingVaraId === deletingVaraId) {
      setIsModalOpen(false);
      setEditingVaraId(null);
    }
    setDeletingVaraId(null);
  };

  const deletingVara = deletingVaraId ? state.varas.find((v) => v.id === deletingVaraId) : null;

  return (
    <div className="p-2 sm:p-4 md:p-6 w-full h-full flex flex-col space-y-3 sm:space-y-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold text-app-text flex items-center uppercase">
          <Building2 className="mr-3 text-primary shrink-0" />
          <span className="truncate">Gestão de Varas</span>
        </h1>
        {canWrite && (
          <button
            onClick={handleAddNew}
            className="bg-primary hover:opacity-90 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            Nova Vara
          </button>
        )}
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="p-3 sm:p-4 border-b border-app-border flex flex-col sm:flex-row gap-3 sm:items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <button
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
                placeholder="Buscar por nome, fórum ou juiz..."
                className="w-full pl-10 pr-10 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-app-secondary text-app-text placeholder-app-text-muted"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-app-text-muted hover:text-app-text transition-colors"
                  title="Limpar busca"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          <span className="text-xs text-app-text-muted font-semibold whitespace-nowrap bg-app-secondary px-2.5 py-1.5 rounded-md border border-app-border self-start sm:self-auto">
            {sortedVaras.length} {sortedVaras.length === 1 ? 'registro encontrado' : 'registros encontrados'}
          </span>
        </div>

        <div className="overflow-auto flex-1 scrollbar-thin scrollbar-thumb-app-border scrollbar-track-transparent">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full text-left border-collapse min-w-full">
              <thead className="sticky top-0 z-20 bg-app-surface shadow-sm">
                <tr className="bg-app-secondary text-app-text-muted text-sm uppercase tracking-wider">
                  <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    {columnOrder.map((colId) => (
                      <SortableTableHeader
                        key={colId}
                        id={colId}
                        label={VARA_COLUMN_LABELS[colId] || colId}
                        onSort={handleSort}
                        sortConfig={sortConfig}
                      />
                    ))}
                  </SortableContext>
                  <th className="px-4 py-3 font-medium text-right sticky right-0 z-20 bg-app-secondary shadow-[-4px_0_8px_rgba(0,0,0,0.05)] hidden sm:table-cell">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {paginatedVaras.map((vara, idx) => {
                  const forum = state.forums.find((f) => f.id === vara.forum);
                  const juiz = state.julgadores.find((j) => j.id === vara.juiz);
                  const sec = state.upj.find((u) => u.id === vara.secretaria);
                  const isGlobal = vara.escritorioId?.toLowerCase() === 'x';

                  return (
                    <tr
                      key={`${vara.id}-${idx}`}
                      onClick={() => {
                        if (window.innerWidth < 1024) {
                          handleView(vara);
                        }
                      }}
                      className={`hover:bg-app-secondary transition-colors group cursor-pointer lg:cursor-default ${
                        isGlobal ? 'bg-primary/5' : ''
                      }`}
                    >
                      {columnOrder.map((colId) => {
                        switch (colId) {
                          case 'id':
                            return (
                              <td key={colId} className="px-4 py-3 text-xs font-mono font-bold text-app-text-muted whitespace-nowrap">
                                {vara.id}
                              </td>
                            );
                          case 'nome':
                            return (
                              <td key={colId} className="px-4 py-3 font-medium text-app-text">
                                <div
                                  className="flex flex-col gap-0.5 cursor-pointer group/name"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleView(vara);
                                  }}
                                >
                                  <div className="flex items-center gap-2 group-hover/name:text-primary transition-colors hover:underline">
                                    <span>{vara.nome}</span>
                                    {vara.idTj && (
                                      <span
                                        className="px-1.5 py-0.5 bg-app-bg text-app-text-muted border border-app-border text-[10px] font-bold rounded uppercase tracking-wider"
                                        title="Tribunal"
                                      >
                                        {vara.idTj}
                                      </span>
                                    )}
                                    {isGlobal && (
                                      <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded uppercase tracking-wider">
                                        Geral
                                      </span>
                                    )}
                                  </div>
                                  <div className="sm:hidden text-[10px] text-app-text-muted">
                                    {forum?.nome || vara.forum || 'Sem fórum'}
                                  </div>
                                </div>
                              </td>
                            );
                          case 'idTj':
                            return (
                              <td key={colId} className="px-4 py-3 whitespace-nowrap">
                                {vara.idTj ? (
                                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded uppercase">
                                    {vara.idTj}
                                  </span>
                                ) : (
                                  <span className="text-xs text-app-text-muted">-</span>
                                )}
                              </td>
                            );
                          case 'forum':
                            return (
                              <td key={colId} className="px-4 py-3 text-app-text-muted text-sm">
                                {forum ? (
                                  <span className="font-medium text-app-text">{forum.nome}</span>
                                ) : (
                                  <span className="italic">{vara.forum || 'Não informado'}</span>
                                )}
                              </td>
                            );
                          case 'secretaria':
                            return (
                              <td key={colId} className="px-4 py-3 text-app-text-muted">
                                {sec ? (
                                  <span className="text-sm font-bold text-primary">{sec.nome}</span>
                                ) : (
                                  <span className="text-xs italic opacity-50">-</span>
                                )}
                              </td>
                            );
                          case 'processos':
                            return (
                              <td key={colId} className="px-4 py-3 text-app-text-muted">
                                <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-full text-xs font-bold min-w-[32px] inline-block text-center">
                                  {countProcessosForVara(vara.id)}
                                </span>
                              </td>
                            );
                          case 'contato':
                            return (
                              <td key={colId} className="px-4 py-3 text-app-text-muted text-sm">
                                {vara.telefone && <div>{vara.telefone}</div>}
                                {vara.email && <div className="text-primary">{vara.email}</div>}
                                {!vara.telefone && !vara.email && <span className="text-xs italic opacity-50">-</span>}
                              </td>
                            );
                          case 'localizacao':
                            return (
                              <td key={colId} className="px-4 py-3 text-app-text-muted text-sm">
                                {vara.localizacao || '-'}
                              </td>
                            );
                          case 'juiz':
                            return (
                              <td key={colId} className="px-4 py-3 text-app-text-muted">
                                <div className="flex items-center gap-2">
                                  <Gavel size={14} className="text-app-text-muted shrink-0" />
                                  {juiz ? (
                                    <span className="text-sm font-semibold text-app-text">{juiz.nome}</span>
                                  ) : (
                                    <span className="text-sm italic text-app-text-muted">{vara.juiz || '-'}</span>
                                  )}
                                </div>
                              </td>
                            );
                          case 'servidores':
                            return (
                              <td key={colId} className="px-4 py-3 text-app-text-muted">
                                <div className="flex flex-wrap gap-1">
                                  {vara.id_servidores && vara.id_servidores.length > 0 ? (
                                    vara.id_servidores.map((sid, sIdx) => {
                                      const s = state.servidores.find((srv) => srv.id === sid);
                                      return s ? (
                                        <span
                                          key={`${sid}-${sIdx}`}
                                          className="text-[10px] bg-app-secondary px-1.5 py-0.5 rounded border border-app-border"
                                        >
                                          {s.nome.split(' ')[0]}
                                        </span>
                                      ) : null;
                                    })
                                  ) : (
                                    <span className="text-xs italic opacity-50">-</span>
                                  )}
                                </div>
                              </td>
                            );
                          default:
                            return null;
                        }
                      })}

                      <td className="px-4 py-3 text-right sticky right-0 z-10 bg-app-surface group-hover:bg-app-secondary transition-colors shadow-[-4px_0_8px_rgba(0,0,0,0.05)] hidden sm:table-cell">
                        <div className="flex items-center justify-end gap-1">
                          {canRead && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleView(vara);
                              }}
                              className="text-app-text-muted hover:text-primary transition-colors p-2 rounded-full hover:bg-primary/10"
                              title="Visualizar"
                            >
                              <Eye size={18} />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowStats(vara);
                            }}
                            className="text-app-text-muted hover:text-primary transition-colors p-2 rounded-full hover:bg-primary/10"
                            title="Estatísticas da Vara"
                          >
                            <Activity size={18} />
                          </button>
                          {canWrite && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(vara);
                              }}
                              className="text-app-text-muted hover:text-primary transition-colors p-2 rounded-full hover:bg-primary/10"
                              title="Editar Vara"
                            >
                              <Edit2 size={18} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingVaraId(vara.id);
                              }}
                              className="text-app-text-muted hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-500/10"
                              title="Excluir Vara"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sortedVaras.length === 0 && (
                  <tr>
                    <td colSpan={columnOrder.length + 1} className="p-8 text-center text-app-text-muted">
                      Nenhuma vara encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </DndContext>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={sortedVaras.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          label="varas"
        />
      </div>

      <ColumnConfigModal
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        columnLabels={VARA_COLUMN_LABELS}
        columnOrder={columnOrder}
        onToggleColumn={toggleColumn}
        onResetColumns={resetColumns}
        entityName="varas"
      />

      <ConfirmDeleteModal
        isOpen={!!deletingVaraId}
        onClose={() => setDeletingVaraId(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Vara"
        description={
          <>
            Tem certeza que deseja excluir a vara <strong className="text-app-text">{deletingVara?.nome || deletingVaraId}</strong>?
          </>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'view' ? 'Visualizar Vara' : modalMode === 'edit' ? 'Editar Vara' : 'Nova Vara'}
      >
        <div className="space-y-4">
          <div className="flex border-b border-app-border">
            <button
              type="button"
              onClick={() => setActiveModalTab('dados')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
                activeModalTab === 'dados'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-app-text-muted hover:text-app-text'
              }`}
            >
              <Info size={16} />
              Informações da Vara
            </button>
            <button
              type="button"
              onClick={() => setActiveModalTab('processos')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
                activeModalTab === 'processos'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-app-text-muted hover:text-app-text'
              }`}
            >
              <FileText size={16} />
              Processos Cadastrados
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeModalTab === 'processos'
                    ? 'bg-primary/20 text-primary'
                    : 'bg-app-secondary text-app-text-muted'
                }`}
              >
                {modalVaraProcessos.length}
              </span>
            </button>
          </div>

          {activeModalTab === 'dados' ? (
            <form onSubmit={handleSave} className="space-y-4">
              <fieldset disabled={modalMode === 'view'} className="space-y-4 disabled:opacity-100 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-app-text">ID da Vara (ID_VARA) *</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                      placeholder="Ex: VARA_01"
                      value={novaVara.id}
                      onChange={(e) => setNovaVara({ ...novaVara, id: e.target.value.toUpperCase() })}
                      disabled={modalMode === 'edit' || modalMode === 'view'}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-app-text">Nome da Vara (VARA_NOME) *</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                      placeholder="Ex: 1ª Vara Cível"
                      value={novaVara.nome}
                      onChange={(e) => setNovaVara({ ...novaVara, nome: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-app-text">Tribunal Vinculado (ID_TJ)</label>
                    {modalMode === 'view' ? (
                      <div className="p-2.5 bg-app-surface border border-app-border rounded-lg text-app-text text-sm flex items-center gap-2">
                        <Building2 size={15} className="text-app-text-muted shrink-0" />
                        <span className="font-medium">
                          {(() => {
                            if (novaVara.idTj) {
                              const t = state.tribunais.find(
                                (tr) => tr.id === novaVara.idTj || tr.id.toLowerCase() === novaVara.idTj?.toLowerCase()
                              );
                              if (t) return t.sigla ? `${t.sigla} - ${t.nome}` : t.nome;
                            }
                            if (novaVara.forum) {
                              const forumObj = state.forums.find(
                                (f) => f.id === novaVara.forum || f.nome === novaVara.forum
                              );
                              if (forumObj && forumObj.tribunalId) {
                                const t = state.tribunais.find(
                                  (tr) =>
                                    tr.id === forumObj.tribunalId ||
                                    tr.id.toLowerCase() === forumObj.tribunalId?.toLowerCase()
                                );
                                if (t) return t.sigla ? `${t.sigla} - ${t.nome}` : t.nome;
                              }
                              const tDirect = state.tribunais.find(
                                (tr) => tr.id === novaVara.forum || tr.id.toLowerCase() === novaVara.forum?.toLowerCase()
                              );
                              if (tDirect) return tDirect.sigla ? `${tDirect.sigla} - ${tDirect.nome}` : tDirect.nome;
                            }
                            return '-';
                          })()}
                        </span>
                      </div>
                    ) : (
                      <select
                        className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text text-sm h-[42px]"
                        value={novaVara.idTj}
                        onChange={(e) => setNovaVara({ ...novaVara, idTj: e.target.value })}
                      >
                        <option value="">Selecione um tribunal...</option>
                        {state.tribunais.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.sigla || t.id} - {t.nome}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-app-text">Quantidade de Processos</label>
                    <div
                      onClick={() => setActiveModalTab('processos')}
                      className="p-2.5 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer rounded-lg border border-primary/20 text-primary font-bold flex items-center justify-between text-sm h-[42px]"
                      title="Clique para ver os processos"
                    >
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-primary shrink-0" />
                        <span>
                          {modalVaraProcessos.length} {modalVaraProcessos.length === 1 ? 'processo' : 'processos'}
                        </span>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 bg-primary/10 rounded-full font-semibold">
                        Ver Lista
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 relative">
                    <label className="text-sm font-medium text-app-text">ID do Fórum (ID_FORUM)</label>
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full px-3 py-2 pl-10 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                        placeholder="Digite para buscar..."
                        value={forumSearch}
                        onChange={(e) => {
                          const val = e.target.value;
                          setForumSearch(val);
                          setShowForumResults(val.length >= 2);
                          if (!val) {
                            setNovaVara({ ...novaVara, forum: '' });
                          } else {
                            const currentForum = state.forums.find((f) => f.id === novaVara.forum);
                            if (!currentForum || val !== currentForum.nome) {
                              setNovaVara({ ...novaVara, forum: val });
                            }
                          }
                        }}
                        onFocus={() => forumSearch.length >= 2 && setShowForumResults(true)}
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />

                      {showForumResults && forumSearch.length >= 2 && modalMode !== 'view' && (
                        <div className="absolute z-50 w-full mt-1 bg-app-surface border border-app-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          {state.forums
                            .filter((f) => {
                              const normSearch = normalizeSearchStr(forumSearch);
                              return (
                                normalizeSearchStr(f.nome).includes(normSearch) ||
                                normalizeSearchStr(f.id).includes(normSearch)
                              );
                            })
                            .slice(0, 10)
                            .map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                className="w-full text-left px-4 py-3 hover:bg-app-secondary/50 text-sm border-b border-app-border last:border-0 flex flex-col"
                                onClick={() => {
                                  setNovaVara({ ...novaVara, forum: f.id });
                                  setForumSearch(f.nome);
                                  setShowForumResults(false);
                                }}
                              >
                                <span className="font-medium text-app-text">{f.nome}</span>
                                <span className="text-[10px] text-app-text-muted">ID: {f.id}</span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-app-text">Localização (LOCALIZACAO)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                      placeholder="Ex: 5º andar, sala 501"
                      value={novaVara.localizacao}
                      onChange={(e) => setNovaVara({ ...novaVara, localizacao: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-app-text">Telefone (TEL01)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                      placeholder="Ex: (11) 99999-9999"
                      value={novaVara.telefone}
                      onChange={(e) => setNovaVara({ ...novaVara, telefone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-app-text">E-mail (EMAIL01)</label>
                    <input
                      type="email"
                      className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                      placeholder="Ex: vara@tjam.jus.br"
                      value={novaVara.email}
                      onChange={(e) => setNovaVara({ ...novaVara, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-app-text">Balcão Virtual (BALCAO01)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                      placeholder="Link do Balcão Virtual"
                      value={novaVara.balcaoVirtual}
                      onChange={(e) => setNovaVara({ ...novaVara, balcaoVirtual: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-app-text">Juiz Titular (JUIZ)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                      placeholder="Nome do Juiz"
                      value={novaVara.juiz}
                      onChange={(e) => setNovaVara({ ...novaVara, juiz: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-app-text">Juiz Auxiliar (JUIZ_2)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                      placeholder="Nome do Juiz Auxiliar"
                      value={novaVara.juiz_2}
                      onChange={(e) => setNovaVara({ ...novaVara, juiz_2: e.target.value })}
                    />
                  </div>
                  <div className="space-y-3 md:col-span-2">
                    <label className="text-sm font-medium text-app-text">Servidores (ID_SERVIDORES)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                      placeholder="IDs dos servidores (separados por vírgula)"
                      value={novaVara.id_servidores?.join(', ')}
                      onChange={(e) =>
                        setNovaVara({
                          ...novaVara,
                          id_servidores: e.target.value
                            .split(',')
                            .map((s) => s.trim().toUpperCase())
                            .filter(Boolean),
                        })
                      }
                    />
                  </div>
                </div>
              </fieldset>

              <div className="pt-4 flex justify-between items-center border-t border-app-border">
                <div>
                  {editingVaraId && canDelete && modalMode !== 'view' && (
                    <button
                      type="button"
                      onClick={() => setDeletingVaraId(editingVaraId)}
                      className="px-4 py-2 text-red-600 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      Excluir Vara
                    </button>
                  )}
                </div>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-secondary/50 transition-colors"
                  >
                    {modalMode === 'view' ? 'Fechar' : 'Cancelar'}
                  </button>
                  {modalMode !== 'view' && (
                    <button
                      type="submit"
                      className="px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      {modalMode === 'edit' ? 'Salvar Alterações' : 'Salvar Vara'}
                    </button>
                  )}
                  {modalMode === 'view' && canWrite && (
                    <button
                      type="button"
                      onClick={() => {
                        const vara = state.varas.find((v) => v.id === editingVaraId);
                        if (vara) handleEdit(vara);
                      }}
                      className="px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm flex items-center"
                    >
                      <Edit2 size={16} className="mr-2" />
                      Editar
                    </button>
                  )}
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                  <input
                    type="text"
                    placeholder="Buscar por número, parte ou classe..."
                    value={processSearchTerm}
                    onChange={(e) => setProcessSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-app-surface border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-app-text"
                  />
                </div>
                <div className="text-xs text-app-text-muted font-medium">
                  Total: <strong className="text-primary">{filteredModalVaraProcessos.length}</strong>{' '}
                  {filteredModalVaraProcessos.length === 1 ? 'processo' : 'processos'}
                </div>
              </div>

              {filteredModalVaraProcessos.length === 0 ? (
                <div className="py-10 text-center text-app-text-muted text-sm border border-dashed border-app-border rounded-xl bg-app-secondary/10">
                  <FileText size={36} className="mx-auto mb-2 opacity-30 text-app-text-muted" />
                  <p className="font-semibold text-app-text">Nenhum processo cadastrado nesta vara</p>
                  <p className="text-xs text-app-text-muted mt-1">
                    {processSearchTerm
                      ? 'Nenhum resultado corresponde à sua busca.'
                      : 'Os processos associados a esta vara aparecerão listados aqui.'}
                  </p>
                </div>
              ) : (
                <div className="max-h-[380px] overflow-y-auto border border-app-border rounded-xl divide-y divide-app-border bg-app-surface shadow-inner">
                  {filteredModalVaraProcessos.map((proc) => {
                    const cliente = state.contatos.find((c) => c.id === proc.clienteId);
                    return (
                      <div
                        key={proc.id}
                        className="p-3.5 hover:bg-app-secondary/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm text-primary">
                              {proc.numero || proc.id}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                proc.status === 'Inativo' || proc.ativo === '0'
                                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              }`}
                            >
                              {proc.status || (proc.ativo === '1' ? 'Ativo' : 'Inativo')}
                            </span>
                            {(proc.classe || proc.tipo) && (
                              <span className="text-[11px] px-2 py-0.5 bg-app-secondary/60 text-app-text-muted rounded-md border border-app-border">
                                {proc.classe || proc.tipo}
                              </span>
                            )}
                          </div>
                          {proc.titulo && (
                            <p className="text-xs font-semibold text-app-text truncate">{proc.titulo}</p>
                          )}
                          <div className="text-xs text-app-text-muted flex items-center gap-3 flex-wrap">
                            {cliente && (
                              <span>
                                <strong className="text-app-text font-medium">Cliente:</strong> {cliente.nome}
                              </span>
                            )}
                            {proc.parteContraria && (
                              <span>
                                <strong className="text-app-text font-medium">Parte Contrária:</strong>{' '}
                                {proc.parteContraria}
                              </span>
                            )}
                            {proc.dataDistribuicao && (
                              <span>
                                <strong className="text-app-text font-medium">Distribuído em:</strong>{' '}
                                {proc.dataDistribuicao}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="pt-4 flex justify-end border-t border-app-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-secondary/50 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {selectedVaraForStats && (
        <VaraStatsModal
          isOpen={isStatsModalOpen}
          onClose={() => setIsStatsModalOpen(false)}
          vara={selectedVaraForStats}
        />
      )}
    </div>
  );
}
