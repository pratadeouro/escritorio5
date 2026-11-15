import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context';
import {
  Building2,
  Search,
  Mail,
  Phone,
  User,
  MapPin,
  ExternalLink,
  MessageSquare,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Settings2,
  X,
} from 'lucide-react';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { UPJ as UPJType } from '../types';
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

const UPJ_COLUMN_LABELS: Record<string, string> = {
  id: 'ID',
  nome: 'Nome da UPJ',
  diretor: 'Diretor(a)',
  localizacao: 'Localização',
  contato: 'E-mail / Telefone',
  whatsapp: 'WhatsApp',
  balcao: 'Balcão Virtual',
};

const UPJ_DEFAULT_COLUMNS = ['nome', 'diretor', 'localizacao', 'contato', 'whatsapp', 'balcao'];

export default function UPJ() {
  const { state, escritorioAtivoId, isAdmin, currentUser, hasPermission, addUPJ, updateUPJ, deleteUPJ } =
    useAppContext();
  const canRead = hasPermission('upj', 'read');
  const canWrite = hasPermission('upj', 'write');
  const canDelete = hasPermission('upj', 'delete');

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [editingUPJ, setEditingUPJ] = useState<UPJType | null>(null);
  const [deletingUPJ, setDeletingUPJ] = useState<UPJType | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'nome', direction: 'asc' });

  const {
    columnOrder,
    toggleColumn,
    resetColumns,
    isColumnModalOpen,
    setIsColumnModalOpen,
    sensors,
    handleDragEnd,
  } = useTableColumns('upj_columns_v1', UPJ_DEFAULT_COLUMNS, Object.keys(UPJ_COLUMN_LABELS));

  const [formData, setFormData] = useState<Partial<UPJType>>({
    nome: '',
    diretor: '',
    localizacao: '',
    email: '',
    telefone: '',
    whatsapp: '',
    balcao: '',
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

  const handleOpenModal = (unit?: UPJType, mode: 'create' | 'edit' | 'view' = unit ? 'edit' : 'create') => {
    setModalMode(mode);
    if (unit) {
      setEditingUPJ(unit);
      setFormData({
        nome: unit.nome || '',
        diretor: unit.diretor || '',
        localizacao: unit.localizacao || '',
        email: unit.email || '',
        telefone: unit.telefone || '',
        whatsapp: unit.whatsapp || '',
        balcao: unit.balcao || '',
      });
    } else {
      setEditingUPJ(null);
      setFormData({
        nome: '',
        diretor: '',
        localizacao: '',
        email: '',
        telefone: '',
        whatsapp: '',
        balcao: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome) return;

    if (editingUPJ) {
      updateUPJ({ ...editingUPJ, ...formData } as UPJType);
    } else {
      addUPJ({
        ...formData,
        id: Math.random().toString(36).substr(2, 9),
        escritorioId: escritorioAtivoId || '',
      } as UPJType);
    }
    setIsModalOpen(false);
    setEditingUPJ(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingUPJ) return;
    deleteUPJ(deletingUPJ.id);
    setDeletingUPJ(null);
  };

  const adminUser = isAdmin();

  const filteredUPJ = useMemo(() => {
    const sNorm = normalizeSearchStr(searchTerm);
    return state.upj.filter((u) => {
      if (!matchesOfficeFilter(u.escritorioId, escritorioAtivoId, adminUser, currentUser?.escritoriosIds)) {
        return false;
      }
      if (!sNorm) return true;
      return (
        normalizeSearchStr(u.id).includes(sNorm) ||
        normalizeSearchStr(u.nome).includes(sNorm) ||
        normalizeSearchStr(u.diretor).includes(sNorm) ||
        normalizeSearchStr(u.localizacao).includes(sNorm) ||
        normalizeSearchStr(u.email).includes(sNorm) ||
        normalizeSearchStr(u.telefone).includes(sNorm) ||
        normalizeSearchStr(u.whatsapp).includes(sNorm)
      );
    });
  }, [state.upj, searchTerm, escritorioAtivoId, adminUser, currentUser]);

  const sortedUPJ = useMemo(() => {
    if (!sortConfig) return filteredUPJ;
    return [...filteredUPJ].sort((a, b) => {
      let aVal = '';
      let bVal = '';
      switch (sortConfig.key) {
        case 'id':
          aVal = a.id || '';
          bVal = b.id || '';
          break;
        case 'nome':
          aVal = a.nome || '';
          bVal = b.nome || '';
          break;
        case 'diretor':
          aVal = a.diretor || '';
          bVal = b.diretor || '';
          break;
        case 'localizacao':
          aVal = a.localizacao || '';
          bVal = b.localizacao || '';
          break;
        case 'contato':
          aVal = `${a.email || ''} ${a.telefone || ''}`.trim();
          bVal = `${b.email || ''} ${b.telefone || ''}`.trim();
          break;
        case 'whatsapp':
          aVal = a.whatsapp || '';
          bVal = b.whatsapp || '';
          break;
        case 'balcao':
          aVal = a.balcao || '';
          bVal = b.balcao || '';
          break;
      }
      const strA = normalizeSearchStr(aVal);
      const strB = normalizeSearchStr(bVal);
      if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredUPJ, sortConfig]);

  const itemsPerPage = state.settings.itemsPerPage || 10;
  const totalPages = Math.ceil(sortedUPJ.length / itemsPerPage);

  const paginatedUPJ = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedUPJ.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedUPJ, currentPage, itemsPerPage]);

  return (
    <div className="p-2 sm:p-4 md:p-6 w-full h-full flex flex-col space-y-3 sm:space-y-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold text-app-text flex items-center uppercase">
          <Building2 className="mr-3 text-primary shrink-0" />
          <span className="truncate">Unidades de Processamento Judicial (UPJ)</span>
        </h1>
        {canWrite && (
          <button
            onClick={() => handleOpenModal(undefined, 'create')}
            className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-colors shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            Nova UPJ
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
                placeholder="Buscar por nome, diretor, e-mail ou localização..."
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
            {sortedUPJ.length} {sortedUPJ.length === 1 ? 'registro encontrado' : 'registros encontrados'}
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
                        label={UPJ_COLUMN_LABELS[colId] || colId}
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
                {paginatedUPJ.map((unit, index) => {
                  const isGlobal = unit.escritorioId?.toLowerCase() === 'x';
                  return (
                    <tr
                      key={`${unit.id}-${index}`}
                      onClick={() => {
                        if (window.innerWidth < 1024 && (canRead || canWrite)) {
                          handleOpenModal(unit, 'view');
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
                                {unit.id}
                              </td>
                            );
                          case 'nome':
                            return (
                              <td key={colId} className="px-4 py-3 font-medium text-app-text">
                                <div
                                  className="flex items-center gap-2 cursor-pointer hover:text-primary hover:underline transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (canRead || canWrite) handleOpenModal(unit, 'view');
                                  }}
                                >
                                  <span>{unit.nome}</span>
                                  {isGlobal && (
                                    <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded uppercase tracking-wider">
                                      Geral
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          case 'diretor':
                            return (
                              <td key={colId} className="px-4 py-3 text-sm text-app-text-muted">
                                {unit.diretor ? (
                                  <div className="flex items-center gap-2 text-app-text">
                                    <User size={14} className="text-app-text-muted shrink-0" />
                                    <span>{unit.diretor}</span>
                                  </div>
                                ) : (
                                  <span className="italic opacity-60">-</span>
                                )}
                              </td>
                            );
                          case 'localizacao':
                            return (
                              <td key={colId} className="px-4 py-3 text-sm text-app-text-muted max-w-xs">
                                {unit.localizacao ? (
                                  <div className="flex items-start gap-2">
                                    <MapPin size={14} className="text-app-text-muted shrink-0 mt-0.5" />
                                    <span className="line-clamp-2">{unit.localizacao}</span>
                                  </div>
                                ) : (
                                  <span className="italic opacity-60">-</span>
                                )}
                              </td>
                            );
                          case 'contato':
                            return (
                              <td key={colId} className="px-4 py-3 text-sm text-app-text-muted">
                                <div className="space-y-0.5">
                                  {unit.email && (
                                    <a
                                      href={`mailto:${unit.email}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex items-center gap-1.5 text-primary hover:underline truncate max-w-[220px]"
                                    >
                                      <Mail size={13} className="shrink-0" />
                                      <span className="truncate">{unit.email}</span>
                                    </a>
                                  )}
                                  {unit.telefone && (
                                    <div className="flex items-center gap-1.5">
                                      <Phone size={13} className="shrink-0" />
                                      <span>{unit.telefone}</span>
                                    </div>
                                  )}
                                  {!unit.email && !unit.telefone && <span className="italic opacity-60">-</span>}
                                </div>
                              </td>
                            );
                          case 'whatsapp':
                            return (
                              <td key={colId} className="px-4 py-3 text-sm whitespace-nowrap">
                                {unit.whatsapp ? (
                                  <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                                    <MessageSquare size={14} className="text-emerald-500 shrink-0" />
                                    {unit.whatsapp}
                                  </span>
                                ) : (
                                  <span className="text-app-text-muted italic opacity-60">-</span>
                                )}
                              </td>
                            );
                          case 'balcao':
                            return (
                              <td key={colId} className="px-4 py-3 whitespace-nowrap">
                                {unit.balcao ? (
                                  <a
                                    href={unit.balcao}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center px-2.5 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full hover:bg-primary hover:text-white transition-colors"
                                  >
                                    <ExternalLink size={12} className="mr-1" />
                                    Acessar
                                  </a>
                                ) : (
                                  <span className="text-xs text-app-text-muted italic opacity-60">-</span>
                                )}
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
                                handleOpenModal(unit, 'view');
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
                                handleOpenModal(unit, 'edit');
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
                                setDeletingUPJ(unit);
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

                {sortedUPJ.length === 0 && (
                  <tr>
                    <td colSpan={columnOrder.length + 1} className="p-8 text-center text-app-text-muted">
                      Nenhuma UPJ encontrada.
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
          totalItems={sortedUPJ.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          label="UPJs"
        />
      </div>

      <ColumnConfigModal
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        columnLabels={UPJ_COLUMN_LABELS}
        columnOrder={columnOrder}
        onToggleColumn={toggleColumn}
        onResetColumns={resetColumns}
        entityName="UPJ"
      />

      <ConfirmDeleteModal
        isOpen={!!deletingUPJ}
        onClose={() => setDeletingUPJ(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir UPJ"
        description={
          <>
            Tem certeza que deseja excluir a UPJ <strong className="text-app-text">{deletingUPJ?.nome}</strong>?
          </>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingUPJ(null);
        }}
        title={
          modalMode === 'view' ? 'Visualizar UPJ' : editingUPJ ? 'Editar UPJ' : 'Nova UPJ'
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <fieldset disabled={modalMode === 'view'} className="space-y-4 disabled:opacity-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Nome da UPJ *</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg outline-none focus:ring-2 focus:ring-primary text-app-text"
                  value={formData.nome || ''}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Diretor(a)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg outline-none focus:ring-2 focus:ring-primary text-app-text"
                  value={formData.diretor || ''}
                  onChange={(e) => setFormData({ ...formData, diretor: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">E-mail</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg outline-none focus:ring-2 focus:ring-primary text-app-text"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Telefone</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg outline-none focus:ring-2 focus:ring-primary text-app-text"
                  value={formData.telefone || ''}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">WhatsApp</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg outline-none focus:ring-2 focus:ring-primary text-app-text"
                  value={formData.whatsapp || ''}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Balcão Virtual (Link)</label>
                <input
                  type="url"
                  className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg outline-none focus:ring-2 focus:ring-primary text-app-text"
                  value={formData.balcao || ''}
                  onChange={(e) => setFormData({ ...formData, balcao: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Localização</label>
              <textarea
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg outline-none focus:ring-2 focus:ring-primary text-app-text resize-none"
                rows={2}
                value={formData.localizacao || ''}
                onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })}
              />
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
            {modalMode === 'view' && canWrite && editingUPJ && (
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
                {editingUPJ ? 'Salvar Alterações' : 'Adicionar UPJ'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
