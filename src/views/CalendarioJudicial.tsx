import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context';
import { 
  Calendar as CalendarIcon, 
  List, 
  LayoutGrid, 
  Search, 
  Filter,
  Inbox,
  Building2,
  Clock,
  ChevronRight,
  Info,
  Plus,
  Trash2,
  Edit2
} from 'lucide-react';
import Calendar from '../components/Calendar';
import Modal from '../components/Modal';
import { formatDate } from '../utils/date';
import { motion, AnimatePresence } from 'motion/react';
import { Calendario } from '../types';

export default function CalendarioJudicial() {
  const { state, escritorioAtivoId, isAdmin, currentUser, addCalendario, updateCalendario, deleteCalendario, hasPermission } = useAppContext();
  const canWrite = hasPermission('calendario', 'write');
  const canDelete = hasPermission('calendario', 'delete');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTJ, setSelectedTJ] = useState<string>('Todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Calendario | null>(null);

  const itemsPerPage = state.settings?.itemsPerPage || 10;

  const initialFormState: Calendario = {
    id: '',
    tj: '',
    data: new Date().toISOString().split('T')[0],
    descricao: '',
    escritorioId: escritorioAtivoId || 'x'
  };

  const [formData, setFormData] = useState<Calendario>(initialFormState);

  const handleOpenModal = (item?: Calendario) => {
    if (item) {
      setEditingItem(item);
      setFormData(item);
    } else {
      setEditingItem(null);
      setFormData(initialFormState);
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
    if (editingItem) {
      updateCalendario(formData);
    } else {
      addCalendario(formData);
    }
    handleCloseModal();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este registro?')) {
      deleteCalendario(id);
      if (isModalOpen) handleCloseModal();
    }
  };

  const filteredItems = useMemo(() => {
    return state.calendario.filter(item => {
      // Escritório filter
      if (escritorioAtivoId && item.escritorioId && item.escritorioId !== escritorioAtivoId && item.escritorioId !== 'x') return false;
      if (!isAdmin() && item.escritorioId && item.escritorioId !== 'x' && !(currentUser?.escritoriosIds || []).includes(item.escritorioId)) return false;

      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (item.tj || '').toLowerCase().includes(searchLower) ||
        (item.descricao || '').toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;

      // TJ Filter
      if (selectedTJ !== 'Todos' && item.tj !== selectedTJ) return false;

      return true;
    }).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [state.calendario, searchTerm, selectedTJ, escritorioAtivoId, isAdmin, currentUser]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const allTJs = useMemo(() => {
    const tjs = new Set<string>();
    state.calendario.forEach(item => {
      if (item.tj) tjs.add(item.tj);
    });
    return ['Todos', ...Array.from(tjs).sort()];
  }, [state.calendario]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-app-text flex items-center">
            <CalendarIcon className="mr-3 text-primary" size={28} />
            Calendário Judicial
          </h1>
          <p className="text-sm text-app-text-muted mt-1">
            Informações e prazos dos tribunais judiciais
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => handleOpenModal()}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all text-sm"
          >
            <Plus size={18} />
            Novo Registro
          </button>

          <div className="flex bg-app-secondary p-1 rounded-xl border border-app-border">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all flex items-center gap-2 px-3 text-sm font-medium ${
                viewMode === 'list' 
                  ? 'bg-app-surface shadow-sm text-primary' 
                  : 'text-app-text-muted hover:text-app-text'
              }`}
            >
              <List size={18} />
              Lista
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-lg transition-all flex items-center gap-2 px-3 text-sm font-medium ${
                viewMode === 'calendar' 
                  ? 'bg-app-surface shadow-sm text-primary' 
                  : 'text-app-text-muted hover:text-app-text'
              }`}
            >
              <LayoutGrid size={18} />
              Calendário
            </button>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-app-surface p-4 rounded-2xl border border-app-border shadow-sm">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
          <input
            type="text"
            placeholder="Buscar por TJ ou descrição..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-app-bg border border-app-border rounded-xl text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-app-bg px-3 py-1.5 rounded-xl border border-app-border">
            <Filter size={16} className="text-app-text-muted" />
            <span className="text-xs font-semibold text-app-text-muted uppercase">TJ:</span>
            <select
              value={selectedTJ}
              onChange={(e) => {
                setSelectedTJ(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent border-none text-sm font-medium text-app-text focus:ring-0 p-0 pr-6"
            >
              {allTJs.map(tj => (
                <option key={tj} value={tj}>{tj}</option>
              ))}
            </select>
          </div>
          
          <div className="text-xs font-medium text-app-text-muted bg-app-bg px-3 py-1.5 rounded-xl border border-app-border">
            {filteredItems.length} registros
          </div>
        </div>
      </div>

      {/* Content Area */}
      <AnimatePresence mode="wait">
        {viewMode === 'list' ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="space-y-3">
              {paginatedItems.length > 0 ? (
                paginatedItems.map((item) => (
                  <div 
                    key={item.id} 
                    className="bg-app-surface p-4 rounded-xl border border-app-border hover:border-primary/30 transition-all group flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-110 transition-transform">
                      <Building2 size={24} />
                    </div>
                    
                    <div className="flex-1 min-w-0" onClick={() => canWrite && handleOpenModal(item)}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-[10px] font-bold tracking-wider uppercase">
                          {item.tj}
                        </span>
                        <div className="flex items-center text-xs text-app-text-muted">
                          <Clock size={12} className="mr-1" />
                          {formatDate(item.data)}
                        </div>
                      </div>
                      <h3 className="text-base font-semibold text-app-text leading-tight mb-1 truncate group-hover:text-primary transition-colors cursor-pointer">
                        {item.descricao}
                      </h3>
                    </div>

                    <div className="flex items-center sm:justify-end gap-2 shrink-0">
                      {canWrite && (
                        <button 
                          onClick={() => handleOpenModal(item)}
                          className="p-2 text-app-text-muted hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                        >
                          <Edit2 size={18} />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-app-text-muted hover:text-red-500 hover:bg-red-50/50 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState />
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-app-surface p-4 rounded-xl border border-app-border">
                <div className="text-sm text-app-text-muted">
                  Mostrando <span className="font-semibold text-app-text">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-semibold text-app-text">{Math.min(currentPage * itemsPerPage, filteredItems.length)}</span> de <span className="font-semibold text-app-text">{filteredItems.length}</span> registros
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-app-border bg-app-bg text-app-text-muted hover:text-primary hover:border-primary disabled:opacity-50 disabled:hover:text-app-text-muted disabled:hover:border-app-border transition-all"
                  >
                    Anterior
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${
                          currentPage === page 
                            ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                            : 'bg-app-bg text-app-text-muted hover:bg-app-secondary border border-app-border'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-app-border bg-app-bg text-app-text-muted hover:text-primary hover:border-primary disabled:opacity-50 disabled:hover:text-app-text-muted disabled:hover:border-app-border transition-all"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className="bg-app-surface rounded-2xl border border-app-border overflow-hidden shadow-lg p-2"
          >
            <Calendar 
              events={filteredItems.map(item => ({
                id: item.id,
                date: item.data,
                title: `${item.tj}: ${item.descricao}`,
                color: 'bg-primary/10 text-primary border-primary/20 cursor-pointer hover:bg-primary/20'
              }))}
              onEventClick={(id) => {
                const item = state.calendario.find(c => c.id === id);
                if (item) handleOpenModal(item);
              }}
            />
            
            {/* Legend */}
            <div className="p-4 bg-app-bg/50 border-t border-app-border flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-primary"></div>
                <span className="text-app-text-muted">Evento Judicial</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary/20 border border-primary/40"></div>
                <span className="text-app-text-muted">Hoje</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal CRUD */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingItem ? 'Editar Registro' : 'Novo Registro Judicial'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Tribunal (TJ)</label>
              <input
                type="text"
                required
                placeholder="Ex: TJGO, TJSP"
                value={formData.tj}
                onChange={(e) => setFormData({ ...formData, tj: e.target.value })}
                className="w-full px-4 py-2 bg-app-bg border border-app-border rounded-xl text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Data</label>
              <input
                type="date"
                required
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                className="w-full px-4 py-2 bg-app-bg border border-app-border rounded-xl text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Descrição</label>
            <textarea
              rows={4}
              required
              placeholder="Descreva o evento ou suspensão de prazo..."
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              className="w-full px-4 py-2 bg-app-bg border border-app-border rounded-xl text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
            />
          </div>

          <div className="pt-4 flex items-center justify-between gap-3">
            {editingItem && (
              <button
                type="button"
                onClick={() => handleDelete(editingItem.id)}
                className="flex items-center gap-2 text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl transition-all font-medium"
              >
                <Trash2 size={18} />
                Excluir
              </button>
            )}
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-6 py-2 rounded-xl font-medium text-app-text-muted hover:bg-app-bg transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-primary text-white px-8 py-2 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
              >
                Salvar
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-app-surface rounded-2xl border border-app-border border-dashed">
      <div className="p-4 bg-app-secondary rounded-full text-app-text-muted mb-4">
        <Inbox size={48} strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-bold text-app-text">Nenhum evento encontrado</h3>
      <p className="text-app-text-muted text-center max-w-xs mt-1">
        Tente ajustar sua busca ou filtros para encontrar o que procura.
      </p>
    </div>
  );
}
