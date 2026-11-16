import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context';
import {
  Calendar as CalendarIcon,
  List,
  LayoutGrid,
  Search,
  Filter,
  Inbox,
  Plus,
  Trash2,
  Edit2,
  X,
  ArrowUpDown,
} from 'lucide-react';
import Calendar from '../components/Calendar';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import {
  ConfirmDeleteModal,
  matchesOfficeFilter,
  normalizeSearchStr,
} from '../components/CadastrosTableHelper';
import { formatDate } from '../utils/date';
import { Calendario } from '../types';

export default function CalendarioJudicial() {
  const {
    state,
    escritorioAtivoId,
    isAdmin,
    currentUser,
    addCalendario,
    updateCalendario,
    deleteCalendario,
    hasPermission,
  } = useAppContext();

  const canWrite = isAdmin() || hasPermission('calendario', 'write');
  const canDelete = isAdmin() || hasPermission('calendario', 'delete');

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTJ, setSelectedTJ] = useState<string>('Todos');
  const [selectedYear, setSelectedYear] = useState<string>('Todos');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(state.settings?.itemsPerPage || 10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Calendario | null>(null);
  const [deletingItem, setDeletingItem] = useState<Calendario | null>(null);

  useEffect(() => {
    if (state.settings?.itemsPerPage) {
      setPageSize(state.settings.itemsPerPage);
    }
  }, [state.settings?.itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedTJ, selectedYear, escritorioAtivoId, pageSize]);

  const initialFormState: Calendario = {
    id: '',
    tj: '',
    data: new Date().toISOString().split('T')[0],
    descricao: '',
    escritorioId: escritorioAtivoId || 'x',
  };

  const [formData, setFormData] = useState<Calendario>(initialFormState);

  const handleOpenModal = (item?: Calendario) => {
    if (item) {
      setEditingItem(item);
      setFormData(item);
    } else {
      setEditingItem(null);
      setFormData({
        id: '',
        tj: selectedTJ !== 'Todos' ? selectedTJ : '',
        data: new Date().toISOString().split('T')[0],
        descricao: '',
        escritorioId: escritorioAtivoId || 'x',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData(initialFormState);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    if (editingItem) {
      updateCalendario(formData);
    } else {
      addCalendario(formData);
    }
    handleCloseModal();
  };

  const handleConfirmDelete = () => {
    if (!deletingItem) return;
    deleteCalendario(deletingItem.id);
    if (isModalOpen && editingItem?.id === deletingItem.id) {
      handleCloseModal();
    }
    setDeletingItem(null);
  };

  const officeScopedItems = useMemo(() => {
    const adminUser = isAdmin();
    const userOffices = currentUser?.escritoriosIds;
    return state.calendario.filter((item) =>
      matchesOfficeFilter(item.escritorioId, escritorioAtivoId, adminUser, userOffices)
    );
  }, [state.calendario, escritorioAtivoId, isAdmin, currentUser]);

  const allTJs = useMemo(() => {
    const tjs = new Set<string>();
    officeScopedItems.forEach((item) => {
      if (item.tj && item.tj.trim()) tjs.add(item.tj.trim());
    });
    return ['Todos', ...Array.from(tjs).sort((a, b) => a.localeCompare(b))];
  }, [officeScopedItems]);

  const allYears = useMemo(() => {
    const years = new Set<string>();
    officeScopedItems.forEach((item) => {
      if (item.data && item.data.length >= 4) {
        const y = item.data.substring(0, 4);
        if (/^\d{4}$/.test(y)) years.add(y);
      }
    });
    return ['Todos', ...Array.from(years).sort((a, b) => b.localeCompare(a))];
  }, [officeScopedItems]);

  const filteredItems = useMemo(() => {
    const queryNorm = normalizeSearchStr(searchTerm);

    return officeScopedItems
      .filter((item) => {
        if (selectedTJ !== 'Todos' && (item.tj || '').trim() !== selectedTJ) {
          return false;
        }

        if (selectedYear !== 'Todos' && !(item.data || '').startsWith(selectedYear)) {
          return false;
        }

        if (queryNorm) {
          const formattedDate = formatDate(item.data);
          const matchesSearch =
            normalizeSearchStr(item.tj).includes(queryNorm) ||
            normalizeSearchStr(item.descricao).includes(queryNorm) ||
            normalizeSearchStr(formattedDate).includes(queryNorm) ||
            normalizeSearchStr(item.data).includes(queryNorm);
          if (!matchesSearch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = a.data ? new Date(`${a.data}T00:00:00`).getTime() : 0;
        const timeB = b.data ? new Date(`${b.data}T00:00:00`).getTime() : 0;
        if (timeA !== timeB) {
          return sortDirection === 'desc' ? timeB - timeA : timeA - timeB;
        }
        return (a.tj || '').localeCompare(b.tj || '');
      });
  }, [officeScopedItems, searchTerm, selectedTJ, selectedYear, sortDirection]);

  const totalPages = Math.ceil(filteredItems.length / pageSize);
  const safeCurrentPage = Math.min(currentPage, Math.max(1, totalPages));

  const paginatedItems = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, safeCurrentPage, pageSize]);

  const hasActiveFilters =
    searchTerm.trim() !== '' || selectedTJ !== 'Todos' || selectedYear !== 'Todos';

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedTJ('Todos');
    setSelectedYear('Todos');
    setCurrentPage(1);
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 w-full h-full flex flex-col space-y-3 sm:space-y-4 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 flex-shrink-0">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-app-text flex items-center">
            <CalendarIcon className="mr-3 text-primary shrink-0" size={26} />
            <span className="truncate">Calendário Judicial</span>
          </h1>
          <p className="text-xs sm:text-sm text-app-text-muted mt-0.5 truncate">
            Feriados, recessos e suspensões de prazos nos tribunais
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
          {canWrite && (
            <button
              type="button"
              onClick={() => handleOpenModal()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-semibold shadow-sm hover:opacity-90 transition-opacity text-sm whitespace-nowrap shrink-0"
            >
              <Plus size={18} />
              Novo Registro
            </button>
          )}

          <div className="flex bg-app-secondary p-1 rounded-lg border border-app-border shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`py-1.5 px-3 rounded-md transition-colors flex items-center gap-1.5 text-sm font-medium whitespace-nowrap shrink-0 ${
                viewMode === 'list'
                  ? 'bg-app-surface shadow-sm text-primary'
                  : 'text-app-text-muted hover:text-app-text'
              }`}
            >
              <List size={16} />
              Lista
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`py-1.5 px-3 rounded-md transition-colors flex items-center gap-1.5 text-sm font-medium whitespace-nowrap shrink-0 ${
                viewMode === 'calendar'
                  ? 'bg-app-surface shadow-sm text-primary'
                  : 'text-app-text-muted hover:text-app-text'
              }`}
            >
              <LayoutGrid size={16} />
              Calendário
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden flex-1 flex flex-col min-h-0">
        {/* Filters Bar */}
        <div className="p-3 sm:p-4 border-b border-app-border flex flex-col lg:flex-row gap-3 lg:items-center justify-between flex-shrink-0">
          <div className="relative flex-1 w-full lg:max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted"
              size={18}
            />
            <input
              type="text"
              placeholder="Buscar por tribunal, data ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-9 py-2 bg-app-secondary border border-app-border rounded-lg text-app-text placeholder-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text transition-colors"
                title="Limpar busca"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <div className="flex items-center gap-2 bg-app-secondary px-3 py-1.5 rounded-lg border border-app-border">
              <Filter size={15} className="text-app-text-muted shrink-0" />
              <span className="text-xs font-medium text-app-text-muted whitespace-nowrap">
                Tribunal:
              </span>
              <select
                value={selectedTJ}
                onChange={(e) => setSelectedTJ(e.target.value)}
                className="bg-transparent border-none text-sm font-medium text-app-text focus:outline-none focus:ring-0 p-0 pr-5 cursor-pointer"
              >
                {allTJs.map((tj) => (
                  <option key={tj} value={tj} className="bg-app-surface text-app-text">
                    {tj}
                  </option>
                ))}
              </select>
            </div>

            {allYears.length > 2 && (
              <div className="flex items-center gap-2 bg-app-secondary px-3 py-1.5 rounded-lg border border-app-border tabular-nums">
                <span className="text-xs font-medium text-app-text-muted whitespace-nowrap">
                  Ano:
                </span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-transparent border-none text-sm font-medium text-app-text focus:outline-none focus:ring-0 p-0 pr-5 cursor-pointer tabular-nums"
                >
                  {allYears.map((yr) => (
                    <option key={yr} value={yr} className="bg-app-surface text-app-text">
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {viewMode === 'list' && (
              <button
                type="button"
                onClick={() =>
                  setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
                }
                className="flex items-center gap-1.5 bg-app-secondary hover:bg-app-bg px-3 py-1.5 rounded-lg border border-app-border text-xs font-medium text-app-text transition-colors whitespace-nowrap shrink-0"
                title="Alternar ordenação por data"
              >
                <ArrowUpDown size={14} className="text-primary shrink-0" />
                {sortDirection === 'desc' ? 'Mais recentes' : 'Mais antigos'}
              </button>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-medium text-primary hover:underline px-2 py-1.5 whitespace-nowrap shrink-0"
              >
                Limpar filtros
              </button>
            )}

            <span className="text-xs text-app-text-muted font-medium whitespace-nowrap ml-auto lg:ml-1 tabular-nums">
              {filteredItems.length}{' '}
              {filteredItems.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>
        </div>

        {/* Content Area */}
        {viewMode === 'list' ? (
          <>
            <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-app-border scrollbar-track-transparent">
              {paginatedItems.length > 0 ? (
                <table className="w-full text-left border-collapse min-w-full">
                  <thead className="sticky top-0 z-10 bg-app-secondary border-b border-app-border text-app-text-muted text-xs font-semibold">
                    <tr>
                      <th className="px-4 py-3 w-36 whitespace-nowrap">Data</th>
                      <th className="px-4 py-3 w-32 whitespace-nowrap">Tribunal</th>
                      <th className="px-4 py-3">Descrição / Suspensão de Prazo</th>
                      {(canWrite || canDelete) && (
                        <th className="px-4 py-3 w-28 text-right whitespace-nowrap">
                          Ações
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border text-sm">
                    {paginatedItems.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => {
                          if (canWrite) handleOpenModal(item);
                        }}
                        className={`hover:bg-app-secondary/60 transition-colors group ${
                          canWrite ? 'cursor-pointer' : ''
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs sm:text-sm text-app-text tabular-nums">
                          {formatDate(item.data)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-semibold text-primary text-xs sm:text-sm">
                          {item.tj || '—'}
                        </td>
                        <td className="px-4 py-3 text-app-text leading-snug">
                          <span className="group-hover:text-primary transition-colors">
                            {item.descricao}
                          </span>
                        </td>
                        {(canWrite || canDelete) && (
                          <td
                            className="px-4 py-2.5 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center justify-end gap-1">
                              {canWrite && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenModal(item)}
                                  className="p-2 text-app-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                  title="Editar registro"
                                >
                                  <Edit2 size={16} />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => setDeletingItem(item)}
                                  className="p-2 text-app-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                  title="Excluir registro"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState
                  hasFilters={hasActiveFilters}
                  onClearFilters={clearFilters}
                  canWrite={canWrite}
                  onAdd={() => handleOpenModal()}
                />
              )}
            </div>

            <Pagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalItems={filteredItems.length}
              itemsPerPage={pageSize}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setPageSize}
              label="registros"
            />
          </>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-app-border scrollbar-track-transparent flex flex-col">
            <div className="p-2 flex-1">
              <Calendar
                events={filteredItems.map((item) => ({
                  id: item.id,
                  date: item.data,
                  title: `${item.tj}: ${item.descricao}`,
                  color:
                    'bg-primary/10 text-primary border-primary/20 cursor-pointer hover:bg-primary/20',
                }))}
                onEventClick={(id) => {
                  const item = state.calendario.find((c) => c.id === id);
                  if (item && canWrite) handleOpenModal(item);
                }}
              />
            </div>

            {/* Legend */}
            <div className="px-4 py-3 bg-app-secondary/30 border-t border-app-border flex flex-wrap gap-4 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-primary" />
                <span className="text-app-text-muted">Evento Judicial</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary/20 border border-primary/40" />
                <span className="text-app-text-muted">Hoje</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Criar / Editar */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingItem ? 'Editar Registro' : 'Novo Registro Judicial'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-app-text-muted">
                Tribunal (TJ)
              </label>
              <input
                type="text"
                required
                placeholder="Ex: TJGO, TJSP"
                value={formData.tj}
                onChange={(e) => setFormData({ ...formData, tj: e.target.value })}
                className="w-full px-3.5 py-2 bg-app-bg border border-app-border rounded-lg text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-app-text-muted">
                Data
              </label>
              <input
                type="date"
                required
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                className="w-full px-3.5 py-2 bg-app-bg border border-app-border rounded-lg text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-app-text-muted">
              Descrição
            </label>
            <textarea
              rows={4}
              required
              placeholder="Descreva o evento ou suspensão de prazo..."
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              className="w-full px-3.5 py-2 bg-app-bg border border-app-border rounded-lg text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none text-sm"
            />
          </div>

          <div className="pt-4 flex items-center justify-between gap-3 border-t border-app-border">
            {editingItem && canDelete ? (
              <button
                type="button"
                onClick={() => setDeletingItem(editingItem)}
                className="flex items-center gap-2 text-red-500 hover:bg-red-500/10 px-3.5 py-2 rounded-lg transition-colors font-medium text-sm whitespace-nowrap shrink-0"
              >
                <Trash2 size={16} />
                Excluir
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-5 py-2 rounded-lg font-medium text-app-text-muted hover:bg-app-bg transition-colors text-sm whitespace-nowrap shrink-0"
              >
                Cancelar
              </button>
              {canWrite && (
                <button
                  type="submit"
                  className="bg-primary text-white px-6 py-2 rounded-lg font-semibold shadow-sm hover:opacity-90 transition-opacity text-sm whitespace-nowrap shrink-0"
                >
                  Salvar
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal Confirmar Exclusão */}
      <ConfirmDeleteModal
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Registro Judicial"
        description={
          <>
            Tem certeza que deseja excluir o evento{' '}
            <strong className="text-app-text">{deletingItem?.descricao}</strong> (
            {deletingItem?.tj} — {deletingItem ? formatDate(deletingItem.data) : ''})?
          </>
        }
      />
    </div>
  );
}

interface EmptyStateProps {
  hasFilters: boolean;
  onClearFilters: () => void;
  canWrite: boolean;
  onAdd: () => void;
}

function EmptyState({ hasFilters, onClearFilters, canWrite, onAdd }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[260px]">
      <div className="p-4 bg-app-secondary rounded-full text-app-text-muted mb-4">
        <Inbox size={40} strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-semibold text-app-text">Nenhum evento encontrado</h3>
      <p className="text-sm text-app-text-muted max-w-xs mt-1">
        {hasFilters
          ? 'Nenhum registro corresponde aos filtros aplicados.'
          : 'Ainda não há feriados ou suspensões cadastrados neste calendário.'}
      </p>
      {hasFilters ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-4 px-4 py-2 text-xs font-semibold text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
        >
          Limpar filtros
        </button>
      ) : (
        canWrite && (
          <button
            type="button"
            onClick={onAdd}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus size={15} />
            Novo Registro
          </button>
        )
      )}
    </div>
  );
}
