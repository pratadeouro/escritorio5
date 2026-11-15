import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context';
import { Landmark, Search, Plus, Edit2, Trash2, Eye, Settings2, X } from 'lucide-react';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { Tribunal } from '../types';
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

const TRIBUNAL_COLUMN_LABELS: Record<string, string> = {
  sigla: 'Sigla (SIGLA)',
  id: 'ID (ID_TJ)',
  nome: 'Nome do Tribunal (NOME)',
  varas: 'Varas',
  processos: 'Processos',
};

const TRIBUNAL_DEFAULT_COLUMNS = ['sigla', 'id', 'nome', 'varas', 'processos'];

export default function Tribunais() {
  const { state, addTribunal, updateTribunal, deleteTribunal, escritorioAtivoId, isAdmin, currentUser, hasPermission } =
    useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingTribunal, setEditingTribunal] = useState<Tribunal | null>(null);
  const [deletingTribunal, setDeletingTribunal] = useState<Tribunal | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [viewTab, setViewTab] = useState<'varas' | 'processos'>('varas');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'sigla', direction: 'asc' });

  useEffect(() => {
    if (!isModalOpen) {
      setViewTab('varas');
    }
  }, [isModalOpen]);

  const canRead = hasPermission('tribunais', 'read');
  const canWrite = hasPermission('tribunais', 'write');
  const canDelete = hasPermission('tribunais', 'delete');

  const {
    columnOrder,
    toggleColumn,
    resetColumns,
    isColumnModalOpen,
    setIsColumnModalOpen,
    sensors,
    handleDragEnd,
  } = useTableColumns('tribunais_columns_v1', TRIBUNAL_DEFAULT_COLUMNS, Object.keys(TRIBUNAL_COLUMN_LABELS));

  const [formData, setFormData] = useState({
    nome: '',
    id: '',
    sigla: '',
  });

  const commonTribunals = [
    { id: 'CNJ', sigla: 'CNJ', nome: 'CNJ - Conselho Nacional de Justiça' },
    { id: 'PJECOR', sigla: 'PJeCor', nome: 'PJeCor - Corregedoria Nacional de Justiça' },
    { id: 'SEEU', sigla: 'SEEU', nome: 'Sistema Eletrônico de Execução Unificado' },
    { id: 'CJF', sigla: 'CJF', nome: 'CJF - Conselho da Justiça Federal' },
    { id: 'CSJT', sigla: 'CSJT', nome: 'CSJT - Conselho Superior da Justiça do Trabalho' },
    { id: 'STF', sigla: 'STF', nome: 'STF - Supremo Tribunal Federal' },
    { id: 'STJ', sigla: 'STJ', nome: 'STJ - Superior Tribunal de Justiça' },
    { id: 'STM', sigla: 'STM', nome: 'Superior Tribunal Militar' },
    { id: 'TJAC', sigla: 'TJAC', nome: 'Tribunal de Justiça do Acre' },
    { id: 'TJAL', sigla: 'TJAL', nome: 'Tribunal de Justiça de Alagoas' },
    { id: 'TJAM', sigla: 'TJAM', nome: 'Tribunal de Justiça do Amazonas' },
    { id: 'TJAP', sigla: 'TJAP', nome: 'Tribunal de Justiça do Amapá' },
    { id: 'TJBA', sigla: 'TJBA', nome: 'Tribunal de Justiça da Bahia' },
    { id: 'TJCE', sigla: 'TJCE', nome: 'Tribunal de Justiça do Ceará' },
    { id: 'TJDFT', sigla: 'TJDFT', nome: 'Tribunal de Justiça do Distrito Federal e Territórios' },
    { id: 'TJES', sigla: 'TJES', nome: 'Tribunal de Justiça do Espírito Santo' },
    { id: 'TJGO', sigla: 'TJGO', nome: 'Tribunal de Justiça de Goiás' },
  ];

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, escritorioAtivoId]);

  const handleSort = (key: string) => {
    setSortConfig((prev) =>
      prev && prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const adminUser = isAdmin();

  const countVarasForTribunal = (tribunal: Tribunal) =>
    state.varas.filter((v) => {
      if ((v.idTj || '').toString().trim().toUpperCase() !== (tribunal.id || '').toUpperCase()) {
        return false;
      }
      return matchesOfficeFilter(v.escritorioId, escritorioAtivoId, adminUser, currentUser?.escritoriosIds);
    }).length;

  const countProcessosForTribunal = (tribunal: Tribunal) =>
    state.processos.filter((p) => {
      if (!matchesOfficeFilter(p.escritorioId, escritorioAtivoId, adminUser, currentUser?.escritoriosIds)) {
        return false;
      }
      const tIdNormalized = (tribunal.id || '').trim().toUpperCase();
      if (p.tribunalId && p.tribunalId.trim().toUpperCase() === tIdNormalized) {
        return true;
      }
      const pVaraId = (p.varaId || p.tribunal || '').toString().trim().toUpperCase();
      if (pVaraId) {
        const matchingVara = state.varas.find(
          (v) => v.id.toUpperCase() === pVaraId || v.nome.toUpperCase() === pVaraId || v.id === p.varaId
        );
        if (matchingVara) {
          const vTj = (matchingVara.idTj || '').toString().trim().toUpperCase();
          if (vTj === tIdNormalized) return true;
        }
      }
      const pTribName = (p.tribunal || '').toString().trim().toUpperCase();
      return pTribName === tIdNormalized || pTribName === (tribunal.sigla || '').trim().toUpperCase();
    }).length;

  const filteredTribunais = useMemo(() => {
    const searchNorm = normalizeSearchStr(searchTerm);
    return state.tribunais.filter((t) => {
      if (!searchNorm) return true;
      return (
        normalizeSearchStr(t.nome).includes(searchNorm) ||
        normalizeSearchStr(t.sigla).includes(searchNorm) ||
        normalizeSearchStr(t.id).includes(searchNorm)
      );
    });
  }, [state.tribunais, searchTerm]);

  const sortedTribunais = useMemo(() => {
    if (!sortConfig) return filteredTribunais;
    return [...filteredTribunais].sort((a, b) => {
      let aVal: any = '';
      let bVal: any = '';
      switch (sortConfig.key) {
        case 'sigla':
          aVal = a.sigla || '';
          bVal = b.sigla || '';
          break;
        case 'id':
          aVal = a.id || '';
          bVal = b.id || '';
          break;
        case 'nome':
          aVal = a.nome || '';
          bVal = b.nome || '';
          break;
        case 'varas':
          aVal = countVarasForTribunal(a);
          bVal = countVarasForTribunal(b);
          break;
        case 'processos':
          aVal = countProcessosForTribunal(a);
          bVal = countProcessosForTribunal(b);
          break;
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const strA = normalizeSearchStr(aVal);
      const strB = normalizeSearchStr(bVal);
      if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredTribunais, sortConfig, state.varas, state.processos, escritorioAtivoId, adminUser, currentUser]);

  const itemsPerPage = state.settings.itemsPerPage || 10;
  const totalPages = Math.ceil(sortedTribunais.length / itemsPerPage);

  const paginatedTribunais = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedTribunais.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedTribunais, currentPage, itemsPerPage]);

  const relatedVaras = useMemo(() => {
    if (!editingTribunal) return [];
    return state.varas.filter((v) => {
      if ((v.idTj || '').toString().trim().toUpperCase() !== editingTribunal.id.toUpperCase()) {
        return false;
      }
      return matchesOfficeFilter(v.escritorioId, escritorioAtivoId, adminUser, currentUser?.escritoriosIds);
    });
  }, [state.varas, editingTribunal, escritorioAtivoId, adminUser, currentUser]);

  const relatedProcessos = useMemo(() => {
    if (!editingTribunal) return [];
    return state.processos.filter((p) => {
      if (!matchesOfficeFilter(p.escritorioId, escritorioAtivoId, adminUser, currentUser?.escritoriosIds)) {
        return false;
      }
      const tIdNormalized = editingTribunal.id.trim().toUpperCase();
      if (p.tribunalId && p.tribunalId.trim().toUpperCase() === tIdNormalized) {
        return true;
      }
      const pVaraId = (p.varaId || p.tribunal || '').toString().trim().toUpperCase();
      if (pVaraId) {
        const matchingVara = state.varas.find(
          (v) => v.id.toUpperCase() === pVaraId || v.nome.toUpperCase() === pVaraId || v.id === p.varaId
        );
        if (matchingVara) {
          const vTj = (matchingVara.idTj || '').toString().trim().toUpperCase();
          if (vTj === tIdNormalized) return true;
        }
      }
      const pTribName = (p.tribunal || '').toString().trim().toUpperCase();
      return pTribName === tIdNormalized || pTribName === (editingTribunal.sigla || '').trim().toUpperCase();
    });
  }, [state.processos, state.varas, editingTribunal, escritorioAtivoId, adminUser, currentUser]);

  const handleOpenModal = (tribunal?: Tribunal, mode: 'create' | 'edit' | 'view' = 'create') => {
    setModalMode(mode);
    if (tribunal) {
      setEditingTribunal(tribunal);
      setFormData({
        nome: tribunal.nome || '',
        id: tribunal.id || '',
        sigla: tribunal.sigla || '',
      });
    } else {
      setEditingTribunal(null);
      setFormData({
        nome: '',
        id: '',
        sigla: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.id || !formData.sigla) return;

    if (editingTribunal) {
      updateTribunal({
        ...editingTribunal,
        id: formData.id,
        sigla: formData.sigla,
        nome: formData.nome,
      });
    } else {
      addTribunal({
        id: formData.id,
        sigla: formData.sigla,
        nome: formData.nome,
      });
    }

    setIsModalOpen(false);
    setEditingTribunal(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingTribunal) return;
    deleteTribunal(deletingTribunal.id);
    setDeletingTribunal(null);
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 w-full h-full flex flex-col space-y-3 sm:space-y-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold text-app-text flex items-center uppercase">
          <Landmark className="mr-3 text-primary shrink-0" />
          <span className="truncate">Tribunais</span>
        </h1>
        {canWrite && (
          <button
            onClick={() => handleOpenModal()}
            className="bg-primary hover:opacity-90 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            Novo Tribunal
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
                placeholder="Buscar por sigla, ID ou nome do tribunal..."
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
            {sortedTribunais.length} {sortedTribunais.length === 1 ? 'registro encontrado' : 'registros encontrados'}
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
                        label={TRIBUNAL_COLUMN_LABELS[colId] || colId}
                        onSort={handleSort}
                        sortConfig={sortConfig}
                        align={colId === 'varas' || colId === 'processos' ? 'center' : 'left'}
                      />
                    ))}
                  </SortableContext>
                  <th className="px-4 py-3 font-medium text-right sticky right-0 z-20 bg-app-secondary shadow-[-4px_0_8px_rgba(0,0,0,0.05)] hidden sm:table-cell">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {paginatedTribunais.map((tribunal, index) => {
                  const varasCount = countVarasForTribunal(tribunal);
                  const processosCount = countProcessosForTribunal(tribunal);
                  const isClickable = canWrite || canRead;

                  return (
                    <tr
                      key={`${tribunal.id}-${index}`}
                      className={`hover:bg-app-secondary transition-colors group ${
                        isClickable ? 'cursor-pointer lg:cursor-default' : ''
                      }`}
                      onClick={() => {
                        if (window.innerWidth < 1024 && isClickable) {
                          handleOpenModal(tribunal, 'view');
                        }
                      }}
                    >
                      {columnOrder.map((colId) => {
                        switch (colId) {
                          case 'sigla':
                            return (
                              <td key={colId} className="px-4 py-3 whitespace-nowrap">
                                <span className="text-xs font-bold text-primary uppercase bg-primary/10 px-2 py-1 rounded">
                                  {tribunal.sigla}
                                </span>
                              </td>
                            );
                          case 'id':
                            return (
                              <td key={colId} className="px-4 py-3 whitespace-nowrap">
                                <span className="text-xs font-mono font-bold text-app-text-muted uppercase">
                                  {tribunal.id}
                                </span>
                              </td>
                            );
                          case 'nome':
                            return (
                              <td key={colId} className="px-4 py-3 font-medium text-app-text">
                                <span
                                  className="cursor-pointer hover:text-primary hover:underline transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isClickable) handleOpenModal(tribunal, 'view');
                                  }}
                                >
                                  {tribunal.nome}
                                </span>
                              </td>
                            );
                          case 'varas':
                            return (
                              <td key={colId} className="px-4 py-3 text-center">
                                <span className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold rounded-full bg-app-bg text-app-text border border-app-border min-w-8">
                                  {varasCount}
                                </span>
                              </td>
                            );
                          case 'processos':
                            return (
                              <td key={colId} className="px-4 py-3 text-center">
                                <span className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold rounded-full bg-primary/10 text-primary min-w-8">
                                  {processosCount}
                                </span>
                              </td>
                            );
                          default:
                            return null;
                        }
                      })}

                      <td className="px-4 py-3 text-right sticky right-0 z-10 bg-app-surface group-hover:bg-app-secondary transition-colors shadow-[-4px_0_8px_rgba(0,0,0,0.05)] hidden sm:table-cell">
                        <div className="flex items-center justify-end space-x-1">
                          {canRead && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenModal(tribunal, 'view');
                              }}
                              className="p-2 text-app-text-muted hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                              title="Visualizar"
                            >
                              <Eye size={18} />
                            </button>
                          )}
                          {canWrite && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenModal(tribunal, 'edit');
                              }}
                              className="p-2 text-app-text-muted hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={18} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingTribunal(tribunal);
                              }}
                              className="p-2 text-app-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
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

                {sortedTribunais.length === 0 && (
                  <tr>
                    <td colSpan={columnOrder.length + 1} className="p-8 text-center text-app-text-muted italic">
                      Nenhum tribunal encontrado.
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
          totalItems={sortedTribunais.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          label="tribunais"
        />
      </div>

      <ColumnConfigModal
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        columnLabels={TRIBUNAL_COLUMN_LABELS}
        columnOrder={columnOrder}
        onToggleColumn={toggleColumn}
        onResetColumns={resetColumns}
        entityName="tribunais"
      />

      <ConfirmDeleteModal
        isOpen={!!deletingTribunal}
        onClose={() => setDeletingTribunal(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Tribunal"
        description={
          <>
            Tem certeza que deseja excluir o tribunal <strong className="text-app-text">{deletingTribunal?.nome}</strong>?
          </>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTribunal(null);
        }}
        title={
          modalMode === 'view'
            ? 'Visualizar Tribunal'
            : editingTribunal
              ? 'Editar Tribunal'
              : 'Novo Tribunal'
        }
      >
        {modalMode === 'view' ? (
          <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
            <div className="bg-app-bg/50 border border-app-border rounded-xl p-4 space-y-3">
              <div>
                <h3 className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Nome do Tribunal (NOME)</h3>
                <p className="text-base font-semibold text-app-text mt-0.5">{editingTribunal?.nome}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Sigla (SIGLA)</h3>
                  <p className="text-sm font-semibold text-primary mt-0.5 bg-primary/10 px-2.5 py-1 rounded-lg inline-block">
                    {editingTribunal?.sigla}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-app-text-muted uppercase tracking-wider">ID (ID_TJ)</h3>
                  <p className="text-sm font-mono font-semibold text-app-text mt-0.5">{editingTribunal?.id}</p>
                </div>
              </div>
            </div>

            <div className="flex border-b border-app-border">
              <button
                type="button"
                onClick={() => setViewTab('varas')}
                className={`flex-1 py-2.5 text-center font-semibold text-sm border-b-2 transition-all flex items-center justify-center gap-2 ${
                  viewTab === 'varas'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-app-text-muted hover:text-app-text hover:bg-app-bg/30'
                }`}
              >
                Varas Relacionadas
                <span
                  className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                    viewTab === 'varas'
                      ? 'bg-primary/20 text-primary'
                      : 'bg-app-bg text-app-text-muted border border-app-border'
                  }`}
                >
                  {relatedVaras.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setViewTab('processos')}
                className={`flex-1 py-2.5 text-center font-semibold text-sm border-b-2 transition-all flex items-center justify-center gap-2 ${
                  viewTab === 'processos'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-app-text-muted hover:text-app-text hover:bg-app-bg/30'
                }`}
              >
                Processos Relacionados
                <span
                  className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                    viewTab === 'processos'
                      ? 'bg-primary/20 text-primary'
                      : 'bg-app-bg text-app-text-muted border border-app-border'
                  }`}
                >
                  {relatedProcessos.length}
                </span>
              </button>
            </div>

            <div className="space-y-3 min-h-[200px]">
              {viewTab === 'varas' ? (
                relatedVaras.length === 0 ? (
                  <div className="text-center py-12 text-app-text-muted italic bg-app-bg/20 rounded-xl border border-app-border border-dashed">
                    Nenhuma vara relacionada encontrada para este tribunal.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                    {relatedVaras.map((v, i) => (
                      <div
                        key={v.id || i}
                        className="bg-app-bg/30 border border-app-border hover:border-primary/50 transition-colors p-3.5 rounded-xl space-y-2"
                      >
                        <div className="flex justify-between items-start">
                          <h4 className="font-semibold text-sm text-app-text">{v.nome}</h4>
                          <span className="text-[10px] bg-app-bg border border-app-border text-app-text-muted font-bold px-1.5 py-0.5 rounded">
                            {v.id}
                          </span>
                        </div>
                        {(v.juiz || v.juiz_2 || v.telefone || v.email) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-app-text-muted pt-1 border-t border-app-border/40">
                            {v.juiz && (
                              <div>
                                <span className="font-medium text-app-text-muted">Juiz Titular:</span>{' '}
                                <span className="text-app-text font-medium">{v.juiz}</span>
                              </div>
                            )}
                            {v.juiz_2 && (
                              <div>
                                <span className="font-medium text-app-text-muted">Juiz Auxiliar:</span>{' '}
                                <span className="text-app-text font-medium">{v.juiz_2}</span>
                              </div>
                            )}
                            {v.email && (
                              <div className="truncate" title={v.email}>
                                <span className="font-medium text-app-text-muted">E-mail:</span>{' '}
                                <span className="text-app-text font-medium">{v.email}</span>
                              </div>
                            )}
                            {v.telefone && (
                              <div>
                                <span className="font-medium text-app-text-muted">Telefone:</span>{' '}
                                <span className="text-app-text font-medium">{v.telefone}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : relatedProcessos.length === 0 ? (
                <div className="text-center py-12 text-app-text-muted italic bg-app-bg/20 rounded-xl border border-app-border border-dashed">
                  Nenhum processo relacionado encontrado para este tribunal.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                  {relatedProcessos.map((p, i) => {
                    const clientContact = state.contatos.find((c) => c.id === p.clienteId);
                    const clientName = clientContact ? clientContact.nome : 'Cliente Desconhecido';
                    return (
                      <div
                        key={p.id || i}
                        className="bg-app-bg/30 border border-app-border hover:border-primary/50 transition-colors p-3.5 rounded-xl space-y-2"
                      >
                        <div className="flex justify-between items-start gap-2 flex-wrap sm:flex-nowrap">
                          <div>
                            <h4 className="font-mono font-bold text-sm text-primary break-all">{p.numero}</h4>
                            <p className="text-xs text-app-text font-semibold mt-1">
                              <span className="text-app-text-muted font-medium">Cliente:</span> {clientName}
                            </p>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              p.status === 'Ativo' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                        {(p.classe || p.assunto || p.pasta) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-app-text-muted pt-1 border-t border-app-border/40">
                            {p.classe && (
                              <div className="truncate" title={p.classe}>
                                <span className="font-medium text-app-text-muted">Classe:</span>{' '}
                                <span className="text-app-text font-medium">{p.classe}</span>
                              </div>
                            )}
                            {p.assunto && (
                              <div className="truncate" title={p.assunto}>
                                <span className="font-medium text-app-text-muted">Assunto:</span>{' '}
                                <span className="text-app-text font-medium">{p.assunto}</span>
                              </div>
                            )}
                            {p.pasta && (
                              <div>
                                <span className="font-medium text-app-text-muted">Pasta:</span>{' '}
                                <span className="text-app-text font-medium">{p.pasta}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-app-border">
              {canWrite && editingTribunal && (
                <button
                  type="button"
                  onClick={() => setModalMode('edit')}
                  className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-secondary/50 transition-colors flex items-center text-sm"
                >
                  <Edit2 size={16} className="mr-2" />
                  Editar
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingTribunal(null);
                }}
                className="px-5 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm font-semibold text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {!editingTribunal && (
              <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border space-y-2">
                <label className="text-[10px] font-bold text-app-text-muted uppercase tracking-wider">
                  Sugestões Rápidas
                </label>
                <div className="flex flex-wrap gap-2">
                  {commonTribunals.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormData({ id: t.id, sigla: t.sigla, nome: t.nome })}
                      className="text-[10px] bg-app-surface border border-app-border px-2 py-1 rounded hover:bg-primary hover:text-white hover:border-primary transition-all font-medium uppercase"
                    >
                      {t.sigla}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Sigla do Tribunal (SIGLA) *</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                placeholder="Ex: TJAM, TRF1"
                value={formData.sigla}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    sigla: val,
                    id: prev.id === '' || prev.id === prev.sigla.toUpperCase() ? val.toUpperCase() : prev.id,
                  }));
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">ID do Tribunal (ID_TJ) *</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text disabled:opacity-75 disabled:bg-app-bg"
                placeholder="Ex: TJAM, CNJ"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
                disabled={!!editingTribunal}
              />
              <p className="text-[10px] text-app-text-muted italic">
                Este ID é usado para vincular Fóruns e Processos.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Nome do Tribunal (NOME) *</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                placeholder="Ex: Tribunal de Justiça do Amazonas"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              />
            </div>
            <div className="pt-4 flex justify-end space-x-3 border-t border-app-border">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingTribunal(null);
                }}
                className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-secondary/50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
              >
                {editingTribunal ? 'Atualizar Tribunal' : 'Salvar Tribunal'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
