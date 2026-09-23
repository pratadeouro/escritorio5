import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context';
import { Calendar as CalendarIcon, Plus, Clock, CheckCircle2, Circle, List, LayoutGrid, Edit2, Eye, Trash2, Search, Link as LinkIcon, Building, User, Info, CalendarPlus } from 'lucide-react';
import Calendar from '../components/Calendar';
import Modal from '../components/Modal';
import { formatDate, formatDateTime } from '../utils/date';
import { Evento } from '../types';

type ModalMode = 'create' | 'edit' | 'view';

export default function Agenda() {
  const { state, addEvento, updateEvento, deleteEvento, escritorioAtivoId, isAdmin, currentUser, setSelectedProcessId, hasPermission, setViewParams } = useAppContext();
  const canWrite = hasPermission('eventos', 'write');
  const canDelete = hasPermission('eventos', 'delete');
  const isGlobalAdmin = isAdmin() && (escritorioAtivoId === "" || !escritorioAtivoId);

  useEffect(() => {
    if (state.viewParams?.editEventoId) {
      const event = state.eventos.find(e => e.id === state.viewParams.editEventoId);
      if (event) {
        // Clear viewParams
        setViewParams(null);
        // Open the modal in edit mode
        handleOpenModal('edit', event);
      }
    } else if (state.viewParams?.viewEventoId) {
      const event = state.eventos.find(e => e.id === state.viewParams.viewEventoId);
      if (event) {
        // Clear viewParams
        setViewParams(null);
        // Open the modal in view mode
        handleOpenModal('view', event);
      }
    }
  }, [state.viewParams, state.eventos, setViewParams]);
  const [filter, setFilter] = useState<'Todos' | 'Pendentes' | 'Concluídos'>('Pendentes');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [searchTerm, setSearchTerm] = useState('');

  const defaultDatetime = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  };

  const formatForDatetimeLocal = (dateStr: string | undefined | null): string => {
    if (!dateStr) {
      return defaultDatetime();
    }
    
    // If it already has "T" and has HH:MM
    if (dateStr.includes('T')) {
      const parts = dateStr.split('T');
      if (parts[1] && parts[1].length >= 5) {
        return dateStr.substring(0, 16);
      }
      return `${parts[0]}T12:00`;
    }

    // If it is YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return `${dateStr}T12:00`;
    }

    // If it contains space like "YYYY-MM-DD HH:MM"
    if (dateStr.includes(' ')) {
      const parts = dateStr.split(' ');
      if (parts[0] && parts[1]) {
        return `${parts[0]}T${parts[1].substring(0, 5)}`;
      }
    }

    return defaultDatetime();
  };
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null);
  const [formData, setFormData] = useState({
    titulo: '',
    data: defaultDatetime(),
    tipo: 'Outro' as Evento['tipo'],
    processoId: '',
    observacoes: '',
    concluido: false,
    escritorioId: escritorioAtivoId || '',
    link: '',
    usuarioId: ''
  });

  const filteredEventos = state.eventos.filter(e => {
    if (escritorioAtivoId) {
      const isGlobal = e.escritorioId?.toLowerCase() === 'x';
      if (e.escritorioId !== escritorioAtivoId && !isGlobal) return false;
    }
    
    if (!isAdmin() && e.escritorioId && e.escritorioId?.toLowerCase() !== 'x' && !(currentUser?.escritoriosIds || []).includes(e.escritorioId)) return false;
    
    const searchLower = searchTerm.toLowerCase();
    const processo = state.processos.find(p => p.id === e.processoId);
    
    const matchesSearch = e.titulo.toLowerCase().includes(searchLower) || 
                         (e.observacoes || '').toLowerCase().includes(searchLower) ||
                         (processo?.numero.toLowerCase().includes(searchLower));

    if (!matchesSearch) return false;
    
    if (filter === 'Pendentes') return !e.concluido;
    if (filter === 'Concluídos') return e.concluido;
    return true;
  }).sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  const getGoogleCalendarUrl = (evento: Evento) => {
    const processo = state.processos.find(p => p.id === evento.processoId);
    const title = `${evento.tipo ? `[${evento.tipo}] ` : ''}${evento.titulo}`;
    
    const descriptionParts = [];
    if (processo) {
      descriptionParts.push(`Processo: ${processo.numero ? processo.numero : ''} - ${processo.titulo || processo.parteContraria || ''}`);
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

  const handleOpenModal = (mode: ModalMode, evento?: Evento) => {
    setModalMode(mode);
    if (evento) {
      setSelectedEvento(evento);
      setFormData({
        titulo: evento.titulo,
        data: formatForDatetimeLocal(evento.data),
        tipo: evento.tipo,
        processoId: evento.processoId || '',
        observacoes: evento.observacoes || '',
        concluido: evento.concluido || false,
        escritorioId: evento.escritorioId || '',
        link: evento.link || '',
        usuarioId: evento.usuarioId || ''
      });
    } else {
      setSelectedEvento(null);
      setFormData({
        titulo: '',
        data: defaultDatetime(),
        tipo: 'Outro',
        processoId: '',
        observacoes: '',
        concluido: false,
        escritorioId: escritorioAtivoId || '',
        link: '',
        usuarioId: currentUser?.id || ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo || !formData.data) return;

    if (modalMode === 'create') {
      addEvento({
        id: Math.random().toString(36).substr(2, 9),
        ...formData,
        usuarioId: currentUser?.id || '',
        escritorioId: formData.escritorioId || escritorioAtivoId || ''
      } as any);
    } else if (modalMode === 'edit' && selectedEvento) {
      updateEvento({
        ...selectedEvento,
        ...formData
      });
    }
    
    setIsModalOpen(false);
  };

  const toggleConcluido = (evento: Evento) => {
    if (!canWrite) return;
    updateEvento({
      ...evento,
      concluido: !evento.concluido
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este evento?')) {
      deleteEvento(id);
    }
  };

  const formatCNJ = (numero: string) => {
    if (!numero) return '';
    const digits = numero.replace(/\D/g, '');
    if (digits.length === 20) {
      return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
    }
    return numero;
  };

  const currentProcesso = state.processos.find(p => p.id === formData.processoId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-app-text flex items-center">
          <CalendarIcon className="mr-3 text-primary" />
          Audiências e Eventos
          <span className="ml-3 text-xs font-normal text-app-text-muted bg-app-secondary px-2 py-1 rounded-full border border-app-border">
            {filteredEventos.length} de {state.eventos.length} registros
          </span>
        </h1>
        {canWrite && (
          <button 
            onClick={() => handleOpenModal('create')}
            className="bg-primary hover:opacity-90 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            Novo Evento
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex space-x-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          {['Todos', 'Pendentes', 'Concluídos'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                filter === f 
                  ? 'bg-primary/10 text-primary border border-primary/20' 
                  : 'bg-app-secondary text-app-text-muted border border-app-border hover:bg-app-bg'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
            <input
              type="text"
              placeholder="Buscar eventos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-app-surface border border-app-border rounded-lg text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          <div className="flex bg-app-secondary p-1 rounded-lg">
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
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
        {viewMode === 'list' ? (
          <div className="divide-y divide-app-border">
            {filteredEventos.map(evento => {
              const processo = state.processos.find(p => p.id === evento.processoId);
              const isAtrasado = !evento.concluido && new Date(evento.data) < new Date();

              return (
                <div key={evento.id} className={`p-4 flex items-start hover:bg-app-secondary/50 transition-colors ${evento.concluido ? 'opacity-60' : ''}`}>
                  <button 
                    disabled={!canWrite}
                    onClick={() => toggleConcluido(evento)}
                    className={`mt-1 mr-4 transition-colors ${!canWrite ? 'opacity-50 cursor-not-allowed' : 'hover:text-primary'} ${evento.concluido ? 'text-emerald-500' : 'text-app-text-muted'}`}
                  >
                    {evento.concluido ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                  </button>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h3 className={`font-semibold text-lg ${evento.concluido ? 'text-app-text-muted line-through' : 'text-app-text'}`}>
                          {evento.titulo}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold ${
                          evento.tipo === 'Prazo' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' :
                          evento.tipo === 'Audiência' ? 'bg-primary/10 text-primary border border-primary/20' :
                          evento.tipo === 'Reunião' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' :
                          'bg-app-bg text-app-text-muted border border-app-border'
                        }`}>
                          {evento.tipo}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <a 
                          href={getGoogleCalendarUrl(evento)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-app-text-muted hover:text-emerald-600 hover:bg-emerald-600/10 rounded-lg transition-all"
                          title="Adicionar ao Google Agenda"
                        >
                          <CalendarPlus size={18} />
                        </a>
                        <button 
                          onClick={() => handleOpenModal('view', evento)}
                          className="p-1.5 text-app-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                          title="Visualizar"
                        >
                          <Eye size={18} />
                        </button>
                        {canWrite && (
                          <button 
                            onClick={() => handleOpenModal('edit', evento)}
                            className="p-1.5 text-app-text-muted hover:text-amber-600 hover:bg-amber-600/10 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            onClick={() => handleDelete(evento.id)}
                            className="p-1.5 text-app-text-muted hover:text-red-600 hover:bg-red-600/10 rounded-lg transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-2 flex flex-wrap items-center text-sm text-app-text-muted gap-x-6 gap-y-2">
                      <div className={`flex items-center ${isAtrasado ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
                        <Clock size={16} className="mr-1.5" />
                        {formatDateTime(evento.data)}
                        {isAtrasado && ' (Atrasado)'}
                      </div>
                      {processo && (
                        <div 
                          className="flex items-center cursor-pointer hover:text-primary transition-colors group/proc"
                          onClick={() => {
                            setSelectedProcessId(processo.id);
                            window.dispatchEvent(new CustomEvent('navigate', { detail: 'processosAtivos' }));
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-app-border mr-2 group-hover/proc:bg-primary"></span>
                          <span className="font-mono text-primary font-bold group-hover/proc:underline">{formatCNJ(processo.numero)}</span>
                        </div>
                      )}
                      {evento.link && (
                        <a
                          href={evento.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center text-primary hover:underline font-medium gap-1 text-xs"
                          title="Acessar Link do Evento"
                        >
                          <LinkIcon size={14} className="text-primary" />
                          <span>Link Salvo</span>
                        </a>
                      )}
                    </div>
                    {evento.observacoes && (
                      <div className="mt-2 p-2 bg-app-bg rounded text-xs text-app-text-muted border border-app-border">
                        {evento.observacoes}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredEventos.length === 0 && (
              <div className="p-12 text-center">
                <div className="inline-flex p-4 bg-app-secondary rounded-full text-app-text-muted mb-4">
                  <CalendarIcon size={32} />
                </div>
                <p className="text-app-text-muted font-medium">Nenhum evento encontrado para este filtro.</p>
                <button 
                  onClick={() => setFilter('Todos')}
                  className="mt-2 text-primary text-sm hover:underline"
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4">
            <Calendar 
              events={filteredEventos.map(e => ({
                id: e.id,
                date: e.data,
                title: e.titulo,
                type: e.tipo,
                color: e.tipo === 'Prazo' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
                       e.tipo === 'Audiência' ? 'bg-primary/10 text-primary border-primary/20' :
                       e.tipo === 'Reunião' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' :
                       'bg-app-bg text-app-text-muted border border-app-border'
              }))}
              onEventClick={(id) => {
                const event = state.eventos.find(e => e.id === id);
                if (event) {
                  handleOpenModal('view', event);
                }
              }}
            />
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalMode === 'create' ? 'Novo Evento' :
          modalMode === 'edit' ? 'Editar Evento' :
          'Detalhes do Evento'
        }
      >
        {modalMode === 'view' && selectedEvento ? (
          <div className="space-y-5">
            {/* Header / Title */}
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-2xl ${
                selectedEvento.tipo === 'Prazo' ? 'bg-red-500/10 text-red-600' :
                selectedEvento.tipo === 'Audiência' ? 'bg-primary/10 text-primary' :
                selectedEvento.tipo === 'Reunião' ? 'bg-purple-500/10 text-purple-600' :
                'bg-app-text-muted/10 text-app-text-muted'
              }`}>
                <CalendarIcon size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-app-text">{selectedEvento.titulo}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-extrabold ${
                    selectedEvento.tipo === 'Prazo' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' :
                    selectedEvento.tipo === 'Audiência' ? 'bg-primary/10 text-primary border border-primary/20' :
                    selectedEvento.tipo === 'Reunião' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' :
                    'bg-app-bg text-app-text-muted border border-app-border'
                  }`}>
                    {selectedEvento.tipo}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-extrabold flex items-center gap-1 ${
                    selectedEvento.concluido 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedEvento.concluido ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {selectedEvento.concluido ? 'Concluído' : 'Pendente'}
                  </span>
                </div>
              </div>
            </div>

            {/* Main Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-app-bg border border-app-border rounded-xl">
                <p className="text-[10px] font-bold text-app-text-muted uppercase mb-1 flex items-center gap-1">
                  <Clock size={12} /> Data e Hora
                </p>
                <p className="text-sm font-semibold text-app-text">
                  {formatDateTime(selectedEvento.data)}
                </p>
              </div>

              {selectedEvento.escritorioId && (
                <div className="p-3 bg-app-bg border border-app-border rounded-xl">
                  <p className="text-[10px] font-bold text-app-text-muted uppercase mb-1 flex items-center gap-1">
                    <Building size={12} /> Escritório Responsável
                  </p>
                  <p className="text-sm font-semibold text-app-text">
                    {state.escritorios.find(e => e.id === selectedEvento.escritorioId)?.nome || 'Todos os Escritórios'}
                  </p>
                </div>
              )}

              {selectedEvento.usuarioId && (
                <div className="p-3 bg-app-bg border border-app-border rounded-xl">
                  <p className="text-[10px] font-bold text-app-text-muted uppercase mb-1 flex items-center gap-1">
                    <User size={12} /> Usuário Responsável
                  </p>
                  <p className="text-sm font-semibold text-app-text">
                    {state.usuarios?.find(u => u.id === selectedEvento.usuarioId)?.nome || 'N/A'}
                  </p>
                </div>
              )}

              {selectedEvento.processoId && (
                <div className="p-3 bg-app-bg border border-app-border rounded-xl md:col-span-2">
                  <p className="text-[10px] font-bold text-app-text-muted uppercase mb-1">Processo Vinculado</p>
                  {(() => {
                    const proc = state.processos.find(p => p.id === selectedEvento.processoId);
                    if (proc) {
                      return (
                        <div 
                          className="cursor-pointer hover:opacity-80 group/proc flex items-center justify-between"
                          onClick={() => {
                            setSelectedProcessId(proc.id);
                            window.dispatchEvent(new CustomEvent('navigate', { detail: 'processosAtivos' }));
                            setIsModalOpen(false);
                          }}
                        >
                          <div>
                            <p className="text-sm font-mono font-bold text-primary group-hover/proc:underline">
                              {formatCNJ(proc.numero)}
                            </p>
                            {(proc.titulo || proc.parteContraria) && (
                              <p className="text-xs text-app-text-muted mt-1 font-semibold">
                                {proc.titulo || proc.parteContraria}
                              </p>
                            )}
                          </div>
                          <Eye size={14} className="text-primary opacity-0 group-hover/proc:opacity-100 transition-opacity" />
                        </div>
                      );
                    }
                    return <p className="text-sm text-app-text-muted">Nenhum processo</p>;
                  })()}
                </div>
              )}
            </div>

            {/* Event Link */}
            {selectedEvento.link && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-app-text-muted uppercase flex items-center gap-1">
                  <LinkIcon size={12} /> Link do Evento
                </p>
                <a 
                  href={selectedEvento.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline bg-primary/5 border border-primary/20 p-3 rounded-xl flex items-center justify-between font-semibold"
                >
                  <span className="truncate mr-4">{selectedEvento.link}</span>
                  <ExternalLink size={14} className="shrink-0" />
                </a>
              </div>
            )}

            {/* Observations */}
            {selectedEvento.observacoes && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-app-text-muted uppercase flex items-center gap-1">
                  <Info size={12} /> Observações
                </p>
                <div className="text-sm text-app-text-muted bg-app-bg p-4 rounded-xl border border-app-border leading-relaxed whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                  {selectedEvento.observacoes}
                </div>
              </div>
            )}

            {/* Footer Buttons with Permissions */}
            <div className="pt-4 border-t border-app-border flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-app-secondary border border-app-border text-app-text rounded-xl font-bold hover:bg-app-bg transition-all"
              >
                Fechar
              </button>

              <a
                href={getGoogleCalendarUrl(selectedEvento)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all flex items-center gap-1 shadow-sm"
              >
                <CalendarPlus size={16} /> Google Agenda
              </a>

              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    handleDelete(selectedEvento.id);
                    setIsModalOpen(false);
                  }}
                  className="px-4 py-2 bg-red-500/10 text-red-600 border border-red-500/20 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-all flex items-center gap-1"
                >
                  <Trash2 size={16} /> Excluir
                </button>
              )}

              {canWrite && (
                <button
                  type="button"
                  onClick={() => setModalMode('edit')}
                  className="px-4 py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all flex items-center gap-1 shadow-sm"
                >
                  <Edit2 size={16} /> Editar
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Título do Evento</label>
              <input
                type="text"
                required
                disabled={modalMode === 'view'}
                value={formData.titulo}
                onChange={(e) => setFormData(prev => ({ ...prev, ...{ titulo: e.target.value } }))}
                placeholder="Ex: Audiência de Instrução"
                className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-lg text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Data e Hora</label>
                <input
                  type="datetime-local"
                  required
                  disabled={modalMode === 'view'}
                  value={formData.data}
                  onChange={(e) => setFormData(prev => ({ ...prev, ...{ data: e.target.value } }))}
                  className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-lg text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Tipo</label>
                <select
                  disabled={modalMode === 'view'}
                  value={formData.tipo}
                  onChange={(e) => setFormData(prev => ({ ...prev, ...{ tipo: e.target.value as any } }))}
                  className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-lg text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60"
                >
                  <option value="Prazo">Prazo</option>
                  <option value="Audiência">Audiência</option>
                  <option value="Reunião">Reunião</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
            </div>

            {isGlobalAdmin && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Escritório Responsável *</label>
                <select 
                  required
                  disabled={modalMode === 'view'}
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                  value={formData.escritorioId || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, ...{ escritorioId: e.target.value } }))}
                >
                  <option value="">Selecione um escritório</option>
                  <option value="x">GLOBAL (Todos os Escritórios)</option>
                  {state.escritorios.map(esc => (
                    <option key={esc.id} value={esc.id}>{esc.nome}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Processo Vinculado (Opcional)</label>
              <select
                disabled={modalMode === 'view'}
                value={formData.processoId}
                onChange={(e) => setFormData(prev => ({ ...prev, ...{ processoId: e.target.value } }))}
                className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-lg text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60"
              >
                <option value="">Nenhum processo</option>
                {state.processos.filter(p => {
                  if (escritorioAtivoId && p.escritorioId !== escritorioAtivoId) return false;
                  if (!isAdmin() && !(currentUser?.escritoriosIds || []).includes(p.escritorioId)) return false;
                  return true;
                }).map(p => (
                  <option key={p.id} value={p.id}>{formatCNJ(p.numero)} - {p.titulo || p.parteContraria}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Usuário Responsável (Opcional)</label>
              <select
                disabled={modalMode === 'view'}
                value={formData.usuarioId}
                onChange={(e) => setFormData(prev => ({ ...prev, ...{ usuarioId: e.target.value } }))}
                className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-lg text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60"
              >
                <option value="">Nenhum responsável</option>
                {state.usuarios
                  .filter(u => !escritorioAtivoId || (u.escritoriosIds || []).includes(escritorioAtivoId))
                  .sort((a, b) => a.nome.localeCompare(b.nome))
                  .map(u => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
              </select>
            </div>

            {currentProcesso?.link && (
              <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center text-sm text-primary font-medium">
                  <LinkIcon size={16} className="mr-2" />
                  Link do Processo disponível
                </div>
                <a 
                  href={currentProcesso.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700 transition-colors flex items-center gap-1"
                >
                  Acessar <ExternalLink size={12} />
                </a>
              </div>
            )}

            {formData.link && modalMode === 'view' && (
              <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center text-sm text-primary font-medium">
                  <LinkIcon size={16} className="mr-2" />
                  Link do Evento disponível
                </div>
                <a 
                  href={formData.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700 transition-colors flex items-center gap-1"
                >
                  Acessar <ExternalLink size={12} />
                </a>
              </div>
            )}

            {modalMode !== 'view' && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Link do Evento (Opcional)</label>
                <input
                  type="url"
                  value={formData.link}
                  onChange={(e) => setFormData(prev => ({ ...prev, ...{ link: e.target.value } }))}
                  placeholder="Ex: https://reuniao.zoom.us/j/123..."
                  className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-lg text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Observações</label>
              <textarea
                disabled={modalMode === 'view'}
                rows={3}
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({ ...prev, ...{ observacoes: e.target.value } }))}
                placeholder="Detalhes adicionais sobre o evento..."
                className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-lg text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 resize-none"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  disabled={modalMode === 'view'}
                  checked={formData.concluido}
                  onChange={(e) => setFormData(prev => ({ ...prev, ...{ concluido: e.target.checked } }))}
                  className="sr-only"
                />
                <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${formData.concluido ? 'bg-emerald-500' : 'bg-app-secondary'}`}>
                  <div className={`bg-white w-4 h-4 rounded-full shadow-sm transition-transform ${formData.concluido ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <span className="ml-3 text-sm font-medium text-app-text group-hover:text-primary transition-colors">Concluído</span>
              </label>
            </div>

            {modalMode !== 'view' && (
              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-app-secondary text-app-text rounded-lg hover:bg-app-bg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-colors shadow-sm font-medium"
                >
                  {modalMode === 'create' ? 'Adicionar' : 'Salvar Alterações'}
                </button>
              </div>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}

// Helper to keep the file compiling
const ExternalLink = ({ size, className }: { size: number; className?: string }) => <LinkIcon size={size} className={className} />;
