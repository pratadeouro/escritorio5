import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context';
import { Users, Plus, Search, Mail, Phone, Briefcase, Edit2, Trash2, Eye, Settings2, X } from 'lucide-react';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { Servidor } from '../types';
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

const SERVIDOR_COLUMN_LABELS: Record<string, string> = {
  id: 'ID',
  nome: 'Nome / Cargo',
  cargo: 'Cargo / Função',
  contato: 'Contato',
  varas: 'Varas Associadas',
};

const SERVIDOR_DEFAULT_COLUMNS = ['nome', 'contato', 'varas'];

export default function Servidores() {
  const { state, addServidor, updateServidor, deleteServidor, escritorioAtivoId, isAdmin, currentUser, hasPermission } =
    useAppContext();
  const canRead = hasPermission('servidores', 'read');
  const canWrite = hasPermission('servidores', 'write');
  const canDelete = hasPermission('servidores', 'delete');

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [editingServidorId, setEditingServidorId] = useState<string | null>(null);
  const [deletingServidor, setDeletingServidor] = useState<Servidor | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'nome', direction: 'asc' });

  const {
    columnOrder,
    toggleColumn,
    resetColumns,
    isColumnModalOpen,
    setIsColumnModalOpen,
    sensors,
    handleDragEnd,
  } = useTableColumns('servidores_columns_v1', SERVIDOR_DEFAULT_COLUMNS, Object.keys(SERVIDOR_COLUMN_LABELS));

  const [novoServidor, setNovoServidor] = useState({
    nome: '',
    cargo: '',
    email: '',
    telefone: '',
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

  const filteredServidores = useMemo(() => {
    const sNorm = normalizeSearchStr(searchTerm);
    return state.servidores.filter((s) => {
      if (!matchesOfficeFilter(s.escritorioId, escritorioAtivoId, adminUser, currentUser?.escritoriosIds)) {
        return false;
      }
      if (!sNorm) return true;
      return (
        normalizeSearchStr(s.id).includes(sNorm) ||
        normalizeSearchStr(s.nome).includes(sNorm) ||
        normalizeSearchStr(s.cargo).includes(sNorm) ||
        normalizeSearchStr(s.email).includes(sNorm) ||
        normalizeSearchStr(s.telefone).includes(sNorm)
      );
    });
  }, [state.servidores, searchTerm, escritorioAtivoId, adminUser, currentUser]);

  const sortedServidores = useMemo(() => {
    if (!sortConfig) return filteredServidores;
    return [...filteredServidores].sort((a, b) => {
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
          aVal = state.varas.filter((v) => v.id_servidores?.includes(a.id)).length;
          bVal = state.varas.filter((v) => v.id_servidores?.includes(b.id)).length;
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
  }, [filteredServidores, sortConfig, state.varas]);

  const itemsPerPage = state.settings.itemsPerPage || 10;
  const totalPages = Math.ceil(sortedServidores.length / itemsPerPage);

  const paginatedServidores = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedServidores.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedServidores, currentPage, itemsPerPage]);

  const handleOpenModal = (servidor?: Servidor, mode: 'create' | 'edit' | 'view' = servidor ? 'edit' : 'create') => {
    setModalMode(mode);
    if (servidor) {
      setEditingServidorId(servidor.id);
      setNovoServidor({
        nome: servidor.nome || '',
        cargo: servidor.cargo || '',
        email: servidor.email || '',
        telefone: servidor.telefone || '',
      });
    } else {
      setEditingServidorId(null);
      setNovoServidor({
        nome: '',
        cargo: '',
        email: '',
        telefone: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoServidor.nome) return;

    if (editingServidorId) {
      updateServidor(editingServidorId, {
        ...novoServidor,
        id: editingServidorId,
        escritorioId: state.servidores.find((s) => s.id === editingServidorId)?.escritorioId,
      });
    } else {
      addServidor({
        id: Math.random().toString(36).substr(2, 9),
        ...novoServidor,
        escritorioId: escritorioAtivoId || '',
      });
    }

    setIsModalOpen(false);
    setNovoServidor({ nome: '', cargo: '', email: '', telefone: '' });
    setEditingServidorId(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingServidor) return;
    deleteServidor(deletingServidor.id);
    if (editingServidorId === deletingServidor.id) {
      setIsModalOpen(false);
      setEditingServidorId(null);
    }
    setDeletingServidor(null);
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 w-full h-full flex flex-col space-y-3 sm:space-y-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold text-app-text flex items-center uppercase">
          <Users className="mr-3 text-primary shrink-0" />
          <span className="truncate">Servidores</span>
        </h1>
        {canWrite && (
          <button
            onClick={() => handleOpenModal(undefined, 'create')}
            className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-colors shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            Novo Servidor
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
                placeholder="Buscar por nome, cargo ou e-mail..."
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
            {sortedServidores.length} {sortedServidores.length === 1 ? 'registro encontrado' : 'registros encontrados'}
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
                        label={SERVIDOR_COLUMN_LABELS[colId] || colId}
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
                {paginatedServidores.map((servidor, idx) => {
                  const varasDoServidor = state.varas.filter((v) => v.id_servidores?.includes(servidor.id));
                  const isGlobal = servidor.escritorioId?.toLowerCase() === 'x';
                  const initial = (servidor.nome || '?').trim().charAt(0).toUpperCase();

                  return (
                    <tr
                      key={`${servidor.id}-${idx}`}
                      onClick={() => {
                        if (window.innerWidth < 1024 && (canRead || canWrite)) {
                          handleOpenModal(servidor, 'view');
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
                                {servidor.id}
                              </td>
                            );
                          case 'nome':
                            return (
                              <td key={colId} className="px-4 py-3">
                                <div className="flex items-center space-x-3">
                                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                                    {initial}
                                  </div>
                                  <div>
                                    <div
                                      className="font-medium text-app-text flex items-center gap-2 cursor-pointer hover:text-primary hover:underline transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (canRead || canWrite) handleOpenModal(servidor, 'view');
                                      }}
                                    >
                                      <span>{servidor.nome}</span>
                                      {isGlobal && (
                                        <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded uppercase tracking-wider">
                                          Geral
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-app-text-muted flex items-center mt-0.5">
                                      <Briefcase size={11} className="mr-1 shrink-0" />
                                      {servidor.cargo || 'Não informado'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            );
                          case 'cargo':
                            return (
                              <td key={colId} className="px-4 py-3 text-sm text-app-text-muted">
                                {servidor.cargo || 'Não informado'}
                              </td>
                            );
                          case 'contato':
                            return (
                              <td key={colId} className="px-4 py-3">
                                <div className="space-y-1">
                                  {servidor.email && (
                                    <div className="text-sm text-primary flex items-center">
                                      <Mail size={12} className="mr-1.5 shrink-0" />
                                      {servidor.email}
                                    </div>
                                  )}
                                  {servidor.telefone && (
                                    <div className="text-sm text-app-text-muted flex items-center">
                                      <Phone size={12} className="mr-1.5 shrink-0" />
                                      {servidor.telefone}
                                    </div>
                                  )}
                                  {!servidor.email && !servidor.telefone && (
                                    <span className="text-xs italic text-app-text-muted opacity-60">-</span>
                                  )}
                                </div>
                              </td>
                            );
                          case 'varas':
                            return (
                              <td key={colId} className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {varasDoServidor.length > 0 ? (
                                    varasDoServidor.map((v) => (
                                      <span
                                        key={v.id}
                                        className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium"
                                      >
                                        {v.nome}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs italic text-app-text-muted">Nenhuma vara</span>
                                  )}
                                </div>
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
                                handleOpenModal(servidor, 'view');
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
                                handleOpenModal(servidor, 'edit');
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
                                setDeletingServidor(servidor);
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
                {sortedServidores.length === 0 && (
                  <tr>
                    <td colSpan={columnOrder.length + 1} className="p-8 text-center text-app-text-muted italic">
                      Nenhum servidor encontrado.
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
          totalItems={sortedServidores.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          label="servidores"
        />
      </div>

      <ColumnConfigModal
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        columnLabels={SERVIDOR_COLUMN_LABELS}
        columnOrder={columnOrder}
        onToggleColumn={toggleColumn}
        onResetColumns={resetColumns}
        entityName="servidores"
      />

      <ConfirmDeleteModal
        isOpen={!!deletingServidor}
        onClose={() => setDeletingServidor(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Servidor"
        description={
          <>
            Tem certeza que deseja excluir o servidor{' '}
            <strong className="text-app-text">{deletingServidor?.nome}</strong>?
          </>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalMode === 'view'
            ? 'Visualizar Servidor'
            : editingServidorId
              ? 'Editar Servidor'
              : 'Novo Servidor'
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <fieldset disabled={modalMode === 'view'} className="space-y-4 disabled:opacity-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {editingServidorId && (
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium text-app-text">ID do Servidor</label>
                  <input
                    type="text"
                    readOnly
                    className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text-muted cursor-not-allowed"
                    value={editingServidorId}
                  />
                </div>
              )}
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-app-text">Nome Completo *</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                  placeholder="Ex: João Silva"
                  value={novoServidor.nome}
                  onChange={(e) => setNovoServidor({ ...novoServidor, nome: e.target.value })}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-app-text">Cargo / Função</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                  placeholder="Ex: Diretor de Secretaria"
                  value={novoServidor.cargo}
                  onChange={(e) => setNovoServidor({ ...novoServidor, cargo: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">E-mail</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                  placeholder="Ex: joao@tjam.jus.br"
                  value={novoServidor.email}
                  onChange={(e) => setNovoServidor({ ...novoServidor, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Telefone / WhatsApp</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                  placeholder="Ex: (11) 99999-9999"
                  value={novoServidor.telefone}
                  onChange={(e) => setNovoServidor({ ...novoServidor, telefone: e.target.value })}
                />
              </div>
              {escritorioAtivoId && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-app-text">ID Escritório</label>
                  <input
                    type="text"
                    readOnly
                    className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text-muted cursor-not-allowed"
                    value={escritorioAtivoId}
                  />
                </div>
              )}
            </div>
          </fieldset>

          <div className="pt-4 flex justify-between items-center border-t border-app-border">
            <div>
              {editingServidorId && canDelete && modalMode !== 'view' && (
                <button
                  type="button"
                  onClick={() => {
                    const srv = state.servidores.find((s) => s.id === editingServidorId);
                    if (srv) setDeletingServidor(srv);
                  }}
                  className="px-4 py-2 text-red-600 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  Excluir Servidor
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
              {modalMode === 'view' && canWrite && (
                <button
                  type="button"
                  onClick={() => setModalMode('edit')}
                  className="px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm flex items-center"
                >
                  <Edit2 size={16} className="mr-2" />
                  Editar
                </button>
              )}
              {modalMode !== 'view' && canWrite && (
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                >
                  {editingServidorId ? 'Salvar Alterações' : 'Salvar Servidor'}
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
