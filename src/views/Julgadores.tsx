import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context';
import { Gavel, Search, Plus, Edit2, Trash2, Eye, Settings2, X, Mail, Phone } from 'lucide-react';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { Julgador } from '../types';
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

const JULGADOR_COLUMN_LABELS: Record<string, string> = {
  id: 'ID',
  nome: 'Nome',
  cargo: 'Cargo',
  contato: 'Contato',
  varas: 'Varas / Fóruns Associados',
};

const JULGADOR_DEFAULT_COLUMNS = ['nome', 'varas'];

export default function Julgadores() {
  const { state, escritorioAtivoId, isAdmin, currentUser, hasPermission, addJulgador, updateJulgador, deleteJulgador } =
    useAppContext();
  const canRead = hasPermission('julgadores', 'read');
  const canWrite = hasPermission('julgadores', 'write');
  const canDelete = hasPermission('julgadores', 'delete');

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [editingJulgador, setEditingJulgador] = useState<Julgador | null>(null);
  const [deletingJulgador, setDeletingJulgador] = useState<Julgador | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'nome', direction: 'asc' });

  const {
    columnOrder,
    toggleColumn,
    resetColumns,
    isColumnModalOpen,
    setIsColumnModalOpen,
    sensors,
    handleDragEnd,
  } = useTableColumns('julgadores_columns_v1', JULGADOR_DEFAULT_COLUMNS, Object.keys(JULGADOR_COLUMN_LABELS));

  const [formData, setFormData] = useState({
    nome: '',
    cargo: '',
    email: '',
    telefone: '',
    escritorioId: escritorioAtivoId || 'x',
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

  const handleOpenModal = (julgador?: Julgador, mode: 'create' | 'edit' | 'view' = julgador ? 'edit' : 'create') => {
    setModalMode(mode);
    if (julgador) {
      setEditingJulgador(julgador);
      setFormData({
        nome: julgador.nome || '',
        cargo: julgador.cargo || '',
        email: julgador.email || '',
        telefone: julgador.telefone || '',
        escritorioId: julgador.escritorioId || 'x',
      });
    } else {
      setEditingJulgador(null);
      setFormData({
        nome: '',
        cargo: '',
        email: '',
        telefone: '',
        escritorioId: escritorioAtivoId || 'x',
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome) return;

    if (editingJulgador) {
      updateJulgador({
        ...editingJulgador,
        nome: formData.nome,
        cargo: formData.cargo || undefined,
        email: formData.email || undefined,
        telefone: formData.telefone || undefined,
      });
    } else {
      addJulgador({
        id: Math.random().toString(36).substr(2, 9),
        nome: formData.nome,
        cargo: formData.cargo || undefined,
        email: formData.email || undefined,
        telefone: formData.telefone || undefined,
        escritorioId: formData.escritorioId,
      });
    }
    setIsModalOpen(false);
    setEditingJulgador(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingJulgador) return;
    deleteJulgador(deletingJulgador.id);
    setDeletingJulgador(null);
  };

  const adminUser = isAdmin();

  const filteredJulgadores = useMemo(() => {
    const sNorm = normalizeSearchStr(searchTerm);
    return state.julgadores.filter((j) => {
      if (!matchesOfficeFilter(j.escritorioId, escritorioAtivoId, adminUser, currentUser?.escritoriosIds)) {
        return false;
      }
      if (!sNorm) return true;

      const varasDoJuiz = state.varas.filter((v) => v.juiz === j.id || v.juiz_2 === j.id);
      const matchFields =
        normalizeSearchStr(j.id).includes(sNorm) ||
        normalizeSearchStr(j.nome).includes(sNorm) ||
        normalizeSearchStr(j.cargo).includes(sNorm) ||
        normalizeSearchStr(j.email).includes(sNorm);

      const matchVaras = varasDoJuiz.some((v) => {
        const forum = state.forums.find((f) => f.id === v.forum);
        return (
          normalizeSearchStr(v.nome).includes(sNorm) ||
          normalizeSearchStr(forum?.nome).includes(sNorm)
        );
      });

      return matchFields || matchVaras;
    });
  }, [state.julgadores, state.varas, state.forums, searchTerm, escritorioAtivoId, adminUser, currentUser]);

  const sortedJulgadores = useMemo(() => {
    if (!sortConfig) return filteredJulgadores;
    return [...filteredJulgadores].sort((a, b) => {
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
        case 'cargo':
          aVal = a.cargo || '';
          bVal = b.cargo || '';
          break;
        case 'contato':
          aVal = `${a.email || ''} ${a.telefone || ''}`.trim();
          bVal = `${b.email || ''} ${b.telefone || ''}`.trim();
          break;
        case 'varas':
          aVal = state.varas.filter((v) => v.juiz === a.id || v.juiz_2 === a.id).length;
          bVal = state.varas.filter((v) => v.juiz === b.id || v.juiz_2 === b.id).length;
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
  }, [filteredJulgadores, sortConfig, state.varas]);

  const itemsPerPage = state.settings.itemsPerPage || 10;
  const totalPages = Math.ceil(sortedJulgadores.length / itemsPerPage);

  const paginatedJulgadores = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedJulgadores.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedJulgadores, currentPage, itemsPerPage]);

  return (
    <div className="p-2 sm:p-4 md:p-6 w-full h-full flex flex-col space-y-3 sm:space-y-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold text-app-text flex items-center uppercase">
          <Gavel className="mr-3 text-primary shrink-0" />
          <span className="truncate">Julgadores</span>
        </h1>
        {canWrite && (
          <button
            onClick={() => handleOpenModal(undefined, 'create')}
            className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-colors shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            Novo Julgador
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
                placeholder="Buscar por nome, vara ou fórum..."
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
            {sortedJulgadores.length} {sortedJulgadores.length === 1 ? 'registro encontrado' : 'registros encontrados'}
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
                        label={JULGADOR_COLUMN_LABELS[colId] || colId}
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
                {paginatedJulgadores.map((julgador, idx) => {
                  const varasDoJuiz = state.varas.filter((v) => v.juiz === julgador.id || v.juiz_2 === julgador.id);
                  const isGlobal = julgador.escritorioId?.toLowerCase() === 'x';
                  const initial = (julgador.nome || '?').trim().charAt(0).toUpperCase();

                  return (
                    <tr
                      key={`${julgador.id}-${idx}`}
                      onClick={() => {
                        if (window.innerWidth < 1024 && (canRead || canWrite)) {
                          handleOpenModal(julgador, 'view');
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
                                {julgador.id}
                              </td>
                            );
                          case 'nome':
                            return (
                              <td key={colId} className="px-4 py-3 align-top">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                    {initial}
                                  </div>
                                  <div
                                    className="font-medium text-app-text flex items-center gap-2 cursor-pointer hover:text-primary hover:underline transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (canRead || canWrite) handleOpenModal(julgador, 'view');
                                    }}
                                  >
                                    <span>{julgador.nome}</span>
                                    {isGlobal && (
                                      <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded uppercase tracking-wider">
                                        Geral
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                            );
                          case 'cargo':
                            return (
                              <td key={colId} className="px-4 py-3 text-sm text-app-text-muted align-top">
                                {julgador.cargo || '-'}
                              </td>
                            );
                          case 'contato':
                            return (
                              <td key={colId} className="px-4 py-3 text-sm text-app-text-muted align-top">
                                <div className="space-y-0.5">
                                  {julgador.email && (
                                    <div className="flex items-center gap-1.5 text-primary">
                                      <Mail size={12} />
                                      <span>{julgador.email}</span>
                                    </div>
                                  )}
                                  {julgador.telefone && (
                                    <div className="flex items-center gap-1.5">
                                      <Phone size={12} />
                                      <span>{julgador.telefone}</span>
                                    </div>
                                  )}
                                  {!julgador.email && !julgador.telefone && <span className="italic opacity-60">-</span>}
                                </div>
                              </td>
                            );
                          case 'varas':
                            return (
                              <td key={colId} className="px-4 py-3 align-top">
                                <div className="space-y-2">
                                  {varasDoJuiz.length > 0 ? (
                                    varasDoJuiz.map((vara) => {
                                      const forum = state.forums.find((f) => f.id === vara.forum);
                                      const isTitular = vara.juiz === julgador.id;
                                      return (
                                        <div key={vara.id} className="flex flex-col text-sm border-l-2 border-primary/30 pl-3 py-0.5">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-app-text">{vara.nome}</span>
                                            {!isTitular && (
                                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase">
                                                Acumulando
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-xs text-app-text-muted">
                                            {forum?.nome || 'Fórum não identificado'}
                                          </span>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <span className="text-app-text-muted italic text-sm">Nenhuma vara associada</span>
                                  )}
                                </div>
                              </td>
                            );
                          default:
                            return null;
                        }
                      })}

                      <td className="px-4 py-3 text-right align-top sticky right-0 z-10 bg-app-surface group-hover:bg-app-secondary transition-colors shadow-[-4px_0_8px_rgba(0,0,0,0.05)] hidden sm:table-cell">
                        <div className="flex items-center justify-end space-x-1">
                          {canRead && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenModal(julgador, 'view');
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
                                handleOpenModal(julgador, 'edit');
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
                                setDeletingJulgador(julgador);
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
                {sortedJulgadores.length === 0 && (
                  <tr>
                    <td colSpan={columnOrder.length + 1} className="p-8 text-center text-app-text-muted">
                      Nenhum julgador encontrado.
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
          totalItems={sortedJulgadores.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          label="julgadores"
        />
      </div>

      <ColumnConfigModal
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        columnLabels={JULGADOR_COLUMN_LABELS}
        columnOrder={columnOrder}
        onToggleColumn={toggleColumn}
        onResetColumns={resetColumns}
        entityName="julgadores"
      />

      <ConfirmDeleteModal
        isOpen={!!deletingJulgador}
        onClose={() => setDeletingJulgador(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Julgador"
        description={
          <>
            Tem certeza que deseja excluir o julgador{' '}
            <strong className="text-app-text">{deletingJulgador?.nome}</strong>?
          </>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalMode === 'view'
            ? 'Visualizar Julgador'
            : editingJulgador
              ? 'Editar Julgador'
              : 'Novo Julgador'
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <fieldset disabled={modalMode === 'view'} className="space-y-4 disabled:opacity-100">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-app-text">Nome do Julgador *</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 bg-app-bg border border-app-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-app-text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Dr. Carlos Gomes"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-app-text">Cargo</label>
              <input
                type="text"
                className="w-full px-4 py-2 bg-app-bg border border-app-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-app-text"
                value={formData.cargo}
                onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                placeholder="Ex: Juiz Titular, Desembargador"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-app-text">E-mail</label>
                <input
                  type="email"
                  className="w-full px-4 py-2 bg-app-bg border border-app-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-app-text"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="gabinete@tribunal.jus.br"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-app-text">Telefone</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-app-bg border border-app-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-app-text"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(00) 0000-0000"
                />
              </div>
            </div>
          </fieldset>

          <div className="flex justify-end gap-3 pt-4 border-t border-app-border">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-secondary/50 transition-colors"
            >
              {modalMode === 'view' ? 'Fechar' : 'Cancelar'}
            </button>
            {modalMode === 'view' && canWrite && editingJulgador && (
              <button
                type="button"
                onClick={() => setModalMode('edit')}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-sm flex items-center"
              >
                <Edit2 size={16} className="mr-2" />
                Editar
              </button>
            )}
            {modalMode !== 'view' && (
              <button
                type="submit"
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-sm"
              >
                {editingJulgador ? 'Salvar Alterações' : 'Adicionar Julgador'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
