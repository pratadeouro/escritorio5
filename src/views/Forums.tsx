import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context';
import { Landmark, Search, MapPin, Plus, Edit2, Trash2, Eye, Settings2, X } from 'lucide-react';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { Forum } from '../types';
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

const FORUM_COLUMN_LABELS: Record<string, string> = {
  id: 'ID (ID_FORUM)',
  nome: 'Nome do Fórum',
  tribunal: 'Tribunal Vinculado',
  endereco: 'Endereço',
  varas: 'Varas',
};

const FORUM_DEFAULT_COLUMNS = ['nome', 'tribunal', 'endereco', 'varas'];

export default function Forums() {
  const { state, addForum, updateForum, deleteForum, escritorioAtivoId, isAdmin, currentUser, hasPermission } =
    useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingForum, setEditingForum] = useState<Forum | null>(null);
  const [deletingForum, setDeletingForum] = useState<Forum | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'nome', direction: 'asc' });

  const canRead = hasPermission('forums', 'read');
  const canWrite = hasPermission('forums', 'write');
  const canDelete = hasPermission('forums', 'delete');

  const {
    columnOrder,
    toggleColumn,
    resetColumns,
    isColumnModalOpen,
    setIsColumnModalOpen,
    sensors,
    handleDragEnd,
  } = useTableColumns('forums_columns_v1', FORUM_DEFAULT_COLUMNS, Object.keys(FORUM_COLUMN_LABELS));

  const [formData, setFormData] = useState({
    id: '',
    nome: '',
    endereco: '',
    tribunalId: '',
  });

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

  const countVarasForForum = (forumId: string) =>
    state.varas.filter((v) => {
      if (v.forum !== forumId) return false;
      return matchesOfficeFilter(v.escritorioId, escritorioAtivoId, adminUser, currentUser?.escritoriosIds);
    }).length;

  const filteredForums = useMemo(() => {
    const sNorm = normalizeSearchStr(searchTerm);
    return state.forums.filter((f) => {
      if (!matchesOfficeFilter(f.escritorioId, escritorioAtivoId, adminUser, currentUser?.escritoriosIds)) {
        return false;
      }
      if (!sNorm) return true;
      const tribunal = state.tribunais.find((t) => t.id === f.tribunalId);
      return (
        normalizeSearchStr(f.id).includes(sNorm) ||
        normalizeSearchStr(f.nome).includes(sNorm) ||
        normalizeSearchStr(f.endereco).includes(sNorm) ||
        normalizeSearchStr(f.tribunalId).includes(sNorm) ||
        normalizeSearchStr(tribunal?.nome).includes(sNorm) ||
        normalizeSearchStr(tribunal?.sigla).includes(sNorm)
      );
    });
  }, [state.forums, state.tribunais, searchTerm, escritorioAtivoId, adminUser, currentUser]);

  const sortedForums = useMemo(() => {
    if (!sortConfig) return filteredForums;
    return [...filteredForums].sort((a, b) => {
      let aVal: any = '';
      let bVal: any = '';
      switch (sortConfig.key) {
        case 'id':
          aVal = a.id || '';
          bVal = b.id || '';
          break;
        case 'nome':
          aVal = a.nome || '';
          bVal = b.nome || '';
          break;
        case 'tribunal': {
          const tA = state.tribunais.find((t) => t.id === a.tribunalId);
          const tB = state.tribunais.find((t) => t.id === b.tribunalId);
          aVal = tA?.sigla || tA?.nome || a.tribunalId || '';
          bVal = tB?.sigla || tB?.nome || b.tribunalId || '';
          break;
        }
        case 'endereco':
          aVal = a.endereco || '';
          bVal = b.endereco || '';
          break;
        case 'varas':
          aVal = countVarasForForum(a.id);
          bVal = countVarasForForum(b.id);
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
  }, [filteredForums, sortConfig, state.tribunais, state.varas, escritorioAtivoId, adminUser, currentUser]);

  const itemsPerPage = state.settings.itemsPerPage || 10;
  const totalPages = Math.ceil(sortedForums.length / itemsPerPage);

  const paginatedForums = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedForums.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedForums, currentPage, itemsPerPage]);

  const handleOpenModal = (forum?: Forum, mode: 'create' | 'edit' | 'view' = forum ? 'edit' : 'create') => {
    setModalMode(mode);
    if (forum) {
      setEditingForum(forum);
      setFormData({
        id: forum.id || '',
        nome: forum.nome || '',
        endereco: forum.endereco || '',
        tribunalId: forum.tribunalId || '',
      });
    } else {
      setEditingForum(null);
      setFormData({
        id: '',
        nome: '',
        endereco: '',
        tribunalId: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.id) return;

    if (editingForum) {
      updateForum({
        ...editingForum,
        ...formData,
      });
    } else {
      addForum({
        ...formData,
        escritorioId: escritorioAtivoId || '',
      });
    }

    setIsModalOpen(false);
    setEditingForum(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingForum) return;
    deleteForum(deletingForum.id);
    setDeletingForum(null);
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 w-full h-full flex flex-col space-y-3 sm:space-y-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold text-app-text flex items-center uppercase">
          <Landmark className="mr-3 text-primary shrink-0" />
          <span className="truncate">Fóruns</span>
        </h1>
        {canWrite && (
          <button
            onClick={() => handleOpenModal(undefined, 'create')}
            className="bg-primary hover:opacity-90 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            Novo Fórum
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
                placeholder="Buscar por nome, endereço ou tribunal..."
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
            {sortedForums.length} {sortedForums.length === 1 ? 'registro encontrado' : 'registros encontrados'}
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
                        label={FORUM_COLUMN_LABELS[colId] || colId}
                        onSort={handleSort}
                        sortConfig={sortConfig}
                        align={colId === 'varas' ? 'center' : 'left'}
                      />
                    ))}
                  </SortableContext>
                  <th className="px-4 py-3 font-medium text-right sticky right-0 z-20 bg-app-secondary shadow-[-4px_0_8px_rgba(0,0,0,0.05)] hidden sm:table-cell">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {paginatedForums.map((forum, index) => {
                  const tribunal = state.tribunais.find((t) => t.id === forum.tribunalId);
                  const isGlobal = forum.escritorioId?.toLowerCase() === 'x';

                  return (
                    <tr
                      key={`${forum.id}-${index}`}
                      onClick={() => {
                        if (window.innerWidth < 1024 && (canRead || canWrite)) {
                          handleOpenModal(forum, 'view');
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
                                {forum.id}
                              </td>
                            );
                          case 'nome':
                            return (
                              <td key={colId} className="px-4 py-3 font-medium text-app-text">
                                <div className="flex flex-col gap-0.5">
                                  <div
                                    className="flex items-center gap-2 cursor-pointer hover:text-primary hover:underline transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (canRead || canWrite) handleOpenModal(forum, 'view');
                                    }}
                                  >
                                    <span>{forum.nome}</span>
                                    {isGlobal && (
                                      <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded uppercase tracking-wider">
                                        Geral
                                      </span>
                                    )}
                                  </div>
                                  {tribunal && (
                                    <div className="sm:hidden mt-0.5">
                                      <span className="text-[10px] font-bold text-primary uppercase bg-primary/10 px-1.5 py-0.5 rounded">
                                        {tribunal.sigla || tribunal.id}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          case 'tribunal':
                            return (
                              <td key={colId} className="px-4 py-3 whitespace-nowrap">
                                {tribunal ? (
                                  <span
                                    className="text-xs font-bold text-primary uppercase bg-primary/10 px-2 py-1 rounded"
                                    title={tribunal.nome}
                                  >
                                    {tribunal.sigla || tribunal.id}
                                  </span>
                                ) : (
                                  <span className="text-app-text-muted text-sm">{forum.tribunalId || '-'}</span>
                                )}
                              </td>
                            );
                          case 'endereco':
                            return (
                              <td key={colId} className="px-4 py-3 text-sm text-app-text-muted max-w-md">
                                {forum.endereco ? (
                                  <div className="flex items-start gap-2">
                                    <MapPin size={15} className="text-app-text-muted shrink-0 mt-0.5" />
                                    <span className="line-clamp-2">{forum.endereco}</span>
                                  </div>
                                ) : (
                                  <span className="italic opacity-60">Não informado</span>
                                )}
                              </td>
                            );
                          case 'varas':
                            return (
                              <td key={colId} className="px-4 py-3 text-center">
                                <span className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold rounded-full bg-app-bg text-app-text border border-app-border min-w-8">
                                  {countVarasForForum(forum.id)}
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
                                handleOpenModal(forum, 'view');
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
                                handleOpenModal(forum, 'edit');
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
                                setDeletingForum(forum);
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

                {sortedForums.length === 0 && (
                  <tr>
                    <td colSpan={columnOrder.length + 1} className="p-8 text-center text-app-text-muted italic">
                      Nenhum fórum encontrado.
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
          totalItems={sortedForums.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          label="fóruns"
        />
      </div>

      <ColumnConfigModal
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        columnLabels={FORUM_COLUMN_LABELS}
        columnOrder={columnOrder}
        onToggleColumn={toggleColumn}
        onResetColumns={resetColumns}
        entityName="fóruns"
      />

      <ConfirmDeleteModal
        isOpen={!!deletingForum}
        onClose={() => setDeletingForum(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Fórum"
        description={
          <>
            Tem certeza que deseja excluir o fórum <strong className="text-app-text">{deletingForum?.nome}</strong>?
          </>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingForum(null);
        }}
        title={
          modalMode === 'view'
            ? 'Visualizar Fórum'
            : editingForum
              ? 'Editar Fórum'
              : 'Novo Fórum'
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <fieldset disabled={modalMode === 'view'} className="space-y-4 disabled:opacity-100">
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">ID do Fórum (ID_FORUM) *</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text disabled:opacity-75"
                placeholder="Ex: FORUM_CENTRAL"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
                disabled={!!editingForum || modalMode === 'view'}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Nome do Fórum (NOME_FORUM) *</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                placeholder="Ex: Fórum Central"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Sigla do Tribunal (ID_TJ) *</label>
              <select
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text font-semibold"
                value={formData.tribunalId}
                onChange={(e) => setFormData({ ...formData, tribunalId: e.target.value })}
              >
                <option value="">Selecione um tribunal...</option>
                {state.tribunais.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.sigla || t.id} - {t.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Endereço (ENDERECO)</label>
              <textarea
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text min-h-[100px]"
                placeholder="Endereço completo..."
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              />
            </div>
          </fieldset>

          <div className="pt-4 flex justify-end space-x-3 border-t border-app-border">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setEditingForum(null);
              }}
              className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-secondary/50 transition-colors"
            >
              {modalMode === 'view' ? 'Fechar' : 'Cancelar'}
            </button>
            {modalMode === 'view' && canWrite && editingForum && (
              <button
                type="button"
                onClick={() => setModalMode('edit')}
                className="px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm flex items-center"
              >
                <Edit2 size={16} className="mr-2" />
                Editar
              </button>
            )}
            {modalMode !== 'view' && (
              <button
                type="submit"
                className="px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
              >
                {editingForum ? 'Atualizar Fórum' : 'Salvar Fórum'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
